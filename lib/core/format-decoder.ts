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
 * Decode HEIC/HEIF file to a standard format (PNG or JPEG)
 * Preserves transparency by converting to PNG, otherwise uses JPEG
 */
async function decodeHeic(file: File): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("HEIC decoding is only supported in the browser runtime")
  }

  try {
    const { default: heic2any } = await import("heic2any")

    // heic2any returns an array of Blobs (supports multi-image HEIC)
    // We only need the first image
    const result = await heic2any({
      blob: file,
      toType: "image/png", // Use PNG to preserve transparency
      quality: 1.0, // Maximum quality for conversion
    })

    // Handle both single Blob and array of Blobs
    const blob = Array.isArray(result) ? result[0] : result
    
    if (!blob) {
      throw new Error("HEIC conversion returned no result")
    }

    return blob
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

