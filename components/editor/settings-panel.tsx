"use client"

import { useEditor } from "./editor-context"
import { PresetSelector } from "./preset-selector"
import { AdvancedSettings } from "./advanced-settings"

export function SettingsPanel() {
    const { hasImages, selectedCount, totalSavings, completedCount, isProcessing } = useEditor()

    // Pitch content when no images
    if (!hasImages) {
        return (
            <div className="h-full flex flex-col justify-center p-6 lg:p-8 overflow-hidden">
                <div className="max-w-md">
                    {/* Privacy Badge */}
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-6 h-6 rounded-full bg-accent border-2 border-background flex items-center justify-center text-[10px] font-bold">🔒</div>
                        <span className="text-xs font-bold text-muted-foreground">100% browser-based • Zero server uploads</span>
                    </div>

                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase leading-[0.85] tracking-tight mb-4 text-balance">
                        Compress images
                        <span className="accent-bg inline-block px-2 mt-2">without uploading them.</span>
                    </h2>

                    <h3 className="text-base font-bold uppercase tracking-wide text-muted-foreground mb-8">
                        80% smaller files. Zero server uploads. Your images never leave your browser.
                    </h3>

                    <section className="space-y-4 text-sm mb-8" aria-labelledby="how-it-works">
                        <h4 id="how-it-works" className="sr-only">How NanoPNG Works</h4>
                        <div className="flex items-start gap-3">
                            <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0" aria-hidden="true">01</span>
                            <p>Compress confidential designs without worrying who's storing your unreleased work.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0" aria-hidden="true">02</span>
                            <p>No upload wait time. Processing starts instantly in your browser.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="accent-bg px-1.5 py-0.5 font-bold text-xs shrink-0" aria-hidden="true">03</span>
                            <p>Verify it yourself: open DevTools → Network tab. Zero outbound image data.</p>
                        </div>
                    </section>

                    {/* Why Choose NanoPNG */}
                    <section className="space-y-3 mb-6" aria-labelledby="why-nanopng">
                        <h4 id="why-nanopng" className="sr-only">Why Choose NanoPNG</h4>
                        <div className="border-l-4 border-accent pl-4 py-2">
                            <h5 className="text-sm font-bold uppercase tracking-tight">Instant Processing</h5>
                            <p className="text-xs text-muted-foreground">No upload wait time. Compression starts immediately in your browser.</p>
                        </div>
                        <div className="border-l-4 border-accent pl-4 py-2">
                            <h5 className="text-sm font-bold uppercase tracking-tight">Unlimited & Free</h5>
                            <p className="text-xs text-muted-foreground">No file limits, no signup, no premium tier. Process 100 images at once.</p>
                        </div>
                        <div className="border-l-4 border-accent pl-4 py-2">
                            <h5 className="text-sm font-bold uppercase tracking-tight">Inspect the Code</h5>
                            <p className="text-xs text-muted-foreground">Open your browser's network tab. Zero outbound requests with your images.</p>
                        </div>
                    </section>

                    {/* Technical Trust */}
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <span>⚡</span>
                            <span>WebAssembly powered</span>
                        </span>
                        <span className="text-foreground/30">|</span>
                        <span>PNG • JPEG • WebP • AVIF • SVG</span>
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
