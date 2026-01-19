"use client"

import { useState } from "react"
import { useEditor } from "./editor-context"
import type { CompressedImage } from "@/lib/types/compression"
import { cn } from "@/lib/utils"

interface ImagePreviewProps {
    image: CompressedImage
    onClose: () => void
}

export function ImagePreview({ image, onClose }: ImagePreviewProps) {
    const { removeImage } = useEditor()
    const [showOriginal, setShowOriginal] = useState(false)

    const isComplete = image.status === "completed" || image.status === "already-optimized"
    const currentUrl = showOriginal ? image.originalBlobUrl : (image.blobUrl || image.originalBlobUrl)

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Header */}
            <div className="p-4 border-b-2 border-foreground flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 border-2 border-foreground flex items-center justify-center hover:bg-foreground hover:text-background transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1"
                        aria-label="Back to grid"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate">{image.originalName}</h3>
                        <p className="text-xs text-muted-foreground">
                            {image.format.toUpperCase()} • {isComplete ? formatSize(image.compressedSize) : "Processing..."}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => {
                            removeImage(image.id)
                            onClose()
                        }}
                        className="w-8 h-8 border-2 border-destructive/50 text-destructive flex items-center justify-center hover:bg-destructive hover:text-background hover:border-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
                        aria-label="Remove image"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Image display */}
            <div className="flex-1 relative overflow-hidden bg-secondary/30 flex items-center justify-center p-4">
                {currentUrl ? (
                    <img
                        src={currentUrl}
                        alt={image.originalName}
                        className="max-w-full max-h-full object-contain"
                    />
                ) : (
                    <div className="w-16 h-16 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                )}
            </div>

            {/* Footer with comparison controls */}
            {isComplete && image.originalBlobUrl && image.blobUrl && (
                <div className="p-4 border-t-2 border-foreground">
                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4 mb-4">
                        <button
                            onClick={() => setShowOriginal(false)}
                            className={cn(
                                "px-4 py-2 border-2 text-xs font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1",
                                !showOriginal
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-foreground/30 hover:border-foreground"
                            )}
                            aria-pressed={!showOriginal}
                        >
                            Compressed
                        </button>
                        <button
                            onClick={() => setShowOriginal(true)}
                            className={cn(
                                "px-4 py-2 border-2 text-xs font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1",
                                showOriginal
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-foreground/30 hover:border-foreground"
                            )}
                            aria-pressed={showOriginal}
                        >
                            Original
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">Original</div>
                            <div className="font-mono font-bold">{formatSize(image.originalSize)}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">Compressed</div>
                            <div className="font-mono font-bold">{formatSize(image.compressedSize)}</div>
                        </div>
                        <div>
                            <div className="text-xs uppercase text-muted-foreground mb-1">Saved</div>
                            <div className={cn(
                                "font-mono font-bold",
                                image.savings > 0 ? "text-green-600 dark:text-green-400" : ""
                            )}>
                                {image.savings > 0 ? `-${image.savings.toFixed(1)}%` : "0%"}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
