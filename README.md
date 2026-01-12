# NanoPNG

**State-of-the-art image compression, right in your browser.**

NanoPNG is a secure, privacy-focused image compressor that rivals server-side solutions like TinyPNG, but runs entirely on your device. No images are ever uploaded to a server.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/Using-TypeScript-3178C6.svg)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)

## 🚀 Vision

The goal of NanoPNG is to provide **server-grade image optimization without the server**. Modern browsers are powerful enough to handle complex image processing tasks like quantization, dithering, and format conversion. By leveraging Web Workers and WASM, we can deliver a tool that respects user privacy (zero data upload) while saving significant bandwidth.

## ✨ Key Features

-   **Privacy First**: All processing happens locally. Your photos never leave your computer.
-   **Batch Processing**: Process up to 100 images simultaneously with 3 concurrent workers. No limits, no subscriptions.
-   **Smart Quantization**: Converts 32-bit RGBA images to efficient 8-bit Indexed PNGs using advanced dithering algorithms (Floyd-Steinberg via `image-q`).
-   **Intelligent Format Selection**: Automatically chooses the best format (AVIF → WebP → PNG) based on browser support and image characteristics.
-   **Format Conversion**: Convert between PNG, JPEG, WebP, and AVIF formats with intelligent quality settings.
-   **Metadata Preservation**: Automatically preserves critical metadata (EXIF orientation, ICC Color Profiles) often lost by standard canvas exports.
-   **Image Analysis**: Advanced photo vs. graphic detection with complexity scoring to optimize compression strategies.
-   **HEIC Support**: Convert HEIC/HEIF images (common on iOS) to web-friendly formats.
-   **Before/After Comparison**: Interactive slider to compare original and compressed images side-by-side.
-   **Bulk Download**: Download all optimized images as a ZIP archive.
-   **Performance**: Offloads heavy computational work to Web Workers, ensuring a smooth, non-blocking UI even with 4K+ images.
-   **Brutalist UI**: Clean, bold interface with dark mode support.

## 🛠 Technical Architecture

NanoPNG is built with **Next.js 14+** and **TypeScript**, designed for performance and extensibility.

### Core Technologies

-   **Frontend**: React-based UI with Drag & Drop zones (Shadcn UI + Tailwind CSS).
-   **Concurrency**: Uses **Web Workers** (`lib/workers/image-processor.worker.ts`) to handle CPU-intensive quantization and PNG encoding.
-   **Image Processing Libraries**:
    -   `image-q`: Advanced color quantization with Floyd-Steinberg dithering
    -   `upng-js`: Efficient PNG encoding for quantized images
    -   Canvas API: Native browser encoding for AVIF/WebP/JPEG
    -   `exifr`: EXIF metadata extraction
    -   `heic2any`: HEIC/HEIF format conversion
-   **WASM Module**: `nanopng-core` Rust-based WASM module (prepared for future migration).

### Processing Pipeline

1.  **Format Detection & Decoding**: Supports PNG, JPEG, WebP, AVIF, HEIC/HEIF. Converts HEIC to decodable format if needed.
2.  **Analysis**: Determines image complexity (Photo vs. Graphic) using:
    -   Solid region ratio
    -   Edge sharpness detection
    -   Color histogram spread
    -   Texture variance scoring
3.  **Decoding**: Uses HTML5 Canvas to extract raw RGBA pixel data.
4.  **Processing**:
    -   **PNG**: Quantization + Dithering in Web Worker → Encoded via UPNG
    -   **AVIF/WebP**: Native Canvas API encoding with quality optimization
    -   **JPEG**: Canvas API with photo-optimized quality settings
5.  **Metadata Injection**: Extracts EXIF/ICC chunks from source and injects them into the optimized Blob.
6.  **Size Validation**: Ensures compressed output is smaller than original; reverts if not.

### Format Selection Strategy

-   **Photos**: Prefers AVIF (if supported) → WebP → JPEG with perceptual quality settings
-   **Graphics**: Prefers AVIF (if supported) → WebP → Quantized PNG with palette optimization
-   **Transparency**: Automatically selects PNG format when alpha channel detected

## 🏁 Roadmap & Next Steps

We are actively working on pushing the boundaries of in-browser compression.

-   [ ] **Rust Core Integration**: Fully integrate the existing `nanopng-core` WASM module to replace TypeScript quantization logic for blazing fast performance and smaller memory footprint.
-   [ ] **Smart Resizing**: Add high-quality resizing (Lanczos3) and "Compress to Target Size" (e.g., "Make this under 50KB").
-   [ ] **PWA Support**: Full offline capabilities with service worker caching.
-   [ ] **Advanced Compression Options**: Fine-tune quantization levels, dithering intensity, and quality presets.
-   [ ] **Image Optimization API**: Programmatic API for developers to integrate compression into their workflows.

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nanopng.git
cd nanopng

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

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

-   Use **TypeScript** for strict type safety.
-   Ensure **Linting** passes (`npm run lint`).
-   Keep heavy computational logic inside `lib/workers` or `lib/core`.
-   Follow the existing architecture patterns:
    -   Services in `lib/services/`
    -   Core algorithms in `lib/core/`
    -   UI components in `components/`
    -   Types in `lib/types/` and `types/`

### Project Structure

```
nanopng/
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── ui/                # Shadcn UI components
│   └── ...                # Feature components
├── lib/
│   ├── core/              # Core algorithms (quantization, dithering, etc.)
│   ├── services/          # Business logic services
│   ├── types/             # TypeScript type definitions
│   ├── utils.ts           # Utility functions
│   ├── wasm/              # WebAssembly modules
│   └── workers/           # Web Worker scripts
└── public/                # Static assets
```

## 🌐 Browser Compatibility

NanoPNG works in all modern browsers that support:
-   **Web Workers** (for background processing)
-   **Canvas API** (for image encoding)
-   **File API** (for drag & drop)
-   **WebAssembly** (for future Rust core features)

### Format Support by Browser

| Format | Chrome/Edge | Firefox | Safari | Notes |
|--------|------------|---------|--------|-------|
| PNG    | ✅         | ✅      | ✅     | Full support |
| JPEG   | ✅         | ✅      | ✅     | Full support |
| WebP   | ✅         | ✅      | ✅     | Full support (Safari 14+) |
| AVIF   | ✅         | ✅      | ⚠️     | Safari 17+ (encoding) |
| HEIC   | ✅         | ✅      | ✅     | Via `heic2any` conversion |

**Note**: AVIF encoding requires browser support. The app automatically falls back to WebP if AVIF encoding is not available.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.
