//! JPEG-XL Codec - WASM Limitations Documentation
//!
//! JPEG-XL (JXL) encoding is NOT implemented in the Rust WASM crate.
//! Instead, it is implemented in JavaScript using @jsquash/jxl.
//!
//! # Why JavaScript Instead of Rust?
//!
//! 1. **jxl-oxide** - Pure Rust, WASM-compatible, but DECODER-ONLY
//!    - GitHub: https://github.com/tirr-c/jxl-oxide
//!    - This crate can decode JXL but cannot encode
//!
//! 2. **jpegxl-rs** - Wraps libjxl (C++ reference implementation)
//!    - Has encoding support but wraps C++ code
//!    - Difficult to compile for wasm32-unknown-unknown target
//!    - Would require Emscripten toolchain
//!
//! 3. **@jsquash/jxl** - JavaScript/WASM solution (what we use)
//!    - npm: https://www.npmjs.com/package/@jsquash/jxl
//!    - Pre-built WASM binaries from libjxl
//!    - Works in browser and Web Workers
//!    - Provides both encoding and decoding
//!
//! # Browser Support (as of 2024)
//!
//! JPEG-XL has limited browser support:
//! - Safari 17+ (macOS, iOS) - SUPPORTED
//! - Chrome - NOT SUPPORTED (removed in Chrome 110)
//! - Firefox - NOT SUPPORTED
//! - Edge - NOT SUPPORTED
//!
//! This is why JXL is marked as EXPERIMENTAL in NanoPNG.
//!
//! # Future Considerations
//!
//! If a pure Rust JXL encoder becomes available that compiles to WASM,
//! we could move the encoding here. Potential projects to watch:
//! - jxl-oxide adding encoder support
//! - New pure Rust JXL encoder crates
//!
//! # Implementation Location
//!
//! The JXL encoder is implemented in:
//! - `/lib/workers/processor.worker.ts` - processJXL function
//! - Uses @jsquash/jxl WASM module loaded at runtime
//! - WASM files in `/public/wasm/jxl_enc.js` and `/public/wasm/jxl_enc.wasm`

// This module is intentionally empty - JXL encoding is in JavaScript
// Keeping this file for documentation purposes

/// Placeholder for future pure-Rust JXL encoding
/// Currently not implemented - use JavaScript @jsquash/jxl instead
#[allow(dead_code)]
pub fn encode_jxl(
    _data: &[u8],
    _width: u32,
    _height: u32,
    _quality: u8,
    _lossless: bool,
) -> Result<Vec<u8>, String> {
    Err("JXL encoding is implemented in JavaScript, not Rust. See lib/workers/processor.worker.ts".to_string())
}

/// Placeholder for JXL decoding
/// Could be implemented using jxl-oxide if needed
#[allow(dead_code)]
pub fn decode_jxl(_data: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    Err("JXL decoding not yet implemented in Rust. Consider using jxl-oxide crate.".to_string())
}
