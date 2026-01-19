import { OutputFormat } from "@/lib/types/compression"

export type PresetId = "web" | "social" | "print" | "email" | "custom"

export interface CompressionPreset {
    id: PresetId
    name: string
    description: string
    icon: string
    format: OutputFormat
    quality: number
    maxWidth?: number
    maxHeight?: number
    targetSizeKb?: number
}

export const COMPRESSION_PRESETS: CompressionPreset[] = [
    {
        id: "web",
        name: "Web Optimized",
        description: "Best balance of size and quality",
        icon: "🌐",
        format: "webp",
        quality: 82,
        maxWidth: 1920,
        maxHeight: 1080,
    },
    {
        id: "social",
        name: "Social Media",
        description: "Optimized for Instagram, Twitter",
        icon: "📱",
        format: "jpeg",
        quality: 85,
        maxWidth: 1200,
        maxHeight: 1200,
    },
    {
        id: "print",
        name: "Print Ready",
        description: "Maximum quality, lossless",
        icon: "🖨️",
        format: "png",
        quality: 100,
    },
    {
        id: "email",
        name: "Email Friendly",
        description: "Fast load, under 500KB",
        icon: "✉️",
        format: "jpeg",
        quality: 72,
        targetSizeKb: 500,
    },
    {
        id: "custom",
        name: "Custom",
        description: "Fine-tune all settings",
        icon: "⚙️",
        format: "auto",
        quality: 85,
    },
]

export function getPresetById(id: PresetId): CompressionPreset {
    return COMPRESSION_PRESETS.find(p => p.id === id) || COMPRESSION_PRESETS[0]!
}
