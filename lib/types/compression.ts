import { CompressedImage, ImageAnalysis, ImageFormat } from "@/types/image"

export type CompressionStatus = "queued" | "analyzing" | "compressing" | "completed" | "error" | "already-optimized"

export type OutputFormat = "auto" | "png" | "jpeg" | "webp" | "avif"

export interface CompressionOptions {
  quality: number
  format: OutputFormat
  targetWidth?: number
  targetHeight?: number
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
