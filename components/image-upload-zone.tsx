"use client"

import { useState, useCallback, useReducer, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { CompressionResultCard } from "@/components/compression-result-card"
import { ImageService } from "@/lib/services/image-service"
import type { CompressedImage, CompressionStatus, ImageFormat } from "@/types/image"
import { ensureDecodable, isHeicFile } from "@/lib/core/format-decoder"
import JSZip from "jszip"
import { cn } from "@/lib/utils"

const CONCURRENT_PROCESSING = 5

const ACCEPTED_FORMATS = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
}

// Format file size contextually (KB, MB, GB)
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

type State = {
  images: CompressedImage[]
  isProcessing: boolean
  queueIndex: number
  formatMode: "smart" | "keep"
}

type Action =
  | { type: "ADD_FILES"; payload: CompressedImage[] }
  | { type: "UPDATE_STATUS"; payload: { id: string; status: CompressionStatus; progress?: number; error?: string; generation?: number } }
  | { type: "UPDATE_IMAGE"; payload: CompressedImage }
  | { type: "NEXT_QUEUE" }
  | { type: "CLEAR_ALL" }
  | { type: "SET_FORMAT_MODE"; payload: "smart" | "keep" }

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
            ? {
              ...img,
              status: action.payload.status,
              progress: action.payload.progress,
              error: action.payload.error,
              generation: action.payload.generation !== undefined ? action.payload.generation : img.generation
            }
            : img
        ),
      }
    case "UPDATE_IMAGE":
      return {
        ...state,
        images: state.images.map((img) => {
          if (img.id !== action.payload.id) return img
          // Robustness: Ignore stale results from older generations
          if (action.payload.generation < img.generation) {
            console.log(`Ignoring stale result for ${img.originalName} (Gen ${action.payload.generation} < ${img.generation})`)
            return img
          }
          return action.payload
        }),
      }
    case "NEXT_QUEUE":
      const processingCount = state.images.filter(img => img.status === "analyzing" || img.status === "compressing").length
      const queuedCount = state.images.filter(img => img.status === "queued").length

      if (processingCount === 0 && queuedCount === 0) {
        return { ...state, isProcessing: false }
      }
      return state
    case "CLEAR_ALL":
      return { images: [], isProcessing: false, queueIndex: 0, formatMode: state.formatMode }
    case "SET_FORMAT_MODE":
      return {
        ...state,
        formatMode: action.payload,
        // Re-queue all completed/error images to respect the new mode
        images: state.images.map(img =>
          (img.status === "completed" || img.status === "already-optimized" || img.status === "error")
            ? { ...img, status: "queued", progress: 0, generation: (img.generation || 0) + 1 }
            : img
        ),
        isProcessing: true // Ensure queue processing restarts
      }
    default:
      return state
  }
}

export function ImageUploadZone() {
  const [state, dispatch] = useReducer(reducer, {
    images: [],
    isProcessing: false,
    queueIndex: 0,
    formatMode: "smart",
  })

  // Dedup cache: hash -> CompressedImage (success only)
  const resultCacheRef = useRef<Map<string, CompressedImage>>(new Map())

  const [isCreatingZip, setIsCreatingZip] = useState(false)

  // Map to store File objects separately
  const [fileMap] = useState<Map<string, File>>(() => new Map())

  // Ref to track images for cleanup on unmount
  const imagesRef = useRef<CompressedImage[]>([])

  // Ref for results section to enable auto-scroll
  const resultsSectionRef = useRef<HTMLDivElement>(null)

  // Handler for format changes on individual images (with artificial loading)
  const handleFormatChange = useCallback(async (imageId: string, newFormat: ImageFormat) => {
    const image = state.images.find(img => img.id === imageId)
    const file = fileMap.get(imageId)
    if (!image || !file) return

    const nextGen = (image.generation || 0) + 1
    // Set to compressing state with new generation
    dispatch({ type: "UPDATE_STATUS", payload: { id: imageId, status: "compressing", generation: nextGen } })

    try {
      // Add natural artificial delay for format conversion
      const sizeInMB = file.size / (1024 * 1024)
      const conversionDelay = 300 + (sizeInMB * 150) + (Math.random() * 200)
      await new Promise(resolve => setTimeout(resolve, conversionDelay))

      const result = await ImageService.compressToFormat(
        file,
        newFormat,
        imageId,
        image.originalName,
        image.originalSize,
        nextGen, // Pass new generation
        image.analysis
      )
      dispatch({ type: "UPDATE_IMAGE", payload: result })
    } catch (error) {
      console.error("Format change failed", error)
      dispatch({
        type: "UPDATE_STATUS",
        payload: {
          id: imageId,
          status: "error",
          error: error instanceof Error ? error.message : "Format conversion failed"
        }
      })
    }
  }, [state.images, fileMap])

  const processNextImage = useCallback(async (image: CompressedImage, formatMode: "smart" | "keep") => {
    const file = fileMap.get(image.id)
    if (!file) return

    try {
      // 1. Compute Hash first
      const inputHash = await ImageService.computeHash(file)

      // Composite key: Hash + Mode
      const cacheKey = `${inputHash}:${formatMode}`

      // 2. Check Cache
      if (resultCacheRef.current.has(cacheKey)) {
        const cached = resultCacheRef.current.get(cacheKey)!
        // If we found a match, we just clone it but give it a new ID/Name/Gen
        console.log("Cache hit for", file.name)

        // Artificial small delay for UX so it doesn't feel instant/broken
        await new Promise(r => setTimeout(r, 100 + Math.random() * 100))

        dispatch({
          type: "UPDATE_IMAGE",
          payload: {
            ...cached,
            id: image.id,
            originalName: file.name, // Keep new name
            originalSize: file.size,
            generation: image.generation, // Keep current generation
            status: "already-optimized", // Or completed, but cache means we are done
            hash: inputHash // Ensure hash is set
          }
        })
        return
      }

      dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "analyzing" } })

      // Natural analyzing delay
      const sizeInMB = file.size / (1024 * 1024)
      const analyzingDelay = 400 + (sizeInMB * 100) + (Math.random() * 200)
      await new Promise(resolve => setTimeout(resolve, analyzingDelay))

      // Detect original format before decoding
      const isHeic = await isHeicFile(file)
      const originalFormat = isHeic
        ? (file.name.toLowerCase().endsWith(".heif") ? "heif" : "heic")
        : undefined

      // Decode HEIC/HEIF files
      const decodedFile = await ensureDecodable(file)
      const fileToProcess = decodedFile instanceof File
        ? decodedFile
        : new File([decodedFile], file.name.replace(/\.(heic|heif)$/i, ".png"), { type: "image/png" })

      const analysis = await ImageService.analyze(fileToProcess)

      dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "compressing" } })

      // Natural compressing delay
      const compressingDelay = 600 + (sizeInMB * 200) + (Math.random() * 300)
      await new Promise(resolve => setTimeout(resolve, compressingDelay))

      let result: CompressedImage

      if (formatMode === "keep") {
        // Keep original format
        const keepFormat = (originalFormat === "heic" || originalFormat === "heif")
          ? "png" // HEIC/HEIF must be converted
          : (image.format as ImageFormat)

        result = await ImageService.compressToFormat(
          fileToProcess,
          keepFormat,
          image.id,
          image.originalName,
          image.originalSize,
          image.generation, // Pass current generation
          analysis
        )
        result.originalFormat = (originalFormat || image.format) as any
      } else {
        // Smart format selection
        result = await ImageService.compress(fileToProcess, image.id, image.generation, analysis, originalFormat)
      }

      result.hash = inputHash // Store raw hash

      // Update Cache if successful
      if (result.status === "completed" || result.status === "already-optimized") {
        resultCacheRef.current.set(cacheKey, result)
      }

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
      toProcess.forEach(img => processNextImage(img, state.formatMode))
    } else if (active === 0 && queued.length === 0) {
      dispatch({ type: "NEXT_QUEUE" })
    }
  }, [state.images, processNextImage, state.isProcessing, state.formatMode])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // No limits - accept all files
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
        generation: 0,
        previewUrl: URL.createObjectURL(file)
      }
    })

    dispatch({ type: "ADD_FILES", payload: newImages })

    // Auto-scroll to results section
    setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }, [fileMap])

  // Global paste handler
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
      {/* Brutalist Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer border-2 border-dashed hover-lift",
          isDragActive
            ? "border-foreground bg-accent/20 brutalist-shadow"
            : "border-foreground/50 hover:border-foreground"
        )}
      >
        <input {...getInputProps()} />

        <div className="px-6 py-12 sm:py-16 md:py-20 flex flex-col items-center text-center">
          <div className={cn(
            "w-16 h-16 border-2 border-foreground flex items-center justify-center mb-6 transition-transform duration-200",
            isDragActive && "brutalist-shadow-accent scale-105"
          )}>
            <svg
              className="w-8 h-8 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h3 className="text-xl sm:text-2xl font-black uppercase mb-2 tracking-tight">
            {isDragActive ? "Drop it" : "Drop images here"}
          </h3>

          <p className="text-muted-foreground max-w-md text-sm mb-6">
            Or click to browse. Paste from clipboard works too.<br />
            <span className="font-bold">PNG, JPEG, WebP, AVIF, HEIC</span>
          </p>

          <button
            type="button"
            className={cn(
              "px-6 py-2.5 border-2 border-foreground font-bold uppercase text-sm btn-spring",
              "hover:bg-foreground hover:text-background hover:brutalist-shadow-sm",
              isDragActive && "bg-accent text-accent-foreground border-accent-foreground"
            )}
          >
            Select Files
          </button>
        </div>
      </div>

      {state.images.length > 0 && (
        <div ref={resultsSectionRef} className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header with Format Mode Toggle */}
          <div className="flex flex-col gap-4 mb-6">
            {/* Format Mode Toggle - Improved with icons */}
            <div className="flex flex-wrap items-center gap-2 p-3 border-2 border-foreground bg-secondary">
              <span className="text-xs font-bold uppercase tracking-wider mr-1">Output:</span>
              <button
                onClick={() => dispatch({ type: "SET_FORMAT_MODE", payload: "smart" })}
                className={cn(
                  "h-8 px-3 text-xs font-bold uppercase flex items-center gap-1.5 btn-spring",
                  state.formatMode === "smart"
                    ? "bg-foreground text-background"
                    : "border border-foreground hover:bg-foreground/10"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Smallest Size
              </button>
              <button
                onClick={() => dispatch({ type: "SET_FORMAT_MODE", payload: "keep" })}
                className={cn(
                  "h-8 px-3 text-xs font-bold uppercase flex items-center gap-1.5 btn-spring",
                  state.formatMode === "keep"
                    ? "bg-foreground text-background"
                    : "border border-foreground hover:bg-foreground/10"
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Same Format
              </button>
              <span className="text-[10px] text-muted-foreground ml-auto hidden sm:block">
                {state.formatMode === "smart" ? "Auto-converts to AVIF/WebP for best compression" : "Keeps original format, just optimizes"}
              </span>
            </div>

            {/* Results Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">
                  Results <span className="text-muted-foreground font-normal">({successfulCount}/{state.images.length})</span>
                </h2>
                {successfulCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Saved <span className="font-bold text-foreground">{formatFileSize(totalSavingsBytes)}</span> total
                    <span className="accent-bg text-accent-foreground px-1 ml-1 font-bold">-{averageSavings.toFixed(0)}%</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {successfulCount > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    disabled={isCreatingZip}
                    className="flex-1 sm:flex-none h-9 px-4 bg-foreground text-background font-bold uppercase text-xs disabled:opacity-50 flex items-center justify-center btn-spring hover:brutalist-shadow-sm"
                  >
                    {isCreatingZip ? "Zipping..." : "Download All"}
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="flex-1 sm:flex-none h-9 px-4 border-2 border-foreground font-bold uppercase text-xs flex items-center justify-center btn-spring hover:bg-secondary"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-2">
            {state.images.map((image) => (
              <CompressionResultCard
                key={image.id}
                image={image}
                onFormatChange={handleFormatChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
