/**
 * Format Capabilities Module
 * Feature detection for browser support of various image formats
 */

// Cache capability results (check once per session)
let avifEncodeSupported: boolean | null = null
let avifDecodeSupported: boolean | null = null

/**
 * Check if the browser can encode AVIF images via canvas.toBlob
 * Uses a singleton pattern to cache the result
 */
export async function canEncodeAvif(): Promise<boolean> {
  if (avifEncodeSupported !== null) {
    return avifEncodeSupported
  }

  try {
    // Test encoding with a 1x1 canvas
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/avif", 0.8)
    })

    // Verify the blob was created and has the correct MIME type
    avifEncodeSupported = blob !== null && blob.type === "image/avif"
    return avifEncodeSupported
  } catch (error) {
    avifEncodeSupported = false
    return false
  }
}

/**
 * Check if the browser can decode AVIF images
 * Tests by creating an Image element and loading a data URL
 */
export async function canDecodeAvif(): Promise<boolean> {
  if (avifDecodeSupported !== null) {
    return avifDecodeSupported
  }

  try {
    // Create a minimal AVIF image (1x1 pixel, red)
    // This is a valid AVIF file encoded as base64
    const minimalAvif = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A="
    
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        avifDecodeSupported = true
        resolve(true)
      }
      img.onerror = () => {
        avifDecodeSupported = false
        resolve(false)
      }
      img.src = minimalAvif
    })
  } catch (error) {
    avifDecodeSupported = false
    return false
  }
}


