"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useEditor, ACCEPTED_FORMATS } from "./editor-context"
import { ImageGrid } from "@/components/editor/image-grid"
import { ImagePreview } from "@/components/editor/image-preview"
import { cn } from "@/lib/utils"

export function UploadPanel() {
    const { images, hasImages, previewImageId, onDrop, setPreview } = useEditor()

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: ACCEPTED_FORMATS,
        maxFiles: 100,
        noClick: false,
        noKeyboard: true,
    })

    // If showing preview, display full image
    if (previewImageId) {
        const image = images.find(img => img.id === previewImageId)
        if (image) {
            return <ImagePreview image={image} onClose={() => setPreview(null)} />
        }
    }

    // If has images, show grid
    if (hasImages) {
        return (
            <div className="h-full flex flex-col">
                {/* Header with add more button */}
                <div className="p-4 border-b-2 border-foreground flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight">Your Images</h2>
                        <p className="text-sm text-muted-foreground">{images.length} file{images.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={open}
                        className="h-9 px-4 border-2 border-foreground text-foreground text-xs font-bold uppercase flex items-center gap-2 btn-spring hover:bg-foreground hover:text-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add More
                    </button>
                    <input {...getInputProps()} />
                </div>

                {/* Image grid */}
                <div className="flex-1 overflow-auto p-4">
                    <ImageGrid />
                </div>
            </div>
        )
    }

    // Initial state - dropzone
    return (
        <div className="h-full flex items-center justify-center p-6 lg:p-12">
            <div
                {...getRootProps()}
                className={cn(
                    "w-full max-w-lg aspect-square border-3 border-dashed rounded-none transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/20",
                    isDragActive
                        ? "border-foreground bg-foreground/5 scale-[1.02]"
                        : "border-foreground/40 hover:border-foreground hover:bg-foreground/5"
                )}
            >
                <input {...getInputProps()} />

                {/* Upload icon */}
                <div className={cn(
                    "w-24 h-24 mb-6 flex items-center justify-center transition-transform duration-300",
                    isDragActive && "scale-110"
                )}>
                    <svg className="w-full h-full text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3">
                    {isDragActive ? "Drop Here" : "Upload Images"}
                </h2>

                <p className="text-muted-foreground text-sm max-w-xs mb-6">
                    Drag & drop, click to browse, or paste from clipboard
                </p>

                <div className="flex flex-wrap gap-2 justify-center">
                    {["PNG", "JPEG", "WebP", "AVIF", "HEIC"].map(format => (
                        <span key={format} className="px-2 py-1 text-xs font-mono border border-foreground/30">
                            {format}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
