export interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  compressedBlob: Blob
  blobUrl: string
  originalBlobUrl: string
  savings: number
  format: "png" | "jpeg" | "webp" | "avif"
  status: "success" | "error" | "processing" | "queued"
  error?: string
  progress?: number
  originalFormat?: string
}
