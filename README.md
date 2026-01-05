# NanoPNG

**State-of-the-art image compression, right in your browser.**

NanoPNG is a secure, privacy-focused image compressor that rivals server-side solutions like TinyPNG, but runs entirely on your device. No images are ever uploaded to a server.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/Using-TypeScript-3178C6.svg)

## 🚀 Vision

The goal of NanoPNG is to provide **server-grade image optimization without the server**. Modern browsers are powerful enough to handle complex image processing tasks like quantization, dithering, and format conversion. By leveraging Web Workers and WASM, we can deliver a tool that respects user privacy (zero data upload) while saving significant bandwidth.

## ✨ Key Features

-   **Privacy First**: All processing happens locally. Your photos never leave your computer.
-   **Smart Quantization**: Converts 32-bit RGBA images to efficient 8-bit Indexed PNGs using advanced dithering algorithms (Floyd-Steinberg).
-   **Metadata Preservation**: Automatically preserves critical metadata (EXIF orientation, ICC Color Profiles) often lost by standard canvas exports.
-   **Performance**: Offloads heavy computational work to Web Workers, ensuring a smooth, non-blocking UI even with 4K+ images.
-   **Modern Formats**: Intelligent fallback and conversion strategies for WebP, AVIF, and JPEG.

## 🛠 Technical Architecture

NanoPNG is built with **Next.js** and **TypeScript**, designed for performance and extensibility.

-   **Frontend**: React-based UI with Drag & Drop zones (Shadcn UI + Tailwind CSS).
-   **Concurrency**: Uses a **Web Worker** (`lib/workers/image-processor.worker.ts`) to handle the CPU-intensive quantization process (via `image-q`).
-   **Pipeline**:
    1.  **Analysis**: Determining image complexity (Photo vs. Graphic).
    2.  **Decoding**: Using HTML5 Canvas to get raw RGBA data.
    3.  **Processing**: Quantization and Dithering in Worker.
    4.  **Metadata Injection**: Extracting EXIF/ICC chunks from source and injecting them into the optimized Blob.

## 🏁 Roadmap & Next Steps

We are actively working on pushing the boundaries of in-browser compression.

-   [ ] **Rust Core**: Migrate the quantization and encoding logic from TypeScript to **Rust** (via WASM) using libraries like `oxipng` or `imagequant-rs` for blazing fast performance and smaller memory footprint.
-   [ ] **Smart Resizing**: Add high-quality resizing (Lanczos3) and "Compress to Target Size" (e.g., "Make this under 50KB").
-   [ ] **Batch Processing**: Parallel processing for folders of images.
-   [ ] **PWA Support**: Full offline capabilities.
-   [ ] **Conversion**: "Convert All to WebP/AVIF".

## 🤝 Contribution Guidelines

We welcome contributions!

1.  **Fork** the repository.
2.  **Clone** your fork locally.
3.  **Branch** for your feature: `git checkout -b feature/amazing-feature`.
4.  **Install dependencies**:
    ```bash
    npm install
    ```
5.  **Run development server**:
    ```bash
    npm run dev
    ```
6.  **Commit** your changes and push.
7.  **Open a Pull Request**.

### Code Standards
-   Use **TypeScript** for strict type safety.
-   Ensure **Linting** passes (`npm run lint` if configured).
-   Keep heavy logic inside `lib/workers` or `lib/core`.

## 📄 License

MIT.
