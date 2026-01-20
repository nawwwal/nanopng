/**
 * Format Decoder Module
 * Handles decoding of formats that require special handling (HEIC/HEIF)
 * Other formats (AVIF, PNG, JPEG, WebP) are decoded natively by the browser
 */
// IMPORTANT: Do not import `heic2any` at module scope.
// It references `window` during initialization and will crash Next.js SSR.

/**
 * Check if a file is HEIC/HEIF format by MIME type or magic bytes
 * HEIC files often have incorrect or missing MIME types, so we check magic bytes too
 */
export async function isHeicFile(file: File): Promise<boolean> {
  // Check MIME type first (fast path)
  const mimeType = file.type.toLowerCase()
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    return true
  }

  // Check file extension as fallback
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
    return true
  }

  // Check magic bytes for HEIC/HEIF formats
  // HEIC files start with: ftyp box containing "heic", "mif1", or "msf1"
  try {
    const buffer = await file.slice(0, 12).arrayBuffer()
    const view = new Uint8Array(buffer)

    // Check for ftyp box (bytes 4-8 should be "ftyp")
    if (view.length >= 12) {
      const ftyp = String.fromCharCode(view[4], view[5], view[6], view[7])
      if (ftyp === "ftyp") {
        // Check brand (bytes 8-12)
        const brand = String.fromCharCode(view[8], view[9], view[10], view[11])
        if (brand === "heic" || brand === "mif1" || brand === "msf1") {
          return true
        }
      }
    }
  } catch (error) {
    // If we can't read the file, fall back to MIME type/extension check
    console.warn("Failed to check HEIC magic bytes:", error)
  }

  return false
}

/**
 * Decode HEIC/HEIF file to a standard format (PNG)
 * Uses libheif-wasm for decoding
 */
async function decodeHeic(file: File): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("HEIC decoding is only supported in the browser runtime")
  }

  try {
    // Dynamic import to avoid bundling and SSR issues
    // Note: `libheif-wasm`'s package entrypoints are misconfigured (no root index.js),
    // so we import the actual built file from `dist/`.
    // @ts-ignore - libheif-wasm types are not wired into this project
    const { decode } = await import("libheif-wasm/dist/index.mjs")

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer()

    // Decode HEIC → raw pixels
    const decoded = await decode(new Uint8Array(buffer), { needAlpha: true })

    if (!decoded?.data?.length || !decoded.width || !decoded.height) {
      throw new Error("No image data found in HEIC file")
    }

    const width = decoded.width
    const height = decoded.height

    // Create canvas and context
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context initialization failed")

    // Create ImageData for the decoded pixels (must be RGBA for canvas)
    const imageData = ctx.createImageData(width, height)

    const channel = decoded.channel
    const src = decoded.data
    const dst = imageData.data

    if (channel === 4) {
      dst.set(src)
    } else if (channel === 3) {
      // Expand RGB → RGBA
      for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
        dst[j] = src[i]
        dst[j + 1] = src[i + 1]
        dst[j + 2] = src[i + 2]
        dst[j + 3] = 255
      }
    } else {
      throw new Error(`Unsupported HEIC decode channel count: ${channel}`)
    }

    ctx.putImageData(imageData, 0, 0)

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas to Blob conversion failed"));
      }, "image/png");
    });

  } catch (error) {
    throw new Error(`Failed to decode HEIC file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Ensure a file is in a decodable format
 * Converts HEIC/HEIF to PNG/JPEG, returns other formats as-is
 */
export async function ensureDecodable(file: File): Promise<File | Blob> {
  const isHeic = await isHeicFile(file)

  if (isHeic) {
    const decodedBlob = await decodeHeic(file)
    // Create a new File-like object with proper name and type
    // Use the original filename but change extension to .png
    const newName = file.name.replace(/\.(heic|heif)$/i, ".png")
    return new File([decodedBlob], newName, { type: "image/png" })
  }

  // For all other formats (AVIF, PNG, JPEG, WebP), browsers decode natively
  return file
}

