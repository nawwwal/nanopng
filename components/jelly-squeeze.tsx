"use client"

import React, { useEffect, useRef, useState, useLayoutEffect } from "react"
import { cn } from "@/lib/utils"

interface JellySqueezeProps {
    /**
     * Additional CSS classes
     */
    className?: string
    /**
     * Title text to display
     * @default "Move cursor to compress"
     */
    title?: string
}

export function JellySqueeze({
    className,
    title = "Move cursor to compress"
}: JellySqueezeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isReady, setIsReady] = useState(false)

    // Animation state
    const animState = useRef({
        squeezeAmount: 0,
        targetSqueeze: 0,
        displaySqueeze: 0,
        velocity: 0, // For elastic spring
        smoothing: 0.12, // Slightly higher for more responsive feel
        springStiffness: 0.15, // Spring tension
        springDamping: 0.75, // Damping factor (lower = more bouncy)
        startTime: 0,
        rafId: 0,
        isMounted: false,
        isMouseOver: false, // Track if mouse is in container
        maxSqueeze: 200,
        originalSize: 2.4, // MB
        blocks: [] as { x: number; y: number; size: number; offset: number; isAccent: boolean }[]
    })

    // Initialize blocks pattern with random accent assignment
    useEffect(() => {
        animState.current.isMounted = true

        // Create grid of blocks for visualization with random accent colors
        const blocks: typeof animState.current.blocks = []
        const gridSize = 6
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                blocks.push({
                    x: i,
                    y: j,
                    size: 1,
                    offset: Math.random() * Math.PI * 2,
                    isAccent: Math.random() < 0.25 // ~25% chance of being accent colored
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

    // Canvas & mouse follow setup
    useLayoutEffect(() => {
        if (!isReady || !canvasRef.current) return

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

        // Animation loop with elastic spring physics
        state.startTime = Date.now()
        const animate = () => {
            if (!state.isMounted || !ctx) return

            const now = Date.now()
            const dt = Math.min((now - state.startTime) / 1000, 0.1)
            state.startTime = now

            // Elastic spring physics
            const displacement = state.targetSqueeze - state.displaySqueeze
            const springForce = displacement * state.springStiffness
            state.velocity += springForce
            state.velocity *= state.springDamping // Apply damping
            state.displaySqueeze += state.velocity * 60 * dt

            // Clamp to bounds but allow slight overshoot for elasticity
            if (state.displaySqueeze < -20) {
                state.displaySqueeze = -20
                state.velocity *= -0.3 // Bounce back
            }
            if (state.displaySqueeze > state.maxSqueeze + 20) {
                state.displaySqueeze = state.maxSqueeze + 20
                state.velocity *= -0.3 // Bounce back
            }

            // Calculate compression percentage (0-70%)
            const clampedSqueeze = Math.max(0, Math.min(state.maxSqueeze, state.displaySqueeze))
            const squeezePercent = (clampedSqueeze / state.maxSqueeze) * 0.7
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
            const squeezeEffect = Math.max(0, state.displaySqueeze) / state.maxSqueeze

            state.blocks.forEach((block) => {
                // Calculate squeeze distortion
                const distanceFromCenter = Math.abs(block.y - gridSize / 2) / (gridSize / 2)
                const squeezeY = squeezeEffect * (1 - distanceFromCenter) * 0.4

                const x = centerX - baseSize / 2 + block.x * blockSize
                const y = centerY - baseSize / 2 + block.y * blockSize * (1 - squeezeY * 0.3)

                // Block size reduces with compression
                const currentBlockSize = blockSize * (1 - squeezeEffect * 0.15)
                const gap = 3 + squeezeEffect * 2

                // Use pre-assigned random accent pattern
                if (block.isAccent && squeezeEffect > 0.1) {
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
            const frameY = centerY - baseSize / 2 + (clampedSqueeze / state.maxSqueeze) * 30
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

        // Mouse move handler - always active
        const handleMouseMove = (e: MouseEvent) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect()
                const normalizedY = (e.clientY - rect.top) / rect.height
                state.targetSqueeze = Math.max(0, Math.min(state.maxSqueeze, normalizedY * state.maxSqueeze))
            }
        }

        // Mouse enter/leave for rebound effect
        const handleMouseEnter = () => {
            state.isMouseOver = true
        }

        const handleMouseLeave = () => {
            state.isMouseOver = false
            // Spring back to original position with a bounce
            state.targetSqueeze = 0
        }

        const container = containerRef.current
        if (container) {
            container.addEventListener("mouseenter", handleMouseEnter)
            container.addEventListener("mouseleave", handleMouseLeave)
        }
        window.addEventListener("mousemove", handleMouseMove)

        return () => {
            window.removeEventListener("resize", setCanvasSize)
            window.removeEventListener("mousemove", handleMouseMove)
            if (container) {
                container.removeEventListener("mouseenter", handleMouseEnter)
                container.removeEventListener("mouseleave", handleMouseLeave)
            }
            cancelAnimationFrame(state.rafId)
        }
    }, [isReady])

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
