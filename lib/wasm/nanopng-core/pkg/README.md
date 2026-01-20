# Nanopng Core WASM Module

This Rust crate provides image analysis, decoding, and resizing functionality via WebAssembly.

## Prerequisites

- Rust toolchain (install from https://rustup.rs/)
- wasm-pack (install with `cargo install wasm-pack`)

## Building

Run from the project root:
```bash
npm run wasm:build
```

Or manually:
```bash
cd lib/wasm/nanopng-core
wasm-pack build --target web --out-dir pkg
```

The built WASM module will be in `lib/wasm/nanopng-core/pkg/`.

## Functions

- `analyze(input: &[u8]) -> JsValue`: Analyzes image and returns metadata (isPhoto, hasTransparency, etc.)
- `decode_to_rgba(input: &[u8]) -> Vec<u8>`: Decodes any supported image format to RGBA bytes
- `resize(input: &[u8], width: u32, height: u32) -> Vec<u8>`: Resizes image using Lanczos3 resampling, returns RGBA bytes

