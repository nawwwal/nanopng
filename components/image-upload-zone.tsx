"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CompressionResultCard } from "@/components/compression-result-card"
import { compressImageAdvanced } from "@/lib/advanced-image-processor"
import type { CompressedImage } from "@/types/image"
import JSZip from "jszip"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 100 // Increased from 20
const CONCURRENT_UPLOADS = 5 // Increased from 3 for faster processing
const MAX_RETRIES = 3

const ACCEPTED_FORMATS = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/avif": [".avif"], // Added AVIF support
}

export function ImageUploadZone() {
  const [images, setImages] = useState<CompressedImage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCreatingZip, setIsCreatingZip] = useState(false)

  const processImage = async (file: File, placeholderId: string, retryCount = 0): Promise<CompressedImage | null> => {
    const originalSize = file.size
    const originalFormat = file.type.split("/")[1] as "png" | "jpeg" | "webp" | "avif"

    try {
      console.log(`[v0] Starting compression for ${file.name}`)

      // Update status to compressing
      setImages((prev) =>
        prev.map((img) => (img.id === placeholderId ? { ...img, status: "processing" as const, progress: 25 } : img)),
      )

      const originalBlobUrl = URL.createObjectURL(file)

      const { compressedBlob, compressedSize, format } = await compressImageAdvanced(file)

      console.log(`[v0] Compressed ${file.name}: ${originalSize} → ${compressedSize} bytes`)

      const blobUrl = URL.createObjectURL(compressedBlob)

      const savings = ((originalSize - compressedSize) / originalSize) * 100

      const result: CompressedImage = {
        id: placeholderId,
        originalName: file.name,
        originalSize,
        compressedSize,
        compressedBlob,
        blobUrl,
        originalBlobUrl, // Added original blob URL
        savings,
        format: format as "png" | "jpeg" | "webp" | "avif",
        originalFormat,
        status: "success",
        progress: 100,
      }

      setImages((prev) => prev.map((img) => (img.id === placeholderId ? result : img)))

      return result
    } catch (error) {
      console.error(`[v0] Error processing ${file.name}:`, error)

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`[v0] Retrying ${file.name} (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1))) // Exponential backoff
        return processImage(file, placeholderId, retryCount + 1)
      }

      // Max retries reached
      setImages((prev) =>
        prev.map((img) =>
          img.id === placeholderId
            ? {
                ...img,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Compression failed",
              }
            : img,
        ),
      )

      return null
    }
  }

  const processBatch = async (files: File[], placeholders: CompressedImage[]) => {
    const queue = files.map((file, index) => ({ file, placeholderId: placeholders[index].id }))
    const results: (CompressedImage | null)[] = []

    // Process in chunks of CONCURRENT_UPLOADS
    for (let i = 0; i < queue.length; i += CONCURRENT_UPLOADS) {
      const chunk = queue.slice(i, i + CONCURRENT_UPLOADS)
      const chunkResults = await Promise.all(chunk.map(({ file, placeholderId }) => processImage(file, placeholderId)))
      results.push(...chunkResults)
    }

    return results
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} images allowed`)
      return
    }

    setIsProcessing(true)

    // Create placeholder cards
    const placeholders: CompressedImage[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      originalName: file.name,
      originalSize: file.size,
      compressedSize: 0,
      compressedBlob: new Blob(),
      blobUrl: "",
      originalBlobUrl: "", // Added empty original blob URL for placeholder
      savings: 0,
      format: file.type.split("/")[1] as "png" | "jpeg" | "webp" | "avif",
      originalFormat: file.type.split("/")[1],
      status: "queued",
      progress: 0,
    }))

    setImages((prev) => [...prev, ...placeholders])

    // Process in batches
    await processBatch(acceptedFiles, placeholders)

    setIsProcessing(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: MAX_FILES,
  })

  const handleClearAll = () => {
    images.forEach((img) => {
      if (img.blobUrl) {
        URL.revokeObjectURL(img.blobUrl)
      }
      if (img.originalBlobUrl) {
        URL.revokeObjectURL(img.originalBlobUrl)
      }
    })
    setImages([])
  }

  const handleDownloadAll = async () => {
    const successfulImages = images.filter((img) => img.status === "success")

    if (successfulImages.length === 0) {
      alert("No images to download")
      return
    }

    setIsCreatingZip(true)

    try {
      const zip = new JSZip()

      successfulImages.forEach((img) => {
        const fileExtension = img.format === "jpeg" ? "jpg" : img.format
        const filename = `compressed-${img.originalName.replace(/\.[^/.]+$/, "")}.${fileExtension}`
        zip.file(filename, img.compressedBlob)
      })

      const zipBlob = await zip.generateAsync({ type: "blob" })

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `compressed-images-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("[v0] Failed to create ZIP:", error)
      alert("Failed to create ZIP file")
    } finally {
      setIsCreatingZip(false)
    }
  }

  const totalSavings = images
    .filter((img) => img.status === "success")
    .reduce((acc, img) => acc + (img.originalSize - img.compressedSize), 0)
  const totalOriginalSize = images
    .filter((img) => img.status === "success")
    .reduce((acc, img) => acc + img.originalSize, 0)
  const averageSavings = totalOriginalSize > 0 ? (totalSavings / totalOriginalSize) * 100 : 0
  const successfulCount = images.filter((img) => img.status === "success").length

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card
        {...getRootProps()}
        className={`border-2 border-dashed transition-all cursor-pointer ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
        <input {...getInputProps()} />
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {isDragActive ? (
            <p className="text-lg font-medium text-primary">Drop your images here...</p>
          ) : (
            <>
              <p className="text-lg font-medium mb-2">Drop your images here or click to browse</p>
              <p className="text-sm text-muted-foreground mb-4">
                PNG, JPEG, WebP, and AVIF formats • No file size limit • Up to {MAX_FILES} images
              </p>
              <Button variant="outline" className="mt-2 bg-transparent">
                Select Images
              </Button>
            </>
          )}
        </div>
      </Card>

      {isProcessing && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-primary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Compressing images...</span>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Compressed Images ({successfulCount}/{images.length})
              </h2>
              {averageSavings > 0 && (
                <p className="text-sm text-muted-foreground">
                  Average savings:{" "}
                  <span className="text-[var(--chart-2)] font-semibold">{averageSavings.toFixed(1)}%</span> •{" "}
                  {(totalSavings / 1024).toFixed(1)} KB saved
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {successfulCount > 0 && (
                <Button onClick={handleDownloadAll} disabled={isCreatingZip} className="gap-2">
                  {isCreatingZip ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating ZIP...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download All ({successfulCount})
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={handleClearAll}>
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {images.map((image) => (
              <CompressionResultCard key={image.id} image={image} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
