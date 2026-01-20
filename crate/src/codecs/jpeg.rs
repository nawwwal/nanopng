use mozjpeg::{ColorSpace, Compress, ScanMode};

pub fn encode_jpeg(
    data: &[u8], 
    width: u32, 
    height: u32, 
    quality: u8, 
    chroma_subsampling: bool
) -> Result<Vec<u8>, String> {
    std::panic::catch_unwind(|| {
        let mut comp = Compress::new(ColorSpace::JCS_EXT_RGBA);
        
        comp.set_size(width as usize, height as usize);
        comp.set_quality(quality as f32);
        
        // Advanced MozJPEG features
        comp.set_optimize_scans(true);
        
        // Auto-enable Trellis Quantization for quality < 95
        if quality < 95 {
             comp.set_trellis_quantization(true);
             comp.set_overshoot_deringing(true);
        }

        // Chroma Subsampling (4:2:0 vs 4:4:4)
        // If chroma_subsampling is true, we use standard 4:2:0 (default usually, but explicit here)
        // If false, we force 4:4:4 (High Detail)
        if !chroma_subsampling {
            comp.set_chroma_sampling(mozjpeg::ChromaSampling::Cs444);
        } else {
             comp.set_chroma_sampling(mozjpeg::ChromaSampling::Cs420);
        }

        let mut comp = comp.start_compress(Vec::new())?;
        
        // Feed data (scanlines)
        // data is flat RGBA, mozjpeg expects slices
        // Actually mozjpeg-sys wrapper might handle this differently, 
        // but `Compress` usually takes raw bytes if we set ColorSpace right.
        // Let's check `write_scanlines`.
        
        // Since we are using JCS_EXT_RGBA, we can write the whole buffer?
        // Compress.write_scanlines takes &[u8].
        comp.write_scanlines(data)?;
        
        let writer = comp.finish()?;
        Ok(writer)
    })
    .map_err(|e| format!("JPEG encoding panic: {:?}", e))?
    .map_err(|e| format!("JPEG encoding error: {:?}", e))
}
