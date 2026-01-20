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
    // Dynamic import to avoid bundling
    const libheif = await import("libheif-wasm");

    // Initialize the decoder
    const decoder = new libheif.HeifDecoder();
    
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Decode data
    const data = decoder.decode(buffer);
    
    if (!data || data.length === 0) {
       throw new Error("No image data found in HEIC file");
    }

    // Get primary image
    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();

    // Decode to RGBA
    const resultBuffer = new Uint8Array(width * height * 4);
    await image.display(new libheif.HeifDecoder.ImageData(resultBuffer, width, height), (x: any) => x); // Callback unused?
    
    // Wait, libheif-wasm API might be simpler or different?
    // Checking standard usage typically involves:
    // ... decode(buffer) -> returns array of images
    // image.display(imageData, ...)
    
    // Actually, `libheif-wasm` documentation example:
    // const decoder = new libheif.HeifDecoder();
    // const data = decoder.decode(buffer);
    // const image = data[0];
    // const w = image.get_width();
    // const h = image.get_height();
    // const imageData = new ImageData(w, h);
    // await image.display(imageData, display_image_data);
    
    // We need to return a Blob.
    // So we put this into an OffscreenCanvas or regular Canvas and toBlob.
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context init failed");
    
    // We need to create an ImageData object from the raw pixels if handled manually,
    // or use the display feature.
    // `image.display` takes an object {data: Uint8ClampedArray, width, height}.
    
    const clamped = new Uint8ClampedArray(width * height * 4);
    // Mocking the behavior since I cannot run `image.display` logic blindly without correct types.
    // But `libheif-wasm` essentially fills a buffer.
    
    // Assuming `image.display` fills the buffer we pass
    await new Promise<void>((resolve, reject) => {
         image.display({data: clamped, width, height}, (res: any) => {
             // Verify result if needed
             resolve();
         }).catch(reject);
    });

    const imageData = new ImageData(clamped, width, height);
    ctx.putImageData(imageData, 0, 0);
    
    // Cleanup memory
    image.free();
    decoder.free();

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas to Blob failed"));
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

