use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format!($($t)*)))
}


mod codecs;

#[derive(Serialize, Deserialize)]
pub enum Format {
    Jpeg,
    Png,
    WebP,
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
    pub quality: u8,          // 0-100
    pub transparent: bool,    // Maintain transparency?
    pub lossless: bool,       // Force lossless?
    pub dithering: f32,       // 0.0 - 1.0 (for PNG/quantization)
    pub resize: Option<ResizeConfig>,
    pub chroma_subsampling: bool, // true = 4:2:0, false = 4:4:4
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn process_image(data: &mut [u8], width: u32, height: u32, config_val: JsValue) -> Result<Vec<u8>, JsValue> {
    let config: Config = serde_wasm_bindgen::from_value(config_val)?;
    
    // Placeholder for resizing (Phase 5)
    
    match config.format {
        Format::Jpeg => {
            codecs::jpeg::encode_jpeg(
                data, 
                width, 
                height, 
                config.quality, 
                config.chroma_subsampling
            ).map_err(|e| JsValue::from_str(&e))
        },
        Format::Png => {
             codecs::png::encode_png(
                data,
                width,
                height,
                config.lossless,
                config.dithering
             ).map_err(|e| JsValue::from_str(&e))
        },
        Format::Avif => {
             codecs::avif::encode_avif(
                data,
                width,
                height,
                config.quality,
                4 // Default speed 4 for now (balanced)
             ).map_err(|e| JsValue::from_str(&e))
        },
        _ => {
            // Placeholder for other formats
            console_log!("Format {:?} not implemented yet, returning raw buffer", config.format as u8); // Debug
            Ok(data.to_vec())
        }
    }
}
