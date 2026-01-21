"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  beforeLabel?: string
  afterLabel?: string
  className?: string
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down"
  beforeWidth?: number
  beforeHeight?: number
  afterWidth?: number
  afterHeight?: number
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Original",
  afterLabel = "Compressed",
  className,
  objectFit = "cover",
  beforeWidth,
  beforeHeight,
  afterWidth,
  afterHeight
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate unified aspect ratio for container when images have different dimensions
  // Use the aspect ratio that fits both images (the wider one)
  const containerAspectRatio = useMemo(() => {
    const beforeAspect = beforeWidth && beforeHeight ? beforeWidth / beforeHeight : null
    const afterAspect = afterWidth && afterHeight ? afterWidth / afterHeight : null

    // If both are available, use the wider aspect ratio to ensure both fit
    if (beforeAspect && afterAspect) {
      // Use the aspect ratio closer to 16:9 for better display, or the wider one
      return Math.max(beforeAspect, afterAspect)
    }

    return beforeAspect || afterAspect || null
  }, [beforeWidth, beforeHeight, afterWidth, afterHeight])

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

  // Determine if we should use inline aspect ratio or CSS class
  const hasExplicitHeight = className?.includes("h-")
  const hasExplicitAspect = className?.includes("aspect-")
  const useInlineAspect = !hasExplicitHeight && !hasExplicitAspect && containerAspectRatio

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden cursor-col-resize select-none ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Only use aspect-video default if no explicit height, aspect class, or calculated ratio
        !hasExplicitHeight && !hasExplicitAspect && !containerAspectRatio ? "aspect-video" : "",
        className
      )}
      style={useInlineAspect ? { aspectRatio: containerAspectRatio } : undefined}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      role="slider"
      aria-label="Comparison slider"
      aria-valuenow={sliderPosition}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(sliderPosition)}% original image visible`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          setSliderPosition((prev) => Math.max(0, prev - 5))
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          setSliderPosition((prev) => Math.min(100, prev + 5))
        }
      }}
    >
      {/* After Image (Compressed) - Full width */}
      <div className="absolute inset-0">
        <img
          src={afterImage || "/placeholder.svg"}
          alt={afterLabel}
          width={afterWidth}
          height={afterHeight}
          className={cn("w-full h-full pointer-events-none select-none",
            objectFit === "contain" ? "object-contain" :
              objectFit === "cover" ? "object-cover" : "object-fill"
          )}
          draggable={false}
        />
        <div className="absolute top-4 right-4 bg-accent/90 text-accent-foreground px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm z-10 pointer-events-none select-none">
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
          width={beforeWidth}
          height={beforeHeight}
          className={cn("w-full h-full pointer-events-none select-none",
            objectFit === "contain" ? "object-contain" :
              objectFit === "cover" ? "object-cover" : "object-fill"
          )}
          draggable={false}
        />
        <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm z-10 pointer-events-none select-none">
          {beforeLabel}
        </div>
      </div>

      {/* Slider Handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-20"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
