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

    // Normalize quality to 0-1 range
    const quality = (options.quality || 85) / 100

    const imageServiceResult = await ImageService.compress(
      file,
      id,
      0,
      undefined,
      targetFormat,
      quality,
      options.targetWidth,
      options.targetHeight
    )

    return {
      blob: imageServiceResult.compressedBlob || null,
      format: imageServiceResult.format,
      analysis: imageServiceResult.analysis!,
      resizeApplied: !!(options.targetWidth || options.targetHeight),
      targetSizeMet: true
    }
  }
}
