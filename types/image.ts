export interface CompressedImage {
  id: string
  originalName: string
  originalSize: number
  compressedSize: number
  compressedUrl: string
  savings: number
  format: "png" | "jpeg" | "webp" | "avif"
  status: "success" | "error" | "processing" | "uploading"
  error?: string
  progress?: number
  originalFormat?: string
}
