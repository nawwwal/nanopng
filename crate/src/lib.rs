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
}

fn default_avif_speed() -> u8 {
    6 // Default balanced speed
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
        current_data = resize::resize_image(
            data_mut, // src
            width,
            height,
            resize_cfg.width,
            resize_cfg.height,
            &resize_cfg.filter,
        )
        .map_err(|e| JsValue::from_str(&e))?;

        current_width = resize_cfg.width;
        current_height = resize_cfg.height;
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
