use fast_image_resize::{
    images::Image, FilterType, MulDiv, PixelType, ResizeAlg, ResizeOptions, Resizer,
};

pub fn resize_image(
    data: &[u8],
    src_width: u32,
    src_height: u32,
    dst_width: u32,
    dst_height: u32,
    filter: &str,
) -> Result<Vec<u8>, String> {
    if src_width == 0 || src_height == 0 || dst_width == 0 || dst_height == 0 {
        return Err("Invalid dimensions".to_string());
    }

    // 1. Create source image wrapper
    // PixelType U8x4 is RGBA8
    let src_image = Image::from_vec_u8(src_width, src_height, data.to_vec(), PixelType::U8x4)
        .map_err(|e| format!("Failed to create source image: {:?}", e))?;

    // 2. Pre-multiply alpha (critical for correct resizing of transparent images)
    let mul_div = MulDiv::default();
    let mut src_premultiplied = Image::new(src_width, src_height, PixelType::U8x4);
    mul_div
        .multiply_alpha(&src_image, &mut src_premultiplied)
        .map_err(|e| format!("Pre-multiply alpha failed: {:?}", e))?;

    // 3. Create destination image
    let mut dst_image = Image::new(dst_width, dst_height, PixelType::U8x4);

    // 4. Configure Resizer
    let mut resizer = Resizer::new();

    // Use Nearest algorithm for pixel art, Convolution for others
    let resize_alg = match filter {
        "Nearest" => ResizeAlg::Nearest,
        "CatmullRom" => ResizeAlg::Convolution(FilterType::CatmullRom),
        "Mitchell" => ResizeAlg::Convolution(FilterType::Mitchell),
        "Bilinear" => ResizeAlg::Convolution(FilterType::Bilinear),
        _ => ResizeAlg::Convolution(FilterType::Lanczos3), // Default to best quality
    };

    let options = ResizeOptions::new().resize_alg(resize_alg);

    // 5. Resize
    resizer
        .resize(&src_premultiplied, &mut dst_image, &options)
        .map_err(|e| format!("Resize failed: {:?}", e))?;

    // 6. De-multiply alpha back
    let mut dst_final = Image::new(dst_width, dst_height, PixelType::U8x4);
    mul_div
        .divide_alpha(&dst_image, &mut dst_final)
        .map_err(|e| format!("De-multiply alpha failed: {:?}", e))?;

    Ok(dst_final.into_vec())
}
