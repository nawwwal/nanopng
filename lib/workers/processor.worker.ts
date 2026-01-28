import * as Comlink from "comlink";
import type { CompressionOptions } from "@/lib/types/compression";

// Define the API exposed by the worker
export interface ProcessorAPI {
    /**
     * Process and compress an image with the given options.
     * @param id - Unique identifier for the image
     * @param width - Width of the input image in pixels
     * @param height - Height of the input image in pixels
     * @param opt - Compression options
     * @param opt.quality - Quality level from 0.0 to 1.0
     * @param sharedBuffer - SharedArrayBuffer containing input pixel data (RGBA)
     * @returns Promise with success status and compressed data or error
     */
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

/**
 * Calculate dimensions that fit within maxWidth x maxHeight while preserving aspect ratio.
 * Only resizes if the image is larger than the bounds.
 * Returns null if no resize is needed.
 */
function calculateFitDimensions(
    srcWidth: number,
    srcHeight: number,
    maxWidth: number | undefined,
    maxHeight: number | undefined
): { width: number; height: number } | null {
    // If no max dimensions specified, no resize needed
    if (!maxWidth && !maxHeight) return null;

    // Use original dimensions as fallback for unspecified max
    const effectiveMaxWidth = maxWidth || srcWidth;
    const effectiveMaxHeight = maxHeight || srcHeight;

    // If image already fits within bounds, no resize needed
    if (srcWidth <= effectiveMaxWidth && srcHeight <= effectiveMaxHeight) {
        return null;
    }

    // Calculate scale factors for each dimension
    const scaleX = effectiveMaxWidth / srcWidth;
    const scaleY = effectiveMaxHeight / srcHeight;

    // Use the smaller scale to ensure image fits within both bounds
    const scale = Math.min(scaleX, scaleY);

    // Calculate new dimensions, ensuring at least 1px
    const newWidth = Math.max(1, Math.round(srcWidth * scale));
    const newHeight = Math.max(1, Math.round(srcHeight * scale));

    return { width: newWidth, height: newHeight };
}

// WebP encoder module (loaded at runtime to bypass Webpack)
let webpModule: any = null;

// Default WebP encoding options (from @jsquash/webp/meta.js)
const webpDefaultOptions = {
    quality: 75,
    target_size: 0,
    target_PSNR: 0,
    method: 4,
    sns_strength: 50,
    filter_strength: 60,
    filter_sharpness: 0,
    filter_type: 1,
    partitions: 0,
    segments: 4,
    pass: 1,
    show_compressed: 0,
    preprocessing: 0,
    autofilter: 0,
    partition_limit: 0,
    alpha_compression: 1,
    alpha_filtering: 1,
    alpha_quality: 100,
    lossless: 0,
    exact: 0,
    image_hint: 0,
    emulate_jpeg_size: 0,
    thread_level: 0,
    low_memory: 0,
    near_lossless: 100,
    use_delta_palette: 0,
    use_sharp_yuv: 0,
};

// Helper to get absolute URL for worker context
function getAbsoluteUrl(relativePath: string): string {
    // Fallback for worker contexts where location.origin may not exist
    const origin = typeof self !== 'undefined' && self.location?.origin
        ? self.location.origin
        : ''
    return `${origin}${relativePath}`
}

async function initWebPEncoder() {
    if (webpModule) return webpModule;

    try {
        // Load wasm-feature-detect at runtime (bypassing bundler)
        const wasmFeatureDetect = await import(/* webpackIgnore: true */ /* @vite-ignore */ getAbsoluteUrl("/wasm/wasm-feature-detect.js"));
        const hasSIMD = await wasmFeatureDetect.simd();

        // Load appropriate encoder based on SIMD support
        const encoderPath = hasSIMD ? "/wasm/webp_enc_simd.js" : "/wasm/webp_enc.js";
        const encoder = await import(/* webpackIgnore: true */ /* @vite-ignore */ getAbsoluteUrl(encoderPath));

        // Initialize Emscripten module with locateFile for WASM loading
        webpModule = await encoder.default({
            noInitialRun: true,
            locateFile: (file: string) => getAbsoluteUrl(`/wasm/${file}`),
        });

        return webpModule;
    } catch (e) {
        console.error("Failed to init WebP encoder:", e);
        throw e;
    }
}

async function initWasm() {
    if (wasmModule) return;

    try {
        const wasm = await import(/* webpackIgnore: true */ /* @vite-ignore */ getAbsoluteUrl("/wasm/nanopng_core.js"));
        await wasm.default(getAbsoluteUrl("/wasm/nanopng_core_bg.wasm"));
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

        // Handle resize using Rust WASM if needed (fit within bounds, preserve aspect ratio)
        const fitDimensions = calculateFitDimensions(width, height, opt.targetWidth, opt.targetHeight);
        if (fitDimensions) {
            await initWasm();
            const resized = wasmModule.resize_only(
                data,
                width,
                height,
                fitDimensions.width,
                fitDimensions.height,
                opt.resizeFilter || "Lanczos3"
            );
            pixelData = resized;
            currentWidth = fitDimensions.width;
            currentHeight = fitDimensions.height;
        }

        // Initialize WebP encoder (runtime loaded)
        const module = await initWebPEncoder();

        // Build encoding options
        const quality = Math.round((opt.quality || 0.8) * 100);
        // In speed mode, use method 0 (fastest) for 2-3x speedup
        const method = opt.speedMode ? 0 : webpDefaultOptions.method;
        const encodeOptions = {
            ...webpDefaultOptions,
            quality,
            lossless: opt.lossless ? 1 : 0,
            method,
        };

        // Encode using the Emscripten module
        const result = module.encode(pixelData, currentWidth, currentHeight, encodeOptions);
        if (!result) {
            throw new Error("WebP encoding failed");
        }

        return { success: true, data: new Uint8Array(result.buffer) };
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
            // Calculate aspect-ratio-preserving resize dimensions
            const fitDimensions = calculateFitDimensions(width, height, opt.targetWidth, opt.targetHeight);

            const config = {
                format: opt.format === 'jpeg' ? 'Jpeg' :
                    opt.format === 'png' ? 'Png' :
                        opt.format === 'avif' ? 'Avif' : 'Jpeg',
                quality: Math.round((opt.quality || 0.8) * 100),
                transparent: true,
                lossless: opt.lossless || false,
                dithering: opt.dithering || 1.0,
                resize: fitDimensions ? {
                    width: fitDimensions.width,
                    height: fitDimensions.height,
                    filter: opt.resizeFilter || "Lanczos3"
                } : null,
                chroma_subsampling: opt.chromaSubsampling !== false,
                speed_mode: opt.speedMode || false,
                avif_speed: opt.avifSpeed ?? 6
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
