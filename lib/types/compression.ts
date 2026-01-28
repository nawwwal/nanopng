import { CompressedImage, ImageAnalysis } from "@/types/image"

export type CompressionStatus = "queued" | "analyzing" | "compressing" | "completed" | "error" | "already-optimized"

export type OutputFormat = "auto" | "png" | "jpeg" | "webp" | "avif" | "svg"

// Basic types
export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "svg"

// Resize filter types
export type ResizeFilter = "Lanczos3" | "Mitchell" | "Bilinear" | "Nearest"

// Fit modes for resize
export type FitMode = "contain" | "cover" | "fill" | "inside" | "outside"

// WebP lossless mode
export type WebpLosslessMode = "lossy" | "near-lossless" | "lossless"

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
  // Speed optimization options
  speedMode?: boolean // true = fast encoding presets for speed
  avifSpeed?: number // AVIF encoder speed (0-10, higher = faster, default 6)
  avifBitDepth?: 8 | 10 // AVIF bit depth (default: 8)
  // Resize options
  resizeFilter?: ResizeFilter // Resize algorithm (default: Lanczos3)
  fitMode?: FitMode // How to fit image in target dimensions (default: contain)
  // Metadata options
  preserveMetadata?: boolean // Keep EXIF, GPS, color profile data (default: false for privacy)
  // WebP options
  webpPreset?: "photo" | "picture" | "graph" // WebP image_hint (default: photo)
  webpLosslessMode?: WebpLosslessMode // WebP compression mode (default: lossy)
  nearLosslessLevel?: number // Near-lossless quality 0-100 (default: 60)
  // JPEG options
  progressive?: boolean // Progressive JPEG encoding (loads blurry to sharp, default: true)
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
  warning?: string
}

export { type CompressedImage, type ImageAnalysis }
