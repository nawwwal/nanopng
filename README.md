# NanoPNG

**State-of-the-art image compression, right in your browser.**

NanoPNG is a secure, privacy-focused image compressor that rivals server-side solutions like TinyPNG, but runs entirely on your device. No images are ever uploaded to a server.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000.svg?logo=rust&logoColor=white)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0.svg?logo=webassembly&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)

## 🚀 Vision

The goal of NanoPNG is to provide **server-grade image optimization without the server**. Modern browsers are powerful enough to handle complex image processing tasks like quantization, dithering, and format conversion. By leveraging Web Workers and WASM, we can deliver a tool that respects user privacy (zero data upload) while saving significant bandwidth.

## ✨ Key Features

-   **Privacy First**: All processing happens locally. Your photos never leave your computer.
-   **Rust/WASM Backend**: High-performance image encoding powered by a custom Rust-based WebAssembly module (`nanopng-core`) for blazing fast compression.
-   **Smart Compression**: Automatically detects photo vs. graphic content and applies optimal compression strategies. Quick probe skips already-optimized images.
-   **Batch Processing**: Process up to 100 images simultaneously with parallel workers and O(1) priority queue scheduling. No limits, no subscriptions.
-   **Intelligent Format Selection**: Automatically chooses the best format (AVIF → WebP → PNG) based on browser support and image characteristics.
-   **Format Conversion**: Convert between PNG, JPEG, WebP, and AVIF formats with intelligent quality settings.
-   **Target Size Compression**: Specify a target file size (e.g., "under 50KB") and the compressor will automatically adjust quality and dimensions.
-   **Metadata Preservation**: Automatically preserves critical metadata (EXIF orientation, ICC Color Profiles) often lost by standard canvas exports.
-   **Image Analysis**: Advanced photo vs. graphic detection using color histogram analysis, edge detection, and texture variance scoring.
-   **HEIC Support**: Convert HEIC/HEIF images (common on iOS) to web-friendly formats.
-   **SVG Optimization**: Optimize SVG files with Safe (lossless) or Aggressive (smaller) modes using SVGO.
-   **Before/After Comparison**: Interactive slider to compare original and compressed images side-by-side.
-   **Bulk Download**: Download all optimized images as a ZIP archive.
-   **Performance**: Offloads heavy computational work to Web Workers with crash recovery, ensuring a smooth, non-blocking UI even with 4K+ images.
-   **Brutalist UI**: Clean, bold interface with dark mode support.

## 🛠 Technical Architecture

NanoPNG is built with **Next.js 14+**, **TypeScript**, and **Rust/WebAssembly**, designed for performance and extensibility.

### Core Technologies

-   **Frontend**: React-based UI with Drag & Drop zones (Shadcn UI + Tailwind CSS).
-   **WASM Core**: `nanopng-core` - Custom Rust-based WebAssembly module providing high-performance codecs:
    -   PNG encoding with lossy quantization (imagequant) and lossless compression
    -   JPEG encoding with quality optimization
    -   AVIF encoding via `ravif` crate
    -   WebP encoding via `webp` crate
-   **Worker Pool**: Parallel processing with O(1) priority queue scheduling, crash recovery, and queue size limits.
-   **Smart Compression**: Orchestration layer with quick probe to skip already-optimized images and auto-detection of photo vs. graphic content.
-   **Supporting Libraries**:
    -   `exifr`: EXIF metadata extraction
    -   `heic2any`: HEIC/HEIF format conversion
    -   `comlink`: Worker communication

### Processing Pipeline

1.  **Quick Probe**: Estimates compressibility at reduced resolution. Skips already-optimized images (< 3% savings).
2.  **Image Analysis**: Classifies as Photo, Graphic, or Mixed using:
    -   Unique color count with logarithmic scaling
    -   Solid region ratio detection
    -   Edge sharpness analysis
    -   Transparency detection
3.  **Format Detection & Decoding**: Supports PNG, JPEG, WebP, AVIF, HEIC/HEIF, and SVG. Converts HEIC to decodable format if needed.
4.  **Compression**:
    -   **PNG**: Lossy (imagequant palette reduction) or lossless with optimal filtering (Rust/WASM)
    -   **JPEG**: Quality-optimized encoding with dimension validation (Rust/WASM)
    -   **WebP/AVIF**: Modern format encoding with quality tuning (Rust/WASM)
    -   **SVG**: Safe or Aggressive optimization via SVGO (JavaScript Worker)
5.  **Target Size Loop**: Binary search quality adjustment with resize fallback for target size constraints.
6.  **Metadata Injection**: Extracts EXIF/ICC chunks from source and injects them into the optimized Blob.
7.  **Size Validation**: Ensures compressed output is smaller than original; reverts if not.

### Format Selection Strategy

-   **Photos**: Prefers AVIF (if supported) → WebP → JPEG with perceptual quality settings
-   **Graphics**: Prefers AVIF (if supported) → WebP → Quantized PNG with palette optimization
-   **Transparency**: Automatically selects PNG format when alpha channel detected

## 🏁 Roadmap & Next Steps

We are actively working on pushing the boundaries of in-browser compression.

### Completed ✅

-   [x] **Rust/WASM Backend**: Full integration of `nanopng-core` for PNG, JPEG, WebP, and AVIF encoding.
-   [x] **Smart Compression**: Auto-detection of photo vs. graphic content with optimized compression strategies.
-   [x] **Target Size Compression**: Binary search quality adjustment with resize fallback.
-   [x] **Worker Pool Improvements**: O(1) priority queue, crash recovery, and queue size limits.
-   [x] **SVG Optimization**: Safe and Aggressive modes using SVGO with Web Worker processing.

### In Progress 🚧

-   [ ] **PWA Support**: Full offline capabilities with service worker caching.
-   [ ] **Advanced Compression Options**: Fine-tune quantization levels, dithering intensity, and quality presets.

### Future 🔮

-   [ ] **CLI Tool**: Command-line interface for batch processing.
-   [ ] **Image Optimization API**: Programmatic API for developers to integrate compression into their workflows.
-   [ ] **Video Frame Extraction**: Extract and optimize frames from video files.

## 🚀 Getting Started

### Prerequisites

-   **Node.js** 18+ and npm
-   **Rust** toolchain (for building WASM module)
-   **wasm-pack** (`cargo install wasm-pack`)

### Installation

```bash
# Clone the repository
git clone https://github.com/nawwwal/nanopng.git
cd nanopng

# Install dependencies
npm install

# Build the Rust/WASM module
npm run wasm:build

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
# Build WASM and Next.js app
npm run wasm:build
npm run build
npm start
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run wasm:build` | Build Rust/WASM module |
| `npm run wasm:dev` | Build WASM in dev mode |
| `npm test` | Run test suite (33 tests) |
| `npm run lint` | Run ESLint |

## 🤝 Contribution Guidelines

We welcome contributions! Here's how to get started:

1.  **Fork** the repository.
2.  **Clone** your fork locally.
3.  **Branch** for your feature: `git checkout -b feature/amazing-feature`.
4.  **Install dependencies**: `npm install`
5.  **Run development server**: `npm run dev`
6.  **Make your changes** following our code standards.
7.  **Test thoroughly** with various image formats and sizes.
8.  **Commit** your changes with clear messages.
9.  **Push** to your fork and open a Pull Request.

### Code Standards

-   Use **TypeScript** for strict type safety (no `any`, no `@ts-ignore`).
-   Use **Rust** for performance-critical encoding in `crate/`.
-   Ensure **Linting** passes (`npm run lint`).
-   Ensure **Tests** pass (`npm test` - 33 tests).
-   Keep heavy computational logic inside `lib/workers` or `crate/`.
-   Follow the existing architecture patterns:
    -   Rust codecs in `crate/src/codecs/`
    -   Services in `lib/services/`
    -   Core algorithms in `lib/core/`
    -   UI components in `components/`
    -   Types in `lib/types/`

### Project Structure

```
nanopng/
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── ui/                # Shadcn UI components
│   └── editor/            # Image editor components
├── crate/                  # Rust/WASM source code
│   ├── src/
│   │   ├── lib.rs         # WASM entry point
│   │   └── codecs/        # PNG, JPEG, WebP, AVIF encoders
│   └── Cargo.toml         # Rust dependencies
├── lib/
│   ├── core/              # Core algorithms (image analysis, format detection)
│   ├── services/          # Business logic (compression orchestrator, image service)
│   ├── types/             # TypeScript type definitions
│   ├── hooks/             # React hooks (useWorkerPool)
│   ├── wasm/              # Compiled WASM modules (generated)
│   └── workers/           # Web Worker scripts (processor, pool)
├── scripts/               # Build scripts (prepare-wasm.mjs)
└── public/                # Static assets
```

## 🌐 Browser Compatibility

NanoPNG works in all modern browsers that support:
-   **Web Workers** (for background processing)
-   **Canvas API** (for image encoding)
-   **File API** (for drag & drop)
-   **WebAssembly** (for Rust core features)

### Format Support by Browser

| Format | Chrome/Edge | Firefox | Safari | Notes |
|--------|------------|---------|--------|-------|
| PNG    | ✅         | ✅      | ✅     | Full support |
| JPEG   | ✅         | ✅      | ✅     | Full support |
| WebP   | ✅         | ✅      | ✅     | Full support (Safari 14+) |
| AVIF   | ✅         | ✅      | ⚠️     | Safari 17+ (encoding) |
| HEIC   | ✅         | ✅      | ✅     | Via `heic2any` conversion |
| SVG    | ✅         | ✅      | ✅     | Via SVGO optimization |

**Note**: AVIF encoding requires browser support. The app automatically falls back to WebP if AVIF encoding is not available.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.
