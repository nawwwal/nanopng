/**
 * Web Worker for Image Processing
 * Handles heavy quantization and compression tasks off the main thread.
 */
import * as iq from "image-q";

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

        if (options.format === "png" && options.colors <= 256) {
            // 1. QUANTIZATION (PNG)
            const inPointContainer = iq.utils.PointContainer.fromUint8Array(
                inputUint8,
                width,
                height
            );

            // Palette generation
            const distanceCalculator = new iq.distance.Euclidean();
            const paletteQuantizer = new iq.palette.NeuQuant(distanceCalculator, 256);
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

        } else {
            // No quantization, just pass through (copy)
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
