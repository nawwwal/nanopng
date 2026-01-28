/// Rotate RGBA image 90 degrees clockwise
pub fn rotate_90_cw(data: &[u8], width: u32, height: u32) -> (Vec<u8>, u32, u32) {
    let new_width = height;
    let new_height = width;
    let mut result = vec![0u8; (new_width * new_height * 4) as usize];

    for y in 0..height {
        for x in 0..width {
            let src_idx = ((y * width + x) * 4) as usize;
            let new_x = height - 1 - y;
            let new_y = x;
            let dst_idx = ((new_y * new_width + new_x) * 4) as usize;
            result[dst_idx..dst_idx + 4].copy_from_slice(&data[src_idx..src_idx + 4]);
        }
    }
    (result, new_width, new_height)
}

/// Rotate RGBA image 180 degrees
pub fn rotate_180(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut result = vec![0u8; data.len()];
    let total_pixels = (width * height) as usize;

    for i in 0..total_pixels {
        let src_idx = i * 4;
        let dst_idx = (total_pixels - 1 - i) * 4;
        result[dst_idx..dst_idx + 4].copy_from_slice(&data[src_idx..src_idx + 4]);
    }
    result
}

/// Rotate RGBA image 270 degrees clockwise (90 CCW)
pub fn rotate_270_cw(data: &[u8], width: u32, height: u32) -> (Vec<u8>, u32, u32) {
    let new_width = height;
    let new_height = width;
    let mut result = vec![0u8; (new_width * new_height * 4) as usize];

    for y in 0..height {
        for x in 0..width {
            let src_idx = ((y * width + x) * 4) as usize;
            let new_x = y;
            let new_y = width - 1 - x;
            let dst_idx = ((new_y * new_width + new_x) * 4) as usize;
            result[dst_idx..dst_idx + 4].copy_from_slice(&data[src_idx..src_idx + 4]);
        }
    }
    (result, new_width, new_height)
}

/// Flip RGBA image horizontally
pub fn flip_horizontal(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut result = vec![0u8; data.len()];

    for y in 0..height {
        for x in 0..width {
            let src_idx = ((y * width + x) * 4) as usize;
            let dst_idx = ((y * width + (width - 1 - x)) * 4) as usize;
            result[dst_idx..dst_idx + 4].copy_from_slice(&data[src_idx..src_idx + 4]);
        }
    }
    result
}

/// Flip RGBA image vertically
pub fn flip_vertical(data: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut result = vec![0u8; data.len()];

    for y in 0..height {
        let src_row_start = (y * width * 4) as usize;
        let dst_row_start = ((height - 1 - y) * width * 4) as usize;
        let row_bytes = (width * 4) as usize;
        result[dst_row_start..dst_row_start + row_bytes]
            .copy_from_slice(&data[src_row_start..src_row_start + row_bytes]);
    }
    result
}

/// Apply all transforms in order: rotate, then flip
pub fn apply_transforms(
    data: &[u8],
    width: u32,
    height: u32,
    rotate: u16,
    flip_h: bool,
    flip_v: bool,
) -> (Vec<u8>, u32, u32) {
    let (mut current_data, mut current_w, mut current_h) = (data.to_vec(), width, height);

    // Apply rotation
    match rotate {
        90 => {
            let (rotated, new_w, new_h) = rotate_90_cw(&current_data, current_w, current_h);
            current_data = rotated;
            current_w = new_w;
            current_h = new_h;
        }
        180 => {
            current_data = rotate_180(&current_data, current_w, current_h);
        }
        270 => {
            let (rotated, new_w, new_h) = rotate_270_cw(&current_data, current_w, current_h);
            current_data = rotated;
            current_w = new_w;
            current_h = new_h;
        }
        _ => {} // 0 or invalid - no rotation
    }

    // Apply flips
    if flip_h {
        current_data = flip_horizontal(&current_data, current_w, current_h);
    }
    if flip_v {
        current_data = flip_vertical(&current_data, current_w, current_h);
    }

    (current_data, current_w, current_h)
}
