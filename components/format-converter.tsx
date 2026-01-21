"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { canEncodeAvif } from "@/lib/core/format-capabilities"
import { Badge } from "@/components/ui/badge"

interface FormatConverterProps {
  onConvert: (format: "png" | "jpeg" | "webp" | "avif") => void
  currentFormat: string
}

export function FormatConverter({ onConvert, currentFormat }: FormatConverterProps) {
  const [selectedFormat, setSelectedFormat] = useState<"png" | "jpeg" | "webp" | "avif">("webp")
  const [avifSupported, setAvifSupported] = useState<boolean>(false)

  useEffect(() => {
    canEncodeAvif().then(setAvifSupported)
  }, [])

  const formats = [
    { 
      value: "avif" as const, 
      label: "AVIF", 
      description: "Best compression (30-50% better than WebP)", 
      supported: avifSupported 
    },
    { value: "webp" as const, label: "WebP", description: "Best compression, modern browsers", supported: true },
    { value: "jpeg" as const, label: "JPEG", description: "Universal support, photos", supported: true },
    { value: "png" as const, label: "PNG", description: "Lossless, transparency", supported: true },
  ]

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Convert Format</h3>
      <RadioGroup value={selectedFormat} onValueChange={(value) => setSelectedFormat(value as "png" | "jpeg" | "webp" | "avif")}>
        <div className="space-y-3">
          {formats.map((format) => (
            <div key={format.value} className="flex items-start space-x-3">
              <RadioGroupItem 
                value={format.value} 
                id={format.value} 
                className="mt-1" 
                disabled={!format.supported}
              />
              <Label 
                htmlFor={format.value} 
                className={`cursor-pointer flex-1 ${!format.supported ? "opacity-50" : ""}`}
              >
                <div className="font-medium flex items-center gap-2">
                  {format.label}
                  {format.value === "avif" && !format.supported && (
                    <Badge variant="outline" className="text-xs">Not supported</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{format.description}</div>
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>
      <Button
        onClick={() => onConvert(selectedFormat)}
        className="w-full mt-4"
        disabled={selectedFormat === currentFormat}
      >
        Convert to {selectedFormat.toUpperCase()}
      </Button>
    </Card>
  )
}
