import { track } from "@vercel/analytics"

// Image compression events
export function trackImageUpload(count: number, totalSizeKb: number) {
    track("image_upload", {
        count,
        totalSizeKb: Math.round(totalSizeKb),
    })
}

export function trackCompressionComplete(
    originalSizeKb: number,
    compressedSizeKb: number,
    format: string,
    savingsPercent: number
) {
    track("compression_complete", {
        originalSizeKb: Math.round(originalSizeKb),
        compressedSizeKb: Math.round(compressedSizeKb),
        format,
        savingsPercent: Math.round(savingsPercent),
    })
}

export function trackBatchComplete(
    imageCount: number,
    totalOriginalKb: number,
    totalCompressedKb: number,
    avgSavingsPercent: number
) {
    track("batch_complete", {
        imageCount,
        totalOriginalKb: Math.round(totalOriginalKb),
        totalCompressedKb: Math.round(totalCompressedKb),
        avgSavingsPercent: Math.round(avgSavingsPercent),
    })
}

// User interaction events
export function trackDownload(format: string, count: number) {
    track("download", {
        format,
        count,
    })
}

export function trackPresetSelect(presetId: string) {
    track("preset_select", {
        presetId,
    })
}

export function trackFormatChange(format: string) {
    track("format_change", {
        format,
    })
}

export function trackQualityChange(quality: number) {
    track("quality_change", {
        quality,
    })
}

// Engagement events
export function trackCTAClick(ctaName: string, location: string) {
    track("cta_click", {
        ctaName,
        location,
    })
}

export function trackExternalLink(destination: string) {
    track("external_link", {
        destination,
    })
}

// Funnel tracking
export function trackFunnelStage(stage: "landing" | "upload" | "processing" | "completed" | "download") {
    track("funnel_stage", {
        stage,
        timestamp: Date.now(),
    })
}

// Error tracking
export function trackError(errorType: string, errorMessage: string, context?: string) {
    track("error", {
        errorType,
        errorMessage,
        context: context || "unknown",
    })
}
