"use server"

import { put } from "@vercel/blob"
import type { CompressedImage } from "@/types/image"

export async function compressImage(formData: FormData): Promise<CompressedImage> {
  try {
    const file = formData.get("file") as File
    const originalSize = Number(formData.get("originalSize"))
    const compressedSize = Number(formData.get("compressedSize"))

    if (!file) {
      throw new Error("No file provided")
    }

    // Get original file format
    const originalFormat = file.type.split("/")[1] as "png" | "jpeg" | "webp" | "avif"

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate filename with correct extension
    const fileExtension = originalFormat === "jpeg" ? "jpg" : originalFormat
    const baseFilename = file.name.replace(/\.[^/.]+$/, "")
    const newFilename = `compressed-${Date.now()}-${baseFilename}.${fileExtension}`

    // Upload compressed image to Vercel Blob
    const blob = await put(newFilename, buffer, {
      access: "public",
      addRandomSuffix: true,
    })

    // Calculate savings
    const savings = ((originalSize - compressedSize) / originalSize) * 100

    return {
      id: Math.random().toString(36).substr(2, 9),
      originalName: file.name,
      originalSize,
      compressedSize,
      compressedUrl: blob.url,
      savings,
      format: originalFormat,
      originalFormat: originalFormat,
      status: "success",
    }
  } catch (error) {
    console.error("[v0] Compression error:", error)
    throw new Error("Failed to compress image")
  }
}
