"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImageAnalyzer } from "@/components/image-analyzer"
import type { CompressedImage } from "@/types/image"
import { cn } from "@/lib/utils"

interface CompressionResultCardProps {
  image: CompressedImage
}

export function CompressionResultCard({ image }: CompressionResultCardProps) {
  const [showAnalyzer, setShowAnalyzer] = useState(false)

  const handleDownload = () => {
    if (!image.blobUrl && !image.originalBlobUrl) return
    
    const url = image.blobUrl || image.originalBlobUrl
    if (!url) return

    const a = document.createElement("a")
    a.href = url
    const fileExtension = image.format === "jpeg" ? "jpg" : image.format
    a.download = `compressed-${image.originalName.replace(/\.[^/.]+$/, "")}.${fileExtension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i]
  }

  const statusConfig = {
    queued: {
      icon: (
        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
           <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
        </div>
      ),
      text: "Queued",
      color: "text-muted-foreground"
    },
    analyzing: {
      icon: (
        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
           <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        </div>
      ),
      text: "Analyzing...",
      color: "text-blue-600"
    },
    compressing: {
      icon: (
        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        </div>
      ),
      text: "Optimizing...",
      color: "text-amber-600"
    },
    error: {
      icon: (
        <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
           </svg>
        </div>
      ),
      text: "Failed",
      color: "text-red-600"
    }
  }

  if (image.status !== "completed" && image.status !== "already-optimized") {
    const config = statusConfig[image.status] || statusConfig.queued
    return (
      <Card className="p-4 border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {config.icon}
            <div>
              <p className="font-semibold text-foreground text-sm sm:text-base">{image.originalName}</p>
              <p className={cn("text-xs sm:text-sm font-medium", config.color)}>{image.error || config.text}</p>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const isAlreadyOptimized = image.status === "already-optimized"
  const wasConverted = image.originalFormat && image.originalFormat !== image.format

  return (
    <Card className="group overflow-hidden border-border/60 bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          {/* Left Section: Icon + Info */}
          <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
            {/* Thumbnail/Icon */}
            <div className={cn(
                "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                isAlreadyOptimized ? 'bg-green-50 text-green-600' : 'bg-primary/5 text-primary'
            )}>
              {isAlreadyOptimized ? (
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            {/* Text Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground truncate text-sm sm:text-base">{image.originalName}</p>
                {wasConverted && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-secondary text-secondary-foreground">
                    {image.originalFormat?.toUpperCase()} → {image.format.toUpperCase()}
                  </Badge>
                )}
                 {isAlreadyOptimized && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-green-700 border-green-200 bg-green-50">
                    Optimized
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                   <span className="line-through opacity-70">{formatFileSize(image.originalSize)}</span>
                   {!isAlreadyOptimized && (
                       <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        <span className="text-foreground font-medium">{formatFileSize(image.compressedSize)}</span>
                       </>
                   )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: Savings + Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-4 pl-16 sm:pl-0">
             {!isAlreadyOptimized && image.savings > 0 && (
              <div className="text-right">
                 <span className="block text-sm font-bold text-green-600">-{image.savings.toFixed(0)}%</span>
                 <span className="block text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Saved</span>
              </div>
            )}
            
            <div className="flex gap-2">
                <Button 
                    onClick={() => setShowAnalyzer(!showAnalyzer)} 
                    size="icon" 
                    variant="ghost" 
                    className="h-9 w-9 rounded-full hover:bg-secondary text-muted-foreground"
                    title="Analyze Details"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Button>
                
                {!isAlreadyOptimized && (
                    <Button onClick={handleDownload} size="sm" className="rounded-full px-4 shadow-sm h-9 text-xs sm:text-sm">
                    Download
                    </Button>
                )}
            </div>
          </div>
        </div>
      </div>

      {showAnalyzer && (
        <div className="border-t border-border/40 bg-secondary/20 p-5 animate-in slide-in-from-top-2 duration-200">
          <ImageAnalyzer image={image} />
        </div>
      )}
    </Card>
  )
}
