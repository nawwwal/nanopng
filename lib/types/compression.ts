import { CompressedImage, ImageAnalysis } from "@/types/image"

export type CompressionStatus = "queued" | "analyzing" | "compressing" | "completed" | "error" | "already-optimized"

export type OutputFormat = "auto" | "png" | "jpeg" | "webp" | "avif" | "svg" | "jxl"

// Basic types
export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "svg" | "gif" | "tiff" | "bmp" | "jxl"

// Resize filter types
export type ResizeFilter = "Lanczos3" | "Mitchell" | "Bilinear" | "Nearest"

// Fit modes for resize
export type FitMode = "contain" | "cover" | "fill" | "inside" | "outside"

// Rotation angle (clockwise)
export type RotationAngle = 0 | 90 | 180 | 270

// Crop region
export interface CropRegion {
  x: number      // Left offset in pixels
  y: number      // Top offset in pixels
  width: number  // Crop width in pixels
  height: number // Crop height in pixels
}

// Watermark position
export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center"

// Watermark options
export interface WatermarkOptions {
  text: string              // Watermark text
  position: WatermarkPosition
  opacity: number           // 0-100
  fontSize: number          // Font size in pixels (default: 24)
  color: string             // Hex color (default: "#ffffff")
}

// Preset aspect ratios for crop
export type CropAspectRatio = "free" | "1:1" | "16:9" | "4:3" | "3:2"

// Transform options
export interface TransformOptions {
  rotate?: RotationAngle  // Rotation in degrees clockwise
  flipH?: boolean         // Flip horizontally
  flipV?: boolean         // Flip vertically
}

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
  // JPEG-XL options (experimental)
  jxlEffort?: number // JXL encoding effort (1-9, higher = slower but better, default: 7)
  jxlProgressive?: boolean // JXL progressive encoding (default: false)
  // Transform options
  rotate?: RotationAngle  // Rotation in degrees clockwise (0, 90, 180, 270)
  flipH?: boolean         // Flip horizontally
  flipV?: boolean         // Flip vertically
  // Filter options
  sharpen?: number // Sharpen amount 0-100 (0 = off, default: 0)
  blur?: number // Blur amount 0-100 (0 = off, default: 0)
  // Auto-trim options
  autoTrim?: boolean          // Auto-trim whitespace borders
  autoTrimThreshold?: number  // Color difference threshold 0-100 (default: 10)
  // Crop options
  crop?: CropRegion           // Crop region to apply before other operations
  // Watermark options
  watermark?: WatermarkOptions // Text watermark to overlay on image
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
