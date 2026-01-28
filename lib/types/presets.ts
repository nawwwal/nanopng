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
    lossless?: boolean
}

export const COMPRESSION_PRESETS: CompressionPreset[] = [
    {
        id: "photo",
        name: "Photo",
        description: "Keeps skin tones natural and skies smooth",
        icon: "📷",
        format: "webp",
        quality: 78,
        maxWidth: 2560,
        maxHeight: 1440,
    },
    {
        id: "graphic",
        name: "Graphic / Logo",
        description: "Preserves crisp text and brand colors",
        icon: "🎨",
        format: "png",
        quality: 85,
        lossless: false,
    },
    {
        id: "social",
        name: "Social Media",
        description: "Hits Instagram's sweet spot: small files, no visible loss",
        icon: "📱",
        format: "jpeg",
        quality: 72,
        maxWidth: 1200,
        maxHeight: 1200,
    },
    {
        id: "custom",
        name: "Custom",
        description: "For pixel-peepers who want total control",
        icon: "⚙️",
        format: "auto",
        quality: 80,
    },
]

export function getPresetById(id: PresetId): CompressionPreset {
    return COMPRESSION_PRESETS.find(p => p.id === id) || COMPRESSION_PRESETS[0]!
}
