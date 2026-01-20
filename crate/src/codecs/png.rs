use oxipng::{Options, RawImage, InFile, OutFile};
use imagequant::Attributes;
use lodepng::{Encoder, ColorType, BitDepth};

pub fn encode_png(
    data: &[u8], 
    width: u32, 
    height: u32, 
    lossless: bool,
    dithering_level: f32
) -> Result<Vec<u8>, String> {
    if lossless {
        encode_lossless(data, width, height)
    } else {
        encode_lossy(data, width, height, dithering_level)
    }
}

fn encode_lossless(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut options = Options::default();
    // High compression for lossless
    options.deflate = oxipng::DeflateEncoding::Rnp; // Rnp is good but slow, maybe default to Libdeflater which is standard in oxipng 9?
    // Let's stick to default which balances speed/ratio or max it out?
    // User wants "production-grade".
    options.optimize_alpha = true;

    // Oxipng 9.0+ RawImage API
    let raw = RawImage::new(width, height, oxipng::ColorType::RGBA, oxipng::BitDepth::Eight, Vec::from(data))
        .map_err(|e| format!("Failed to create raw image: {:?}", e))?;

    let out = raw.create_optimized_png(&options)
        .map_err(|e| format!("Oxipng optimization failed: {:?}", e))?;

    Ok(out)
}

fn encode_lossy(data: &[u8], width: u32, height: u32, dithering_level: f32) -> Result<Vec<u8>, String> {
    // 1. Quantize with libimagequant
    let mut attr = Attributes::new();
    attr.set_speed(5); // Balance between speed/quality
    
    // imagequant crate uses 0.0-1.0 for quality, but dithering is separate
    // Actually set_quality takes min/max (0-100).
    // We assume we want max quality visualization.
    attr.set_quality(0, 100).map_err(|e| format!("Failed to set LIQ quality: {:?}", e))?;

    let mut img = attr.new_image(data.to_vec(), width as usize, height as usize, 0.0)
        .map_err(|e| format!("Failed to create LIQ image: {:?}", e))?;

    let mut res = attr.quantize(&mut img)
        .map_err(|e| format!("Quantization failed: {:?}", e))?;

    res.set_dithering_level(dithering_level)
       .map_err(|e| format!("Failed to set dithering: {:?}", e))?;

    let (palette, pixels) = res.remapped(&mut img)
        .map_err(|e| format!("Remapping failed: {:?}", e))?;

    // 2. Encode to uncompressed PNG using lodepng (fast)
    // We need to construct the palette for lodepng
    // imagequant palette is RGBA8888
    let mut state = lodepng::State::new();
    state.info_png.color.colortype = ColorType::PALETTE;
    state.info_png.color.bitdepth = BitDepth::Eight;
    state.info_raw.colortype = ColorType::PALETTE;
    state.info_raw.bitdepth = BitDepth::Eight;
    state.encoder.auto_convert = false; // We provided exact palette data

    for px in palette {
         state.info_png.color.palette_add(px.r, px.g, px.b, px.a)
             .map_err(|e| format!("Failed to add palette: {:?}", e))?;
         state.info_raw.color.palette_add(px.r, px.g, px.b, px.a)
             .map_err(|e| format!("Failed to add palette raw: {:?}", e))?;
    }

    let png_buffer = state.encode(&pixels, width as usize, height as usize)
        .map_err(|e| format!("Lodepng encoding failed: {:?}", e))?;

    // 3. Optimize that PNG with oxipng
    let mut options = Options::default();
    options.optimize_alpha = true; // Still useful for palette transparency?
    
    let optimized = oxipng::optimize_from_memory(&png_buffer, &options)
        .map_err(|e| format!("Oxipng optimization failed: {:?}", e))?;

    Ok(optimized)
}
