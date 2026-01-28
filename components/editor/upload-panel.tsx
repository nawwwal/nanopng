"use client"

import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { useDropzone } from "react-dropzone"
import { useEditor, ACCEPTED_FORMATS } from "./editor-context"
import { ImageGrid } from "@/components/editor/image-grid"
import { ImagePreview } from "@/components/editor/image-preview"
import { ActionBar } from "@/components/editor/action-bar"
import { cn } from "@/lib/utils"
import { trackCTAClick, trackFunnelStage } from "@/lib/analytics"
import { useEffect, useRef } from "react"

export function UploadPanel() {
    const { images, hasImages, previewImageId, onDrop, setPreview } = useEditor()
    const hasTrackedLanding = useRef(false)

    // Track funnel stages
    useEffect(() => {
        if (!hasTrackedLanding.current && !hasImages) {
            trackFunnelStage("landing")
            hasTrackedLanding.current = true
        }
    }, [hasImages])

    // Track upload stage when images are added
    useEffect(() => {
        if (hasImages && hasTrackedLanding.current) {
            trackFunnelStage("upload")
        }
    }, [hasImages])

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: ACCEPTED_FORMATS,
        maxFiles: 100,
        noClick: false,
        noKeyboard: true,
    })

    // Determine current view
    const previewImage = previewImageId ? images.find(img => img.id === previewImageId) : null

    return (
        <LayoutGroup>
            <AnimatePresence mode="wait">
                {/* Preview view */}
                {previewImage ? (
                    <ImagePreview key="preview" image={previewImage} onClose={() => setPreview(null)} />
                ) : hasImages ? (
                    /* Grid view */
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="h-full flex flex-col relative"
                    >
                        {/* Header with add more button */}
                        <div className="px-4 py-2 border-b border-foreground flex items-center justify-between bg-secondary shrink-0 h-14">
                            <h2 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                                Images
                                <span className="text-muted-foreground text-xs font-bold">({images.length})</span>
                            </h2>

                            <div className="flex items-center gap-2">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={open}
                                    className="h-8 px-3 border border-foreground flex items-center justify-center hover:bg-foreground hover:text-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground text-xs font-bold uppercase gap-2"
                                    title="Add more images"
                                    aria-label="Add more images"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="hidden sm:inline">Add Images</span>
                                </motion.button>
                            </div>
                        </div>
                        <input {...getInputProps()} />

                        {/* Image grid */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 scrollbar-hide">
                            <ImageGrid />
                        </div>

                        {/* Action bar - fixed at bottom */}
                        <ActionBar />
                    </motion.div>
                ) : (
                    /* Initial state - dropzone */
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex items-center justify-center p-6 lg:p-12"
                    >
                        <div
                            {...getRootProps()}
                            className={cn(
                                "w-full max-w-lg aspect-square border-3 border-dashed rounded-none transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/20",
                                isDragActive
                                    ? "border-foreground bg-accent/10 scale-[1.02] shadow-[6px_6px_0_var(--accent)]"
                                    : "border-foreground hover:bg-accent/5 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--accent)]"
                            )}
                        >
                            <input {...getInputProps()} />

                            {/* Upload icon */}
                            <motion.div
                                animate={{ scale: isDragActive ? 1.1 : 1 }}
                                transition={{ duration: 0.2 }}
                                className="w-20 h-20 mb-4 flex items-center justify-center"
                            >
                                <svg className="w-full h-full text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </motion.div>

                            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">
                                {isDragActive ? "Drop Here" : "Start Compressing"}
                            </h2>

                            <p className="text-muted-foreground text-sm max-w-xs mb-4">
                                Drop images here, click to browse, or paste from clipboard
                            </p>

                            {/* Primary CTA Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    trackCTAClick("select_files", "dropzone")
                                    open()
                                }}
                                className="accent-bg px-6 py-3 text-sm font-black uppercase tracking-wide mb-4 shadow-[4px_4px_0_var(--foreground)] hover:shadow-[2px_2px_0_var(--foreground)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                            >
                                Start Compressing — No Upload Required
                            </motion.button>

                            <p className="text-xs text-muted-foreground mb-4">
                                No signup • No server uploads • 100% private
                            </p>

                            {/* Sample compression result - reciprocity mechanism */}
                            <div className="mb-4 p-3 border border-foreground/20 bg-secondary/50 max-w-xs">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Sample Result</div>
                                <div className="flex items-center justify-between gap-4 text-xs">
                                    <div className="text-muted-foreground">
                                        <span className="line-through">2.4 MB</span>
                                    </div>
                                    <div className="text-foreground font-bold">→</div>
                                    <div className="font-bold">
                                        <span>480 KB</span>
                                        <span className="ml-2 accent-bg px-1 text-[10px]">-80%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-center mb-4">
                                {["PNG", "JPEG", "WebP", "AVIF", "GIF", "HEIC", "TIFF", "BMP", "SVG", "JXL"].map((format, index) => (
                                    <motion.span
                                        key={format}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + index * 0.05 }}
                                        className="px-2 py-1 text-xs font-bold uppercase tracking-wider border border-foreground/30"
                                    >
                                        {format}
                                    </motion.span>
                                ))}
                            </div>

                            {/* Trust badge */}
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                <span>🔒 Files stay on your device</span>
                                <span className="text-foreground/30">•</span>
                                <span>WebAssembly powered</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </LayoutGroup>
    )
}
