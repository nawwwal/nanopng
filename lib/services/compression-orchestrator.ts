import { ImageService } from "./image-service"
import { CompressionOptions, CompressionResult } from "@/lib/types/compression"

export class CompressionOrchestrator {
  private static instance: CompressionOrchestrator

  private constructor() { }

  static getInstance(): CompressionOrchestrator {
    if (!CompressionOrchestrator.instance) {
      CompressionOrchestrator.instance = new CompressionOrchestrator()
    }
    return CompressionOrchestrator.instance
  }

  async compress(payload: { id: string; file: File; options: CompressionOptions }): Promise<CompressionResult> {
    const { id, file, options } = payload

    // Determine target format
    const targetFormat = options.format === 'auto' ? undefined : options.format

    // Target size in bytes (if specified)
    const targetSizeBytes = options.targetSizeKb ? options.targetSizeKb * 1024 : null

    // Binary search parameters for target size
    let quality = options.quality || 85
    let minQuality = 10 // Don't go below 10%
    let maxQuality = quality
    const maxIterations = 8

    // First pass at requested quality
    let imageServiceResult = await ImageService.compress(
      file,
      id,
      0,
      undefined,
      targetFormat,
      quality / 100,
      options.targetWidth,
      options.targetHeight,
      options.dithering,
      options.chromaSubsampling,
      options.lossless
    )

    // If target size is specified and exceeded, iterate with binary search
    if (targetSizeBytes && imageServiceResult.compressedBlob && imageServiceResult.compressedBlob.size > targetSizeBytes) {
      let iterations = 0

      while (iterations < maxIterations && maxQuality - minQuality > 1) {
        // Binary search: try midpoint
        quality = Math.floor((minQuality + maxQuality) / 2)

        imageServiceResult = await ImageService.compress(
          file,
          id,
          0,
          undefined,
          targetFormat,
          quality / 100,
          options.targetWidth,
          options.targetHeight,
          options.dithering,
          options.chromaSubsampling,
          options.lossless
        )

        const currentSize = imageServiceResult.compressedBlob?.size || 0

        if (currentSize <= targetSizeBytes) {
          // Size is within target, try higher quality to get closer
          minQuality = quality
        } else {
          // Size exceeds target, need lower quality
          maxQuality = quality
        }

        iterations++

        // Early exit if we've hit target
        if (currentSize <= targetSizeBytes && currentSize >= targetSizeBytes * 0.9) {
          break
        }
      }
    }

    const finalSize = imageServiceResult.compressedBlob?.size || 0
    const targetSizeMet = !targetSizeBytes || finalSize <= targetSizeBytes

    return {
      blob: imageServiceResult.compressedBlob || null,
      format: imageServiceResult.format,
      analysis: imageServiceResult.analysis!,
      resizeApplied: !!(options.targetWidth || options.targetHeight),
      targetSizeMet,
      originalWidth: imageServiceResult.originalWidth,
      originalHeight: imageServiceResult.originalHeight,
      width: imageServiceResult.width,
      height: imageServiceResult.height,
    }
  }
}
