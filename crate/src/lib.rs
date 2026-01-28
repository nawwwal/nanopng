use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

mod codecs;
mod resize;

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

    // We need to own the data if we resize (since size changes)
    // Or we keep it as ref if no resize.
    // Since resize returns Vec<u8>, we can use Cow or just shadow.

    let current_data: Vec<u8>;
    let current_width: u32;
    let current_height: u32;

    if let Some(resize_cfg) = config.resize {
        // Calculate dimensions and optional crop based on fit mode
        let (scaled_w, scaled_h, crop_region) = resize::calculate_fit_dimensions(
            width,
            height,
            resize_cfg.width,
            resize_cfg.height,
            &resize_cfg.fit_mode,
        );

        // First resize to calculated dimensions
        let resized_data = resize::resize_image(
            data_mut, // src
            width,
            height,
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
        current_data = data_mut.to_vec();
        current_width = width;
        current_height = height;
    }

    match config.format {
        Format::Jpeg => codecs::jpeg::encode_jpeg(
            &current_data,
            current_width,
            current_height,
            config.quality,
            config.chroma_subsampling,
            config.progressive,
        )
        .map_err(|e| JsValue::from_str(&e)),
        Format::Png => codecs::png::encode_png(
            &current_data,
            current_width,
            current_height,
            config.lossless,
            config.dithering,
            config.speed_mode,
            config.quality,
        )
        .map_err(|e| JsValue::from_str(&e)),
        Format::Avif => codecs::avif::encode_avif(
            &current_data,
            current_width,
            current_height,
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
