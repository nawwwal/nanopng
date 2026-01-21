"use client"

import { useEditor } from "./editor-context"
import { cn } from "@/lib/utils"

export function ActionBar() {
    const { images, selectedIds, selectedCount, selectAll, deselectAll, removeImage, clearAll } = useEditor()

    if (images.length === 0) return null

    return (
        <div className="shrink-0 border-t border-foreground bg-background py-3 px-4">
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-3 border border-foreground/30 bg-background px-2 py-2">
                    {/* Toggle Selection Mode / Select All */}
                    <button
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
                    </button>

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
                    </button>
                </div>
            </div>
        </div>
    )
}
