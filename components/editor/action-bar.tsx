"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEditor } from "./editor-context"
import { cn } from "@/lib/utils"
import { trackCTAClick } from "@/lib/analytics"

export function ActionBar() {
    const { images, selectedIds, selectedCount, selectAll, deselectAll, removeImage, clearAll, downloadAll, downloadSelected, completedCount, isProcessing } = useEditor()

    if (images.length === 0) return null

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 border border-foreground bg-background/95 backdrop-blur-sm shadow-[4px_4px_0_var(--foreground)] py-3 px-4"
        >
            <div className="inline-flex items-center gap-3">
                    {/* Primary Download CTA */}
                    {completedCount > 0 && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                trackCTAClick(selectedCount > 0 ? "download_selected" : "download_all", "action_bar")
                                selectedCount > 0 ? downloadSelected() : downloadAll()
                            }}
                            disabled={isProcessing && completedCount === 0}
                            className="h-8 px-4 accent-bg text-accent-foreground text-xs font-black uppercase tracking-tight transition-all flex items-center gap-2 shadow-[3px_3px_0_var(--foreground)] hover:shadow-[1px_1px_0_var(--foreground)] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {selectedCount > 0 ? `Download ${selectedCount}` : `Download All (${completedCount})`}
                        </motion.button>
                    )}

                    {/* Toggle Selection Mode / Select All */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={selectedCount === images.length ? deselectAll : selectAll}
                        className={cn(
                            "h-7 px-3 border text-[10px] font-bold uppercase transition-all flex items-center gap-2 rounded-sm",
                            selectedCount > 0
                                ? "border-foreground bg-accent text-accent-foreground shadow-[2px_2px_0_var(--foreground)]"
                                : "border-foreground/30 bg-background hover:border-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-[2px_2px_0_var(--foreground)] active:border-foreground active:bg-accent active:text-accent-foreground active:shadow-[1px_1px_0_var(--foreground)]"
                        )}
                    >
                        {selectedCount === images.length ? (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Deselect All
                            </>
                        ) : selectedCount > 0 ? (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="tabular-nums">{selectedCount} selected</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Select All
                            </>
                        )}
                    </motion.button>

                    {/* Delete / Clear Action */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
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
                            "h-7 px-3 border text-[10px] font-bold uppercase transition-all flex items-center gap-2 rounded-sm hover:shadow-[2px_2px_0_var(--destructive)] active:shadow-[1px_1px_0_var(--destructive)]",
                            selectedCount > 0
                                ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                : "border-foreground/30 hover:border-destructive hover:text-destructive"
                        )}
                    >
                        {selectedCount > 0 ? (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Selected
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Clear All
                            </>
                        )}
                    </motion.button>
            </div>
        </motion.div>
    )
}
