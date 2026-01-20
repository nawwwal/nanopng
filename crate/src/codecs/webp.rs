use image_webp::{ColorType, WebPEncoder};
use std::io::Cursor;

pub fn encode_webp(
    data: &[u8],
    width: u32,
    height: u32,
    _quality: u8,    // Not used - lossless only
    _lossless: bool, // Always lossless with this encoder
) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    let cursor = Cursor::new(&mut output);

    let encoder = WebPEncoder::new(cursor);

    encoder
        .encode(data, width, height, ColorType::Rgba8)
        .map_err(|e| format!("WebP encoding failed: {:?}", e))?;

    Ok(output)
}
