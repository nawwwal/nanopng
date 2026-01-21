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

    // Binary search parameters for target size - quality floor at 1% for hard limit
    let quality = options.quality || 85
    let minQuality = 1 // Go all the way down to 1% for hard limit
    let maxQuality = quality
    const maxIterations = 12 // More iterations for precision

    // Track current dimensions for resize fallback
    let currentWidth = options.targetWidth
    let currentHeight = options.targetHeight
    let resizeAttempts = 0
    let warning: string | undefined

    // First pass at requested quality
    let imageServiceResult = await ImageService.compress(
      file,
      id,
      0,
      undefined,
      targetFormat,
      quality / 100,
      currentWidth,
      currentHeight,
      options.dithering,
      options.chromaSubsampling,
      options.lossless
    )

    // If target size is specified and exceeded, iterate with binary search
    if (targetSizeBytes && imageServiceResult.compressedBlob && imageServiceResult.compressedBlob.size > targetSizeBytes) {
      let iterations = 0

      // Binary search for optimal quality
      while (iterations < maxIterations && maxQuality - minQuality > 1) {
        quality = Math.floor((minQuality + maxQuality) / 2)

        imageServiceResult = await ImageService.compress(
          file,
          id,
          0,
          undefined,
          targetFormat,
          quality / 100,
          currentWidth,
          currentHeight,
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
      }

      // After binary search, if still exceeds target, try resize fallback
      let currentSize = imageServiceResult.compressedBlob?.size || 0
      const maxResizeAttempts = 3

      while (currentSize > targetSizeBytes && resizeAttempts < maxResizeAttempts) {
        resizeAttempts++

        // Get current dimensions from result or original
        const baseWidth = imageServiceResult.width || imageServiceResult.originalWidth || 1920
        const baseHeight = imageServiceResult.height || imageServiceResult.originalHeight || 1080

        // Scale down by 25%
        currentWidth = Math.round(baseWidth * 0.75)
        currentHeight = Math.round(baseHeight * 0.75)

        // Ensure minimum dimensions
        currentWidth = Math.max(currentWidth, 100)
        currentHeight = Math.max(currentHeight, 100)

        // Reset quality search for new dimensions
        quality = options.quality || 85
        minQuality = 1
        maxQuality = quality
        iterations = 0

        // Binary search again at smaller size
        while (iterations < maxIterations && maxQuality - minQuality > 1) {
          quality = Math.floor((minQuality + maxQuality) / 2)

          imageServiceResult = await ImageService.compress(
            file,
            id,
            0,
            undefined,
            targetFormat,
            quality / 100,
            currentWidth,
            currentHeight,
            options.dithering,
            options.chromaSubsampling,
            options.lossless
          )

          currentSize = imageServiceResult.compressedBlob?.size || 0

          if (currentSize <= targetSizeBytes) {
            minQuality = quality
          } else {
            maxQuality = quality
          }

          iterations++
        }

        currentSize = imageServiceResult.compressedBlob?.size || 0
      }

      // Set warning if we had to resize
      if (resizeAttempts > 0) {
        warning = `Image was resized to ${currentWidth}x${currentHeight} to meet target size`
      }
    }

    const finalSize = imageServiceResult.compressedBlob?.size || 0
    const targetSizeMet = !targetSizeBytes || finalSize <= targetSizeBytes

    // Add warning if target still not met after all attempts
    if (!targetSizeMet) {
      warning = `Could not meet target size of ${options.targetSizeKb}KB (best: ${Math.round(finalSize / 1024)}KB)`
    }

    return {
      blob: imageServiceResult.compressedBlob || null,
      format: imageServiceResult.format,
      analysis: imageServiceResult.analysis!,
      resizeApplied: !!(options.targetWidth || options.targetHeight) || resizeAttempts > 0,
      targetSizeMet,
      originalWidth: imageServiceResult.originalWidth,
      originalHeight: imageServiceResult.originalHeight,
      width: imageServiceResult.width,
      height: imageServiceResult.height,
      warning,
    }
  }
}
