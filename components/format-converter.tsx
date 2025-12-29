"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface FormatConverterProps {
  onConvert: (format: "png" | "jpeg" | "webp") => void
  currentFormat: string
}

export function FormatConverter({ onConvert, currentFormat }: FormatConverterProps) {
  const [selectedFormat, setSelectedFormat] = useState<"png" | "jpeg" | "webp">("webp")

  const formats = [
    { value: "webp", label: "WebP", description: "Best compression, modern browsers" },
    { value: "jpeg", label: "JPEG", description: "Universal support, photos" },
    { value: "png", label: "PNG", description: "Lossless, transparency" },
  ] as const

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Convert Format</h3>
      <RadioGroup value={selectedFormat} onValueChange={(value) => setSelectedFormat(value as any)}>
        <div className="space-y-3">
          {formats.map((format) => (
            <div key={format.value} className="flex items-start space-x-3">
              <RadioGroupItem value={format.value} id={format.value} className="mt-1" />
              <Label htmlFor={format.value} className="cursor-pointer flex-1">
                <div className="font-medium">{format.label}</div>
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
