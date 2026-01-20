use png::{BitDepth, ColorType, Encoder, Compression};
use imagequant::Attributes;

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
    let mut output = Vec::new();
    
    {
        let mut encoder = Encoder::new(&mut output, width, height);
        encoder.set_color(ColorType::Rgba);
        encoder.set_depth(BitDepth::Eight);
        encoder.set_compression(Compression::Best);
        
        let mut writer = encoder.write_header()
            .map_err(|e| format!("PNG header write failed: {:?}", e))?;
        
        writer.write_image_data(data)
            .map_err(|e| format!("PNG data write failed: {:?}", e))?;
    }
    
    Ok(output)
}

fn encode_lossy(data: &[u8], width: u32, height: u32, dithering_level: f32) -> Result<Vec<u8>, String> {
    // 1. Quantize with libimagequant
    let mut attr = Attributes::new();
    attr.set_speed(5); // Balance between speed/quality
    attr.set_quality(0, 100).map_err(|e| format!("Failed to set LIQ quality: {:?}", e))?;

    let mut img = attr.new_image(data.to_vec(), width as usize, height as usize, 0.0)
        .map_err(|e| format!("Failed to create LIQ image: {:?}", e))?;

    let mut res = attr.quantize(&mut img)
        .map_err(|e| format!("Quantization failed: {:?}", e))?;

    res.set_dithering_level(dithering_level)
       .map_err(|e| format!("Failed to set dithering: {:?}", e))?;

    let (palette, pixels) = res.remapped(&mut img)
        .map_err(|e| format!("Remapping failed: {:?}", e))?;

    // 2. Encode to PNG with palette using the `png` crate
    let mut output = Vec::new();
    
    {
        let mut encoder = Encoder::new(&mut output, width, height);
        encoder.set_color(ColorType::Indexed);
        encoder.set_depth(BitDepth::Eight);
        encoder.set_compression(Compression::Best);
        
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
        
        let mut writer = encoder.write_header()
            .map_err(|e| format!("PNG header write failed: {:?}", e))?;
        
        writer.write_image_data(&pixels)
            .map_err(|e| format!("PNG data write failed: {:?}", e))?;
    }
    
    Ok(output)
}
