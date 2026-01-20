import encode from '@jsquash/webp/encode';

export interface WebPEncodeOptions {
  quality: number;      // 0-100
  lossless: boolean;
}

/**
 * Encode raw RGBA pixel data to WebP format using @jsquash/webp
 */
export async function encodeToWebP(
  data: Uint8Array,
  width: number,
  height: number,
  options: WebPEncodeOptions
): Promise<Uint8Array> {
  const imageData = new ImageData(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width,
    height
  );

  const webpBuffer = await encode(imageData, {
    quality: options.quality,
    lossless: options.lossless ? 1 : 0,
  });

  return new Uint8Array(webpBuffer);
}
