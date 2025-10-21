"use server"

export async function createZip(images: { url: string; filename: string }[]): Promise<Blob> {
  try {
    // Dynamic import of JSZip to avoid bundling it on the client
    const JSZip = (await import("jszip")).default

    const zip = new JSZip()

    // Fetch all images and add them to the ZIP
    await Promise.all(
      images.map(async (image) => {
        try {
          const response = await fetch(image.url)
          const arrayBuffer = await response.arrayBuffer()
          zip.file(image.filename, arrayBuffer)
        } catch (error) {
          console.error(`[v0] Failed to fetch ${image.filename}:`, error)
        }
      }),
    )

    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({ type: "blob" })

    return zipBlob
  } catch (error) {
    console.error("[v0] Failed to create ZIP:", error)
    throw new Error("Failed to create ZIP file")
  }
}
