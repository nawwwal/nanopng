import sharp from "sharp"

interface CompressionResult {
  compressedBuffer: Buffer
  originalSize: number
  compressedSize: number
}

export async function compressImageBuffer(
  buffer: Buffer,
  format: "png" | "jpeg" | "webp" | "avif",
  quality = 85,
): Promise<CompressionResult> {
  const originalSize = buffer.length

  let compressedBuffer: Buffer

  switch (format) {
    case "png":
      // PNG compression with lossy optimization
      compressedBuffer = await sharp(buffer)
        .png({
          quality: Math.round(quality * 0.8), // Scale quality for PNG (0-100)
          compressionLevel: 9,
          palette: true,
          effort: 10,
        })
        .toBuffer()
      break

    case "jpeg":
      // JPEG compression with MozJPEG
      compressedBuffer = await sharp(buffer)
        .jpeg({
          quality: quality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer()
      break

    case "webp":
      // WebP compression (lossy mode)
      compressedBuffer = await sharp(buffer)
        .webp({
          quality: quality,
          alphaQuality: 90,
          lossless: false,
          nearLossless: false,
          smartSubsample: true,
          effort: 6,
        })
        .toBuffer()
      break

    case "avif":
      // AVIF compression (next-gen format)
      compressedBuffer = await sharp(buffer)
        .avif({
          quality: quality,
          effort: 4,
          chromaSubsampling: "4:2:0",
        })
        .toBuffer()
      break

    default:
      throw new Error(`Unsupported format: ${format}`)
  }

  const compressedSize = compressedBuffer.length

  return {
    compressedBuffer,
    originalSize,
    compressedSize,
  }
}
