"use client"

import { useState, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SettingHintProps {
    label: string
    hint: string
    children: ReactNode
    className?: string
    inline?: boolean
}

export function SettingHint({ label, hint, children, className, inline }: SettingHintProps) {
    const [showHint, setShowHint] = useState(false)

    const hintButton = (
        <button
            type="button"
            className={cn(
                "w-4 h-4 text-[10px] font-bold border transition-colors shrink-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                showHint
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-foreground/30 hover:border-foreground hover:text-foreground"
            )}
            onClick={() => setShowHint(!showHint)}
            onMouseEnter={() => setShowHint(true)}
            onMouseLeave={() => setShowHint(false)}
            onFocus={() => setShowHint(true)}
            onBlur={() => setShowHint(false)}
            aria-label={`More info about ${label}`}
            aria-expanded={showHint}
        >
            ?
        </button>
    )

    const hintPopover = (
        <div
            className={cn(
                "text-xs text-muted-foreground font-mono overflow-hidden transition-all duration-200",
                showHint ? "max-h-20 opacity-100 mb-2" : "max-h-0 opacity-0"
            )}
            role="tooltip"
            aria-hidden={!showHint}
        >
            <div className="py-1 px-2 border-l-2 border-accent bg-accent/5">
                {hint}
            </div>
        </div>
    )

    // Inline mode: [checkbox] [label] [?] in a row
    if (inline) {
        return (
            <div className={cn("space-y-1", className)}>
                <div className="flex items-center gap-2">
                    {children}
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {label}
                    </label>
                    {hintButton}
                </div>
                {hintPopover}
            </div>
        )
    }

    // Default mode: [label] [?], then hint, then children
    return (
        <div className={cn("space-y-1", className)}>
            <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                </label>
                {hintButton}
            </div>
            {hintPopover}
            {children}
        </div>
    )
}
