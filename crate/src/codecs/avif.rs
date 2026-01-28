use ravif::{BitDepth, Encoder, Img, RGBA8};
use rgb::FromSlice;

// Helper to cast bytes
trait AsPixels {
    fn as_pixels(&self) -> &[RGBA8];
}

impl AsPixels for [u8] {
    fn as_pixels(&self) -> &[RGBA8] {
        self.as_rgba()
    }
}

pub fn encode_avif(
    data: &[u8],
    width: u32,
    height: u32,
    quality: u8,
    speed: u8,
    bit_depth: u8,
) -> Result<Vec<u8>, String> {
    // 1. Wrap data
    // ravif expects Img<[RGBA8]>
    // We trust input is correct length RGBA
    let img = Img::new(
        data.as_pixels(), 
        width as usize, 
        height as usize
    );

    // 2. Configure Encoder
    // Map u8 bit depth to ravif's BitDepth enum
    let depth = match bit_depth {
        10 => BitDepth::Ten,
        _ => BitDepth::Eight, // Default to 8-bit for compatibility
    };

    let encoder = Encoder::new()
        .with_quality(quality as f32)
        .with_speed(speed)
        .with_bit_depth(depth)
        .with_alpha_color_mode(ravif::AlphaColorMode::UnassociatedClean);

    // 3. Encode
    let res = encoder.encode_rgba(img)
        .map_err(|e| format!("AVIF encoding failed: {}", e))?;

    Ok(res.avif_file)
}
