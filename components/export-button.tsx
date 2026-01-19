"use client"

import { useEditor } from "@/components/editor"
import { cn } from "@/lib/utils"

// This component must be used inside EditorProvider
function ExportButtonInner() {
    const {
        hasImages,
        selectedCount,
        images,
        completedCount,
        downloadSelected,
        downloadAll,
        isProcessing
    } = useEditor()

    if (!hasImages) return null

    const handleClick = () => {
        if (selectedCount > 0) {
            downloadSelected()
        } else {
            downloadAll()
        }
    }

    const downloadCount = selectedCount > 0 ? selectedCount : completedCount
    const isDisabled = downloadCount === 0 || isProcessing

    return (
        <button
            onClick={handleClick}
            disabled={isDisabled}
            className={cn(
                "h-9 px-4 border-2 text-xs font-bold uppercase flex items-center gap-2 btn-spring transition-all",
                isDisabled
                    ? "border-muted-foreground/30 text-muted-foreground cursor-not-allowed"
                    : "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground"
            )}
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {selectedCount > 0
                ? `Export ${selectedCount}`
                : completedCount > 0
                    ? `Export All (${completedCount})`
                    : "Export"
            }
        </button>
    )
}

// Wrapper that handles the case when not inside EditorProvider
export function ExportButton() {
    // Try to use the hook, return null if not in provider
    try {
        return <ExportButtonInner />
    } catch {
        // Not inside EditorProvider - this is expected on initial render
        return null
    }
}
