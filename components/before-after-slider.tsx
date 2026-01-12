"use client"

import { useState, useRef, useEffect } from "react"

interface BeforeAfterSliderProps {
  beforeImage?: string
  afterImage?: string
  beforeLabel?: string
  afterLabel?: string
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Original",
  afterLabel = "Optimized",
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = (x / rect.width) * 100
    setSliderPosition(Math.max(0, Math.min(100, percentage)))
  }

  const handleMouseDown = () => setIsDragging(true)
  const handleMouseUp = () => setIsDragging(false)

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    handleMove(e.clientX)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return
    handleMove(e.touches[0].clientX)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = 5
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault()
        setSliderPosition((prev) => Math.max(0, prev - step))
        break
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault()
        setSliderPosition((prev) => Math.min(100, prev + step))
        break
      case "Home":
        e.preventDefault()
        setSliderPosition(0)
        break
      case "End":
        e.preventDefault()
        setSliderPosition(100)
        break
    }
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove)
      document.addEventListener("touchend", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="Image comparison slider"
      aria-valuenow={Math.round(sliderPosition)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative w-full aspect-video bg-secondary cursor-col-resize select-none focus-visible:ring-2 focus-visible:ring-foreground outline-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onKeyDown={handleKeyDown}
    >
      {/* After Image (Optimized) - Full width */}
      <div className="absolute inset-0">
        <img
          src={afterImage || "/placeholder.svg"}
          alt={afterLabel}
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-2 right-2 accent-bg px-2 py-1 text-xs font-bold uppercase">
          {afterLabel}
        </div>
      </div>

      {/* Before Image (Original) - Clipped */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
        }}
      >
        <img
          src={beforeImage || "/placeholder.svg"}
          alt={beforeLabel}
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-2 left-2 bg-foreground text-background px-2 py-1 text-xs font-bold uppercase">
          {beforeLabel}
        </div>
      </div>

      {/* Slider Handle - Brutalist */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-foreground"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-foreground border-2 border-background flex items-center justify-center">
          <svg className="w-4 h-4 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
