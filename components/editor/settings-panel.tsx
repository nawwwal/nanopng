"use client"

import { useEditor } from "./editor-context"
import { PresetSelector } from "./preset-selector"
import { AdvancedSettings } from "./advanced-settings"

export function SettingsPanel() {
    const { hasImages, selectedCount, images, totalSavings, completedCount, isProcessing } = useEditor()

    // Pitch content when no images
    if (!hasImages) {
        return (
            <div className="h-full flex flex-col justify-center p-6 lg:p-12">
                <div className="max-w-md">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase leading-[0.9] tracking-tight mb-6 text-balance">
                        Compress images.
                        <span className="accent-bg inline-block px-2 mt-2">Locally.</span>
                    </h1>

                    <p className="text-lg font-bold uppercase tracking-wide text-muted-foreground mb-8">
                        No upload. No limits. No bullsh*t.
                    </p>

                    <div className="space-y-4 text-sm">
                        <div className="flex items-start gap-3">
                            <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">01</span>
                            <span>Your images stay on <strong className="uppercase">your device</strong>. Not on a server.</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">02</span>
                            <span>Process 100 images while others are still loading spinners.</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0">03</span>
                            <span>No "upgrade to pro" nonsense. It's <strong className="uppercase">free forever</strong>.</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Settings panel when images present
    return (
        <div className="h-full flex flex-col">
            {/* Status header - Simplified */}
            <div className="px-3 py-2 border-b border-foreground bg-background flex items-center justify-between shrink-0 h-10">
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-black uppercase tracking-tight">Settings</h2>
                    {selectedCount > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase border border-foreground/20 px-1 rounded-sm">
                            {selectedCount} Selected
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Savings summary */}
                    {completedCount > 0 && totalSavings.bytes > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className="text-muted-foreground hidden sm:inline">Saved:</span>
                            <span className="font-mono">{(totalSavings.bytes / 1024).toFixed(0)}KB</span>
                            <span className="text-accent-text bg-accent/10 px-1 rounded">-{totalSavings.percent.toFixed(0)}%</span>
                        </div>
                    )}
                    
                    {/* Processing indicator */}
                    {isProcessing && (
                        <div className="flex items-center gap-1.5" aria-live="polite">
                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Processing</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Settings content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 scrollbar-hide">
                {/* Presets */}
                <PresetSelector />

                {/* Advanced settings */}
                <AdvancedSettings />
            </div>
        </div>
    )
}
