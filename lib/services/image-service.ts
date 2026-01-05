import { CompressedImage, ImageAnalysis, ImageFormat } from "@/types/image"
import { canEncodeAvif } from "@/lib/core/format-capabilities"
import { copyMetadata } from "@/lib/core/metadata"
import { CompressionJob, CompressionResult } from "@/lib/workers/image-processor.worker"

export class ImageService {
  /**
   * Calculate the ratio of solid regions
   */
  private static calculateSolidRegionRatio(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): number {
    const blockSize = 4
    let solidBlocks = 0
    let totalBlocks = 0

    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        totalBlocks++
        let minR = 255, maxR = 0
        let minG = 255, maxG = 0
        let minB = 255, maxB = 0

        for (let by = 0; by < blockSize; by++) {
          for (let bx = 0; bx < blockSize; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4
            const r = data[idx]
            minR = Math.min(minR, r); maxR = Math.max(maxR, r)
            const g = data[idx + 1]
            minG = Math.min(minG, g); maxG = Math.max(maxG, g)
            const b = data[idx + 2]
            minB = Math.min(minB, b); maxB = Math.max(maxB, b)
          }
        }
        const colorDiff = (maxR - minR) + (maxG - minG) + (maxB - minB)
        if (colorDiff < 5) solidBlocks++
      }
    }
    return totalBlocks > 0 ? solidBlocks / totalBlocks : 0
  }

  // ... (Keep analysis helpers or move them to worker? keeping here for simplicity as they need canvas read)
  // Re-implementing simplified analysis helpers for brevity in this refactor, 
  // or I should keep the original logic. 
  // I will keep the original analysis helpers but optimized/compacted to save tokens if possible,
  // or just copy them back.

  private static calculateEdgeSharpnessRatio(data: Uint8ClampedArray, width: number, height: number) {
    // ... (Rest of analysis code is valid, I will preserve it in full in real edit)
    // For this tool call, I need to provide the FULL content if I use replace_file_content on the whole class.
    // I will rely on the previous logic but I will just assume I have them.
    // Wait, I can't assuming. I need to write the code.
    // I'll copy the analysis methods from the previous read.

    let sharpEdges = 0, gradualTransitions = 0, totalTransitions = 0
    // Horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const i1 = (y * width + x - 1) * 4, i2 = (y * width + x) * 4
        const diff = Math.abs(data[i1] - data[i2]) + Math.abs(data[i1 + 1] - data[i2 + 1]) + Math.abs(data[i1 + 2] - data[i2 + 2])
        totalTransitions++
        if (diff > 50) sharpEdges++; else if (diff < 20) gradualTransitions++
      }
    }
    // Vertical
    for (let y = 1; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i1 = ((y - 1) * width + x) * 4, i2 = (y * width + x) * 4
        const diff = Math.abs(data[i1] - data[i2]) + Math.abs(data[i1 + 1] - data[i2 + 1]) + Math.abs(data[i1 + 2] - data[i2 + 2])
        totalTransitions++
        if (diff > 50) sharpEdges++; else if (diff < 20) gradualTransitions++
      }
    }
    return { sharpEdges, gradualTransitions, ratio: totalTransitions ? gradualTransitions / totalTransitions : 0 }
  }

  private static calculateHistogramSpread(data: Uint8ClampedArray): number {
    const bins = 32, histogram = new Array(bins * bins * bins).fill(0)
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.min(bins - 1, (data[i] / 255 * bins) | 0)
      const g = Math.min(bins - 1, (data[i + 1] / 255 * bins) | 0)
      const b = Math.min(bins - 1, (data[i + 2] / 255 * bins) | 0)
      histogram[r * bins * bins + g * bins + b]++
      total++
    }
    let entropy = 0
    for (const h of histogram) if (h > 0) { const p = h / total; entropy -= p * Math.log2(p) }
    return entropy / Math.log2(bins * bins * bins)
  }

  private static calculateTextureScore(data: Uint8ClampedArray, width: number, height: number): number {
    const blockSize = 8, sampleBlocks = 20
    let totalVar = 0, sampled = 0
    const gridCols = Math.ceil(Math.sqrt(sampleBlocks)), gridRows = Math.ceil(sampleBlocks / gridCols)
    const stepX = Math.max(1, ((width - blockSize) / gridCols) | 0), stepY = Math.max(1, ((height - blockSize) / gridRows) | 0)

    for (let i = 0; i < sampleBlocks; i++) {
      const gx = i % gridCols, gy = (i / gridCols) | 0
      const x = Math.min(width - blockSize - 1, gx * stepX), y = Math.min(height - blockSize - 1, gy * stepY)
      let sr = 0, sg = 0, sb = 0, sr2 = 0, sg2 = 0, sb2 = 0, n = 0
      for (let by = 0; by < blockSize && y + by < height; by++)
        for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
          const idx = ((y + by) * width + x + bx) * 4
          const r = data[idx], g = data[idx + 1], b = data[idx + 2]
          sr += r; sg += g; sb += b; sr2 += r * r; sg2 += g * g; sb2 += b * b; n++
        }
      if (n > 0) {
        const vr = sr2 / n - (sr / n) ** 2, vg = sg2 / n - (sg / n) ** 2, vb = sb2 / n - (sb / n) ** 2
        totalVar += (vr + vg + vb) / 3; sampled++
      }
    }
    return Math.min((sampled ? totalVar / sampled : 0) / 100, 1)
  }

  static async analyze(file: File): Promise<ImageAnalysis> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        try {
          const cvs = document.createElement("canvas")
          const size = Math.min(img.width, 200)
          cvs.width = size; cvs.height = img.height * (size / img.width)
          const ctx = cvs.getContext("2d", { willReadFrequently: true })!
          ctx.drawImage(img, 0, 0, cvs.width, cvs.height)
          const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data

          const colorSet = new Set<string>()
          let hasTrans = false, totalVar = 0
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 255) hasTrans = true
            colorSet.add(`${data[i] & 240},${data[i + 1] & 240},${data[i + 2] & 240}`)
            if (i >= 4) totalVar += Math.abs(data[i] - data[i - 4]) + Math.abs(data[i + 1] - data[i - 3]) + Math.abs(data[i + 2] - data[i - 2])
          }

          const uniqueColors = colorSet.size
          const complexity = Math.min((totalVar / (data.length / 4) / 3) / 20, 1)

          const solid = this.calculateSolidRegionRatio(data, cvs.width, cvs.height)
          const edge = this.calculateEdgeSharpnessRatio(data, cvs.width, cvs.height)
          const spread = this.calculateHistogramSpread(data)
          const texture = this.calculateTextureScore(data, cvs.width, cvs.height)

          const score = (1 - solid) * 0.3 + edge.ratio * 0.25 + spread * 0.25 + texture * 0.20
          const isPhoto = score > 0.55

          URL.revokeObjectURL(url)
          resolve({ isPhoto, hasTransparency: hasTrans, complexity, uniqueColors, suggestedFormat: "webp" }) // Default to WebP
        } catch (e) { URL.revokeObjectURL(url); reject(e) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load failed")) }
      img.src = url
    })
  }

  // Helper to run worker
  private static async runWorker(job: Omit<CompressionJob, "id">): Promise<CompressionResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("../workers/image-processor.worker.ts", import.meta.url))
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)

      worker.onmessage = (e) => {
        worker.terminate()
        resolve(e.data)
      }
      worker.onerror = (e) => {
        worker.terminate()
        reject(e)
      }

      // Transfer buffer to worker for zero-copy
      const message: CompressionJob = { ...job, id }
      worker.postMessage(message, [job.data])
    })
  }

  static async compress(
    file: File,
    id: string,
    generation: number,
    analysis?: ImageAnalysis,
    originalFormat?: string
  ): Promise<CompressedImage> {
    const originalSize = file.size
    const imgAnalysis = analysis || await this.analyze(file) // Re-analyze if needed? analyze is fast enough

    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = async () => {
        try {
          const cvs = document.createElement("canvas")
          cvs.width = img.width; cvs.height = img.height
          const ctx = cvs.getContext("2d", { willReadFrequently: true })!
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"
          ctx.drawImage(img, 0, 0)

          const rawFormat = originalFormat || file.type.split("/")[1] || "png"
          const normFormat = rawFormat === "jpg" ? "jpeg" : rawFormat.toLowerCase()
          let bestFormat = normFormat as "png" | "jpeg" | "webp" | "avif"

          // Determine settings
          const isPhoto = imgAnalysis.isPhoto
          const shouldQuantize = !isPhoto && imgAnalysis.uniqueColors > 256

          // Run worker job
          const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height)

          // We try AVIF/WebP/PNG
          // Since we can't easily encode AVIF/WebP in the worker (unless we used Squoosh WASM),
          // we still rely on Canvas for final encoding of web formats, 
          // BUT we use the worker for quantization if PNG is chosen.

          // NEW STRATEGY:
          // 1. If PNG and quantization needed -> Worker
          // 2. If AVIF/WebP -> Canvas (native is fast enough usually, or we should have moved that too)
          // For now, let's move QUANTIZATION to worker.

          let finalizedBlob: Blob | null = null
          let finalizedFormat = bestFormat

          // Try AVIF
          if (await canEncodeAvif()) {
            const b = await new Promise<Blob | null>(r => cvs.toBlob(r, "image/avif", isPhoto ? 0.75 : 0.85))
            if (b && b.size < originalSize) { finalizedBlob = b; finalizedFormat = "avif" }
          }

          // Try WebP (if AVIF failed or not supported)
          if (!finalizedBlob || (finalizedFormat !== 'avif')) { // Simple logic: if AVIF supported, it wins usually.
            const q = isPhoto ? (imgAnalysis.complexity > 0.5 ? 0.82 : 0.85) : 0.90
            const b = await new Promise<Blob | null>(r => cvs.toBlob(r, "image/webp", q))
            if (b && (!finalizedBlob || b.size < finalizedBlob.size)) {
              finalizedBlob = b; finalizedFormat = "webp"
            }
          }

          // Try PNG (Quantized) if graphics OR if explicit PNG requested
          // We force quantization for PNG output to ensure file size savings 
          // even if it's a photo, as standard Canvas PNG is very bloated.
          if (shouldQuantize || finalizedFormat === "png") {
            const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height)

            // Use Worker
            const result = await this.runWorker({
              width: imageData.width,
              height: imageData.height,
              data: imageData.data.buffer, // Transfer the buffer
              options: { format: "png", quality: 1, colors: 256, dithering: true }
            })

            if (result.success && result.data) {
              // Result is now a standard PNG file buffer (from UPNG)
              // We do NOT put it back on canvas (which would decode it to 32-bit RGBA).
              // We just use it directly.
              const b = new Blob([result.data], { type: "image/png" })

              if (b && (!finalizedBlob || b.size < finalizedBlob.size)) {
                finalizedBlob = b; finalizedFormat = "png"
              }
            }
          }

          // Fallback to original if nothing better
          if (!finalizedBlob && finalizedFormat === normFormat) {
            // Encode original format
            finalizedBlob = await new Promise<Blob | null>(r => cvs.toBlob(r, file.type, 0.9))
          }

          if (!finalizedBlob) { finalizedBlob = file; finalizedFormat = normFormat as any; }

          // METADATA PRESERVATION
          // Inject metadata from original file into the new blob
          const blobWithMeta = await copyMetadata(file, finalizedBlob)
          const bestSize = blobWithMeta.size
          const savings = Math.max(0, (originalSize - bestSize) / originalSize * 100)

          URL.revokeObjectURL(url)
          resolve({
            id,
            originalName: file.name,
            originalSize,
            compressedSize: bestSize,
            compressedBlob: blobWithMeta,
            blobUrl: URL.createObjectURL(blobWithMeta),
            originalBlobUrl: URL.createObjectURL(file),
            savings,
            format: finalizedFormat,
            originalFormat: (originalFormat || normFormat) as any,
            status: savings < 2 ? "already-optimized" : "completed",
            analysis: imgAnalysis,
            generation
          })

        } catch (e) { URL.revokeObjectURL(url); reject(e) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load failed")) }
      img.src = url
    })
  }

  // Copied logic for explicit format conversion
  static async compressToFormat(file: File | Blob, targetFormat: ImageFormat, id: string, name: string, origSize: number, generation: number, analysis?: ImageAnalysis): Promise<CompressedImage> {
    const imgAnalysis = analysis || (file instanceof File ? await this.analyze(file) : null)
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = async () => {
        try {
          const cvs = document.createElement("canvas")
          cvs.width = img.width; cvs.height = img.height
          const ctx = cvs.getContext("2d", { willReadFrequently: true })!
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"
          ctx.drawImage(img, 0, 0)

          // Quantize if needed (for all PNG outputs to save size)
          if (targetFormat === "png" && ((imgAnalysis && imgAnalysis.uniqueColors > 256) || true)) {
            const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height)

            const res = await this.runWorker({
              width: imageData.width,
              height: imageData.height,
              data: imageData.data.buffer,
              options: { format: "png", quality: 1, colors: 256, dithering: true }
            })

            // For PNG, worker returns the encoded file directly
            if (res.success && res.data) {
              const pngBlob = new Blob([res.data], { type: "image/png" })

              // Return early with this blob (plus metadata injection)
              let blob: Blob = pngBlob
              // Metadata
              if (file instanceof File || file instanceof Blob) {
                blob = await copyMetadata(file as Blob, blob)
              }

              URL.revokeObjectURL(url)
              const savings = ((origSize - blob.size) / origSize) * 100
              resolve({
                id, originalName: name, originalSize: origSize, compressedSize: blob.size, compressedBlob: blob,
                blobUrl: URL.createObjectURL(blob), originalBlobUrl: URL.createObjectURL(file),
                savings: Math.max(0, savings), format: targetFormat,
                status: savings < 2 ? "already-optimized" : "completed",
                analysis: imgAnalysis || undefined, formatPreference: targetFormat,
                generation
              })
              return
            }
          }

          let mime = "image/jpeg", q = 0.85
          if (targetFormat === "png") { mime = "image/png"; q = 1; }
          else if (targetFormat === "webp") { mime = "image/webp"; q = imgAnalysis?.isPhoto ? 0.82 : 0.9; }
          else if (targetFormat === "avif") { mime = "image/avif"; q = imgAnalysis?.isPhoto ? 0.75 : 0.85; }

          if (targetFormat === "avif" && !(await canEncodeAvif())) {
            // Fallback
            targetFormat = "webp"; mime = "image/webp";
          }

          let blob = await new Promise<Blob | null>(r => cvs.toBlob(r, mime, q))
          if (!blob) throw new Error("Encoding failed")

          // Metadata
          if (file instanceof File || file instanceof Blob) {
            blob = await copyMetadata(file as Blob, blob)
          }

          const size = blob.size
          const savings = Math.max(0, (origSize - size) / origSize * 100)

          URL.revokeObjectURL(url)
          resolve({
            id, originalName: name, originalSize: origSize, compressedSize: size, compressedBlob: blob,
            blobUrl: URL.createObjectURL(blob), originalBlobUrl: URL.createObjectURL(file),
            savings, format: targetFormat, status: savings < 2 ? "already-optimized" : "completed",
            analysis: imgAnalysis || undefined, formatPreference: targetFormat,
            generation
          })
        } catch (e) { URL.revokeObjectURL(url); reject(e) }
      }
      img.src = url
    })
  }
}
