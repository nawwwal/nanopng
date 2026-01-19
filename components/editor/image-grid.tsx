"use client"

import { useRef, useEffect, useCallback } from "react"
import { useEditor } from "./editor-context"
import { useMarqueeSelect } from "./use-marquee-select"
import { cn } from "@/lib/utils"
import type { CompressedImage } from "@/lib/types/compression"

function ImageThumbnail({
    image,
    onRegisterRect
}: {
    image: CompressedImage
    onRegisterRect: (id: string, rect: DOMRect | null) => void
}) {
    const { selectedIds, toggleSelect, setPreview } = useEditor()
    const isSelected = selectedIds.has(image.id)
    const elementRef = useRef<HTMLDivElement>(null)

    const isComplete = image.status === "completed" || image.status === "already-optimized"
    const isProcessing = image.status === "analyzing" || image.status === "compressing" || image.status === "queued"
    const hasError = image.status === "error"

    const imageUrl = image.blobUrl || image.originalBlobUrl

    // Register element rect for marquee selection
    useEffect(() => {
        const updateRect = () => {
            if (elementRef.current) {
                onRegisterRect(image.id, elementRef.current.getBoundingClientRect())
            }
        }
        updateRect()
        window.addEventListener('resize', updateRect)
        window.addEventListener('scroll', updateRect)
        return () => {
            window.removeEventListener('resize', updateRect)
            window.removeEventListener('scroll', updateRect)
            onRegisterRect(image.id, null)
        }
    }, [image.id, onRegisterRect])

    return (
        <div
            ref={elementRef}
            className={cn(
                "relative aspect-square border-2 cursor-pointer transition-all duration-200 group overflow-hidden focus:outline-none focus:ring-4 focus:ring-foreground focus:ring-opacity-50",
                isSelected
                    ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    : "border-foreground/30 hover:border-foreground"
            )}
            onClick={() => toggleSelect(image.id)}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleSelect(image.id)
                }
            }}
        >
            {/* Image */}
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={image.originalName}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                />
            ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            )}

            {/* Selection checkbox */}
            <div className={cn(
                "absolute top-2 left-2 w-5 h-5 border-2 flex items-center justify-center transition-all pointer-events-none",
                isSelected
                    ? "border-background bg-foreground"
                    : "border-foreground bg-background/80 opacity-0 group-hover:opacity-100"
            )}>
                {isSelected && (
                    <svg className="w-3 h-3 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>

            {/* Preview button */}
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    setPreview(image.id)
                }}
                className="absolute top-2 right-2 w-7 h-7 border-2 border-foreground bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground hover:text-background focus:opacity-100"
                aria-label={`Preview ${image.originalName}`}
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
            </button>

            {/* Status overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {hasError && (
                <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center pointer-events-none">
                    <svg className="w-8 h-8 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
            )}

            {/* Bottom info bar */}
            {isComplete && (
                <div className="absolute bottom-0 left-0 right-0 bg-foreground/90 text-background px-2 py-1 pointer-events-none">
                    <div className="flex items-center justify-between text-xs font-mono">
                        <span className="truncate">{image.format.toUpperCase()}</span>
                        <span className={cn(
                            image.savings > 0 ? "text-green-300" : "text-muted"
                        )}>
                            {image.savings > 0 ? `-${image.savings.toFixed(0)}%` : "0%"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

export function ImageGrid() {
    const { images, selectedIds, selectedCount, selectImage, deselectAll, selectAll, clearAll } = useEditor()
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRectsRef = useRef<Map<string, DOMRect>>(new Map())

    const { isSelecting, selectionRect, handlers, getSelectedIds } = useMarqueeSelect(containerRef)

    // Register item rects for marquee selection
    const handleRegisterRect = useCallback((id: string, rect: DOMRect | null) => {
        if (rect) {
            itemRectsRef.current.set(id, rect)
        } else {
            itemRectsRef.current.delete(id)
        }
    }, [])

    // Apply marquee selection on mouse up
    useEffect(() => {
        if (!isSelecting && selectionRect) {
            const selectedIds = getSelectedIds(itemRectsRef.current)
            selectedIds.forEach(id => selectImage(id))
        }
    }, [isSelecting, selectionRect, getSelectedIds, selectImage])

    return (
        <div>
            {/* Selection controls */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={selectedCount === images.length ? deselectAll : selectAll}
                    className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors"
                >
                    {selectedCount === images.length ? "Deselect All" : "Select All"}
                </button>
                <span className="text-xs text-muted-foreground">•</span>
                <button
                    onClick={clearAll}
                    className="text-xs font-bold uppercase text-destructive hover:opacity-80 transition-opacity"
                >
                    Clear All
                </button>
                {selectedCount > 0 && (
                    <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-mono text-muted-foreground">
                            {selectedCount} selected
                        </span>
                    </>
                )}
            </div>

            {/* Grid with marquee selection */}
            <div
                ref={containerRef}
                className="relative select-none"
                {...handlers}
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {images.map(image => (
                        <ImageThumbnail
                            key={image.id}
                            image={image}
                            onRegisterRect={handleRegisterRect}
                        />
                    ))}
                </div>

                {/* Marquee selection rectangle */}
                {isSelecting && selectionRect && selectionRect.width > 5 && selectionRect.height > 5 && (
                    <div
                        className="absolute border-2 border-foreground bg-foreground/10 pointer-events-none z-10"
                        style={{
                            left: selectionRect.x,
                            top: selectionRect.y,
                            width: selectionRect.width,
                            height: selectionRect.height,
                        }}
                    />
                )}
            </div>

            {/* Hint */}
            <p className="text-xs text-muted-foreground mt-4 italic">
                Tip: Drag to select multiple images
            </p>
        </div>
    )
}
