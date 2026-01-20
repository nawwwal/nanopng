use jpeg_encoder::{Encoder, ColorType};

pub fn encode_jpeg(
    data: &[u8], 
    width: u32, 
    height: u32, 
    quality: u8, 
    _chroma_subsampling: bool // Note: jpeg-encoder doesn't expose chroma subsampling control
) -> Result<Vec<u8>, String> {
    // Convert RGBA to RGB (JPEG doesn't support alpha)
    let rgb_data: Vec<u8> = data
        .chunks(4)
        .flat_map(|rgba| [rgba[0], rgba[1], rgba[2]])
        .collect();
    
    let mut output = Vec::new();
    
    let encoder = Encoder::new(&mut output, quality);
    
    encoder
        .encode(&rgb_data, width as u16, height as u16, ColorType::Rgb)
        .map_err(|e| format!("JPEG encoding failed: {:?}", e))?;
    
    Ok(output)
}
