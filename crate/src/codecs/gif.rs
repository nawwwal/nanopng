use gif::{DecodeOptions, ColorOutput};

/// Decode a GIF image to RGBA pixels.
/// For animated GIFs, only decodes the first frame.
/// Returns (pixels, width, height)
pub fn decode_gif(data: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    // Validate GIF magic bytes
    if !is_gif(data) {
        return Err("Not a valid GIF file".to_string());
    }

    let mut decoder_opts = DecodeOptions::new();
    decoder_opts.set_color_output(ColorOutput::RGBA);

    let mut decoder = decoder_opts
        .read_info(data)
        .map_err(|e| format!("Failed to read GIF: {:?}", e))?;

    let width = decoder.width() as u32;
    let height = decoder.height() as u32;

    // Read the first frame
    let frame = decoder
        .read_next_frame()
        .map_err(|e| format!("Failed to decode GIF frame: {:?}", e))?
        .ok_or_else(|| "GIF has no frames".to_string())?;

    // The frame buffer contains RGBA data
    let pixels = frame.buffer.to_vec();

    // Handle case where frame is smaller than canvas (dispose method)
    // For now, we assume frame fills the canvas
    if pixels.len() != (width * height * 4) as usize {
        return Err(format!(
            "GIF frame size mismatch: expected {}, got {}",
            width * height * 4,
            pixels.len()
        ));
    }

    Ok((pixels, width, height))
}

/// Check if data is a GIF file by checking magic bytes
pub fn is_gif(data: &[u8]) -> bool {
    data.len() >= 6 && (
        &data[0..6] == b"GIF87a" || &data[0..6] == b"GIF89a"
    )
}
