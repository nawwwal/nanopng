"use client"

import { useState, useCallback, useReducer, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { CompressionResultCard } from "@/components/compression-result-card"
import { CompressionOrchestrator } from "@/lib/services/compression-orchestrator"
import type { CompressedImage, CompressionStatus, CompressionOptions, OutputFormat, CompressionResult, ImageAnalysis } from "@/lib/types/compression"
import { ensureDecodable, isHeicFile } from "@/lib/core/format-decoder"
import JSZip from "jszip"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILES = 100
const CONCURRENT_PROCESSING = 3

const ACCEPTED_FORMATS = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
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

  // Compression options state
  const [compressionOptions, setCompressionOptions] = useState<CompressionOptions>({
    quality: 85,
    format: "auto",
  })
  const [resizeEnabled, setResizeEnabled] = useState(false)
  const [targetWidth, setTargetWidth] = useState<number | undefined>()
  const [targetHeight, setTargetHeight] = useState<number | undefined>()
  const [targetSizeEnabled, setTargetSizeEnabled] = useState(false)
  const [targetSizeKb, setTargetSizeKb] = useState<number | undefined>()

  // Map to store File objects separately
  const [fileMap] = useState<Map<string, File>>(() => new Map())

  // Ref to track images for cleanup on unmount
  const imagesRef = useRef<CompressedImage[]>([])

  // Ref for results section to enable auto-scroll
  const resultsSectionRef = useRef<HTMLDivElement>(null)

  const processNextImage = useCallback(async (image: CompressedImage) => {
    const file = fileMap.get(image.id)
    if (!file) return

    try {
      dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "compressing" } })

      // Detect original format before decoding
      const isHeic = await isHeicFile(file)
      const originalFormat = isHeic
        ? (file.name.toLowerCase().endsWith(".heif") ? "heif" : "heic")
        : undefined

      // Decode HEIC/HEIF files to a standard format before processing
      const decodedFile = await ensureDecodable(file)
      // Convert Blob to File if needed
      const fileToProcess = decodedFile instanceof File
        ? decodedFile
        : new File([decodedFile], file.name.replace(/\.(heic|heif)$/i, ".png"), { type: "image/png" })

      // Build compression options
      const options: CompressionOptions = {
        ...compressionOptions,
        targetWidth: resizeEnabled ? targetWidth : undefined,
        targetHeight: resizeEnabled ? targetHeight : undefined,
        targetSizeKb: targetSizeEnabled ? targetSizeKb : undefined,
      }

      const orchestrator = CompressionOrchestrator.getInstance();
      const result = await orchestrator.compress({
        id: image.id,
        file: fileToProcess,
        options
      });

      const compressedSize = result.blob?.size || 0
      const savings = file.size > 0 ? ((file.size - compressedSize) / file.size) * 100 : 0

      let status: "completed" | "already-optimized" = "completed"
      if (savings < 2 || compressedSize >= file.size) {
        status = "already-optimized"
      }

      const completedImage: CompressedImage = {
        id: image.id,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: compressedSize,
        compressedBlob: result.blob || undefined,
        blobUrl: result.blob ? URL.createObjectURL(result.blob) : undefined,
        originalBlobUrl: URL.createObjectURL(file),
        savings: Math.max(0, savings),
        format: (result.format as "png" | "jpeg" | "webp" | "avif") || "png",
        originalFormat: (originalFormat || file.type.split("/")[1] || "png") as any,
        status,
        analysis: result.analysis,
        resizeApplied: result.resizeApplied,
        targetSizeMet: result.targetSizeMet,
        generation: image.generation
      }

      dispatch({ type: "UPDATE_IMAGE", payload: completedImage })
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
  }, [fileMap, compressionOptions, resizeEnabled, targetWidth, targetHeight, targetSizeEnabled, targetSizeKb])

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
      const typePart = file.type ? file.type.split("/")[1] : ""
      const nameExtPart = file.name.split(".").pop()?.toLowerCase() ?? ""
      let inferredFormat = (typePart || nameExtPart || "png").toLowerCase()

      if (inferredFormat === "jpg") inferredFormat = "jpeg"
      if (!["png", "jpeg", "webp", "avif"].includes(inferredFormat)) inferredFormat = "png"

      const id = Math.random().toString(36).substr(2, 9)
      fileMap.set(id, file)
      return {
        id,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: 0,
        savings: 0,
        format: inferredFormat as any,
        status: "queued",
        progress: 0,
        generation: 1
      }
    })

    dispatch({ type: "ADD_FILES", payload: newImages })

    // Auto-scroll to results section after a brief delay to allow DOM update
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }, [fileMap])

  // Global paste handler for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item) continue
        if (!item.type?.startsWith("image/")) continue

        const blob = item.getAsFile()
        if (!blob) continue

        const mime = item.type || blob.type || "image/png"
        const ext = mime.split("/")[1] || "png"
        const name = `pasted-image-${Date.now()}-${i + 1}.${ext}`
        imageFiles.push(new File([blob], name, { type: mime }))
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        onDrop(imageFiles)
      }
    }

    window.addEventListener("paste", handlePaste, true)
    return () => window.removeEventListener("paste", handlePaste, true)
  }, [onDrop])

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
          // Map format to file extension
          const extMap: Record<string, string> = {
            jpeg: "jpg",
            avif: "avif",
            webp: "webp",
            png: "png",
          }
          const ext = extMap[img.format] || img.format
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
      {/* Compression Options Panel */}
      <div className="mb-8 p-6 bg-card border border-border rounded-2xl shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Compression Settings</h3>

        <div className="space-y-6">
          {/* Quality and Format Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quality Slider */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Quality: {compressionOptions.quality}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={compressionOptions.quality}
                onChange={(e) => setCompressionOptions({ ...compressionOptions, quality: parseInt(e.target.value) })}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Format Selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Output Format
              </label>
              <select
                value={compressionOptions.format}
                onChange={(e) => setCompressionOptions({ ...compressionOptions, format: e.target.value as OutputFormat })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="auto">Auto</option>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
                <option value="avif">AVIF</option>
              </select>
            </div>
          </div>

          {/* Resize Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="resize-enabled"
                checked={resizeEnabled}
                onChange={(e) => {
                  setResizeEnabled(e.target.checked)
                  if (!e.target.checked) {
                    setTargetWidth(undefined)
                    setTargetHeight(undefined)
                  }
                }}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <label htmlFor="resize-enabled" className="text-sm font-medium text-foreground cursor-pointer">
                Resize to dimensions
              </label>
            </div>

            {resizeEnabled && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Width (px)</label>
                  <input
                    type="number"
                    value={targetWidth || ''}
                    onChange={(e) => setTargetWidth(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto"
                    min="1"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Height (px)</label>
                  <input
                    type="number"
                    value={targetHeight || ''}
                    onChange={(e) => setTargetHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto"
                    min="1"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="target-size-enabled"
                checked={targetSizeEnabled}
                onChange={(e) => {
                  setTargetSizeEnabled(e.target.checked)
                  if (!e.target.checked) {
                    setTargetSizeKb(undefined)
                  }
                }}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <label htmlFor="target-size-enabled" className="text-sm font-medium text-foreground cursor-pointer">
                Target file size
              </label>
            </div>

            {targetSizeEnabled && (
              <div className="ml-6">
                <input
                  type="number"
                  value={targetSizeKb || ''}
                  onChange={(e) => setTargetSizeKb(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Size in KB"
                  min="1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        </div>
      </div>

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
            Drag & drop files here, click to browse, or paste from clipboard. <br /> We support PNG, JPEG, WebP, AVIF & HEIC/HEIF.
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
        <div ref={resultsSectionRef} className="mt-16 animate-fade-in-up duration-700">
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
