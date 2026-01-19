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
                "relative aspect-square border cursor-pointer transition-all duration-200 group overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-foreground focus-visible:ring-opacity-50",
                isSelected
                    ? "border-foreground shadow-[4px_4px_0_var(--foreground)] -translate-y-1"
                    : "border-foreground/30 hover:border-foreground hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--foreground)]"
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
                    className="w-full h-full object-cover pointer-events-none select-none"
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
                "absolute top-2 left-2 w-5 h-5 border flex items-center justify-center transition-all pointer-events-none z-10",
                isSelected
                    ? "border-accent bg-accent shadow-sm"
                    : "border-foreground bg-background/80 opacity-0 group-hover:opacity-100"
            )}>
                {isSelected && (
                    <svg className="w-3 h-3 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="absolute top-2 right-2 w-7 h-7 border border-foreground bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground hover:text-background focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1 z-20"
                aria-label={`Preview ${image.originalName}`}
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            </button>

            {/* Status overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {hasError && (
                <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center pointer-events-none z-20">
                    <svg className="w-8 h-8 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
            )}

            {/* Selected Overlay (Neo Green Gradient) */}
            {isSelected && (
                <div className="absolute inset-0 bg-gradient-to-br from-accent/50 to-transparent mix-blend-multiply z-10 pointer-events-none" />
            )}

            {/* Bottom info bar */}
            {isComplete && (
                <div className="absolute bottom-0 left-0 right-0 bg-foreground text-background px-2 py-1.5 pointer-events-none z-20">
                    <div className="flex items-center justify-between text-xs font-bold leading-none">
                        <span className="truncate opacity-70">{image.format.toUpperCase()}</span>
                        <div className="flex items-center gap-2">
                            <span className="tabular-nums">
                                {(image.compressedSize / 1024).toFixed(0)}KB
                            </span>
                            {image.savings > 0 && (
                                <span className="bg-accent text-accent-foreground px-1 py-0.5 text-[10px] rounded-[1px]">
                                    -{image.savings.toFixed(0)}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export function ImageGrid() {
    const { images, selectedIds, selectedCount, selectImage, deselectAll, selectAll, clearAll, removeImage } = useEditor()
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
            <div className="flex items-center justify-between mb-4 px-1 sticky top-0 bg-background z-20 py-2 border-b border-foreground/10">
                <div className="flex items-center gap-2">
                    {/* Toggle Selection Mode / Select All */}
                    <button
                        onClick={selectedCount === images.length ? deselectAll : selectAll}
                        className="h-8 px-3 border border-foreground/30 hover:border-foreground hover:bg-foreground hover:text-background text-xs font-bold uppercase transition-all flex items-center gap-2 rounded-sm"
                    >
                        {selectedCount === images.length ? (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                Deselect All
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Select All
                            </>
                        )}
                    </button>

                    {selectedCount > 0 && (
                        <span className="text-xs font-bold text-muted-foreground tabular-nums">
                            {selectedCount} selected
                        </span>
                    )}
                </div>

                {/* Delete / Clear Action */}
                <button
                    onClick={() => {
                        if (selectedCount > 0) {
                            if (confirm(`Delete ${selectedCount} images?`)) {
                                const ids = Array.from(selectedIds)
                                ids.forEach(id => removeImage(id))
                            }
                        } else {
                            if (confirm("Clear all images?")) clearAll()
                        }
                    }}
                    className={cn(
                        "h-8 px-3 border text-xs font-bold uppercase transition-all flex items-center gap-2 rounded-sm",
                        selectedCount > 0
                            ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            : "border-foreground/30 hover:border-destructive hover:text-destructive"
                    )}
                >
                    {selectedCount > 0 ? (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete Selected
                        </>
                    ) : (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Clear All
                        </>
                    )}
                </button>
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
                        className="absolute border-2 border-accent bg-accent/20 pointer-events-none z-10"
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
