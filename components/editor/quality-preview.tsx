"use client"

import { useMemo } from "react"
import { useEditor } from "./editor-context"
import { cn } from "@/lib/utils"

// Compression ratios based on research
// These represent typical compressed size as a fraction of uncompressed
const COMPRESSION_RATIOS: Record<string, Record<number, number>> = {
    jpeg: {
        100: 0.50,
        95: 0.25,
        90: 0.18,
        85: 0.15,
        80: 0.12,
        75: 0.10,
        70: 0.08,
        60: 0.06,
        50: 0.05,
    },
    webp: {
        100: 0.40,
        95: 0.18,
        90: 0.12,
        85: 0.09,
        80: 0.07,
        75: 0.06,
        70: 0.05,
        60: 0.04,
        50: 0.03,
    },
    avif: {
        100: 0.30,
        95: 0.12,
        90: 0.08,
        85: 0.06,
        80: 0.05,
        75: 0.04,
        70: 0.03,
        60: 0.02,
        50: 0.02,
    },
    png: {
        100: 0.35, // PNG is lossless but uses compression
    },
}

function interpolateRatio(format: string, quality: number): number {
    const ratios = COMPRESSION_RATIOS[format] || COMPRESSION_RATIOS.jpeg
    const qualities = Object.keys(ratios).map(Number).sort((a, b) => b - a)

    // Find surrounding quality levels
    let upper = qualities[0]!
    let lower = qualities[qualities.length - 1]!

    for (let i = 0; i < qualities.length - 1; i++) {
        if (quality <= qualities[i]! && quality >= qualities[i + 1]!) {
            upper = qualities[i]!
            lower = qualities[i + 1]!
            break
        }
    }

    if (quality >= upper) return ratios[upper]!
    if (quality <= lower) return ratios[lower]!

    // Linear interpolation
    const t = (quality - lower) / (upper - lower)
    return ratios[lower]! + t * (ratios[upper]! - ratios[lower]!)
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface QualityPreviewProps {
    originalWidth?: number
    originalHeight?: number
    originalSize?: number
}

export function QualityPreview({ originalWidth, originalHeight, originalSize }: QualityPreviewProps) {
    const { compressionOptions } = useEditor()
    const { format, quality, targetWidth, targetHeight } = compressionOptions

    // Calculate uncompressed size
    const effectiveFormat = format === "auto" ? "webp" : format

    // Calculate dimensions
    const width = targetWidth || originalWidth || 1920
    const height = targetHeight || originalHeight || 1080

    // Uncompressed size (RGB = 3 bytes per pixel)
    const uncompressedSize = width * height * 3

    // Estimate compressed sizes at different quality levels
    const qualityLevels = [100, 92, 85, 70]

    const estimates = useMemo(() => {
        return qualityLevels.map(q => {
            const ratio = interpolateRatio(effectiveFormat, q)
            const estimatedSize = Math.round(uncompressedSize * ratio)
            return {
                quality: q,
                size: estimatedSize,
                dimensions: `${width} × ${height}`,
                isSelected: q === quality,
            }
        })
    }, [effectiveFormat, uncompressedSize, width, height, quality])

    // Current estimate
    const currentRatio = interpolateRatio(effectiveFormat, quality)
    const currentEstimate = Math.round(uncompressedSize * currentRatio)

    return (
        <div className="border-2 border-foreground/20 bg-background/50">
            {/* Header */}
            <div className="px-3 py-2 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Size Estimate
                </span>
                <span className="text-sm font-mono font-bold">
                    ~{formatBytes(currentEstimate)}
                </span>
            </div>

            {/* Quality table */}
            <div className="divide-y divide-foreground/10">
                <div className="grid grid-cols-3 px-3 py-1 text-xs text-muted-foreground font-bold uppercase">
                    <span>Quality</span>
                    <span>Est. Size</span>
                    <span>Dimensions</span>
                </div>
                {estimates.map(est => (
                    <div
                        key={est.quality}
                        className={cn(
                            "grid grid-cols-3 px-3 py-1.5 text-xs font-mono transition-colors",
                            est.isSelected ? "bg-foreground/5 font-bold" : ""
                        )}
                    >
                        <span>{est.quality}</span>
                        <span>{formatBytes(est.size)}</span>
                        <span className="text-muted-foreground">{est.dimensions}</span>
                    </div>
                ))}
            </div>

            {/* Note */}
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
                * Estimates based on typical compression ratios
            </div>
        </div>
    )
}
