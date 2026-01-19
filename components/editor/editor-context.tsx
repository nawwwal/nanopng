"use client"

import { createContext, useContext, useReducer, useCallback, useRef, useState, useEffect, ReactNode } from "react"
import { CompressionOrchestrator } from "@/lib/services/compression-orchestrator"
import { ensureDecodable, isHeicFile } from "@/lib/core/format-decoder"
import { PresetId, getPresetById, COMPRESSION_PRESETS } from "@/lib/types/presets"
import type { CompressedImage, CompressionStatus, CompressionOptions, OutputFormat } from "@/lib/types/compression"
import JSZip from "jszip"

// Constants
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

// State types
type EditorState = {
    images: CompressedImage[]
    selectedIds: Set<string>
    previewImageId: string | null
    isProcessing: boolean
    queueIndex: number
}

type EditorAction =
    | { type: "ADD_FILES"; payload: CompressedImage[] }
    | { type: "UPDATE_STATUS"; payload: { id: string; status: CompressionStatus; progress?: number; error?: string } }
    | { type: "UPDATE_IMAGE"; payload: CompressedImage }
    | { type: "NEXT_QUEUE" }
    | { type: "CLEAR_ALL" }
    | { type: "SELECT_IMAGE"; payload: string }
    | { type: "DESELECT_IMAGE"; payload: string }
    | { type: "SELECT_ALL" }
    | { type: "DESELECT_ALL" }
    | { type: "TOGGLE_SELECT"; payload: string }
    | { type: "SET_PREVIEW"; payload: string | null }
    | { type: "REMOVE_IMAGE"; payload: string }

function editorReducer(state: EditorState, action: EditorAction): EditorState {
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
        case "NEXT_QUEUE": {
            const processingCount = state.images.filter(img => img.status === "analyzing" || img.status === "compressing").length
            const queuedCount = state.images.filter(img => img.status === "queued").length
            if (processingCount === 0 && queuedCount === 0) {
                return { ...state, isProcessing: false }
            }
            return state
        }
        case "CLEAR_ALL":
            return { ...state, images: [], selectedIds: new Set(), previewImageId: null, isProcessing: false, queueIndex: 0 }
        case "SELECT_IMAGE": {
            const newSelected = new Set(state.selectedIds)
            newSelected.add(action.payload)
            return { ...state, selectedIds: newSelected }
        }
        case "DESELECT_IMAGE": {
            const newSelected = new Set(state.selectedIds)
            newSelected.delete(action.payload)
            return { ...state, selectedIds: newSelected }
        }
        case "SELECT_ALL":
            return { ...state, selectedIds: new Set(state.images.map(img => img.id)) }
        case "DESELECT_ALL":
            return { ...state, selectedIds: new Set() }
        case "TOGGLE_SELECT": {
            const newSelected = new Set(state.selectedIds)
            if (newSelected.has(action.payload)) {
                newSelected.delete(action.payload)
            } else {
                newSelected.add(action.payload)
            }
            return { ...state, selectedIds: newSelected }
        }
        case "SET_PREVIEW":
            return { ...state, previewImageId: action.payload }
        case "REMOVE_IMAGE": {
            const newSelected = new Set(state.selectedIds)
            newSelected.delete(action.payload)
            return {
                ...state,
                images: state.images.filter(img => img.id !== action.payload),
                selectedIds: newSelected,
                previewImageId: state.previewImageId === action.payload ? null : state.previewImageId,
            }
        }
        default:
            return state
    }
}

// Context
interface EditorContextValue {
    // State
    images: CompressedImage[]
    selectedIds: Set<string>
    previewImageId: string | null
    isProcessing: boolean

    // Settings
    currentPreset: PresetId
    compressionOptions: CompressionOptions

    // Actions
    setCurrentPreset: (preset: PresetId) => void
    setCompressionOptions: (options: Partial<CompressionOptions>) => void
    onDrop: (files: File[]) => void
    selectImage: (id: string) => void
    deselectImage: (id: string) => void
    toggleSelect: (id: string) => void
    selectAll: () => void
    deselectAll: () => void
    setPreview: (id: string | null) => void
    removeImage: (id: string) => void
    clearAll: () => void
    downloadSelected: () => Promise<void>
    downloadAll: () => Promise<void>

    // Computed
    hasImages: boolean
    selectedCount: number
    completedCount: number
    totalSavings: { bytes: number; percent: number }
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor() {
    const context = useContext(EditorContext)
    if (!context) {
        throw new Error("useEditor must be used within EditorProvider")
    }
    return context
}

export function EditorProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(editorReducer, {
        images: [],
        selectedIds: new Set(),
        previewImageId: null,
        isProcessing: false,
        queueIndex: 0,
    })

    const [currentPreset, setCurrentPreset] = useState<PresetId>("web")
    const [compressionOptions, setCompressionOptionsState] = useState<CompressionOptions>(() => {
        const preset = getPresetById("web")
        return {
            quality: preset.quality,
            format: preset.format,
            targetWidth: preset.maxWidth,
            targetHeight: preset.maxHeight,
            targetSizeKb: preset.targetSizeKb,
        }
    })

    const [isCreatingZip, setIsCreatingZip] = useState(false)
    const fileMapRef = useRef<Map<string, File>>(new Map())
    const imagesRef = useRef<CompressedImage[]>([])

    // Update options when preset changes
    const handlePresetChange = useCallback((presetId: PresetId) => {
        setCurrentPreset(presetId)
        if (presetId !== "custom") {
            const preset = getPresetById(presetId)
            setCompressionOptionsState({
                quality: preset.quality,
                format: preset.format,
                targetWidth: preset.maxWidth,
                targetHeight: preset.maxHeight,
                targetSizeKb: preset.targetSizeKb,
            })
        }
    }, [])

    const setCompressionOptions = useCallback((options: Partial<CompressionOptions>) => {
        setCompressionOptionsState(prev => {
            const newOptions = { ...prev, ...options }

            // Trigger reprocessing for all non-processing images
            // We need to access the current state, so we'll use a side effect or thunk pattern if possible,
            // but since we are inside a simplified hook, we can access state.images from the ref or closure?
            // "state" from useReducer is available in this scope.

            const imagesToReprocess = imagesRef.current.filter(img =>
                img.status === "completed" ||
                img.status === "already-optimized" ||
                img.status === "error"
            )

            if (imagesToReprocess.length > 0) {
                // Batch update would be better but we can map dispatch
                imagesToReprocess.forEach(img => {
                    dispatch({
                        type: "UPDATE_STATUS",
                        payload: { id: img.id, status: "queued", progress: 0 }
                    })
                })
            }

            return newOptions
        })
        // If user manually changes settings, switch to custom preset
        setCurrentPreset("custom")
    }, [state.images]) // Added state.images dependency to access latest images? No, imagesRef.current avoids this dependency.

    // Process image
    const processNextImage = useCallback(async (image: CompressedImage) => {
        const file = fileMapRef.current.get(image.id)
        if (!file) return

        try {
            dispatch({ type: "UPDATE_STATUS", payload: { id: image.id, status: "compressing" } })

            const isHeic = await isHeicFile(file)
            const originalFormat = isHeic
                ? (file.name.toLowerCase().endsWith(".heif") ? "heif" : "heic")
                : undefined

            const decodedFile = await ensureDecodable(file)
            const fileToProcess = decodedFile instanceof File
                ? decodedFile
                : new File([decodedFile], file.name.replace(/\.(heic|heif)$/i, ".png"), { type: "image/png" })

            const orchestrator = CompressionOrchestrator.getInstance()
            const result = await orchestrator.compress({
                id: image.id,
                file: fileToProcess,
                options: compressionOptions
            })

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
                compressedBlob: result.blob,
                blobUrl: result.blob ? URL.createObjectURL(result.blob) : undefined,
                originalBlobUrl: URL.createObjectURL(file),
                savings: Math.max(0, savings),
                format: (result.format as "png" | "jpeg" | "webp" | "avif") || "png",
                originalFormat: (originalFormat || file.type.split("/")[1] || "png") as any,
                status,
                analysis: result.analysis,
                generation: image.generation || 0,
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
    }, [compressionOptions])

    // Process queue
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

    // Update ref
    useEffect(() => {
        imagesRef.current = state.images
    }, [state.images])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            imagesRef.current.forEach((img) => {
                if (img.blobUrl) URL.revokeObjectURL(img.blobUrl)
                if (img.originalBlobUrl) URL.revokeObjectURL(img.originalBlobUrl)
            })
        }
    }, [])

    // Global paste handler
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items
            if (!items) return

            const imageFiles: File[] = []
            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                if (!item || !item.type?.startsWith("image/")) continue

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
    }, [])

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
            fileMapRef.current.set(id, file)
            return {
                id,
                originalName: file.name,
                originalSize: file.size,
                compressedSize: 0,
                savings: 0,
                format: inferredFormat as any,
                status: "queued" as const,
                progress: 0,
                generation: 0,
            }
        })

        dispatch({ type: "ADD_FILES", payload: newImages })
    }, [])

    const clearAll = useCallback(() => {
        state.images.forEach((img) => {
            if (img.blobUrl) URL.revokeObjectURL(img.blobUrl)
            if (img.originalBlobUrl) URL.revokeObjectURL(img.originalBlobUrl)
        })
        fileMapRef.current.clear()
        dispatch({ type: "CLEAR_ALL" })
    }, [state.images])

    const downloadImages = useCallback(async (imagesToDownload: CompressedImage[]) => {
        const successfulImages = imagesToDownload.filter((img) => img.status === "completed" || img.status === "already-optimized")
        if (successfulImages.length === 0) return

        if (successfulImages.length === 1) {
            // Single file download
            const img = successfulImages[0]!
            const blob = img.compressedBlob || fileMapRef.current.get(img.id)
            if (blob) {
                const extMap: Record<string, string> = { jpeg: "jpg", avif: "avif", webp: "webp", png: "png" }
                const ext = extMap[img.format] || img.format
                const name = `optimized-${img.originalName.replace(/\.[^/.]+$/, "")}.${ext}`
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = name
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }
            return
        }

        // Multiple files - create ZIP
        setIsCreatingZip(true)
        try {
            const zip = new JSZip()
            successfulImages.forEach((img) => {
                const blob = img.compressedBlob || fileMapRef.current.get(img.id)
                if (blob) {
                    const extMap: Record<string, string> = { jpeg: "jpg", avif: "avif", webp: "webp", png: "png" }
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
    }, [])

    const downloadSelected = useCallback(async () => {
        const selectedImages = state.images.filter(img => state.selectedIds.has(img.id))
        await downloadImages(selectedImages)
    }, [state.images, state.selectedIds, downloadImages])

    const downloadAll = useCallback(async () => {
        await downloadImages(state.images)
    }, [state.images, downloadImages])

    // Computed values
    const completedImages = state.images.filter(img => img.status === "completed" || img.status === "already-optimized")
    const totalOriginal = completedImages.reduce((acc, img) => acc + img.originalSize, 0)
    const totalCompressed = completedImages.reduce((acc, img) => acc + (img.compressedSize || img.originalSize), 0)
    const totalSavingsBytes = totalOriginal - totalCompressed
    const averageSavings = totalOriginal > 0 ? (totalSavingsBytes / totalOriginal) * 100 : 0

    const value: EditorContextValue = {
        images: state.images,
        selectedIds: state.selectedIds,
        previewImageId: state.previewImageId,
        isProcessing: state.isProcessing,
        currentPreset,
        compressionOptions,
        setCurrentPreset: handlePresetChange,
        setCompressionOptions,
        onDrop,
        selectImage: (id) => dispatch({ type: "SELECT_IMAGE", payload: id }),
        deselectImage: (id) => dispatch({ type: "DESELECT_IMAGE", payload: id }),
        toggleSelect: (id) => dispatch({ type: "TOGGLE_SELECT", payload: id }),
        selectAll: () => dispatch({ type: "SELECT_ALL" }),
        deselectAll: () => dispatch({ type: "DESELECT_ALL" }),
        setPreview: (id) => dispatch({ type: "SET_PREVIEW", payload: id }),
        removeImage: (id) => dispatch({ type: "REMOVE_IMAGE", payload: id }),
        clearAll,
        downloadSelected,
        downloadAll,
        hasImages: state.images.length > 0,
        selectedCount: state.selectedIds.size,
        completedCount: completedImages.length,
        totalSavings: { bytes: totalSavingsBytes, percent: averageSavings },
    }

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    )
}

export { ACCEPTED_FORMATS }
