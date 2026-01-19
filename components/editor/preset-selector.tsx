"use client"

import { useEditor } from "./editor-context"
import { COMPRESSION_PRESETS, PresetId } from "@/lib/types/presets"
import { cn } from "@/lib/utils"

export function PresetSelector() {
    const { currentPreset, setCurrentPreset } = useEditor()

    return (
        <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Optimization Preset
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMPRESSION_PRESETS.map(preset => (
                    <button
                        key={preset.id}
                        onClick={() => setCurrentPreset(preset.id)}
                        className={cn(
                            "p-3 border text-left transition-colors transition-transform duration-200 group relative",
                            currentPreset === preset.id
                                ? "border-foreground bg-accent text-accent-foreground shadow-[4px_4px_0_var(--foreground)] -translate-y-1"
                                : "border-foreground/30 hover:border-foreground bg-background hover:shadow-[4px_4px_0_var(--foreground)] hover:-translate-y-1"
                        )}
                    >
                        <div className="flex items-start gap-2">
                            <span className="text-xl">{preset.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm uppercase tracking-tight truncate">
                                    {preset.name}
                                </div>
                                <div className={cn(
                                    "text-xs mt-0.5 truncate",
                                    currentPreset === preset.id ? "opacity-70" : "text-muted-foreground"
                                )}>
                                    {preset.description}
                                </div>
                            </div>
                        </div>

                        {/* Format & quality badge */}
                        {preset.id !== "custom" && (
                            <div className={cn(
                                "mt-2 flex items-center gap-2 text-xs font-mono",
                                currentPreset === preset.id ? "opacity-60" : "text-muted-foreground"
                            )}>
                                <span className="px-1.5 py-0.5 border border-current/30 uppercase text-[10px]">
                                    {preset.format}
                                </span>
                                <span>{preset.quality}%</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
