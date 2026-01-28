/// Apply unsharp mask sharpening to an RGBA image.
/// amount: 0.0 to 1.0 (0 = no sharpening, 1 = maximum)
pub fn sharpen(data: &[u8], width: u32, height: u32, amount: f32) -> Vec<u8> {
    if amount <= 0.0 || width < 3 || height < 3 {
        return data.to_vec();
    }

    let mut result = data.to_vec();
    let w = width as usize;
    let h = height as usize;

    // Unsharp mask kernel (center - blur)
    // We use a simple 3x3 sharpen kernel:
    //  0  -1   0
    // -1   5  -1
    //  0  -1   0
    // Blended with original based on amount

    let kernel_strength = amount.min(1.0);

    for y in 1..(h - 1) {
        for x in 1..(w - 1) {
            let idx = (y * w + x) * 4;

            for c in 0..3 {  // RGB channels only, preserve alpha
                let center = data[idx + c] as f32;
                let top = data[((y - 1) * w + x) * 4 + c] as f32;
                let bottom = data[((y + 1) * w + x) * 4 + c] as f32;
                let left = data[(y * w + x - 1) * 4 + c] as f32;
                let right = data[(y * w + x + 1) * 4 + c] as f32;

                // Sharpen kernel: 5*center - neighbors
                let sharpened = 5.0 * center - top - bottom - left - right;

                // Blend with original based on amount
                let blended = center + (sharpened - center) * kernel_strength;

                // Clamp to valid range
                result[idx + c] = blended.max(0.0).min(255.0) as u8;
            }
        }
    }

    result
}

/// Detect the bounding box of non-background content.
/// Returns (x, y, width, height) of the content area.
/// threshold: 0-255, how different a pixel must be from the background to be considered content
pub fn detect_content_bounds(
    data: &[u8],
    width: u32,
    height: u32,
    threshold: u8,
) -> Option<(u32, u32, u32, u32)> {
    if width == 0 || height == 0 {
        return None;
    }

    let w = width as usize;
    let h = height as usize;

    // Sample corner pixels to determine background color
    // Use average of corners for more robust detection
    let corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)];

    let mut bg_r = 0u32;
    let mut bg_g = 0u32;
    let mut bg_b = 0u32;

    for (x, y) in corners.iter() {
        let idx = (y * w + x) * 4;
        bg_r += data[idx] as u32;
        bg_g += data[idx + 1] as u32;
        bg_b += data[idx + 2] as u32;
    }

    let bg_r = (bg_r / 4) as u8;
    let bg_g = (bg_g / 4) as u8;
    let bg_b = (bg_b / 4) as u8;

    let is_background = |idx: usize| -> bool {
        let dr = (data[idx] as i16 - bg_r as i16).unsigned_abs() as u8;
        let dg = (data[idx + 1] as i16 - bg_g as i16).unsigned_abs() as u8;
        let db = (data[idx + 2] as i16 - bg_b as i16).unsigned_abs() as u8;
        dr <= threshold && dg <= threshold && db <= threshold
    };

    // Find bounds
    let mut min_x = w;
    let mut max_x = 0usize;
    let mut min_y = h;
    let mut max_y = 0usize;

    for y in 0..h {
        for x in 0..w {
            let idx = (y * w + x) * 4;
            if !is_background(idx) {
                if x < min_x {
                    min_x = x;
                }
                if x > max_x {
                    max_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if y > max_y {
                    max_y = y;
                }
            }
        }
    }

    // Check if we found any content
    if min_x > max_x || min_y > max_y {
        return None; // Image is entirely background
    }

    let crop_x = min_x as u32;
    let crop_y = min_y as u32;
    let crop_w = (max_x - min_x + 1) as u32;
    let crop_h = (max_y - min_y + 1) as u32;

    // Only return if there's actually trimming to do
    if crop_x == 0 && crop_y == 0 && crop_w == width && crop_h == height {
        return None;
    }

    Some((crop_x, crop_y, crop_w, crop_h))
}

/// Auto-trim whitespace from image borders.
/// Returns trimmed image data and new dimensions, or original if no trimming needed.
pub fn auto_trim(data: &[u8], width: u32, height: u32, threshold: u8) -> (Vec<u8>, u32, u32) {
    match detect_content_bounds(data, width, height, threshold) {
        Some((x, y, w, h)) => {
            let trimmed = crate::resize::crop_image(data, width, height, x, y, w, h);
            (trimmed, w, h)
        }
        None => (data.to_vec(), width, height),
    }
}
