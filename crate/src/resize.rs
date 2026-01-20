use fast_image_resize::{Image, PixelType, ResizeAlg, Resizer, FilterType, MulDiv};
use std::num::NonZeroU32;

pub fn resize_image(
    data: &[u8], 
    src_width: u32, 
    src_height: u32, 
    dst_width: u32, 
    dst_height: u32, 
    filter: &str
) -> Result<Vec<u8>, String> {
    // 1. Create source image wrapper
    let src_width_nz = NonZeroU32::new(src_width).ok_or("Invalid width")?;
    let src_height_nz = NonZeroU32::new(src_height).ok_or("Invalid height")?;
    
    // PixelType U8x4 is RGBA8
    let mut src_image = Image::from_vec_u8(
        src_width_nz, 
        src_height_nz, 
        data.to_vec(), 
        PixelType::U8x4
    ).map_err(|e| format!("Failed to create source image: {:?}", e))?;

    // 2. Pre-multiply alpha (critical for correct resizing of transparent images)
    let mul_div = MulDiv::default();
    mul_div.mul_alpha(&mut src_image)
        .map_err(|e| format!("Pre-multiply alpha failed: {:?}", e))?;

    // 3. Create destination image
    let dst_width_nz = NonZeroU32::new(dst_width).ok_or("Invalid dest width")?;
    let dst_height_nz = NonZeroU32::new(dst_height).ok_or("Invalid dest height")?;

    let mut dst_image = Image::new(
        dst_width_nz, 
        dst_height_nz, 
        PixelType::U8x4
    );

    // 4. Configure Resizer
    let mut resizer = Resizer::new(ResizeAlg::Convolution(match filter {
         "CatmullRom" => FilterType::CatmullRom,
         "Mitchell" => FilterType::Mitchell,
         "Bilinear" => FilterType::Bilinear,
         _ => FilterType::Lanczos3, // Default to best quality
    }));
    
    // 5. Resize
    resizer.resize(&src_image, &mut dst_image)
         .map_err(|e| format!("Resize failed: {:?}", e))?;

    // 6. De-multiply alpha back
    mul_div.div_alpha(&mut dst_image)
        .map_err(|e| format!("De-multiply alpha failed: {:?}", e))?;

    Ok(dst_image.into_vec())
}

