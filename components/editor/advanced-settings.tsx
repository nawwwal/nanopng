"use client"

import { useState, useEffect } from "react"
import { useEditor } from "./editor-context"
import { QualityPreview } from "./quality-preview"
import { OutputFormat, ResizeFilter, FitMode, CropAspectRatio, WatermarkPosition } from "@/lib/types/compression"
import type { SvgOptimizationMode } from "@/lib/types/svg"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SettingHint } from "@/components/ui/setting-hint"

const FORMAT_OPTIONS: { value: OutputFormat; label: string; desc: string }[] = [
    { value: "auto", label: "Auto", desc: "Analyzes image to choose optimal format" },
    { value: "webp", label: "WebP", desc: "Modern format, 30% smaller than JPEG" },
    { value: "avif", label: "AVIF", desc: "Newest format, 50% smaller, limited support" },
    { value: "jpeg", label: "JPEG", desc: "Universal, best for photos" },
    { value: "png", label: "PNG", desc: "Lossless, best for graphics with transparency" },
    { value: "jxl", label: "JXL", desc: "JPEG-XL (Experimental) - 30-60% smaller, Safari only" },
]

const RESIZE_FILTER_OPTIONS: { value: ResizeFilter; label: string; desc: string }[] = [
    { value: "Lanczos3", label: "Lanczos", desc: "Best quality for photos (default)" },
    { value: "Mitchell", label: "Mitchell", desc: "Good balance of sharpness and smoothness" },
    { value: "Bilinear", label: "Bilinear", desc: "Fast, good for slight scaling" },
    { value: "Nearest", label: "Nearest", desc: "Pixel-perfect for pixel art" },
]

const FIT_MODE_OPTIONS: { value: FitMode; label: string; desc: string }[] = [
    { value: "contain", label: "Contain", desc: "Fit within bounds, preserve ratio" },
    { value: "cover", label: "Cover", desc: "Fill bounds, crop overflow" },
    { value: "fill", label: "Fill", desc: "Stretch to exact size" },
]

const WEBP_PRESET_OPTIONS: { value: "photo" | "picture" | "graph"; label: string; desc: string }[] = [
    { value: "photo", label: "Photo", desc: "Default for photos (smooth gradients)" },
    { value: "picture", label: "Picture", desc: "For indoor/outdoor photos with objects" },
    { value: "graph", label: "Graphic", desc: "For graphics, text, screenshots" },
]

const WEBP_LOSSLESS_OPTIONS: { value: "lossy" | "near-lossless" | "lossless"; label: string; desc: string }[] = [
    { value: "lossy", label: "Lossy", desc: "Smallest size, minor quality loss" },
    { value: "near-lossless", label: "Near-Lossless", desc: "2-3x smaller than lossless, imperceptible loss" },
    { value: "lossless", label: "Lossless", desc: "Perfect quality, larger files" },
]

const AVIF_BIT_DEPTH_OPTIONS: { value: 8 | 10; label: string; desc: string }[] = [
    { value: 8, label: "8-bit", desc: "Standard, maximum compatibility" },
    { value: 10, label: "10-bit", desc: "Better gradients, HDR support" },
]

const ROTATION_OPTIONS: { value: 0 | 90 | 180 | 270; label: string }[] = [
    { value: 0, label: "0" },
    { value: 90, label: "90" },
    { value: 180, label: "180" },
    { value: 270, label: "270" },
]

const CROP_ASPECT_OPTIONS: { value: CropAspectRatio; label: string }[] = [
    { value: "free", label: "Free" },
    { value: "1:1", label: "1:1" },
    { value: "16:9", label: "16:9" },
    { value: "4:3", label: "4:3" },
    { value: "3:2", label: "3:2" },
]

const WATERMARK_POSITION_OPTIONS: { value: WatermarkPosition; label: string }[] = [
    { value: "bottom-right", label: "Bottom Right" },
    { value: "bottom-left", label: "Bottom Left" },
    { value: "top-right", label: "Top Right" },
    { value: "top-left", label: "Top Left" },
    { value: "center", label: "Center" },
]

const SETTING_HINTS = {
    format: "Auto picks the best format based on image content",
    transform: "Rotate and flip applied before resize",
    quality: "Lower = smaller files. 80-85% is usually indistinguishable from original",
    highDetail: "Preserves color detail in fine patterns and text",
    lossless: "No quality loss but larger files. Use for pixel-perfect accuracy",
    preserveMetadata: "Keep EXIF, GPS, color profile data. Turn off for privacy",
    dithering: "Simulates gradients. Turn off (0%) for sharp-edged graphics",
    maxDimensions: "Resize images exceeding these limits while keeping aspect ratio",
    resizeFilter: "Lanczos for photos, Nearest for pixel art",
    fitMode: "How image fills target dimensions",
    targetSize: "Auto-adjusts quality to meet file size limit",
    svgOptimization: "Safe preserves all details. Aggressive removes metadata for smaller files",
    webpPreset: "Optimizes encoding for different content types",
    progressive: "Loads progressively from blurry to sharp. Recommended for web.",
    webpLosslessMode: "Near-lossless provides best size/quality balance",
    avifBitDepth: "Higher bit depth = better gradients but less browser support",
    sharpen: "Enhance edges and details. Apply after resize for best results",
    blur: "Apply blur for privacy or placeholder images",
    autoTrim: "Automatically remove solid color borders from screenshots and scanned documents",
    crop: "Crop region applied before resize and compression",
    watermark: "Add text watermark to images",
    jxlEffort: "Higher effort = smaller files but slower encoding",
    jxlProgressive: "Enable progressive decoding (slightly larger files)",
}

export function AdvancedSettings() {
    const { currentPreset, compressionOptions, setCompressionOptions, images, selectedIds, svgMode, setSvgMode } = useEditor()
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
            className="border border-foreground/20 bg-background"
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
                <div className="border-t border-foreground/20">
                    {/* Core Settings */}
                    <div className="p-4 space-y-4">
                        {/* Output Format */}
                        <SettingHint label="Output Format" hint={SETTING_HINTS.format}>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Output Format">
                                {FORMAT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setCompressionOptions({ format: opt.value })}
                                        className={cn(
                                            "px-2.5 py-1 border text-xs font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground",
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
                        </SettingHint>

                        {/* Quality Slider */}
                        <SettingHint label="Quality" hint={SETTING_HINTS.quality}>
                            <div className="flex items-center justify-between mb-1">
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
                        </SettingHint>

                        {/* Quality Preview Table */}
                        <QualityPreview />
                    </div>

                    {/* Format Options */}
                    <div className="px-4 pb-4 space-y-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 border-t border-foreground/10 pt-4">
                            Format Options
                        </div>

                        {/* High Detail and Lossless side-by-side */}
                        <div className="grid grid-cols-2 gap-4">
                            <SettingHint label="High Detail" hint={SETTING_HINTS.highDetail} inline>
                                <input
                                    type="checkbox"
                                    checked={compressionOptions.chromaSubsampling === false}
                                    onChange={(e) => setCompressionOptions({ chromaSubsampling: !e.target.checked })}
                                    className="w-4 h-4 accent-foreground"
                                />
                            </SettingHint>
                            <SettingHint label="Lossless" hint={SETTING_HINTS.lossless} inline>
                                <input
                                    type="checkbox"
                                    checked={!!compressionOptions.lossless}
                                    onChange={(e) => setCompressionOptions({ lossless: e.target.checked })}
                                    className="w-4 h-4 accent-foreground"
                                />
                            </SettingHint>
                        </div>

                        {/* Preserve Metadata toggle */}
                        <SettingHint label="Preserve Metadata" hint={SETTING_HINTS.preserveMetadata} inline>
                            <input
                                type="checkbox"
                                checked={!!compressionOptions.preserveMetadata}
                                onChange={(e) => setCompressionOptions({ preserveMetadata: e.target.checked })}
                                className="w-4 h-4 accent-foreground"
                            />
                        </SettingHint>

                        {/* Dithering - only for lossy PNG/WebP */}
                        {(compressionOptions.format === 'png' || compressionOptions.format === 'webp') && !compressionOptions.lossless && (
                            <SettingHint label="Dithering" hint={SETTING_HINTS.dithering}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono font-bold">
                                        {Math.round((compressionOptions.dithering ?? 1) * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={Math.round((compressionOptions.dithering ?? 1) * 100)}
                                    onChange={(e) => setCompressionOptions({ dithering: parseInt(e.target.value) / 100 })}
                                    className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                />
                            </SettingHint>
                        )}

                        {/* WebP Preset - only for webp format */}
                        {compressionOptions.format === 'webp' && (
                            <SettingHint label="WebP Preset" hint={SETTING_HINTS.webpPreset}>
                                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="WebP Preset">
                                    {WEBP_PRESET_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setCompressionOptions({ webpPreset: opt.value })}
                                            className={cn(
                                                "px-2.5 py-1 border text-xs font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground",
                                                (compressionOptions.webpPreset || "photo") === opt.value
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-foreground/30 hover:border-foreground"
                                            )}
                                            title={opt.desc}
                                            role="radio"
                                            aria-checked={(compressionOptions.webpPreset || "photo") === opt.value}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingHint>
                        )}

                        {/* WebP Lossless Mode - only for webp format */}
                        {compressionOptions.format === 'webp' && (
                            <SettingHint label="Compression Mode" hint={SETTING_HINTS.webpLosslessMode}>
                                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="WebP Compression Mode">
                                    {WEBP_LOSSLESS_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setCompressionOptions({ webpLosslessMode: opt.value })}
                                            className={cn(
                                                "px-2.5 py-1 border text-xs font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground",
                                                (compressionOptions.webpLosslessMode || "lossy") === opt.value
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-foreground/30 hover:border-foreground"
                                            )}
                                            title={opt.desc}
                                            role="radio"
                                            aria-checked={(compressionOptions.webpLosslessMode || "lossy") === opt.value}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingHint>
                        )}

                        {/* Near-Lossless Level - only for webp near-lossless mode */}
                        {compressionOptions.format === 'webp' && compressionOptions.webpLosslessMode === 'near-lossless' && (
                            <SettingHint label="Near-Lossless Level" hint="Lower = smaller files, higher = closer to lossless">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono font-bold">
                                        {compressionOptions.nearLosslessLevel ?? 60}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={compressionOptions.nearLosslessLevel ?? 60}
                                    onChange={(e) => setCompressionOptions({ nearLosslessLevel: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                />
                            </SettingHint>
                        )}

                        {/* Progressive JPEG - only for jpeg format */}
                        {compressionOptions.format === 'jpeg' && (
                            <SettingHint label="Progressive" hint={SETTING_HINTS.progressive} inline>
                                <input
                                    type="checkbox"
                                    checked={compressionOptions.progressive !== false}
                                    onChange={(e) => setCompressionOptions({ progressive: e.target.checked })}
                                    className="w-4 h-4 accent-foreground"
                                />
                            </SettingHint>
                        )}

                        {/* AVIF Bit Depth - only for avif format */}
                        {compressionOptions.format === 'avif' && (
                            <SettingHint label="Bit Depth" hint={SETTING_HINTS.avifBitDepth}>
                                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="AVIF Bit Depth">
                                    {AVIF_BIT_DEPTH_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setCompressionOptions({ avifBitDepth: opt.value })}
                                            className={cn(
                                                "px-2.5 py-1 border text-xs font-bold uppercase transition-colors",
                                                (compressionOptions.avifBitDepth || 8) === opt.value
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-foreground/30 hover:border-foreground"
                                            )}
                                            title={opt.desc}
                                            role="radio"
                                            aria-checked={(compressionOptions.avifBitDepth || 8) === opt.value}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {(compressionOptions.avifBitDepth || 8) > 8 && (
                                    <p className="text-[10px] text-amber-600 mt-1">Note: 10-bit may not display correctly in all browsers</p>
                                )}
                            </SettingHint>
                        )}

                        {/* JXL Options - only for jxl format */}
                        {compressionOptions.format === 'jxl' && (
                            <>
                                <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                                    <strong>Experimental:</strong> JPEG-XL has limited browser support (mainly Safari). Images may not display in Chrome/Firefox.
                                </div>
                                <SettingHint label="Effort" hint={SETTING_HINTS.jxlEffort}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-mono font-bold">
                                            {compressionOptions.jxlEffort ?? 7}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="9"
                                        value={compressionOptions.jxlEffort ?? 7}
                                        onChange={(e) => setCompressionOptions({ jxlEffort: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                        aria-label="JXL Encoding Effort"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>Faster</span>
                                        <span>Smaller</span>
                                    </div>
                                </SettingHint>
                                <SettingHint label="Progressive" hint={SETTING_HINTS.jxlProgressive} inline>
                                    <input
                                        type="checkbox"
                                        checked={!!compressionOptions.jxlProgressive}
                                        onChange={(e) => setCompressionOptions({ jxlProgressive: e.target.checked })}
                                        className="w-4 h-4 accent-foreground"
                                    />
                                </SettingHint>
                            </>
                        )}

                        {/* SVG Optimization Mode */}
                        <SettingHint label="SVG Optimization" hint={SETTING_HINTS.svgOptimization}>
                            <RadioGroup
                                value={svgMode}
                                onValueChange={(value) => setSvgMode(value as SvgOptimizationMode)}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="safe" id="svg-safe" />
                                    <Label htmlFor="svg-safe" className="text-xs font-medium cursor-pointer">
                                        Safe (lossless)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="aggressive" id="svg-aggressive" />
                                    <Label htmlFor="svg-aggressive" className="text-xs font-medium cursor-pointer">
                                        Aggressive (smaller)
                                    </Label>
                                </div>
                            </RadioGroup>
                        </SettingHint>

                        {/* Sharpen slider */}
                        <SettingHint label="Sharpen" hint={SETTING_HINTS.sharpen}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono font-bold">
                                    {compressionOptions.sharpen || 0}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={compressionOptions.sharpen || 0}
                                onChange={(e) => setCompressionOptions({ sharpen: parseInt(e.target.value) })}
                                className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                aria-label="Sharpen Amount"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Off</span>
                                <span>Maximum</span>
                            </div>
                        </SettingHint>

                        {/* Blur slider */}
                        <SettingHint label="Blur" hint={SETTING_HINTS.blur}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono font-bold">
                                    {compressionOptions.blur || 0}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={compressionOptions.blur || 0}
                                onChange={(e) => setCompressionOptions({ blur: parseInt(e.target.value) })}
                                className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                aria-label="Blur Amount"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Off</span>
                                <span>Maximum</span>
                            </div>
                        </SettingHint>
                    </div>

                    {/* Resize & Constraints */}
                    <div className="p-4 border-t border-foreground/10 space-y-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Resize & Constraints
                        </div>

                        {/* Auto-Trim Whitespace toggle */}
                        <SettingHint label="Auto-Trim Whitespace" hint={SETTING_HINTS.autoTrim} inline>
                            <input
                                type="checkbox"
                                checked={!!compressionOptions.autoTrim}
                                onChange={(e) => setCompressionOptions({ autoTrim: e.target.checked })}
                                className="w-4 h-4 accent-foreground"
                            />
                        </SettingHint>

                        {/* Trim Threshold - only show when auto-trim is enabled */}
                        {compressionOptions.autoTrim && (
                            <SettingHint label="Trim Threshold" hint="Higher = more aggressive trimming">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono font-bold">
                                        {compressionOptions.autoTrimThreshold ?? 10}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    value={compressionOptions.autoTrimThreshold ?? 10}
                                    onChange={(e) => setCompressionOptions({ autoTrimThreshold: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                />
                            </SettingHint>
                        )}

                        {/* Max Dimensions */}
                        <SettingHint label="Max Dimensions" hint={SETTING_HINTS.maxDimensions}>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    name="maxWidth"
                                    autoComplete="off"
                                    placeholder="Width"
                                    min="1"
                                    value={compressionOptions.targetWidth || ""}
                                    onChange={(e) => setCompressionOptions({
                                        targetWidth: e.target.value ? parseInt(e.target.value) : undefined
                                    })}
                                    className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Max Width"
                                />
                                <input
                                    type="number"
                                    name="maxHeight"
                                    autoComplete="off"
                                    placeholder="Height"
                                    min="1"
                                    value={compressionOptions.targetHeight || ""}
                                    onChange={(e) => setCompressionOptions({
                                        targetHeight: e.target.value ? parseInt(e.target.value) : undefined
                                    })}
                                    className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Max Height"
                                />
                            </div>
                        </SettingHint>

                        {/* Resize Filter - only show when resize is enabled */}
                        {(compressionOptions.targetWidth || compressionOptions.targetHeight) && (
                            <SettingHint label="Resize Filter" hint={SETTING_HINTS.resizeFilter}>
                                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Resize Filter">
                                    {RESIZE_FILTER_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setCompressionOptions({ resizeFilter: opt.value })}
                                            className={cn(
                                                "px-2.5 py-1 border text-xs font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground",
                                                (compressionOptions.resizeFilter || "Lanczos3") === opt.value
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-foreground/30 hover:border-foreground"
                                            )}
                                            title={opt.desc}
                                            role="radio"
                                            aria-checked={(compressionOptions.resizeFilter || "Lanczos3") === opt.value}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingHint>
                        )}

                        {/* Fit Mode - only when resize is enabled */}
                        {(compressionOptions.targetWidth || compressionOptions.targetHeight) && (
                            <SettingHint label="Fit Mode" hint={SETTING_HINTS.fitMode}>
                                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Fit Mode">
                                    {FIT_MODE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setCompressionOptions({ fitMode: opt.value })}
                                            className={cn(
                                                "px-2.5 py-1 border text-xs font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-foreground",
                                                (compressionOptions.fitMode || "contain") === opt.value
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-foreground/30 hover:border-foreground"
                                            )}
                                            title={opt.desc}
                                            role="radio"
                                            aria-checked={(compressionOptions.fitMode || "contain") === opt.value}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingHint>
                        )}

                        {/* Target Size */}
                        <SettingHint label="Target Size" hint={SETTING_HINTS.targetSize}>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    name="targetSize"
                                    autoComplete="off"
                                    placeholder="e.g., 500"
                                    min="1"
                                    value={compressionOptions.targetSizeKb || ""}
                                    onChange={(e) => setCompressionOptions({
                                        targetSizeKb: e.target.value ? parseInt(e.target.value) : undefined
                                    })}
                                    className="flex-1 px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Target File Size in KB"
                                />
                                <span className="text-xs font-bold uppercase text-muted-foreground">KB</span>
                            </div>
                        </SettingHint>
                    </div>

                    {/* Crop Settings */}
                    <div className="p-4 border-t border-foreground/10 space-y-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Crop
                        </div>
                        <SettingHint label="Crop Region" hint={SETTING_HINTS.crop}>
                            <div className="grid grid-cols-4 gap-2">
                                <input
                                    type="number"
                                    placeholder="X"
                                    min="0"
                                    value={compressionOptions.crop?.x ?? ""}
                                    onChange={(e) => setCompressionOptions({
                                        crop: {
                                            x: parseInt(e.target.value) || 0,
                                            y: compressionOptions.crop?.y || 0,
                                            width: compressionOptions.crop?.width || 0,
                                            height: compressionOptions.crop?.height || 0
                                        }
                                    })}
                                    className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Crop X offset"
                                />
                                <input
                                    type="number"
                                    placeholder="Y"
                                    min="0"
                                    value={compressionOptions.crop?.y ?? ""}
                                    onChange={(e) => setCompressionOptions({
                                        crop: {
                                            x: compressionOptions.crop?.x || 0,
                                            y: parseInt(e.target.value) || 0,
                                            width: compressionOptions.crop?.width || 0,
                                            height: compressionOptions.crop?.height || 0
                                        }
                                    })}
                                    className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Crop Y offset"
                                />
                                <input
                                    type="number"
                                    placeholder="W"
                                    min="1"
                                    value={compressionOptions.crop?.width ?? ""}
                                    onChange={(e) => setCompressionOptions({
                                        crop: {
                                            x: compressionOptions.crop?.x || 0,
                                            y: compressionOptions.crop?.y || 0,
                                            width: parseInt(e.target.value) || 0,
                                            height: compressionOptions.crop?.height || 0
                                        }
                                    })}
                                    className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Crop width"
                                />
                                <input
                                    type="number"
                                    placeholder="H"
                                    min="1"
                                    value={compressionOptions.crop?.height ?? ""}
                                    onChange={(e) => setCompressionOptions({
                                        crop: {
                                            x: compressionOptions.crop?.x || 0,
                                            y: compressionOptions.crop?.y || 0,
                                            width: compressionOptions.crop?.width || 0,
                                            height: parseInt(e.target.value) || 0
                                        }
                                    })}
                                    className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                                    aria-label="Crop height"
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                <span>X</span>
                                <span>Y</span>
                                <span>Width</span>
                                <span>Height</span>
                            </div>
                            {compressionOptions.crop && (compressionOptions.crop.width > 0 || compressionOptions.crop.height > 0) && (
                                <button
                                    onClick={() => setCompressionOptions({ crop: undefined })}
                                    className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Clear crop
                                </button>
                            )}
                        </SettingHint>
                    </div>

                    {/* Transform Settings */}
                    <div className="p-4 border-t border-foreground/10 space-y-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Transform
                        </div>

                        {/* Rotation */}
                        <SettingHint label="Rotation" hint={SETTING_HINTS.transform}>
                            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rotation">
                                {ROTATION_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setCompressionOptions({ rotate: opt.value })}
                                        className={cn(
                                            "px-2.5 py-1 border text-xs font-bold uppercase transition-colors",
                                            (compressionOptions.rotate || 0) === opt.value
                                                ? "border-foreground bg-foreground text-background"
                                                : "border-foreground/30 hover:border-foreground"
                                        )}
                                        role="radio"
                                        aria-checked={(compressionOptions.rotate || 0) === opt.value}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </SettingHint>

                        {/* Flip options */}
                        <div className="grid grid-cols-2 gap-4">
                            <SettingHint label="Flip Horizontal" hint="Mirror left-right" inline>
                                <input
                                    type="checkbox"
                                    checked={!!compressionOptions.flipH}
                                    onChange={(e) => setCompressionOptions({ flipH: e.target.checked })}
                                    className="w-4 h-4 accent-foreground"
                                />
                            </SettingHint>
                            <SettingHint label="Flip Vertical" hint="Mirror top-bottom" inline>
                                <input
                                    type="checkbox"
                                    checked={!!compressionOptions.flipV}
                                    onChange={(e) => setCompressionOptions({ flipV: e.target.checked })}
                                    className="w-4 h-4 accent-foreground"
                                />
                            </SettingHint>
                        </div>
                    </div>

                    {/* Watermark Settings */}
                    <div className="p-4 border-t border-foreground/10 space-y-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            Watermark
                        </div>

                        <SettingHint label="Watermark Text" hint={SETTING_HINTS.watermark}>
                            <input
                                type="text"
                                placeholder="Enter watermark text..."
                                value={compressionOptions.watermark?.text || ""}
                                onChange={(e) => setCompressionOptions({
                                    watermark: e.target.value ? {
                                        text: e.target.value,
                                        position: compressionOptions.watermark?.position || "bottom-right",
                                        opacity: compressionOptions.watermark?.opacity ?? 50,
                                        fontSize: compressionOptions.watermark?.fontSize || 24,
                                        color: compressionOptions.watermark?.color || "#ffffff"
                                    } : undefined
                                })}
                                className="w-full px-2 py-1.5 border border-foreground/30 bg-background text-xs focus:outline-none focus:border-foreground"
                            />
                        </SettingHint>

                        {compressionOptions.watermark?.text && (
                            <>
                                <SettingHint label="Position" hint="Where to place the watermark">
                                    <div className="flex flex-wrap gap-1.5">
                                        {WATERMARK_POSITION_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setCompressionOptions({
                                                    watermark: { ...compressionOptions.watermark!, position: opt.value }
                                                })}
                                                className={cn(
                                                    "px-2 py-1 border text-[10px] font-bold uppercase",
                                                    compressionOptions.watermark?.position === opt.value
                                                        ? "border-foreground bg-foreground text-background"
                                                        : "border-foreground/30 hover:border-foreground"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </SettingHint>

                                <SettingHint label="Opacity" hint="Watermark transparency">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-mono font-bold">
                                            {compressionOptions.watermark?.opacity ?? 50}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={compressionOptions.watermark?.opacity ?? 50}
                                        onChange={(e) => setCompressionOptions({
                                            watermark: { ...compressionOptions.watermark!, opacity: parseInt(e.target.value) }
                                        })}
                                        className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                    />
                                </SettingHint>

                                <SettingHint label="Font Size" hint="Text size in pixels">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-mono font-bold">
                                            {compressionOptions.watermark?.fontSize || 24}px
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="12"
                                        max="72"
                                        value={compressionOptions.watermark?.fontSize || 24}
                                        onChange={(e) => setCompressionOptions({
                                            watermark: { ...compressionOptions.watermark!, fontSize: parseInt(e.target.value) }
                                        })}
                                        className="w-full h-2 bg-foreground/20 appearance-none cursor-pointer accent-foreground"
                                    />
                                </SettingHint>

                                <SettingHint label="Color" hint="Watermark text color">
                                    <input
                                        type="color"
                                        value={compressionOptions.watermark?.color || "#ffffff"}
                                        onChange={(e) => setCompressionOptions({
                                            watermark: { ...compressionOptions.watermark!, color: e.target.value }
                                        })}
                                        className="w-full h-8 border border-foreground/30 bg-background cursor-pointer"
                                    />
                                </SettingHint>
                            </>
                        )}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
