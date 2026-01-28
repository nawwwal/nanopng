use fast_image_resize::{
    images::Image, FilterType, MulDiv, PixelType, ResizeAlg, ResizeOptions, Resizer,
};

/// Calculate dimensions based on fit mode.
/// Returns (final_width, final_height, optional_crop_region)
/// crop_region is (x, y, crop_width, crop_height) for cover mode
pub fn calculate_fit_dimensions(
    src_width: u32,
    src_height: u32,
    target_width: u32,
    target_height: u32,
    fit_mode: &str,
) -> (u32, u32, Option<(u32, u32, u32, u32)>) {
    match fit_mode {
        "fill" => {
            // Stretch to exact dimensions
            (target_width, target_height, None)
        }
        "cover" => {
            // Scale to fill, then crop to target
            let scale_x = target_width as f64 / src_width as f64;
            let scale_y = target_height as f64 / src_height as f64;
            let scale = scale_x.max(scale_y);
            let scaled_w = (src_width as f64 * scale).round() as u32;
            let scaled_h = (src_height as f64 * scale).round() as u32;
            // Center crop
            let crop_x = scaled_w.saturating_sub(target_width) / 2;
            let crop_y = scaled_h.saturating_sub(target_height) / 2;
            (scaled_w.max(1), scaled_h.max(1), Some((crop_x, crop_y, target_width, target_height)))
        }
        "outside" => {
            // Scale to cover minimum dimension
            let scale_x = target_width as f64 / src_width as f64;
            let scale_y = target_height as f64 / src_height as f64;
            let scale = scale_x.max(scale_y);
            let new_w = (src_width as f64 * scale).round() as u32;
            let new_h = (src_height as f64 * scale).round() as u32;
            (new_w.max(1), new_h.max(1), None)
        }
        _ => {
            // "contain" or "inside" - fit within bounds
            let scale_x = target_width as f64 / src_width as f64;
            let scale_y = target_height as f64 / src_height as f64;
            let scale = scale_x.min(scale_y);
            let new_w = (src_width as f64 * scale).round() as u32;
            let new_h = (src_height as f64 * scale).round() as u32;
            (new_w.max(1), new_h.max(1), None)
        }
    }
}

/// Crop an RGBA image to the specified region.
pub fn crop_image(
    data: &[u8],
    width: u32,
    _height: u32,
    x: u32,
    y: u32,
    crop_width: u32,
    crop_height: u32,
) -> Vec<u8> {
    let mut result = Vec::with_capacity((crop_width * crop_height * 4) as usize);
    for row in y..(y + crop_height) {
        let start = ((row * width + x) * 4) as usize;
        let end = start + (crop_width * 4) as usize;
        result.extend_from_slice(&data[start..end]);
    }
    result
}

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
