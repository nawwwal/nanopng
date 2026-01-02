export type CompressionStatus =
  | "queued"
  | "analyzing"
  | "compressing"
  | "completed"
  | "already-optimized"
  | "error"

export type ImageFormat = "png" | "jpeg" | "webp" | "avif"
export type OriginalFormat = "png" | "jpeg" | "webp" | "avif" | "heic" | "heif"
export type FormatPreference = "smart" | "keep" | ImageFormat

export interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  compressedBlob?: Blob | File
  blobUrl?: string
  originalBlobUrl?: string
  savings: number
  format: ImageFormat
  status: CompressionStatus
  error?: string
  progress?: number
  originalFormat?: OriginalFormat
  analysis?: ImageAnalysis
  /** User's format preference for this image - defaults to "smart" */
  formatPreference?: FormatPreference
}

export interface ImageAnalysis {
  isPhoto: boolean
  hasTransparency: boolean
  complexity: number
  uniqueColors: number
  suggestedFormat: "png" | "jpeg" | "webp" | "avif"
}
