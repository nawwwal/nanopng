"use client"

import React, { useEffect, useRef, useState, useLayoutEffect } from "react"
import gsap from "gsap"
import { Draggable } from "gsap/dist/Draggable"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Register GSAP plugin
if (typeof window !== "undefined") {
    gsap.registerPlugin(Draggable)
}

interface JellySqueezeProps {
    /**
     * Whether to show the bottom controls
     * @default true
     */
    showControls?: boolean
    /**
     * Additional CSS classes
     */
    className?: string
    /**
     * Title text to display
     * @default "Drag to compress"
     */
    title?: string
}

export function JellySqueeze({
    showControls = true,
    className,
    title = "Drag to compress"
}: JellySqueezeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const dragTriggerRef = useRef<HTMLDivElement>(null)
    const [followMouse, setFollowMouse] = useState(false)
    const [isReady, setIsReady] = useState(false)

    // Animation state
    const animState = useRef({
        squeezeAmount: 0,
        targetSqueeze: 0,
        displaySqueeze: 0,
        smoothing: 0.08,
        startTime: 0,
        rafId: 0,
        isMounted: false,
        maxSqueeze: 200,
        originalSize: 2.4, // MB
        blocks: [] as { x: number; y: number; size: number; offset: number }[]
    })

    // Initialize blocks pattern
    useEffect(() => {
        animState.current.isMounted = true

        // Create grid of blocks for visualization
        const blocks: typeof animState.current.blocks = []
        const gridSize = 6
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                blocks.push({
                    x: i,
                    y: j,
                    size: 1,
                    offset: Math.random() * Math.PI * 2
                })
            }
        }
        animState.current.blocks = blocks

        // Small delay to ensure proper mounting
        setTimeout(() => setIsReady(true), 100)

        return () => {
            animState.current.isMounted = false
            cancelAnimationFrame(animState.current.rafId)
        }
    }, [])

    // Canvas & GSAP setup
    useLayoutEffect(() => {
        if (!isReady || !canvasRef.current || !dragTriggerRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        const state = animState.current

        // Get computed styles for theming
        const getColors = () => {
            const style = getComputedStyle(document.documentElement)
            return {
                foreground: style.getPropertyValue("--foreground").trim() || "#000000",
                background: style.getPropertyValue("--background").trim() || "#ffffff",
                accent: style.getPropertyValue("--accent").trim() || "#c8ff00",
                muted: style.getPropertyValue("--muted-foreground").trim() || "#666666"
            }
        }

        // Canvas sizing
        const setCanvasSize = () => {
            if (!canvas) return
            const ratio = window.devicePixelRatio || 1
            const rect = canvas.getBoundingClientRect()
            const width = rect.width
            const height = rect.height

            canvas.width = width * ratio
            canvas.height = height * ratio

            if (ctx) {
                ctx.scale(ratio, ratio)
            }
        }

        setCanvasSize()
        window.addEventListener("resize", setCanvasSize)

        // Initialize GSAP position
        gsap.set(canvas, { y: 0 })

        // Draggable setup
        const draggable = Draggable.create(canvas, {
            trigger: dragTriggerRef.current,
            type: "y",
            inertia: true,
            bounds: { minY: 0, maxY: state.maxSqueeze },
            allowNativeTouchScrolling: false,
            dragResistance: 0.3,
            edgeResistance: 0.9,
            minDuration: 0.5,
            maxDuration: 1.5,
            onDrag: function () {
                state.targetSqueeze = this.y
            },
            onThrowUpdate: function () {
                state.targetSqueeze = this.y
            }
        })[0]

        // Animation loop
        state.startTime = Date.now()
        const animate = () => {
            if (!state.isMounted || !ctx) return

            const now = Date.now()
            const dt = Math.min((now - state.startTime) / 1000, 0.1)
            state.startTime = now

            // Smooth lerp
            const dampening = 1.0 - Math.exp(-state.smoothing * 60 * dt)
            state.displaySqueeze += (state.targetSqueeze - state.displaySqueeze) * dampening

            // Calculate compression percentage (0-70%)
            const squeezePercent = (state.displaySqueeze / state.maxSqueeze) * 0.7
            const compressedSize = state.originalSize * (1 - squeezePercent)

            // Clear canvas
            const width = canvas.clientWidth
            const height = canvas.clientHeight
            ctx.clearRect(0, 0, width, height)

            const colors = getColors()
            const isDark = colors.background.includes("0a") || colors.foreground === "#ffffff"

            // Draw compression visualization
            const centerX = width / 2
            const centerY = height / 2
            const baseSize = Math.min(width, height) * 0.6
            const gridSize = 6
            const blockSize = baseSize / gridSize

            // Draw blocks with squeeze effect
            state.blocks.forEach((block) => {
                const squeezeEffect = state.displaySqueeze / state.maxSqueeze

                // Calculate squeeze distortion
                const distanceFromCenter = Math.abs(block.y - gridSize / 2) / (gridSize / 2)
                const squeezeY = squeezeEffect * (1 - distanceFromCenter) * 0.4

                const x = centerX - baseSize / 2 + block.x * blockSize
                const y = centerY - baseSize / 2 + block.y * blockSize * (1 - squeezeY * 0.3)

                // Block size reduces with compression
                const currentBlockSize = blockSize * (1 - squeezeEffect * 0.15)
                const gap = 3 + squeezeEffect * 2

                // Alternate colors for checkerboard pattern
                const isAccent = (block.x + block.y) % 3 === 0

                if (isAccent && squeezeEffect > 0.1) {
                    ctx.fillStyle = colors.accent
                } else {
                    ctx.fillStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)"
                }

                // Draw block with brutalist sharp edges
                ctx.fillRect(
                    x + gap / 2,
                    y + gap / 2 + squeezeEffect * 30,
                    currentBlockSize - gap,
                    currentBlockSize - gap
                )
            })

            // Draw border frame
            ctx.strokeStyle = isDark ? "#ffffff" : "#000000"
            ctx.lineWidth = 3
            const frameY = centerY - baseSize / 2 + (state.displaySqueeze / state.maxSqueeze) * 30
            const frameHeight = baseSize * (1 - squeezePercent * 0.4)
            ctx.strokeRect(
                centerX - baseSize / 2 - 10,
                frameY - 10,
                baseSize + 20,
                frameHeight + 20
            )

            // Draw file size indicator
            ctx.font = "bold 24px 'JetBrains Mono', monospace"
            ctx.textAlign = "center"
            ctx.fillStyle = isDark ? "#ffffff" : "#000000"
            ctx.fillText(
                `${compressedSize.toFixed(1)} MB`,
                centerX,
                height - 40
            )

            // Draw savings badge if compressed
            if (squeezePercent > 0.05) {
                const savingsText = `-${Math.round(squeezePercent * 100)}%`
                ctx.font = "bold 16px 'JetBrains Mono', monospace"
                const textWidth = ctx.measureText(savingsText).width

                // Accent background
                ctx.fillStyle = colors.accent
                ctx.fillRect(centerX - textWidth / 2 - 8, height - 75, textWidth + 16, 24)

                // Text
                ctx.fillStyle = "#000000"
                ctx.fillText(savingsText, centerX, height - 57)
            }

            state.rafId = requestAnimationFrame(animate)
        }

        animate()

        // Mouse move handler for follow mode
        const handleMouseMove = (e: MouseEvent) => {
            if (followMouse && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                const normalizedY = (e.clientY - rect.top) / rect.height
                state.targetSqueeze = Math.max(0, Math.min(state.maxSqueeze, normalizedY * state.maxSqueeze))
            }
        }

        if (followMouse) {
            window.addEventListener("mousemove", handleMouseMove)
            draggable.disable()
        } else {
            draggable.enable()
            gsap.set(canvas, { y: state.displaySqueeze })
            draggable.update()
        }

        return () => {
            window.removeEventListener("resize", setCanvasSize)
            window.removeEventListener("mousemove", handleMouseMove)
            cancelAnimationFrame(state.rafId)
            draggable.kill()
        }
    }, [isReady, followMouse])

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative flex flex-col items-center justify-center w-full h-full min-h-[300px] overflow-hidden select-none",
                className
            )}
        >
            {/* Header */}
            <div
                className={cn(
                    "absolute top-4 left-0 right-0 z-20 text-center pointer-events-none transition-opacity duration-500",
                    isReady ? "opacity-100" : "opacity-0"
                )}
            >
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {title}
                </h2>
            </div>

            {/* Canvas Container */}
            <div className="relative w-full h-full flex items-center justify-center">
                <canvas
                    ref={canvasRef}
                    className={cn(
                        "w-full h-full transition-opacity duration-700",
                        isReady ? "opacity-100" : "opacity-0"
                    )}
                />

                {/* Invisible Drag Trigger */}
                <div
                    ref={dragTriggerRef}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing z-20"
                    aria-label="Drag to squeeze"
                />
            </div>

            {/* Loading State */}
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                    isReady ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
            >
                <div className="w-24 h-[2px] bg-foreground/20 overflow-hidden">
                    <div className="h-full w-1/3 bg-foreground animate-loader" />
                </div>
            </div>

            {/* Bottom Controls */}
            {showControls && (
                <div
                    className={cn(
                        "absolute bottom-4 w-full flex justify-center z-20 transition-opacity duration-500",
                        isReady ? "opacity-100" : "opacity-0"
                    )}
                >
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase group">
                        <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={followMouse}
                            onChange={(e) => setFollowMouse(e.target.checked)}
                        />
                        <div className="w-4 h-4 border-2 border-foreground flex items-center justify-center transition-colors peer-checked:bg-foreground">
                            <Check
                                className={cn(
                                    "w-3 h-3 transition-opacity",
                                    followMouse ? "text-background opacity-100" : "opacity-0"
                                )}
                                strokeWidth={3}
                            />
                        </div>
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                            Follow mouse
                        </span>
                    </label>
                </div>
            )}

            {/* Loader animation style */}
            <style jsx>{`
        @keyframes loader {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
        .animate-loader {
          animation: loader 1s infinite ease-in-out;
        }
      `}</style>
        </div>
    )
}
