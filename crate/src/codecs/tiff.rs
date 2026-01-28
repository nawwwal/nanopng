use tiff::decoder::{Decoder, DecodingResult};
use std::io::Cursor;

/// Decode a TIFF image to RGBA pixels.
/// Returns (pixels, width, height)
pub fn decode_tiff(data: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    // Validate TIFF magic bytes
    if !is_tiff(data) {
        return Err("Not a valid TIFF file".to_string());
    }

    let cursor = Cursor::new(data);
    let mut decoder = Decoder::new(cursor)
        .map_err(|e| format!("Failed to create TIFF decoder: {:?}", e))?;

    let (width, height) = decoder.dimensions()
        .map_err(|e| format!("Failed to get TIFF dimensions: {:?}", e))?;

    let result = decoder.read_image()
        .map_err(|e| format!("Failed to decode TIFF: {:?}", e))?;

    let rgba = match result {
        DecodingResult::U8(pixels) => {
            // Determine color type from decoder
            let color_type = decoder.colortype()
                .map_err(|e| format!("Failed to get color type: {:?}", e))?;

            match color_type {
                tiff::ColorType::Gray(8) => {
                    // Convert grayscale to RGBA
                    pixels.iter()
                        .flat_map(|&g| [g, g, g, 255])
                        .collect()
                }
                tiff::ColorType::RGB(8) => {
                    // Convert RGB to RGBA
                    pixels.chunks(3)
                        .flat_map(|rgb| [rgb[0], rgb[1], rgb[2], 255])
                        .collect()
                }
                tiff::ColorType::RGBA(8) => {
                    pixels
                }
                tiff::ColorType::GrayA(8) => {
                    // Convert grayscale + alpha to RGBA
                    pixels.chunks(2)
                        .flat_map(|ga| [ga[0], ga[0], ga[0], ga[1]])
                        .collect()
                }
                _ => return Err(format!("Unsupported TIFF color type: {:?}", color_type)),
            }
        }
        DecodingResult::U16(pixels) => {
            // Convert 16-bit to 8-bit RGBA
            // This is a simple approach - divide by 257 to map 0-65535 to 0-255
            let color_type = decoder.colortype()
                .map_err(|e| format!("Failed to get color type: {:?}", e))?;

            match color_type {
                tiff::ColorType::Gray(16) => {
                    pixels.iter()
                        .flat_map(|&g| {
                            let g8 = (g / 257) as u8;
                            [g8, g8, g8, 255]
                        })
                        .collect()
                }
                tiff::ColorType::RGB(16) => {
                    pixels.chunks(3)
                        .flat_map(|rgb| {
                            [(rgb[0] / 257) as u8, (rgb[1] / 257) as u8, (rgb[2] / 257) as u8, 255]
                        })
                        .collect()
                }
                tiff::ColorType::RGBA(16) => {
                    pixels.chunks(4)
                        .flat_map(|rgba| {
                            [(rgba[0] / 257) as u8, (rgba[1] / 257) as u8, (rgba[2] / 257) as u8, (rgba[3] / 257) as u8]
                        })
                        .collect()
                }
                _ => return Err(format!("Unsupported TIFF 16-bit color type: {:?}", color_type)),
            }
        }
        _ => return Err("Unsupported TIFF pixel format".to_string()),
    };

    Ok((rgba, width, height))
}

/// Check if data is a TIFF file by checking magic bytes
pub fn is_tiff(data: &[u8]) -> bool {
    data.len() >= 4 && (
        // Little-endian TIFF
        (&data[0..4] == b"II\x2a\x00") ||
        // Big-endian TIFF
        (&data[0..4] == b"MM\x00\x2a")
    )
}
