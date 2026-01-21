use imagequant::{Attributes, RGBA};
use png::{BitDepth, ColorType, Compression, Encoder};

pub fn encode_png(
    data: &[u8],
    width: u32,
    height: u32,
    lossless: bool,
    dithering_level: f32,
    speed_mode: bool,
) -> Result<Vec<u8>, String> {
    if lossless {
        encode_lossless(data, width, height, speed_mode)
    } else {
        encode_lossy(data, width, height, dithering_level, speed_mode)
    }
}

fn encode_lossless(data: &[u8], width: u32, height: u32, speed_mode: bool) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();

    {
        let mut encoder = Encoder::new(&mut output, width, height);
        encoder.set_color(ColorType::Rgba);
        encoder.set_depth(BitDepth::Eight);
        // Use Fast compression in speed mode, Best otherwise (3-5x speedup)
        encoder.set_compression(if speed_mode { Compression::Fast } else { Compression::Best });

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header write failed: {:?}", e))?;

        writer
            .write_image_data(data)
            .map_err(|e| format!("PNG data write failed: {:?}", e))?;
    }

    Ok(output)
}

fn encode_lossy(
    data: &[u8],
    width: u32,
    height: u32,
    dithering_level: f32,
    speed_mode: bool,
) -> Result<Vec<u8>, String> {
    // 1. Convert raw bytes to RGBA pixels
    let pixels: Vec<RGBA> = data
        .chunks(4)
        .map(|chunk| RGBA {
            r: chunk[0],
            g: chunk[1],
            b: chunk[2],
            a: chunk[3],
        })
        .collect();

    // 2. Quantize with libimagequant
    let mut attr = Attributes::new();
    // Speed: 1 = slowest/best, 10 = fastest
    // In speed mode, use 10 for ~2x speedup; otherwise use 5 for balanced quality
    attr.set_speed(if speed_mode { 10 } else { 5 })
        .map_err(|e| format!("Failed to set LIQ speed: {:?}", e))?;
    attr.set_quality(0, 100)
        .map_err(|e| format!("Failed to set LIQ quality: {:?}", e))?;

    let mut img = attr
        .new_image(pixels, width as usize, height as usize, 0.0)
        .map_err(|e| format!("Failed to create LIQ image: {:?}", e))?;

    let mut res = attr
        .quantize(&mut img)
        .map_err(|e| format!("Quantization failed: {:?}", e))?;

    res.set_dithering_level(dithering_level)
        .map_err(|e| format!("Failed to set dithering: {:?}", e))?;

    let (palette, indexed_pixels) = res
        .remapped(&mut img)
        .map_err(|e| format!("Remapping failed: {:?}", e))?;

    // 3. Encode to PNG with palette using the `png` crate
    let mut output = Vec::new();

    {
        let mut encoder = Encoder::new(&mut output, width, height);
        encoder.set_color(ColorType::Indexed);
        encoder.set_depth(BitDepth::Eight);
        // Use Fast compression in speed mode, Best otherwise
        encoder.set_compression(if speed_mode { Compression::Fast } else { Compression::Best });

        // Build palette (RGB) and transparency (tRNS) chunks
        let mut rgb_palette: Vec<u8> = Vec::with_capacity(palette.len() * 3);
        let mut trns: Vec<u8> = Vec::with_capacity(palette.len());

        for px in &palette {
            rgb_palette.push(px.r);
            rgb_palette.push(px.g);
            rgb_palette.push(px.b);
            trns.push(px.a);
        }

        encoder.set_palette(rgb_palette);
        encoder.set_trns(trns);

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header write failed: {:?}", e))?;

        writer
            .write_image_data(&indexed_pixels)
            .map_err(|e| format!("PNG data write failed: {:?}", e))?;
    }

    Ok(output)
}
