"use client"

import { useState, useEffect } from "react"
import { useEditor } from "./editor-context"
import { QualityPreview } from "./quality-preview"
import { OutputFormat } from "@/lib/types/compression"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const FORMAT_OPTIONS: { value: OutputFormat; label: string; desc: string }[] = [
    { value: "auto", label: "Auto", desc: "Best for each image" },
    { value: "webp", label: "WebP", desc: "Great compression" },
    { value: "avif", label: "AVIF", desc: "Best compression" },
    { value: "jpeg", label: "JPEG", desc: "Universal" },
    { value: "png", label: "PNG", desc: "Lossless" },
]

export function AdvancedSettings() {
    const { currentPreset, compressionOptions, setCompressionOptions, images, selectedIds } = useEditor()
    const [isExpanded, setIsExpanded] = useState(currentPreset === "custom")
    const [showProMode, setShowProMode] = useState(false)

    // Auto-expand when custom preset selected
    useEffect(() => {
        if (currentPreset === "custom") {
            setIsExpanded(true)
        }
    }, [currentPreset])

    // Get selected image info for size preview
    const selectedImages = images.filter(img => selectedIds.has(img.id))
    const firstImage = selectedImages[0] || images[0]

    return (
        <Collapsible
            open={isExpanded}
            onOpenChange={setIsExpanded}
            className="border-2 border-foreground/20 bg-background"
        >
            <CollapsibleTrigger asChild>
                <button
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground group"
                >
                    <span className="text-sm font-black uppercase tracking-wider group-data-[state=open]:text-accent-text transition-colors">
                        Advanced Settings
                    </span>
                    <svg
                        className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="data-[state=open]:animate-radix-slide-down data-[state=closed]:animate-radix-slide-up overflow-hidden">
                <div className="border-t-2 border-foreground/20 space-y-4">
                    {/* Level 2: Basic Advanced Settings */}
                    <div className="p-4 space-y-4">
                        {/* Output Format */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Output Format
                            </label>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Output Format">
                                {FORMAT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setCompressionOptions({ format: opt.value })}
                                        className={cn(
                                            "px-2.5 py-1 border-2 text-xs font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground",
                                            compressionOptions.format === opt.value
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-foreground/30 hover:border-foreground"
                                        )}
                                        title={opt.desc}
                                        role="radio"
                                        aria-checked={compressionOptions.format === opt.value}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quality Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Quality
                                </label>
                                <span className="text-sm font-mono font-bold">
                                    {compressionOptions.quality}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={compressionOptions.quality}
                                onChange={(e) => setCompressionOptions({ quality: parseInt(e.target.value) })}
                                className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                                aria-label="Compression Quality"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Smaller</span>
                                <span>Higher quality</span>
                            </div>
                        </div>

                        {/* Quality Preview Table */}
                        <QualityPreview />
                    </div>

                    {/* Level 3: Pro Mode Toggle */}
                    <div className="border-t border-foreground/10">
                        <button
                            onClick={() => setShowProMode(!showProMode)}
                            className="w-full px-4 py-2 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground"
                            aria-expanded={showProMode}
                        >
                            <span className="font-bold uppercase tracking-wider">
                                {showProMode ? "Hide" : "Show"} Pro Settings
                            </span>
                            <svg
                                className={cn(
                                    "w-3 h-3 transition-transform duration-200",
                                    showProMode && "rotate-180"
                                )}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showProMode && (
                            <div className="px-4 pb-4 space-y-4">
                                {/* Max Dimensions */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                        Max Dimensions
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <input
                                                type="number"
                                                placeholder="Width"
                                                min="1"
                                                value={compressionOptions.targetWidth || ""}
                                                onChange={(e) => setCompressionOptions({
                                                    targetWidth: e.target.value ? parseInt(e.target.value) : undefined
                                                })}
                                                className="w-full px-2 py-1.5 border-2 border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground"
                                                aria-label="Max Width"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                placeholder="Height"
                                                min="1"
                                                value={compressionOptions.targetHeight || ""}
                                                onChange={(e) => setCompressionOptions({
                                                    targetHeight: e.target.value ? parseInt(e.target.value) : undefined
                                                })}
                                                className="w-full px-2 py-1.5 border-2 border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground"
                                                aria-label="Max Height"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Target Size */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                        Target File Size
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            placeholder="e.g., 500"
                                            min="1"
                                            value={compressionOptions.targetSizeKb || ""}
                                            onChange={(e) => setCompressionOptions({
                                                targetSizeKb: e.target.value ? parseInt(e.target.value) : undefined
                                            })}
                                            className="flex-1 px-2 py-1.5 border-2 border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground"
                                            aria-label="Target File Size in KB"
                                        />
                                        <span className="text-xs font-bold uppercase text-muted-foreground">KB</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
