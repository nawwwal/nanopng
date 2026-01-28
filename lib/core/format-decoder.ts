/**
 * Format Decoder Module
 * Handles decoding of formats that require special handling (HEIC/HEIF, BMP, GIF, TIFF)
 * Other formats (AVIF, PNG, JPEG, WebP) are decoded natively by the browser
 */

// Helper to get absolute URL for module loading
function getAbsoluteUrl(relativePath: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${relativePath}`
  }
  return relativePath
}

// Cache for WASM module
let wasmModule: any = null

async function initWasm(): Promise<any> {
  if (wasmModule) return wasmModule

  const wasm = await import(/* webpackIgnore: true */ /* @vite-ignore */ getAbsoluteUrl("/wasm/nanopng_core.js"))
  await wasm.default(getAbsoluteUrl("/wasm/nanopng_core_bg.wasm"))
  wasmModule = wasm
  return wasmModule
}

/**
 * Check if a file is HEIC/HEIF format by MIME type or magic bytes
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
    // Fall back to MIME type/extension check
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
    // @ts-expect-error - libheif-wasm types are not wired into this project
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

    return new Promise<Blob>((resolve, reject) => {
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
 * Check if a file is TIFF format by MIME type or magic bytes
 */
export async function isTiffFile(file: File): Promise<boolean> {
  // Check MIME type first (fast path)
  const mimeType = file.type.toLowerCase()
  if (mimeType === "image/tiff" || mimeType === "image/x-tiff") {
    return true
  }

  // Check file extension as fallback
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith(".tiff") || fileName.endsWith(".tif")) {
    return true
  }

  // Check magic bytes for TIFF format
  // Little-endian: "II" (0x49 0x49) followed by 42 (0x2A 0x00)
  // Big-endian: "MM" (0x4D 0x4D) followed by 42 (0x00 0x2A)
  try {
    const buffer = await file.slice(0, 4).arrayBuffer()
    const view = new Uint8Array(buffer)
    if (view.length >= 4) {
      // Little-endian TIFF
      if (view[0] === 0x49 && view[1] === 0x49 && view[2] === 0x2A && view[3] === 0x00) {
        return true
      }
      // Big-endian TIFF
      if (view[0] === 0x4D && view[1] === 0x4D && view[2] === 0x00 && view[3] === 0x2A) {
        return true
      }
    }
  } catch (error) {
    // Fall back to MIME type/extension check
  }

  return false
}

/**
 * Decode TIFF file to a standard format (PNG)
 * Uses our WASM decoder
 */
async function decodeTiff(file: File): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("TIFF decoding is only supported in the browser runtime")
  }

  try {
    const wasm = await initWasm()

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    // Decode TIFF → raw RGBA pixels (first 8 bytes are width and height)
    const result = wasm.decode_tiff(data)

    const view = new DataView(result.buffer)
    const width = view.getUint32(0, true)
    const height = view.getUint32(4, true)
    const pixels = new Uint8Array(result.buffer, 8)

    // Create canvas and context
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context initialization failed")

    // Create ImageData for the decoded pixels
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Canvas to Blob conversion failed"))
      }, "image/png")
    })
  } catch (error) {
    throw new Error(`Failed to decode TIFF file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Check if a file is BMP format by MIME type or magic bytes
 */
export async function isBmpFile(file: File): Promise<boolean> {
  // Check MIME type first (fast path)
  const mimeType = file.type.toLowerCase()
  if (mimeType === "image/bmp" || mimeType === "image/x-bmp" || mimeType === "image/x-ms-bmp") {
    return true
  }

  // Check file extension as fallback
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith(".bmp")) {
    return true
  }

  // Check magic bytes for BMP format (starts with "BM")
  try {
    const buffer = await file.slice(0, 2).arrayBuffer()
    const view = new Uint8Array(buffer)
    if (view.length >= 2 && view[0] === 0x42 && view[1] === 0x4D) {
      return true
    }
  } catch (error) {
    // Fall back to MIME type/extension check
  }

  return false
}

/**
 * Decode BMP file to a standard format (PNG)
 * Uses our WASM decoder
 */
async function decodeBmp(file: File): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("BMP decoding is only supported in the browser runtime")
  }

  try {
    const wasm = await initWasm()

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    // Decode BMP → raw RGBA pixels (first 8 bytes are width and height)
    const result = wasm.decode_bmp(data)

    const view = new DataView(result.buffer)
    const width = view.getUint32(0, true)
    const height = view.getUint32(4, true)
    const pixels = new Uint8Array(result.buffer, 8)

    // Create canvas and context
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context initialization failed")

    // Create ImageData for the decoded pixels
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Canvas to Blob conversion failed"))
      }, "image/png")
    })
  } catch (error) {
    throw new Error(`Failed to decode BMP file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Ensure a file is in a decodable format
 * Converts HEIC/HEIF/BMP/TIFF to PNG, returns other formats as-is
 */
export async function ensureDecodable(file: File): Promise<File | Blob> {
  const isHeic = await isHeicFile(file)

  if (isHeic) {
    const decodedBlob = await decodeHeic(file)
    const newName = file.name.replace(/\.(heic|heif)$/i, ".png")
    return new File([decodedBlob], newName, { type: "image/png" })
  }

  const isTiff = await isTiffFile(file)

  if (isTiff) {
    const decodedBlob = await decodeTiff(file)
    const newName = file.name.replace(/\.(tiff|tif)$/i, ".png")
    return new File([decodedBlob], newName, { type: "image/png" })
  }

  const isBmp = await isBmpFile(file)

  if (isBmp) {
    const decodedBlob = await decodeBmp(file)
    const newName = file.name.replace(/\.bmp$/i, ".png")
    return new File([decodedBlob], newName, { type: "image/png" })
  }

  return file
}

