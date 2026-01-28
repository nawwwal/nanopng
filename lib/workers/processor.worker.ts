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
 * Calculate target dimensions for resize based on fit mode.
 * Returns null if no resize is needed.
 * For fit modes that need exact dimensions (fill, cover), returns the target dimensions.
 * The actual fit mode logic is handled in WASM.
 */
function calculateTargetDimensions(
    srcWidth: number,
    srcHeight: number,
    targetWidth: number | undefined,
    targetHeight: number | undefined,
    fitMode: string = "contain"
): { width: number; height: number } | null {
    // If no target dimensions specified, no resize needed
    if (!targetWidth && !targetHeight) return null;

    // Use original dimensions as fallback for unspecified target
    const effectiveWidth = targetWidth || srcWidth;
    const effectiveHeight = targetHeight || srcHeight;

    // For contain/inside modes, skip if image already fits within bounds
    if ((fitMode === "contain" || fitMode === "inside") &&
        srcWidth <= effectiveWidth && srcHeight <= effectiveHeight) {
        return null;
    }

    // Return target dimensions - WASM will handle the fit mode logic
    return { width: effectiveWidth, height: effectiveHeight };
}

// WebP encoder module (loaded at runtime to bypass Webpack)
let webpModule: any = null;

// MozJPEG encoder module for progressive JPEG encoding
let mozjpegModule: any = null;

// Default MozJPEG encoding options (from @jsquash/jpeg/meta.js)
// MozJPEG provides 5-15% smaller files at same quality with:
// - Progressive JPEG encoding (loads blurry to sharp)
// - Trellis quantization for optimal coefficient encoding
// - Optimal Huffman coding tables
const mozjpegDefaultOptions = {
    quality: 75,
    baseline: false,
    arithmetic: false,
    progressive: true,      // Progressive JPEG enabled by default
    optimize_coding: true,  // Optimal Huffman coding
    smoothing: 0,
    color_space: 3,         // YCbCr color space
    quant_table: 3,         // MozJPEG optimized quant tables
    trellis_multipass: false,
    trellis_opt_zero: false,
    trellis_opt_table: false,
    trellis_loops: 1,
    auto_subsample: true,
    chroma_subsample: 2,    // 4:2:0 chroma subsampling
    separate_chroma_quality: false,
    chroma_quality: 75,
};

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

async function initMozJPEGEncoder() {
    if (mozjpegModule) return mozjpegModule;

    try {
        // Load MozJPEG encoder at runtime (bypassing bundler)
        const encoder = await import(/* webpackIgnore: true */ /* @vite-ignore */ getAbsoluteUrl("/wasm/mozjpeg_enc.js"));

        // Initialize Emscripten module with locateFile for WASM loading
        mozjpegModule = await encoder.default({
            noInitialRun: true,
            locateFile: (file: string) => getAbsoluteUrl(`/wasm/${file}`),
        });

        return mozjpegModule;
    } catch (e) {
        console.error("Failed to init MozJPEG encoder:", e);
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

/**
 * Crop RGBA pixel data to the specified region.
 */
function cropPixelData(
    data: Uint8Array,
    width: number,
    x: number,
    y: number,
    cropWidth: number,
    cropHeight: number
): Uint8Array {
    const cropped = new Uint8Array(cropWidth * cropHeight * 4);
    for (let row = 0; row < cropHeight; row++) {
        const srcStart = ((row + y) * width + x) * 4;
        const dstStart = row * cropWidth * 4;
        cropped.set(data.subarray(srcStart, srcStart + cropWidth * 4), dstStart);
    }
    return cropped;
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

        // Apply user crop first if specified (before resize)
        if (opt.crop && opt.crop.width > 0 && opt.crop.height > 0) {
            pixelData = cropPixelData(
                pixelData,
                currentWidth,
                opt.crop.x,
                opt.crop.y,
                opt.crop.width,
                opt.crop.height
            );
            currentWidth = opt.crop.width;
            currentHeight = opt.crop.height;
        }

        // Handle resize using Rust WASM if needed
        // For WebP, we use a simplified resize (WASM handles fit modes for other formats)
        const fitMode = opt.fitMode || "contain";
        const targetDims = calculateTargetDimensions(currentWidth, currentHeight, opt.targetWidth, opt.targetHeight, fitMode);
        if (targetDims) {
            await initWasm();
            // For WebP, we need to handle fit mode in JS since we're using a separate encoder
            // Calculate actual resize dimensions based on fit mode
            const scaleX = targetDims.width / currentWidth;
            const scaleY = targetDims.height / currentHeight;
            let resizeWidth: number;
            let resizeHeight: number;

            if (fitMode === "fill") {
                // Stretch to exact dimensions
                resizeWidth = targetDims.width;
                resizeHeight = targetDims.height;
            } else if (fitMode === "cover" || fitMode === "outside") {
                // Scale to fill/cover - use larger scale
                const scale = Math.max(scaleX, scaleY);
                resizeWidth = Math.max(1, Math.round(currentWidth * scale));
                resizeHeight = Math.max(1, Math.round(currentHeight * scale));
            } else {
                // "contain" or "inside" - scale to fit within bounds
                const scale = Math.min(scaleX, scaleY);
                resizeWidth = Math.max(1, Math.round(currentWidth * scale));
                resizeHeight = Math.max(1, Math.round(currentHeight * scale));
            }

            const resized = wasmModule.resize_only(
                pixelData,
                currentWidth,
                currentHeight,
                resizeWidth,
                resizeHeight,
                opt.resizeFilter || "Lanczos3"
            );

            // For cover mode, crop to target dimensions
            if (fitMode === "cover" && (resizeWidth > targetDims.width || resizeHeight > targetDims.height)) {
                // Center crop
                const cropX = Math.floor((resizeWidth - targetDims.width) / 2);
                const cropY = Math.floor((resizeHeight - targetDims.height) / 2);
                const cropped = new Uint8Array(targetDims.width * targetDims.height * 4);
                for (let row = 0; row < targetDims.height; row++) {
                    const srcStart = ((row + cropY) * resizeWidth + cropX) * 4;
                    const dstStart = row * targetDims.width * 4;
                    cropped.set(resized.subarray(srcStart, srcStart + targetDims.width * 4), dstStart);
                }
                pixelData = cropped;
                currentWidth = targetDims.width;
                currentHeight = targetDims.height;
            } else {
                pixelData = resized;
                currentWidth = resizeWidth;
                currentHeight = resizeHeight;
            }
        }

        // Initialize WebP encoder (runtime loaded)
        const module = await initWebPEncoder();

        // Build encoding options
        const quality = Math.round((opt.quality || 0.8) * 100);
        // In speed mode, use method 0 (fastest) for 2-3x speedup
        const method = opt.speedMode ? 0 : webpDefaultOptions.method;
        // Map webpPreset to image_hint (0=photo, 1=picture, 2=graph)
        const imageHintMap: Record<string, number> = { photo: 0, picture: 1, graph: 2 };

        // Determine lossless and near_lossless settings
        let losslessFlag = 0;
        let nearLosslessValue = 100;

        if (opt.webpLosslessMode === 'lossless') {
            losslessFlag = 1;
            nearLosslessValue = 100;
        } else if (opt.webpLosslessMode === 'near-lossless') {
            losslessFlag = 1;
            nearLosslessValue = opt.nearLosslessLevel ?? 60;
        } else {
            // lossy mode (default)
            losslessFlag = opt.lossless ? 1 : 0;
        }

        const encodeOptions = {
            ...webpDefaultOptions,
            quality,
            lossless: losslessFlag,
            method,
            image_hint: opt.webpPreset ? imageHintMap[opt.webpPreset] : 0,
            near_lossless: nearLosslessValue,
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

/**
 * Process JPEG using MozJPEG for progressive encoding and better compression.
 * MozJPEG provides:
 * - Progressive JPEG encoding (loads blurry to sharp)
 * - Trellis quantization for optimal coefficient encoding
 * - 5-15% smaller files at same quality
 */
async function processJPEG(
    data: Uint8Array,
    width: number,
    height: number,
    opt: CompressionOptions
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
    try {
        let pixelData = data;
        let currentWidth = width;
        let currentHeight = height;

        // Apply user crop first if specified (before resize)
        if (opt.crop && opt.crop.width > 0 && opt.crop.height > 0) {
            pixelData = cropPixelData(
                pixelData,
                currentWidth,
                opt.crop.x,
                opt.crop.y,
                opt.crop.width,
                opt.crop.height
            );
            currentWidth = opt.crop.width;
            currentHeight = opt.crop.height;
        }

        // Handle resize using Rust WASM if needed
        const fitMode = opt.fitMode || "contain";
        const targetDims = calculateTargetDimensions(currentWidth, currentHeight, opt.targetWidth, opt.targetHeight, fitMode);
        if (targetDims) {
            await initWasm();
            // Calculate actual resize dimensions based on fit mode
            const scaleX = targetDims.width / currentWidth;
            const scaleY = targetDims.height / currentHeight;
            let resizeWidth: number;
            let resizeHeight: number;

            if (fitMode === "fill") {
                // Stretch to exact dimensions
                resizeWidth = targetDims.width;
                resizeHeight = targetDims.height;
            } else if (fitMode === "cover" || fitMode === "outside") {
                // Scale to fill/cover - use larger scale
                const scale = Math.max(scaleX, scaleY);
                resizeWidth = Math.max(1, Math.round(currentWidth * scale));
                resizeHeight = Math.max(1, Math.round(currentHeight * scale));
            } else {
                // "contain" or "inside" - scale to fit within bounds
                const scale = Math.min(scaleX, scaleY);
                resizeWidth = Math.max(1, Math.round(currentWidth * scale));
                resizeHeight = Math.max(1, Math.round(currentHeight * scale));
            }

            const resized = wasmModule.resize_only(
                pixelData,
                currentWidth,
                currentHeight,
                resizeWidth,
                resizeHeight,
                opt.resizeFilter || "Lanczos3"
            );

            // For cover mode, crop to target dimensions
            if (fitMode === "cover" && (resizeWidth > targetDims.width || resizeHeight > targetDims.height)) {
                // Center crop
                const cropX = Math.floor((resizeWidth - targetDims.width) / 2);
                const cropY = Math.floor((resizeHeight - targetDims.height) / 2);
                const cropped = new Uint8Array(targetDims.width * targetDims.height * 4);
                for (let row = 0; row < targetDims.height; row++) {
                    const srcStart = ((row + cropY) * resizeWidth + cropX) * 4;
                    const dstStart = row * targetDims.width * 4;
                    cropped.set(resized.subarray(srcStart, srcStart + targetDims.width * 4), dstStart);
                }
                pixelData = cropped;
                currentWidth = targetDims.width;
                currentHeight = targetDims.height;
            } else {
                pixelData = resized;
                currentWidth = resizeWidth;
                currentHeight = resizeHeight;
            }
        }

        // Initialize MozJPEG encoder
        const module = await initMozJPEGEncoder();

        // Build encoding options
        const quality = Math.round((opt.quality || 0.8) * 100);
        const progressive = opt.progressive ?? true;

        // Chroma subsampling: 2 = 4:2:0 (smaller), 1 = 4:4:4 (better quality)
        const chromaSubsample = opt.chromaSubsampling !== false ? 2 : 1;

        const encodeOptions = {
            ...mozjpegDefaultOptions,
            quality,
            progressive,
            chroma_subsample: chromaSubsample,
            // Use auto_subsample to let MozJPEG optimize based on content
            auto_subsample: opt.chromaSubsampling !== false,
        };

        // MozJPEG expects ImageData-like object with data, width, height
        // The encode function expects RGBA data and will convert to RGB internally
        const imageData = {
            data: pixelData,
            width: currentWidth,
            height: currentHeight,
        };

        // Encode using the Emscripten module
        const result = module.encode(imageData.data, imageData.width, imageData.height, encodeOptions);
        if (!result) {
            throw new Error("MozJPEG encoding failed");
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

        // Route WebP to JS encoder
        if (opt.format === 'webp') {
            return processWebP(data, width, height, opt);
        }

        // Route JPEG to MozJPEG for progressive encoding and better compression
        // MozJPEG provides 5-15% smaller files with progressive loading
        if (opt.format === 'jpeg') {
            return processJPEG(data, width, height, opt);
        }

        // PNG and AVIF use Rust WASM encoder
        await initWasm();

        try {
            // Calculate target dimensions based on fit mode
            const fitMode = opt.fitMode || "contain";
            const targetDims = calculateTargetDimensions(width, height, opt.targetWidth, opt.targetHeight, fitMode);

            const config = {
                // JPEG and WebP are handled above, so this is only PNG or AVIF
                format: opt.format === 'png' ? 'Png' :
                    opt.format === 'avif' ? 'Avif' : 'Png',
                quality: Math.round((opt.quality || 0.8) * 100),
                transparent: true,
                lossless: opt.lossless || false,
                dithering: opt.dithering || 1.0,
                resize: targetDims ? {
                    width: targetDims.width,
                    height: targetDims.height,
                    filter: opt.resizeFilter || "Lanczos3",
                    fit_mode: fitMode
                } : null,
                chroma_subsampling: opt.chromaSubsampling !== false,
                speed_mode: opt.speedMode || false,
                avif_speed: opt.avifSpeed ?? 6,
                avif_bit_depth: opt.avifBitDepth ?? 8,
                progressive: opt.progressive ?? true,
                sharpen: (opt.sharpen || 0) / 100,  // Convert 0-100 to 0.0-1.0
                rotate: opt.rotate || 0,
                flip_h: opt.flipH || false,
                flip_v: opt.flipV || false,
                auto_trim: opt.autoTrim || false,
                auto_trim_threshold: Math.round((opt.autoTrimThreshold ?? 10) * 2.55),  // Convert 0-100 to 0-255
                crop: opt.crop ? {
                    x: opt.crop.x,
                    y: opt.crop.y,
                    width: opt.crop.width,
                    height: opt.crop.height,
                } : null,
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
