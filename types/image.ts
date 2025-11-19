export type CompressionStatus =
  | "queued"
  | "analyzing"
  | "compressing"
  | "completed"
  | "already-optimized"
  | "error"

export interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  compressedBlob?: Blob
  blobUrl?: string
  originalBlobUrl?: string
  savings: number
  format: "png" | "jpeg" | "webp" | "avif"
  status: CompressionStatus
  error?: string
  progress?: number
  originalFormat?: string
  analysis?: ImageAnalysis
}

export interface ImageAnalysis {
  isPhoto: boolean
  hasTransparency: boolean
  complexity: number
  uniqueColors: number
  suggestedFormat: "png" | "jpeg" | "webp" | "avif"
}
