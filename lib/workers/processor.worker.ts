import * as Comlink from "comlink";
import type { CompressionOptions } from "@/lib/types/compression";

// Define the API exposed by the worker
export interface ProcessorAPI {
    processImage(
        id: string,
        width: number,
        height: number,
        opt: CompressionOptions,
        sharedBuffer: SharedArrayBuffer // Input pixels
    ): Promise<{
        success: boolean;
        data?: Uint8Array; // Output file
        error?: string;
    }>;
}

let wasmModule: any = null;

// Lazy load WebP encoder
let webpEncoder: typeof import('@/lib/codecs/webp-encoder') | null = null;

async function getWebPEncoder() {
    if (!webpEncoder) {
        webpEncoder = await import('@/lib/codecs/webp-encoder');
    }
    return webpEncoder;
}

async function initWasm() {
    if (wasmModule) return;

    try {
        // @ts-expect-error - Runtime dynamic import bypasses Webpack
        const wasm = await import(/* webpackIgnore: true */ "/wasm/nanopng_core.js");
        await wasm.default("/wasm/nanopng_core_bg.wasm");
        wasmModule = wasm;
    } catch (e) {
        console.error("Failed to init Wasm:", e);
        throw e;
    }
}

async function processWebP(
    data: Uint8Array,
    width: number,
    height: number,
    opt: CompressionOptions
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
    try {
        let pixelData = data;
        let currentWidth = width;
        let currentHeight = height;

        // Handle resize using Rust WASM if needed
        if (opt.targetWidth && opt.targetHeight) {
            await initWasm();
            const resized = wasmModule.resize_only(
                data,
                width,
                height,
                opt.targetWidth,
                opt.targetHeight,
                "Lanczos3"
            );
            pixelData = resized;
            currentWidth = opt.targetWidth;
            currentHeight = opt.targetHeight;
        }

        const encoder = await getWebPEncoder();
        const quality = Math.round((opt.quality || 0.8) * 100);
        const result = await encoder.encodeToWebP(pixelData, currentWidth, currentHeight, {
            quality,
            lossless: opt.lossless || false
        });

        return { success: true, data: result };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err)
        };
    }
}

const api: ProcessorAPI = {
    async processImage(id, width, height, opt, sharedBuffer) {
        const data = new Uint8Array(sharedBuffer);

        // Route WebP to JS encoder, others to Rust WASM
        if (opt.format === 'webp') {
            return processWebP(data, width, height, opt);
        }

        await initWasm();

        try {
            const config = {
                format: opt.format === 'jpg' ? 'Jpeg' :
                    opt.format === 'png' ? 'Png' :
                        opt.format === 'avif' ? 'Avif' : 'Jpeg',
                quality: Math.round((opt.quality || 0.8) * 100),
                transparent: true,
                lossless: opt.lossless || false,
                dithering: opt.dithering || 1.0,
                resize: opt.targetWidth && opt.targetHeight ? {
                    width: opt.targetWidth,
                    height: opt.targetHeight,
                    filter: "Lanczos3"
                } : null,
                chroma_subsampling: opt.chromaSubsampling !== false
            };

            const result: Uint8Array = wasmModule.process_image(data, width, height, config);

            return {
                success: true,
                data: result
            };

        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    }
};

Comlink.expose(api);
