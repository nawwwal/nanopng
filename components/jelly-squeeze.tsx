"use strict";
"use client"

import React, { useEffect, useRef, useState, useLayoutEffect } from "react"
import { cn } from "@/lib/utils"
import dynamic from 'next/dynamic'

const JellyShader = dynamic(() => import("./ui/jelly-shader").then(mod => mod.JellyShader), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-transparent" />
})

interface JellySqueezeProps {
    className?: string
    title?: string
}

export function JellySqueeze({
    className,
    title = "Hold & Drag to Stretch"
}: JellySqueezeProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isReady, setIsReady] = useState(false)
    const [colors, setColors] = useState({
        foreground: "#000000",
        background: "#ffffff",
        accent: "#c8ff00"
    })

    const [squeezeValue, setSqueezeValue] = useState(0)
    const [compressedSize, setCompressedSize] = useState(2.4)
    const [savings, setSavings] = useState(0)
    const [seed, setSeed] = useState(0)

    // Animation state
    const animState = useRef({
        targetSqueeze: 0,
        displaySqueeze: 0,
        velocity: 0,
        springStiffness: 0.15,
        springDamping: 0.4,
        startTime: 0,
        rafId: 0,
        isMounted: false,
        isDragging: false,
        dragStartY: 0,
        maxSqueeze: 100,
        originalSize: 2.4,
    })

    useEffect(() => {
        animState.current.isMounted = true

        const updateColors = () => {
            const style = getComputedStyle(document.documentElement)
            setColors({
                foreground: style.getPropertyValue("--foreground").trim() || "#000000",
                background: style.getPropertyValue("--background").trim() || "#ffffff",
                accent: style.getPropertyValue("--accent").trim() || "#c8ff00",
            })
        }
        updateColors()

        const observer = new MutationObserver(updateColors)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

        setTimeout(() => setIsReady(true), 100)
        setSeed(Math.random() * 100)

        return () => {
            animState.current.isMounted = false
            observer.disconnect()
            cancelAnimationFrame(animState.current.rafId)
        }
    }, [])

    useLayoutEffect(() => {
        const state = animState.current
        state.startTime = Date.now()

        const animate = () => {
            if (!state.isMounted) return

            const now = Date.now()
            const dt = Math.min((now - state.startTime) / 1000, 0.1)
            state.startTime = now

            // Physics
            const displacement = state.targetSqueeze - state.displaySqueeze
            const springForce = displacement * state.springStiffness
            state.velocity += springForce
            state.velocity *= state.springDamping
            state.displaySqueeze += state.velocity * 60 * dt

            // Bounds / Bounce for rebound
            if (state.displaySqueeze < -80) {
                state.displaySqueeze = -80
                state.velocity *= -0.5
            }

            const rawRatio = state.displaySqueeze / state.maxSqueeze;
            const clampedRatio = Math.max(0, Math.min(1, rawRatio));
            const currentSavings = Math.min(0.7, clampedRatio * 0.7);

            setSqueezeValue(rawRatio)
            setCompressedSize(state.originalSize * (1 - currentSavings))
            setSavings(Math.round(currentSavings * 100))

            state.rafId = requestAnimationFrame(animate)
        }
        animate()

        // DRAG HANDLERS
        const handleMouseDown = (e: MouseEvent) => {
            state.isDragging = true
            state.dragStartY = e.clientY
            state.velocity = 0
            setSeed(Math.random() * 100)
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!state.isDragging) return

            const deltaY = e.clientY - state.dragStartY
            const sensitivity = 0.8
            state.targetSqueeze = Math.max(0, deltaY * sensitivity)
        }

        const handleMouseUp = () => {
            if (state.isDragging) {
                state.isDragging = false
                state.targetSqueeze = 0 // SNAP BACK
            }
        }

        const handleMouseLeave = () => {
            if (state.isDragging) {
                state.isDragging = false
                state.targetSqueeze = 0
            }
        }

        const container = containerRef.current
        if (container) {
            container.addEventListener("mousedown", handleMouseDown)
            container.addEventListener("mouseleave", handleMouseLeave)
        }
        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("mouseup", handleMouseUp)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mouseup", handleMouseUp)
            if (container) {
                container.removeEventListener("mousedown", handleMouseDown)
                container.removeEventListener("mouseleave", handleMouseLeave)
            }
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative flex flex-col items-center justify-center w-full h-full min-h-[300px] overflow-hidden select-none bg-accent/5 cursor-grab active:cursor-grabbing",
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

            {/* Shader Container */}
            <div className={cn("absolute inset-0 z-10 transition-opacity duration-700", isReady ? "opacity-100" : "opacity-0")}>
                {isReady && <JellyShader squeeze={squeezeValue} colors={colors} seed={seed} />}
            </div>

            {/* HTML Overlay for Text */}
            <div className="absolute bottom-8 left-0 right-0 z-20 flex flex-col items-center pointer-events-none">
                {savings > 5 && (
                    <div className="bg-accent text-black px-2 py-0.5 mb-2 font-bold font-mono text-sm leading-none animate-in fade-in slide-in-from-bottom-2">
                        -{savings}%
                    </div>
                )}
                <div className="font-bold text-2xl font-mono text-foreground">
                    {compressedSize.toFixed(1)} MB
                </div>
            </div>

            {/* Loading State */}
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none",
                    isReady ? "opacity-0" : "opacity-100"
                )}
            >
                <div className="w-24 h-[2px] bg-foreground/20 overflow-hidden">
                    <div className="h-full w-1/3 bg-foreground animate-loader" />
                </div>
            </div>

            <style jsx>{`
                @keyframes loader {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(400%); }
                }
                .animate-loader {
                  animation: loader 1s infinite ease-in-out;
                }
            `}</style>
        </div>
    )
}
