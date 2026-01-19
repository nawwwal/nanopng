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
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase leading-[0.9] tracking-tight mb-6">
                        Compress<br />
                        images.<br />
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
            {/* Status header */}
            <div className="p-4 border-b-2 border-foreground bg-foreground text-background">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">Settings</h2>
                        {selectedCount > 0 ? (
                            <p className="text-xs font-mono uppercase opacity-90 border border-background/20 inline-block px-1.5 py-0.5 mt-1">
                                {selectedCount} Selected
                            </p>
                        ) : (
                            <p className="text-xs font-mono uppercase opacity-70 mt-1">
                                All Images
                            </p>
                        )}
                    </div>

                    {/* Processing indicator */}
                    {isProcessing && (
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-background rounded-full animate-pulse" />
                            <span className="text-xs font-mono uppercase">Processing...</span>
                        </div>
                    )}
                </div>

                {/* Savings summary */}
                {completedCount > 0 && totalSavings.bytes > 0 && (
                    <div className="mt-3 pt-3 border-t border-background/20">
                        <p className="text-sm">
                            Saved <strong className="font-mono">{(totalSavings.bytes / 1024).toFixed(1)} KB</strong>
                            {" "}({totalSavings.percent.toFixed(0)}% reduction)
                        </p>
                    </div>
                )}
            </div>

            {/* Settings content */}
            <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
                {/* Presets */}
                <PresetSelector />

                {/* Advanced settings */}
                <AdvancedSettings />
            </div>
        </div>
    )
}
