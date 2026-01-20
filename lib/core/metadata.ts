/**
 * Metadata preservation utilities
 */
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import textChunk from "png-chunk-text";

// Critical chunks that affect rendering or contain important metadata
const METADATA_CHUNKS = [
  "eXIf", // EXIF data
  "iCCP", // ICC color profile
  "gAMA", // Gamma
  "cHRM", // Chromaticities
  "sRGB", // sRGB intent
  "pHYs", // Physical pixel dimensions
  "tEXt", // Textual data
  "zTXt", // Compressed text
  "iTXt", // International text
  "tIME", // Time
];

export interface MetadataChunks {
  [key: string]: Uint8Array[];
}

/**
 * Extract metadata chunks from a PNG buffer
 */
export function extractMetadata(buffer: Uint8Array): MetadataChunks {
  try {
    const chunks = extractChunks(buffer);
    const metadata: MetadataChunks = {};

    for (const chunk of chunks) {
      if (METADATA_CHUNKS.includes(chunk.name)) {
        if (!metadata[chunk.name]) {
          metadata[chunk.name] = [];
        }
        metadata[chunk.name].push(chunk.data);
      }
    }

    return metadata;
  } catch (error) {
    console.warn("Failed to extract metadata:", error);
    return {};
  }
}

/**
 * Insert metadata chunks into a PNG buffer
 */
export function injectMetadata(buffer: Uint8Array, metadata: MetadataChunks): Uint8Array {
  try {
    const chunks = extractChunks(buffer);

    // Create a map of existing chunk names to avoid dupes if necessary,
    // but usually we want to keep the new image's critical IHDR/IDAT/IEND
    // and just inject the auxiliary chunks.

    // Filter out existing metadata chunks from the target if we are replacing them
    // or keep them? Usually optimization strips them, so we just add them back.
    // But if the optimizer added some (e.g. gAMA), we might want to respect the source or target.
    // Safe bet: prioritize source metadata.

    const newChunks = chunks.filter(c => !METADATA_CHUNKS.includes(c.name));

    // Find insertion point (after IHDR, before IDAT)
    let insertIdx = 1; // Default after IHDR
    for (let i = 0; i < newChunks.length; i++) {
      if (newChunks[i].name === 'PLTE') {
        insertIdx = i + 1; // After palette
      }
    }

    const chunksToAdd: { name: string; data: Uint8Array }[] = [];

    for (const [name, dataList] of Object.entries(metadata)) {
      for (const data of dataList) {
        chunksToAdd.push({ name, data });
      }
    }

    // Insert metadata chunks
    newChunks.splice(insertIdx, 0, ...chunksToAdd);

    return encodeChunks(newChunks);
  } catch (error) {
    console.warn("Failed to inject metadata:", error);
    return buffer;
  }
}

export async function copyMetadata(source: Blob, target: Blob): Promise<Blob> {
  if (source.type === 'image/png' && target.type === 'image/png') {
    const sourceBuf = new Uint8Array(await source.arrayBuffer());
    const targetBuf = new Uint8Array(await target.arrayBuffer());

    const metadata = extractMetadata(sourceBuf);
    const newBuf = injectMetadata(targetBuf, metadata);

    return new Blob([newBuf], { type: 'image/png' });
  }
  // TODO: Handle JPEG/WebP metadata if needed (using exifr/piexif)
  // For now, focus on PNG as that's the main breakage
  return target;
}
