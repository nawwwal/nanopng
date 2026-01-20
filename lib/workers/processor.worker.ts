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

// Initialize Wasm module
async function initWasm() {
    if (wasmModule) return;
    try {
        // Dynamic import of the generated Wasm glue code
        // We rely on 'wasm-pack' output being in public/wasm or similar, but
        // in Next.js with asyncWebAssembly, we can import the pkg directly if installed,
        // OR import from a relative path if built into the source tree.
        // User plan says: built to `public/wasm`.
        // However, loading Wasm from 'public' in a Worker via standard import is tricky in Next.js webpack.
        // Best practice: Import the `pkg` module directly if it's in the src tree or node_modules.
        // But we are manually building to `public/wasm`.
        // So we use standard fetch-based instantiation or the generated init function.

        // Let's assume we import the generated JS file which handles Wasm loading.
        // import init, { process_image } from "../../../public/wasm/nanopng_core.js";

        // But `public` is not in src. using explicit URL.
        // Actually, easiest way with Next.js is to put the pkg in `lib/pkg` or similar and import it.
        // But let's follow the plan: `public/wasm`.

        // We can't import strictly from public in source.
        // We will fallback to `fetch` instantiation if needed, but `wasm-bindgen` generated code usually handles it.
        // Since we haven't built it yet, we can't import it.
        // I will write this assuming the standard `wasm-bindgen` loading pattern:
        // `import init, * as wasm from ...`

        // To make this work "out of the box" with the build stepping,
        // we'll assume the user copies the wasm pkg to a resolvable location or we use the URL.

        // NOTE: For this to work in dev without build, we need the files.
        // I will write the code to use a dynamic import from a known location where we will output the build.
        // Let's decided to output build to `lib/wasm-pkg`? No, stick to `public`.

        // Current workaround: use `importScripts` or dynamic import of the glue JS.
        // @ts-ignore - Wasm module loaded at runtime from public folder
        const wasm = await import("/wasm/nanopng_core.js" /* webpackIgnore: true */);
        await wasm.default("/wasm/nanopng_core_bg.wasm");
        wasmModule = wasm;

    } catch (e) {
        console.error("Failed to init Wasm:", e);
        throw e;
    }
}

const api: ProcessorAPI = {
    async processImage(id, width, height, opt, sharedBuffer) {
        await initWasm();

        try {
            // 1. View the SharedArrayBuffer
            // We need a Uint8Array view
            const data = new Uint8Array(sharedBuffer);

            // 2. Prepare Config
            // Map JS options to Rust Config struct
            // Note: we need to match the Rust struct fields EXACTLY (snake_case usually for serde)
            const config = {
                format: opt.format === 'jpg' ? 'Jpeg' :
                    opt.format === 'png' ? 'Png' :
                        opt.format === 'avif' ? 'Avif' :
                            opt.format === 'webp' ? 'WebP' : 'Jpeg', // Fallback
                quality: Math.round((opt.quality || 0.8) * 100),
                transparent: true,
                lossless: opt.lossless || false,
                dithering: opt.dithering || 1.0,
                resize: opt.targetWidth && opt.targetHeight ? {
                    width: opt.targetWidth,
                    height: opt.targetHeight,
                    filter: "Lanczos3"
                } : null,
                chroma_subsampling: opt.chromaSubsampling !== false // Default true (4:2:0)
            };

            // 3. Call Rust
            // We pass the data slice. Rust will clone it if needed or process in place?
            // process_image declaration: fn process_image(data: &mut [u8], ...) -> Vec<u8>
            // We pass `data` which is `Uint8Array` backed by SharedArrayBuffer.
            // `wasm-bindgen` supports `&mut [u8]` from `Uint8Array`.
            // However, SharedArrayBuffer might have concurrency issues if we write back.
            // But here we just read primarily (except for resize which we handle internally in Rust by creating new buf).

            // Important: `process_image` takes `&mut [u8]`.
            // If we want zero-copy into Wasm memory, we usually need to copy to Wasm memory first 
            // OR use `Memory` view. 
            // `wasm-bindgen` automatically copies `Uint8Array` into Wasm memory for `&[u8]` arguments usually.
            // True Zero-Copy with SharedBuffer requires unsafe Wasm memory access.
            // For MVP, letting bindgen copy (once) is acceptable and still faster than pure JS.

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
