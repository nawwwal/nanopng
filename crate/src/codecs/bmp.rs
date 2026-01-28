/// Decode a BMP image to RGBA pixels.
/// Returns (pixels, width, height)
pub fn decode_bmp(data: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    if data.len() < 54 {
        return Err("BMP file too small".to_string());
    }

    // Check magic bytes
    if !is_bmp(data) {
        return Err("Not a valid BMP file".to_string());
    }

    // Read header info (little-endian)
    let data_offset = u32::from_le_bytes([data[10], data[11], data[12], data[13]]) as usize;
    let width = i32::from_le_bytes([data[18], data[19], data[20], data[21]]);
    let height = i32::from_le_bytes([data[22], data[23], data[24], data[25]]);
    let bits_per_pixel = u16::from_le_bytes([data[28], data[29]]);
    let compression = u32::from_le_bytes([data[30], data[31], data[32], data[33]]);

    if compression != 0 && compression != 3 {
        return Err(format!("Unsupported BMP compression: {}", compression));
    }

    let width = width.unsigned_abs();
    let height_abs = height.unsigned_abs();
    let is_top_down = height < 0;

    // Calculate row size (rows are padded to 4-byte boundaries)
    let bytes_per_pixel = (bits_per_pixel / 8) as usize;
    let row_size = ((width as usize * bytes_per_pixel + 3) / 4) * 4;

    let mut rgba = vec![0u8; (width * height_abs * 4) as usize];

    for y in 0..height_abs {
        let src_y = if is_top_down { y } else { height_abs - 1 - y };
        let row_start = data_offset + (src_y as usize * row_size);

        for x in 0..width {
            let src_idx = row_start + (x as usize * bytes_per_pixel);
            let dst_idx = ((y * width + x) * 4) as usize;

            if src_idx + bytes_per_pixel > data.len() {
                return Err("BMP data truncated".to_string());
            }

            match bits_per_pixel {
                24 => {
                    // BGR -> RGBA
                    rgba[dst_idx] = data[src_idx + 2]; // R
                    rgba[dst_idx + 1] = data[src_idx + 1]; // G
                    rgba[dst_idx + 2] = data[src_idx]; // B
                    rgba[dst_idx + 3] = 255; // A
                }
                32 => {
                    // BGRA -> RGBA
                    rgba[dst_idx] = data[src_idx + 2]; // R
                    rgba[dst_idx + 1] = data[src_idx + 1]; // G
                    rgba[dst_idx + 2] = data[src_idx]; // B
                    rgba[dst_idx + 3] = data[src_idx + 3]; // A
                }
                _ => return Err(format!("Unsupported BMP bit depth: {}", bits_per_pixel)),
            }
        }
    }

    Ok((rgba, width, height_abs))
}

/// Check if data is a BMP file by checking magic bytes
pub fn is_bmp(data: &[u8]) -> bool {
    data.len() >= 2 && &data[0..2] == b"BM"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_bmp() {
        assert!(is_bmp(b"BM\x00\x00\x00\x00"));
        assert!(!is_bmp(b"PNG\x00\x00\x00"));
        assert!(!is_bmp(b"B"));
        assert!(!is_bmp(b""));
    }

    #[test]
    fn test_decode_bmp_too_small() {
        let result = decode_bmp(b"BM");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too small"));
    }

    #[test]
    fn test_decode_bmp_invalid_magic() {
        let data = vec![0u8; 54];
        let result = decode_bmp(&data);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a valid BMP"));
    }
}
