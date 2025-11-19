"use client"

import { useState, useCallback, useReducer, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CompressionResultCard } from "@/components/compression-result-card"
import { ImageService } from "@/lib/services/image-service"
import type { CompressedImage, CompressionStatus } from "@/types/image"
import JSZip from "jszip"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILES = 100
const CONCURRENT_PROCESSING = 3

const ACCEPTED_FORMATS = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
}

// --- Reducer State Management ---

type State = {
  images: CompressedImage[]
  isProcessing: boolean
  queueIndex: number // Pointer to next image to process
}

type Action =
  | { type: "ADD_FILES"; payload: CompressedImage[] }
  | { type: "UPDATE_STATUS"; payload: { id: string; status: CompressionStatus; progress?: number; error?: string } }
  | { type: "UPDATE_IMAGE"; payload: CompressedImage }
  | { type: "NEXT_QUEUE" }
  | { type: "CLEAR_ALL" }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_FILES":
      return {
        ...state,
        images: [...state.images, ...action.payload],
        isProcessing: true,
      }
    case "UPDATE_STATUS":
      return {
        ...state,
        images: state.images.map((img) =>
          img.id === action.payload.id
            ? { ...img, status: action.payload.status, progress: action.payload.progress, error: action.payload.error }
            : img
        ),
      }
    case "UPDATE_IMAGE":
      return {
        ...state,
        images: state.images.map((img) => (img.id === action.payload.id ? action.payload : img)),
      }
    case "NEXT_QUEUE":
       // Check if we are done
       const processingCount = state.images.filter(img => img.status === "analyzing" || img.status === "compressing").length
       const queuedCount = state.images.filter(img => img.status === "queued").length
       
       if (processingCount === 0 && queuedCount === 0) {
         return { ...state, isProcessing: false }
       }
       return state
    case "CLEAR_ALL":
      return { images: [], isProcessing: false, queueIndex: 0 }
    default:
      return state
  }
}

export function ImageUploadZone() {
  const [state, dispatch] = useReducer(reducer, {
    images: [],
    isProcessing: false,
    queueIndex: 0,
  })
  
  const [isCreatingZip, setIsCreatingZip] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  // Effect to manage the processing queue
  useEffect(() => {
    if (!state.isProcessing) return

    const processQueue = async () => {
      // Find images that are queued
      const queuedImages = state.images.filter((img) => img.status === "queued")
      const activeProcessing = state.images.filter((img) => img.status === "analyzing" || img.status === "compressing")

      if (queuedImages.length === 0) {
        dispatch({ type: "NEXT_QUEUE" })
        return
      }

      if (activeProcessing.length >= CONCURRENT_PROCESSING) {
        return // Wait for slots to free up
      }

      // Take next batch
      const slotsAvailable = CONCURRENT_PROCESSING - activeProcessing.length
      const nextBatch = queuedImages.slice(0, slotsAvailable)

      nextBatch.forEach(async (image) => {
        try {
          // 1. Analyze
          dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "analyzing" } })
          
          // We need the original file object. In a real app with persistence we'd need to handle this better,
          // but here we can probably assume we still have access if we kept it in memory or if we pass it through.
          // The 'image' object in state doesn't have the File object directly to keep state serializable-ish,
          // but we need it. 
          // Correct fix: The initial ADD_FILES payload should perhaps include the File object in a non-serializable property 
          // OR we maintain a separate map of ID -> File.
          // Let's use a Ref or Map for ID -> File
        } catch (error) {
           console.error(error)
        }
      })
    }
    
    processQueue()
  }, [state.images, state.isProcessing])

  // Map to store File objects separately from state
  const [fileMap] = useState<Map<string, File>>(() => new Map())

  // Actual processing logic separated from the effect for clarity
  // We trigger this from the effect effectively by changing status, 
  // but the effect above is just checking status.
  // Let's simplify: The useEffect will just trigger `processNextImage` if slots available.

  const processNextImage = useCallback(async (image: CompressedImage) => {
    const file = fileMap.get(image.id)
    if (!file) return

    try {
      // 1. Analyze
      dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "analyzing" } })
      const analysis = await ImageService.analyze(file)

      // 2. Compress
      dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "compressing" } })
      const result = await ImageService.compress(file, image.id, analysis)

      dispatch({ type: "UPDATE_IMAGE", payload: result })
    } catch (error) {
      console.error("Processing failed", error)
      dispatch({ 
        type: "UPDATE_STATUS", 
        payload: { 
          id: image.id, 
          status: "error", 
          error: error instanceof Error ? error.message : "Unknown error" 
        } 
      })
    }
  }, [fileMap])

  // Revised Queue Effect
  useEffect(() => {
    const active = state.images.filter(i => i.status === "analyzing" || i.status === "compressing").length
    const queued = state.images.filter(i => i.status === "queued")
    
    if (queued.length > 0 && active < CONCURRENT_PROCESSING) {
      const toProcess = queued.slice(0, CONCURRENT_PROCESSING - active)
      toProcess.forEach(img => processNextImage(img))
    } else if (active === 0 && queued.length === 0 && state.isProcessing) {
      // All done
      dispatch({ type: "NEXT_QUEUE" }) // Will set isProcessing false
    }
  }, [state.images, processNextImage, state.isProcessing])


  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} images allowed`)
      return
    }

    const newImages: CompressedImage[] = acceptedFiles.map((file) => {
      const id = Math.random().toString(36).substr(2, 9)
      fileMap.set(id, file)
      return {
        id,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: 0,
        savings: 0,
        format: file.type.split("/")[1] as any,
        status: "queued",
        progress: 0,
      }
    })

    dispatch({ type: "ADD_FILES", payload: newImages })
  }, [fileMap])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: MAX_FILES,
  })

  const handleClearAll = () => {
    state.images.forEach((img) => {
      if (img.blobUrl) URL.revokeObjectURL(img.blobUrl)
      if (img.originalBlobUrl) URL.revokeObjectURL(img.originalBlobUrl)
    })
    fileMap.clear()
    dispatch({ type: "CLEAR_ALL" })
  }

  const handleDownloadAll = async () => {
    const successfulImages = state.images.filter((img) => img.status === "completed" || img.status === "already-optimized")
    if (successfulImages.length === 0) return

    setIsCreatingZip(true)
    try {
      const zip = new JSZip()
      successfulImages.forEach((img) => {
        const blob = img.compressedBlob || fileMap.get(img.id) // Fallback to original if already optimized (should satisfy blob)
        if (blob) {
            const ext = img.format === "jpeg" ? "jpg" : img.format
            const name = `optimized-${img.originalName.replace(/\.[^/.]+$/, "")}.${ext}`
            zip.file(name, blob)
        }
      })
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = `optimized-images-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Zip failed", err)
      alert("Failed to create zip")
    } finally {
      setIsCreatingZip(false)
    }
  }

  const successfulCount = state.images.filter((img) => img.status === "completed" || img.status === "already-optimized").length
  
  // Calculate stats
  const completedImages = state.images.filter(img => img.status === "completed" || img.status === "already-optimized")
  const totalOriginal = completedImages.reduce((acc, img) => acc + img.originalSize, 0)
  const totalCompressed = completedImages.reduce((acc, img) => acc + (img.compressedSize || img.originalSize), 0) // Handle 0 compressedSize for already-optimized?
  // Wait, compressedSize is set in compress() even for already-optimized (it equals originalSize or best attempt)
  // So we can rely on it.
  
  const totalSavingsBytes = totalOriginal - totalCompressed
  const averageSavings = totalOriginal > 0 ? (totalSavingsBytes / totalOriginal) * 100 : 0

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Card
        {...getRootProps()}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`rounded-2xl transition-all duration-300 cursor-pointer border-2 ${
          isDragActive
            ? "border-primary bg-primary/5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] scale-[1.01]"
            : isHovering
              ? "border-primary/30 bg-primary/[0.02] shadow-[0_8px_24px_rgba(0,0,0,0.08)] scale-[1.01]"
              : "border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] scale-100"
        }`}
      >
        <input {...getInputProps()} />
        <div className="p-16 text-center">
           {/* SVG Icon */}
           <div
            className={`w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300 ${
              isHovering || isDragActive ? "scale-110 bg-primary/15" : "scale-100"
            }`}
          >
            <svg
              className={`w-8 h-8 text-primary transition-transform duration-300 ${
                isHovering || isDragActive ? "-translate-y-1" : "translate-y-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
              <p className="text-lg font-semibold mb-2 text-foreground">Drop your images here or click to browse</p>
              <p className="text-sm text-muted-foreground mb-6">
                PNG, JPEG, WebP, and AVIF formats • No file size limit • Up to {MAX_FILES} images
              </p>
              <Button
                variant="outline"
                className={`mt-2 rounded-xl shadow-sm bg-transparent transition-all duration-300 ${
                  isHovering ? "border-primary/50 text-primary" : ""
                }`}
              >
                Select Images
              </Button>
            </>
          )}
        </div>
      </Card>

      {state.images.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Processed Images ({successfulCount}/{state.images.length})
              </h2>
               {successfulCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Average savings:{" "}
                  <span className="text-[var(--chart-2)] font-semibold">{averageSavings.toFixed(1)}%</span> •{" "}
                  {(totalSavingsBytes / 1024).toFixed(1)} KB saved
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {successfulCount > 0 && (
                <Button onClick={handleDownloadAll} disabled={isCreatingZip} className="gap-2 rounded-xl shadow-sm">
                   {isCreatingZip ? "Creating ZIP..." : `Download All (${successfulCount})`}
                </Button>
              )}
              <Button variant="outline" onClick={handleClearAll} className="rounded-xl shadow-sm bg-transparent">
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {state.images.map((image) => (
              <CompressionResultCard key={image.id} image={image} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
