import { ImageService } from "./image-service"
import { CompressionOptions, CompressionResult, ImageFormat } from "@/lib/types/compression"
import { analyzeImageType, ImageAnalysisResult } from "@/lib/core/image-analyzer"

/** Result of quick probe to determine if full compression is worthwhile */
interface QuickProbeResult {
  shouldSkip: boolean
  estimatedSavings: number
  probeTimeMs: number
  imageAnalysis?: ImageAnalysisResult
}

export class CompressionOrchestrator {
  private static instance: CompressionOrchestrator

  /** Minimum savings threshold to proceed with full compression */
  private static readonly SKIP_THRESHOLD_PERCENT = 3

  private constructor() { }

  static getInstance(): CompressionOrchestrator {
    if (!CompressionOrchestrator.instance) {
      CompressionOrchestrator.instance = new CompressionOrchestrator()
    }
    return CompressionOrchestrator.instance
  }

  /**
   * Quick probe to estimate if full compression is worthwhile.
   * Uses fast presets at reduced resolution (~50%) to quickly test compressibility.
   *
   * @param file - Original image file
   * @param id - Unique identifier for tracking
   * @param targetFormat - Target format for compression
   * @returns Probe result with skip recommendation and estimated savings
   */
  async quickProbe(
    file: File,
    id: string,
    targetFormat?: ImageFormat
  ): Promise<QuickProbeResult> {
    const startTime = performance.now()
    const originalSize = file.size

    try {
      // Decode image to get dimensions and analyze type
      const img = await createImageBitmap(file)
      const oriWidth = img.width
      const oriHeight = img.height

      // Calculate probe dimensions (50% or max 512px on longest side)
      const maxProbeDim = 512
      const scaleFactor = Math.min(
        0.5,
        maxProbeDim / Math.max(oriWidth, oriHeight)
      )
      const probeWidth = Math.max(1, Math.round(oriWidth * scaleFactor))
      const probeHeight = Math.max(1, Math.round(oriHeight * scaleFactor))

      // Get pixel data for image type analysis
      const cvs = new OffscreenCanvas(oriWidth, oriHeight)
      const ctx = cvs.getContext("2d", { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, oriWidth, oriHeight)

      // Analyze image type (photo vs graphic)
      const imageAnalysis = analyzeImageType(imageData.data, oriWidth, oriHeight)

      // Quick probe compression with speed mode enabled and high priority
      const probeResult = await ImageService.compress(
        file,
        `${id}-probe`,
        0,
        undefined,
        targetFormat,
        0.5, // Low quality for probe
        probeWidth,
        probeHeight,
        1.0, // dithering
        true, // chromaSubsampling
        false, // not lossless
        true, // speedMode enabled
        'high', // High priority for fast probe execution
        undefined, // resizeFilter
        false // preserveMetadata - not needed for probe
      )

      const probeSize = probeResult.compressedBlob?.size || originalSize
      const probeTimeMs = performance.now() - startTime

      // Calculate probe's original size (before compression) at probe dimensions
      // This is an estimate based on pixel ratio
      const probePixels = probeWidth * probeHeight
      const originalPixels = oriWidth * oriHeight

      // Probe compression ratio: how much did the probe compress?
      // Use the probe's own input size estimate, not the original file size
      const estimatedProbeInputSize = (probePixels / originalPixels) * originalSize
      const probeCompressionRatio = probeSize / estimatedProbeInputSize

      // Apply same compression ratio to full-size image
      const estimatedFullCompressedSize = originalSize * probeCompressionRatio

      // Calculate savings as percentage
      const estimatedSavings = Math.max(0, ((originalSize - estimatedFullCompressedSize) / originalSize) * 100)

      // Skip if estimated savings below threshold
      const shouldSkip = estimatedSavings < CompressionOrchestrator.SKIP_THRESHOLD_PERCENT

      return {
        shouldSkip,
        estimatedSavings,
        probeTimeMs,
        imageAnalysis
      }
    } catch (error) {
      // On error, proceed with full compression (don't skip)
      return {
        shouldSkip: false,
        estimatedSavings: 100, // Assume compressible
        probeTimeMs: performance.now() - startTime
      }
    }
  }

  /**
   * Determines if quick probe should be used for this compression request.
   * Skip probe for format conversions (where savings are usually significant)
   * and when target size is specified (need exact result).
   */
  private shouldUseQuickProbe(file: File, options: CompressionOptions): boolean {
    // Skip probe if target size specified (need precise compression)
    if (options.targetSizeKb) return false

    // Skip probe for format conversions (usually have significant savings)
    const sourceFormat = this.getSourceFormat(file)
    const targetFormat = options.format === 'auto' ? sourceFormat : options.format

    // Only probe for same-format conversions
    return sourceFormat === targetFormat
  }

  private getSourceFormat(file: File): ImageFormat {
    const type = file.type.toLowerCase()
    if (type.includes('png')) return 'png'
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg'
    if (type.includes('webp')) return 'webp'
    if (type.includes('avif')) return 'avif'
    return 'jpeg' // default
  }

  async compress(payload: { id: string; file: File; options: CompressionOptions }): Promise<CompressionResult> {
    const { id, file, options } = payload

    // Determine target format
    const sourceFormat = this.getSourceFormat(file)
    const targetFormat = options.format === 'auto' ? undefined : options.format
    const effectiveFormat = targetFormat || sourceFormat

    // Skip probe for SVG (not applicable to vector formats)
    // SVG should not go through this orchestrator - handled separately
    // But if it does, just skip the probe
    if (effectiveFormat === 'svg') {
      // SVG optimization is handled by the SVG optimizer worker
      // This orchestrator is for raster image compression only
    }

    // Quick probe for same-format conversions to skip already-optimized images
    let imageAnalysis: ImageAnalysisResult | undefined
    if (effectiveFormat !== 'svg' && this.shouldUseQuickProbe(file, options)) {
      const probeResult = await this.quickProbe(file, id, effectiveFormat as Exclude<ImageFormat, 'svg'>)

      if (probeResult.shouldSkip) {
        // Image is already optimized, return early
        const img = await createImageBitmap(file)
        return {
          blob: file,
          format: effectiveFormat,
          analysis: {
            isPhoto: probeResult.imageAnalysis?.type === 'photo',
            hasTransparency: probeResult.imageAnalysis?.hasTransparency || false,
            complexity: 0.5,
            uniqueColors: probeResult.imageAnalysis?.uniqueColors || 10000,
            suggestedFormat: effectiveFormat
          },
          resizeApplied: false,
          targetSizeMet: true,
          originalWidth: img.width,
          originalHeight: img.height,
          width: img.width,
          height: img.height,
          warning: `Skipped: image already optimized (estimated savings: ${probeResult.estimatedSavings.toFixed(1)}%)`
        }
      }

      imageAnalysis = probeResult.imageAnalysis
    }

    // Determine optimal compression settings based on image type
    let effectiveLossless = options.lossless
    let effectiveQuality = options.quality || 85

    if (imageAnalysis && effectiveFormat === 'png' && effectiveLossless === undefined) {
      // Auto-select lossless vs lossy for PNG based on image type
      // Photos: NEVER use lossless PNG - it produces huge files. Use lossy quantization.
      // Graphics: use lossy (palette reduction works great for flat colors)
      // Mixed: use lossy with higher dithering for smooth gradients
      // Only use lossless for very simple graphics with few colors where quantization would be obvious
      if (imageAnalysis.type === 'photo') {
        effectiveLossless = false  // Photos should NEVER be lossless PNG - they become huge
      } else if (imageAnalysis.type === 'mixed') {
        effectiveLossless = false  // Lossy with dithering handles gradients well
      } else {
        // Graphics: only use lossless if very few unique colors (< 256 means palette is lossless anyway)
        effectiveLossless = imageAnalysis.uniqueColors !== undefined && imageAnalysis.uniqueColors < 256
      }
    }

    if (imageAnalysis && effectiveFormat === 'jpeg') {
      // Photos: enforce minimum quality floor of 70
      // Graphics: can go lower (50+) as artifacts are less visible
      if (imageAnalysis.type === 'photo' && effectiveQuality < 70) {
        effectiveQuality = 70
      }
    }

    // Target size in bytes (if specified)
    const targetSizeBytes = options.targetSizeKb ? options.targetSizeKb * 1024 : null

    // Binary search parameters for target size - quality floor at 1% for hard limit
    let quality = effectiveQuality
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
      effectiveLossless,
      options.speedMode,
      'normal',
      options.resizeFilter,
      options.preserveMetadata,
      options.watermark
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
          effectiveLossless,
          options.speedMode,
          'normal',
          options.resizeFilter,
          options.preserveMetadata,
          options.watermark
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
        quality = effectiveQuality
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
            effectiveLossless,
            options.speedMode,
            'normal',
            options.resizeFilter,
            options.preserveMetadata,
            options.watermark
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

    // Safety check: if output is larger than input, try to reduce or skip
    const originalSize = file.size;
    let finalBlob = imageServiceResult.compressedBlob;
    let usedQuality = quality;

    if (finalBlob && finalBlob.size >= originalSize && !options.targetSizeKb) {
      // Output is larger than input - try iterative quality reduction
      let retryQuality = Math.min(effectiveQuality, 70); // Start lower

      while (finalBlob && finalBlob.size >= originalSize && retryQuality >= 40) {
        retryQuality -= 10;

        const retryResult = await ImageService.compress(
          file,
          id,
          0,
          undefined,
          targetFormat,
          retryQuality / 100,
          currentWidth,
          currentHeight,
          options.dithering,
          options.chromaSubsampling,
          effectiveLossless,
          options.speedMode,
          'normal',
          options.resizeFilter,
          options.preserveMetadata,
          options.watermark
        );

        if (retryResult.compressedBlob && retryResult.compressedBlob.size < finalBlob.size) {
          finalBlob = retryResult.compressedBlob;
          usedQuality = retryQuality;
          imageServiceResult = retryResult;
        }
      }

      // If still larger than original after all retries, return original file
      if (finalBlob && finalBlob.size >= originalSize) {
        const img = await createImageBitmap(file);
        // suggestedFormat excludes 'svg' - use a safe fallback
        const suggestedFmt = effectiveFormat === 'svg' ? 'png' : effectiveFormat;
        return {
          blob: file,
          format: effectiveFormat,
          analysis: imageServiceResult.analysis || {
            isPhoto: true,
            hasTransparency: false,
            complexity: 0.5,
            uniqueColors: 10000,
            suggestedFormat: suggestedFmt
          },
          resizeApplied: false,
          targetSizeMet: true,
          originalWidth: img.width,
          originalHeight: img.height,
          width: img.width,
          height: img.height,
          warning: 'Returned original: already optimized (compression would increase size)'
        };
      }
    }

    return {
      blob: finalBlob || null,
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
