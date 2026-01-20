import { CompressedImage, ImageAnalysis } from "@/types/image"

export type CompressionStatus = "queued" | "analyzing" | "compressing" | "completed" | "error" | "already-optimized"

export type OutputFormat = "auto" | "png" | "jpeg" | "webp" | "avif"

// Basic types
export type ImageFormat = "jpeg" | "png" | "webp" | "avif"

export interface CompressionOptions {
  format: ImageFormat | "auto"
  quality: number // 0-100
  targetWidth?: number
  targetHeight?: number
  // Advanced options
  dithering?: number // 0.0 - 1.0 (for PNG)
  chromaSubsampling?: boolean // true = 4:2:0, false = 4:4:4 (for JPEG)
  lossless?: boolean // Force lossless (PNG/WebP)
  targetSizeKb?: number
}

export interface CompressionResult {
  blob: Blob | null
  format: string
  analysis: ImageAnalysis
  resizeApplied: boolean
  targetSizeMet: boolean
  originalWidth?: number
  originalHeight?: number
  width?: number
  height?: number
}

export { type CompressedImage, type ImageAnalysis }
