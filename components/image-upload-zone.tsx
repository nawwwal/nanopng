"use client"

import { useState, useCallback, useReducer, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { CompressionResultCard } from "@/components/compression-result-card"
import { ImageService } from "@/lib/services/image-service"
import type { CompressedImage, CompressionStatus } from "@/types/image"
import JSZip from "jszip"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILES = 100
const CONCURRENT_PROCESSING = 3

const ACCEPTED_FORMATS = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
}

type State = {
  images: CompressedImage[]
  isProcessing: boolean
  queueIndex: number
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

  // Map to store File objects separately
  const [fileMap] = useState<Map<string, File>>(() => new Map())
  
  // Ref to track images for cleanup on unmount
  const imagesRef = useRef<CompressedImage[]>([])

  const processNextImage = useCallback(async (image: CompressedImage) => {
    const file = fileMap.get(image.id)
    if (!file) return

    try {
      dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "analyzing" } })
      const analysis = await ImageService.analyze(file)

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

  useEffect(() => {
    if (!state.isProcessing) return

    const active = state.images.filter(i => i.status === "analyzing" || i.status === "compressing").length
    const queued = state.images.filter(i => i.status === "queued")
    
    if (queued.length > 0 && active < CONCURRENT_PROCESSING) {
      const toProcess = queued.slice(0, CONCURRENT_PROCESSING - active)
      toProcess.forEach(img => processNextImage(img))
    } else if (active === 0 && queued.length === 0) {
      dispatch({ type: "NEXT_QUEUE" })
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
    noClick: false,
    noKeyboard: true,
  })

  // Update ref whenever images change
  useEffect(() => {
    imagesRef.current = state.images
  }, [state.images])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      // Cleanup all blob URLs when component unmounts
      imagesRef.current.forEach((img) => {
        if (img.blobUrl) URL.revokeObjectURL(img.blobUrl)
        if (img.originalBlobUrl) URL.revokeObjectURL(img.originalBlobUrl)
      })
    }
  }, [])

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
        const blob = img.compressedBlob || fileMap.get(img.id)
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
  const completedImages = state.images.filter(img => img.status === "completed" || img.status === "already-optimized")
  const totalOriginal = completedImages.reduce((acc, img) => acc + img.originalSize, 0)
  const totalCompressed = completedImages.reduce((acc, img) => acc + (img.compressedSize || img.originalSize), 0)
  const totalSavingsBytes = totalOriginal - totalCompressed
  const averageSavings = totalOriginal > 0 ? (totalSavingsBytes / totalOriginal) * 100 : 0

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div
        {...getRootProps()}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={cn(
          "relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-500 ease-out overflow-hidden",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.02] shadow-2xl"
            : isHovering
              ? "border-primary/50 bg-secondary/30 scale-[1.01] shadow-xl"
              : "border-border/50 bg-card shadow-lg hover:shadow-xl"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="relative px-8 py-20 md:py-28 flex flex-col items-center text-center z-10">
           <div className={cn(
             "w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center mb-8 transition-transform duration-500",
             (isHovering || isDragActive) ? "scale-110 rotate-3" : "scale-100 rotate-0"
           )}>
            <svg
              className="w-10 h-10 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-tight">
            {isDragActive ? "Drop to upload" : "Upload images"}
          </h3>
          
          <p className="text-muted-foreground max-w-md text-lg mb-8 font-normal leading-relaxed">
            Drag & drop files here or click to browse. <br/> We support PNG, JPEG & WebP.
          </p>
          
          <Button
            size="lg"
            className={cn(
                "rounded-full px-8 h-12 text-base font-medium transition-all duration-300 shadow-lg hover:shadow-xl",
                (isHovering || isDragActive) ? "bg-primary text-primary-foreground scale-105" : "bg-primary text-primary-foreground"
            )}
          >
            Select Files
          </Button>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
             <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
             <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary rounded-full blur-3xl" />
        </div>
      </div>

      {state.images.length > 0 && (
        <div className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Your Library <span className="text-muted-foreground font-normal text-lg ml-2">({successfulCount}/{state.images.length})</span>
              </h2>
               {successfulCount > 0 && (
                <p className="text-muted-foreground mt-1">
                  Saved <span className="text-foreground font-semibold">{(totalSavingsBytes / 1024).toFixed(1)} KB</span> total ({averageSavings.toFixed(0)}%)
                </p>
              )}
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              {successfulCount > 0 && (
                <Button onClick={handleDownloadAll} disabled={isCreatingZip} className="flex-1 sm:flex-none rounded-full shadow-sm">
                   {isCreatingZip ? "Zipping..." : "Download All"}
                </Button>
              )}
              <Button variant="outline" onClick={handleClearAll} className="flex-1 sm:flex-none rounded-full border-border/60 bg-transparent hover:bg-secondary/50">
                Clear All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {state.images.map((image) => (
              <CompressionResultCard key={image.id} image={image} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
