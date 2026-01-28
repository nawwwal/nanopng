use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

mod codecs;
mod filters;
mod resize;
mod transform;

#[derive(Serialize, Deserialize)]
pub enum Format {
    Jpeg,
    Png,
    Avif,
}

#[derive(Serialize, Deserialize)]
pub struct ResizeConfig {
    pub width: u32,
    pub height: u32,
    pub filter: String, // "Lanczos3", "CatmullRom", etc.
    #[serde(default = "default_fit_mode")]
    pub fit_mode: String, // "contain", "cover", "fill", "inside", "outside"
}

fn default_fit_mode() -> String {
    "contain".to_string()
}

#[derive(Serialize, Deserialize)]
pub struct CropConfig {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize)]
pub struct Config {
    pub format: Format,
    pub quality: u8,       // 0-100
    pub transparent: bool, // Maintain transparency?
    pub lossless: bool,    // Force lossless?
    pub dithering: f32,    // 0.0 - 1.0 (for PNG/quantization)
    pub resize: Option<ResizeConfig>,
    pub chroma_subsampling: bool, // true = 4:2:0, false = 4:4:4
    #[serde(default)]
    pub speed_mode: bool, // true = fast encoding presets, false = quality presets
    #[serde(default = "default_avif_speed")]
    pub avif_speed: u8,   // AVIF encoder speed (0-10, higher = faster)
    #[serde(default = "default_avif_bit_depth")]
    pub avif_bit_depth: u8, // AVIF bit depth: 8 or 10
    #[serde(default = "default_progressive")]
    pub progressive: bool, // Progressive JPEG encoding (default: true)
    #[serde(default)]
    pub rotate: u16,  // 0, 90, 180, 270
    #[serde(default)]
    pub flip_h: bool,
    #[serde(default)]
    pub flip_v: bool,
    #[serde(default)]
    pub auto_trim: bool,
    #[serde(default = "default_trim_threshold")]
    pub auto_trim_threshold: u8,  // 0-255
    #[serde(default)]
    pub crop: Option<CropConfig>,
    #[serde(default)]
    pub sharpen: f32,  // 0.0 to 1.0
}

fn default_trim_threshold() -> u8 {
    25  // ~10% of 255
}

fn default_avif_speed() -> u8 {
    6 // Default balanced speed
}

fn default_avif_bit_depth() -> u8 {
    8 // Default 8-bit for maximum compatibility
}

fn default_progressive() -> bool {
    true // Default ON - progressive JPEGs load blurry to sharp
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn process_image(
    data_mut: &mut [u8],
    width: u32,
    height: u32,
    config_val: JsValue,
) -> Result<Vec<u8>, JsValue> {
    let config: Config = serde_wasm_bindgen::from_value(config_val)?;

    // Apply auto-trim if enabled (FIRST, before crop, transform, resize)
    let (trimmed_data, trimmed_width, trimmed_height) = if config.auto_trim {
        filters::auto_trim(data_mut, width, height, config.auto_trim_threshold)
    } else {
        (data_mut.to_vec(), width, height)
    };

    // Apply user crop if specified (after auto-trim, before resize)
    let (cropped_data, cropped_width, cropped_height) = if let Some(crop_cfg) = &config.crop {
        let cropped = resize::crop_image(
            &trimmed_data,
            trimmed_width,
            trimmed_height,
            crop_cfg.x,
            crop_cfg.y,
            crop_cfg.width,
            crop_cfg.height,
        );
        (cropped, crop_cfg.width, crop_cfg.height)
    } else {
        (trimmed_data, trimmed_width, trimmed_height)
    };

    // Now apply resize if specified
    let current_data: Vec<u8>;
    let current_width: u32;
    let current_height: u32;

    if let Some(resize_cfg) = config.resize {
        // Calculate dimensions and optional crop based on fit mode
        let (scaled_w, scaled_h, crop_region) = resize::calculate_fit_dimensions(
            cropped_width,
            cropped_height,
            resize_cfg.width,
            resize_cfg.height,
            &resize_cfg.fit_mode,
        );

        // First resize to calculated dimensions
        let resized_data = resize::resize_image(
            &cropped_data, // src (use cropped data)
            cropped_width,
            cropped_height,
            scaled_w,
            scaled_h,
            &resize_cfg.filter,
        )
        .map_err(|e| JsValue::from_str(&e))?;

        // Apply crop if needed (for cover mode)
        if let Some((crop_x, crop_y, crop_w, crop_h)) = crop_region {
            current_data = resize::crop_image(&resized_data, scaled_w, scaled_h, crop_x, crop_y, crop_w, crop_h);
            current_width = crop_w;
            current_height = crop_h;
        } else {
            current_data = resized_data;
            current_width = scaled_w;
            current_height = scaled_h;
        }
    } else {
        current_data = cropped_data;
        current_width = cropped_width;
        current_height = cropped_height;
    }

    // Apply transforms (rotate, flip)
    let (transformed_data, transformed_width, transformed_height) = transform::apply_transforms(
        &current_data,
        current_width,
        current_height,
        config.rotate,
        config.flip_h,
        config.flip_v,
    );

    // Apply sharpen if specified (after resize/transforms, before encoding)
    let final_data = if config.sharpen > 0.0 {
        filters::sharpen(&transformed_data, transformed_width, transformed_height, config.sharpen)
    } else {
        transformed_data
    };

    match config.format {
        Format::Jpeg => codecs::jpeg::encode_jpeg(
            &final_data,
            transformed_width,
            transformed_height,
            config.quality,
            config.chroma_subsampling,
            config.progressive,
        )
        .map_err(|e| JsValue::from_str(&e)),
        Format::Png => codecs::png::encode_png(
            &final_data,
            transformed_width,
            transformed_height,
            config.lossless,
            config.dithering,
            config.speed_mode,
            config.quality,
        )
        .map_err(|e| JsValue::from_str(&e)),
        Format::Avif => codecs::avif::encode_avif(
            &final_data,
            transformed_width,
            transformed_height,
            config.quality,
            config.avif_speed,
            config.avif_bit_depth,
        )
        .map_err(|e| JsValue::from_str(&e)),
    }
}

#[wasm_bindgen]
pub fn resize_only(
    data_mut: &mut [u8],
    width: u32,
    height: u32,
    target_width: u32,
    target_height: u32,
    filter: &str,
) -> Result<Vec<u8>, JsValue> {
    resize::resize_image(data_mut, width, height, target_width, target_height, filter)
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn decode_gif(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let (pixels, width, height) = codecs::gif::decode_gif(data)
        .map_err(|e| JsValue::from_str(&e))?;

    // Return pixels with width and height encoded in first 8 bytes
    let mut result = Vec::with_capacity(8 + pixels.len());
    result.extend_from_slice(&width.to_le_bytes());
    result.extend_from_slice(&height.to_le_bytes());
    result.extend_from_slice(&pixels);

    Ok(result)
}

#[wasm_bindgen]
pub fn decode_bmp(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let (pixels, width, height) = codecs::bmp::decode_bmp(data)
        .map_err(|e| JsValue::from_str(&e))?;

    // Return pixels with width and height encoded in first 8 bytes
    let mut result = Vec::with_capacity(8 + pixels.len());
    result.extend_from_slice(&width.to_le_bytes());
    result.extend_from_slice(&height.to_le_bytes());
    result.extend_from_slice(&pixels);

    Ok(result)
}

#[wasm_bindgen]
pub fn decode_tiff(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let (pixels, width, height) = codecs::tiff::decode_tiff(data)
        .map_err(|e| JsValue::from_str(&e))?;

    // Return pixels with width and height encoded in first 8 bytes
    let mut result = Vec::with_capacity(8 + pixels.len());
    result.extend_from_slice(&width.to_le_bytes());
    result.extend_from_slice(&height.to_le_bytes());
    result.extend_from_slice(&pixels);

    Ok(result)
}
