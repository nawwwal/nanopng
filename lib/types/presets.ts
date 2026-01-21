import { OutputFormat } from "@/lib/types/compression"

export type PresetId = "photo" | "graphic" | "social" | "custom"

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
        id: "photo",
        name: "Photo",
        description: "Best for photographs with smooth gradients",
        icon: "📷",
        format: "webp",
        quality: 85,
        maxWidth: 2560,
        maxHeight: 1440,
    },
    {
        id: "graphic",
        name: "Graphic / Logo",
        description: "Sharp edges, flat colors, illustrations",
        icon: "🎨",
        format: "png",
        quality: 100,
    },
    {
        id: "social",
        name: "Social Media",
        description: "Optimized for Instagram, Twitter, Facebook",
        icon: "📱",
        format: "jpeg",
        quality: 85,
        maxWidth: 1200,
        maxHeight: 1200,
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
