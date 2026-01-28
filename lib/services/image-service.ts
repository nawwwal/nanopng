import { CompressedImage, ImageAnalysis, ImageFormat } from "@/types/image"
import type { ResizeFilter, WatermarkOptions } from "@/lib/types/compression"
import { canEncodeAvif } from "@/lib/core/format-capabilities"
import { copyMetadata } from "@/lib/core/metadata"
import * as exifr from "exifr"
import { getWorkerPool } from "@/lib/workers/worker-pool"

/**
 * Applies a text watermark to an image blob using Canvas API
 */
async function applyWatermark(
  blob: Blob,
  watermark: WatermarkOptions
): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;

  // Draw original image
  ctx.drawImage(img, 0, 0);

  // Configure text style
  const fontSize = watermark.fontSize || 24;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = watermark.color || '#ffffff';
  ctx.globalAlpha = (watermark.opacity ?? 50) / 100;

  // Calculate position
  const metrics = ctx.measureText(watermark.text);
  const textWidth = metrics.width;
  const textHeight = fontSize;
  const padding = 10;

  let x: number, y: number;
  switch (watermark.position) {
    case 'top-left':
      x = padding;
      y = textHeight + padding;
      break;
    case 'top-right':
      x = img.width - textWidth - padding;
      y = textHeight + padding;
      break;
    case 'bottom-left':
      x = padding;
      y = img.height - padding;
      break;
    case 'bottom-right':
      x = img.width - textWidth - padding;
      y = img.height - padding;
      break;
    case 'center':
    default:
      x = (img.width - textWidth) / 2;
      y = (img.height + textHeight) / 2;
      break;
  }

  // Draw text with shadow for visibility
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(watermark.text, x, y);

  // Convert back to blob
  return await canvas.convertToBlob({ type: blob.type });
}

export class ImageService {

  private static detectFormat(mimeType: string): ImageFormat {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpeg'
    if (mimeType.includes('png')) return 'png'
    if (mimeType.includes('webp')) return 'webp'
    if (mimeType.includes('avif')) return 'avif'
    if (mimeType.includes('gif')) return 'gif'
    if (mimeType.includes('tiff')) return 'tiff'
    if (mimeType.includes('bmp')) return 'bmp'
    if (mimeType.includes('jxl')) return 'jxl'
    return 'jpeg' // default
  }

  private static selectOptimalFormat(hasTransparency: boolean, isPhoto: boolean): ImageFormat {
    if (hasTransparency) {
      return 'webp'; // WebP handles alpha well with good compression
    }
    if (isPhoto) {
      return 'webp'; // WebP compresses photos better than JPEG
    }
    return 'png'; // Graphics benefit from PNG's lossless palette
  }

  static async computeHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private static calculateSolidRegionRatio(data: Uint8ClampedArray, width: number, height: number): number {
    const blockSize = 4; let solid = 0, total = 0;
    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        total++; let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        for (let by = 0; by < blockSize; by++) for (let bx = 0; bx < blockSize; bx++) {
          const i = ((y + by) * width + (x + bx)) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
          if (r < minR) minR = r; if (r > maxR) maxR = r; if (g < minG) minG = g; if (g > maxG) maxG = g; if (b < minB) minB = b; if (b > maxB) maxB = b;
        }
        if ((maxR - minR) + (maxG - minG) + (maxB - minB) < 5) solid++;
      }
    }
    return total ? solid / total : 0;
  }

  static async analyze(file: File): Promise<ImageAnalysis> {
    return { isPhoto: true, hasTransparency: false, complexity: 0.5, uniqueColors: 10000, suggestedFormat: "webp" };
  }
  static async compress(
    file: File,
    id: string,
    generation: number,
    analysis?: ImageAnalysis,
    format?: ImageFormat | "auto",
    quality?: number,
    targetWidth?: number,
    targetHeight?: number,
    dithering?: number,
    chromaSubsampling?: boolean,
    lossless?: boolean,
    speedMode?: boolean,
    priority: 'normal' | 'high' = 'normal',
    resizeFilter?: ResizeFilter,
    preserveMetadata?: boolean,
    watermark?: WatermarkOptions
  ): Promise<CompressedImage> {
    const originalSize = file.size;
    const img = await createImageBitmap(file);
    const oriWidth = img.width;
    const oriHeight = img.height;

    const sab = new SharedArrayBuffer(oriWidth * oriHeight * 4);
    const dataView = new Uint8Array(sab);

    const cvs = new OffscreenCanvas(oriWidth, oriHeight);
    const ctx = cvs.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, oriWidth, oriHeight);
    dataView.set(imageData.data);

    // Detect transparency for auto format selection
    let hasTransparency = false;
    if (format === "auto") {
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] < 255) {
          hasTransparency = true;
          break;
        }
      }
    }

    // Resolve format before passing to worker
    const resolvedFormat = format === "auto"
      ? ImageService.selectOptimalFormat(hasTransparency, analysis?.isPhoto ?? true)
      : (format || "jpeg");

    // Use worker pool for better performance
    const workerPool = getWorkerPool();

    const result = await workerPool.execute(async (api) => {
      return api.processImage(
        id,
        oriWidth,
        oriHeight,
        {
          format: resolvedFormat,
          quality: quality ?? 0.85,
          targetWidth,
          targetHeight,
          dithering,
          chromaSubsampling,
          lossless,
          speedMode,
          resizeFilter
        },
        sab
      );
    }, priority);

    if (!result.success || !result.data) {
      throw new Error(result.error || "Unknown Wasm error");
    }

    const actualFormat = (resolvedFormat as string) === "jpg" ? "jpeg" : resolvedFormat;
    const blob = new Blob([new Uint8Array(result.data)], { type: `image/${actualFormat}` });

    let finalBlob = blob;
    if (preserveMetadata && file.type === "image/jpeg" && (actualFormat === "jpeg")) {
      try {
        finalBlob = await copyMetadata(file, blob);
      } catch (e) { console.warn("Metadata copy failed", e); }
    }

    // Apply watermark if specified
    if (watermark && watermark.text) {
      try {
        finalBlob = await applyWatermark(finalBlob, watermark);
      } catch (e) { console.warn("Watermark application failed", e); }
    }

    const savings = Math.max(0, (originalSize - finalBlob.size) / originalSize * 100);

    // Calculate output dimensions (fit within bounds, preserve aspect ratio)
    let outputWidth = oriWidth;
    let outputHeight = oriHeight;

    if (targetWidth || targetHeight) {
      const effectiveMaxWidth = targetWidth || oriWidth;
      const effectiveMaxHeight = targetHeight || oriHeight;

      // Only resize if image exceeds bounds
      if (oriWidth > effectiveMaxWidth || oriHeight > effectiveMaxHeight) {
        const scaleX = effectiveMaxWidth / oriWidth;
        const scaleY = effectiveMaxHeight / oriHeight;
        const scale = Math.min(scaleX, scaleY);
        outputWidth = Math.max(1, Math.round(oriWidth * scale));
        outputHeight = Math.max(1, Math.round(oriHeight * scale));
      }
    }

    return {
      id,
      originalName: file.name,
      originalSize,
      originalWidth: oriWidth,
      originalHeight: oriHeight,
      compressedSize: finalBlob.size,
      compressedBlob: finalBlob,
      blobUrl: URL.createObjectURL(finalBlob),
      originalBlobUrl: URL.createObjectURL(file),
      savings,
      format: resolvedFormat,
      originalFormat: ImageService.detectFormat(file.type),
      status: savings < 1 ? "already-optimized" : "completed",
      analysis: analysis || { isPhoto: true, hasTransparency: false, complexity: 0.5, uniqueColors: 10000, suggestedFormat: "webp" },
      generation,
      width: outputWidth,
      height: outputHeight
    };
  }
}
