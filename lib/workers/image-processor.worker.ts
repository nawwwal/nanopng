/**
 * Web Worker for Image Processing
 * Handles heavy quantization and compression tasks off the main thread.
 */
import * as iq from "image-q";
import UPNG from "upng-js";

export interface CompressionJob {
    id: string;
    width: number;
    height: number;
    data: ArrayBuffer; // Raw RGBA data
    options: {
        format: "png" | "jpeg" | "webp" | "avif";
        quality: number; // 0-1
        colors: number; // For PNG quantization (e.g. 256)
        dithering: boolean;
    };
}

export interface CompressionResult {
    id: string;
    success: boolean;
    data?: ArrayBuffer; // Quantized RGBA or Raw data
    width?: number;
    height?: number;
    error?: string;
}

// Listen for messages
self.onmessage = async (e: MessageEvent<CompressionJob>) => {
    const { id, width, height, data, options } = e.data;

    try {
        let resultBuffer: Uint8Array | null = null;
        const inputUint8 = new Uint8ClampedArray(data);

        if (options.format === "png" && options.colors === 0) {
            // LOSSLESS PNG - No quantization, just optimized deflate compression
            // UPNG.encode with colors=0 means lossless (no palette reduction)
            const pngBuffer = UPNG.encode([inputUint8], width, height, 0);
            resultBuffer = new Uint8Array(pngBuffer);

        } else if (options.format === "png" && options.colors <= 256) {
            // LOSSY PNG - Quantize to N colors for smaller file size
            const inPointContainer = iq.utils.PointContainer.fromUint8Array(
                inputUint8,
                width,
                height
            );

            // Palette generation
            const distanceCalculator = new iq.distance.Euclidean();
            const paletteQuantizer = new iq.palette.NeuQuant(distanceCalculator, options.colors);
            paletteQuantizer.sample(inPointContainer);
            const palette = paletteQuantizer.quantizeSync();

            // Dithering
            const imageQuantizer = new iq.image.ErrorDiffusionArray(
                distanceCalculator,
                iq.image.ErrorDiffusionArrayKernel.FloydSteinberg
            );

            // Quantize
            const outPointContainer = imageQuantizer.quantizeSync(inPointContainer, palette);
            resultBuffer = outPointContainer.toUint8Array();

            // Encode as indexed PNG
            const pngBuffer = UPNG.encode([resultBuffer], width, height, options.colors);
            resultBuffer = new Uint8Array(pngBuffer);

        } else {
            // No quantization, just pass through (copy)
            // But wait, if we are not quantizing, we usually rely on main thread Canvas to encode.
            // However, to be consistent, if the worker returns "data", we might need to know IF it's a file or pixels.
            // Current design in ImageService expects "pixels" if it creates ImageData.
            // WE NEED TO CHANGE THIS CONTRACT.

            // New Contract:
            // If success=true, data is:
            // - A PNG FILE BUFFER (if format=png && quantized)
            // - OR RAW PIXELS (if no quantization)
            //
            // Actually, mixing types is confusing.
            // Let's decide: Worker ALWAYS returns "resultBuffer". 
            // If it's PNG, it's a file. If it's other, it's pixels?
            // "options.format" was sent to worker.

            // For now, only PNG path produces a FILE.
            // The Main Thread checks if it's PNG + Quantized -> Blob. 
            // Else -> PutImageData -> Blob.

            resultBuffer = new Uint8Array(inputUint8);
        }

        // Post back the result
        // We use transfer list for zero-copy if possible, but safely we just send the buffer
        (self as any).postMessage({
            id,
            success: true,
            data: resultBuffer.buffer,
            width,
            height
        }, [resultBuffer.buffer]);

    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
