"use client"

import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { useDropzone } from "react-dropzone"
import { useEditor, ACCEPTED_FORMATS } from "./editor-context"
import { ImageGrid } from "@/components/editor/image-grid"
import { ImagePreview } from "@/components/editor/image-preview"
import { ActionBar } from "@/components/editor/action-bar"
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
                                "w-full max-w-lg aspect-square border-2 border-dashed rounded-none transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/20",
                                isDragActive
                                    ? "border-foreground bg-foreground/5 scale-[1.02] shadow-[4px_4px_0_var(--foreground)]"
                                    : "border-foreground/40 hover:border-foreground hover:bg-foreground/5 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--foreground)]"
                            )}
                        >
                            <input {...getInputProps()} />

                            {/* Upload icon */}
                            <motion.div
                                animate={{ scale: isDragActive ? 1.1 : 1 }}
                                transition={{ duration: 0.2 }}
                                className="w-24 h-24 mb-6 flex items-center justify-center"
                            >
                                <svg className="w-full h-full text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </motion.div>

                            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3">
                                {isDragActive ? "Drop Here" : "Upload Images"}
                            </h2>

                            <p className="text-muted-foreground text-sm max-w-xs mb-6">
                                Drag & drop, click to browse, or paste from clipboard
                            </p>

                            <div className="flex flex-wrap gap-2 justify-center">
                                {["PNG", "JPEG", "WebP", "AVIF", "HEIC", "SVG"].map((format, index) => (
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </LayoutGroup>
    )
}
