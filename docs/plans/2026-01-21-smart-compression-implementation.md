# Smart Compression Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement quick probe detection, speed optimizations, and auto photo/graphic detection for all same-format conversions.

**Architecture:** Two-phase compression with fast probe first, then full encode if savings likely. Image type detection to auto-select lossy vs lossless for PNG. Speed flags added to all encoders.

**Tech Stack:** TypeScript, Rust/WASM (png, jpeg-encoder, ravif, imagequant crates), Vitest for testing

---

## Task 1: Add Image Type Detection

**Files:**
- Create: `lib/core/image-analyzer.ts`
- Create: `lib/core/__tests__/image-analyzer.test.ts`

**Step 1: Write the failing test**

Create `lib/core/__tests__/image-analyzer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeImageType, ImageType } from '../image-analyzer';

describe('analyzeImageType', () => {
  it('detects graphic with few unique colors', () => {
    // 10x10 image with only 2 colors (red and blue)
    const width = 10;
    const height = 10;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const isRed = i % 2 === 0;
      data[i * 4] = isRed ? 255 : 0;     // R
      data[i * 4 + 1] = 0;                // G
      data[i * 4 + 2] = isRed ? 0 : 255;  // B
      data[i * 4 + 3] = 255;              // A
    }

    const result = analyzeImageType(data, width, height);
    expect(result.type).toBe('graphic');
    expect(result.uniqueColors).toBeLessThan(100);
  });

  it('detects photo with many unique colors', () => {
    // 100x100 image with gradient (many colors)
    const width = 100;
    const height = 100;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = Math.floor((x / width) * 255);      // R gradient
        data[i + 1] = Math.floor((y / height) * 255); // G gradient
        data[i + 2] = 128;                             // B constant
        data[i + 3] = 255;                             // A
      }
    }

    const result = analyzeImageType(data, width, height);
    expect(result.type).toBe('photo');
    expect(result.uniqueColors).toBeGreaterThan(1000);
  });

  it('returns mixed for ambiguous images', () => {
    // 50x50 image with moderate color variety
    const width = 50;
    const height = 50;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      // 500 unique colors (between thresholds)
      const colorIndex = i % 500;
      data[i * 4] = colorIndex % 256;
      data[i * 4 + 1] = Math.floor(colorIndex / 2) % 256;
      data[i * 4 + 2] = 100;
      data[i * 4 + 3] = 255;
    }

    const result = analyzeImageType(data, width, height);
    expect(result.type).toBe('mixed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: FAIL with "Cannot find module '../image-analyzer'"

**Step 3: Write minimal implementation**

Create `lib/core/image-analyzer.ts`:

```typescript
export type ImageType = 'photo' | 'graphic' | 'mixed';

export interface ImageAnalysisResult {
  type: ImageType;
  uniqueColors: number;
  hasGradients: boolean;
  hasSolidRegions: boolean;
}

const GRAPHIC_COLOR_THRESHOLD = 5000;
const PHOTO_COLOR_THRESHOLD = 50000;
const SAMPLE_SIZE = 10000;

/**
 * Analyze image to determine if it's a photo or graphic.
 * Samples pixels to count unique colors and detect patterns.
 */
export function analyzeImageType(
  data: Uint8Array,
  width: number,
  height: number
): ImageAnalysisResult {
  const totalPixels = width * height;
  const sampleStep = Math.max(1, Math.floor(totalPixels / SAMPLE_SIZE));

  // Count unique colors using a Set of color hashes
  const colorSet = new Set<number>();
  let solidRegions = 0;
  let gradientPixels = 0;
  let sampledPixels = 0;

  for (let i = 0; i < totalPixels; i += sampleStep) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Hash color to single number (ignore alpha for color counting)
    const colorHash = (r << 16) | (g << 8) | b;
    colorSet.add(colorHash);
    sampledPixels++;

    // Check for gradient by comparing with neighbor
    if (i + sampleStep < totalPixels) {
      const nextIdx = (i + sampleStep) * 4;
      const dr = Math.abs(data[nextIdx] - r);
      const dg = Math.abs(data[nextIdx + 1] - g);
      const db = Math.abs(data[nextIdx + 2] - b);
      const diff = dr + dg + db;

      if (diff > 0 && diff < 30) {
        gradientPixels++;
      } else if (diff === 0) {
        solidRegions++;
      }
    }
  }

  // Extrapolate unique colors based on sample ratio
  const sampleRatio = sampledPixels / totalPixels;
  const estimatedUniqueColors = Math.min(
    totalPixels,
    Math.round(colorSet.size / sampleRatio)
  );

  const hasGradients = gradientPixels > sampledPixels * 0.3;
  const hasSolidRegions = solidRegions > sampledPixels * 0.3;

  // Classify based on thresholds
  let type: ImageType;
  if (estimatedUniqueColors < GRAPHIC_COLOR_THRESHOLD || hasSolidRegions) {
    type = 'graphic';
  } else if (estimatedUniqueColors > PHOTO_COLOR_THRESHOLD && hasGradients) {
    type = 'photo';
  } else {
    type = 'mixed';
  }

  return {
    type,
    uniqueColors: estimatedUniqueColors,
    hasGradients,
    hasSolidRegions,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/core/__tests__/image-analyzer.test.ts`

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add lib/core/image-analyzer.ts lib/core/__tests__/image-analyzer.test.ts
git commit -m "feat: add image type detection (photo vs graphic)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Speed Mode to CompressionOptions

**Files:**
- Modify: `lib/types/compression.ts`
- Modify: `lib/types/__tests__/compression.test.ts`

**Step 1: Write the failing test**

Add to `lib/types/__tests__/compression.test.ts`:

```typescript
it('supports speedMode option', () => {
  const options: CompressionOptions = {
    format: 'png',
    quality: 80,
    speedMode: true,
  };
  expect(options.speedMode).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/types/__tests__/compression.test.ts`

Expected: FAIL with TypeScript error about speedMode not existing

**Step 3: Write minimal implementation**

Modify `lib/types/compression.ts` - add to CompressionOptions interface:

```typescript
export interface CompressionOptions {
  format: ImageFormat | "auto"
  quality: number // 0-100
  targetWidth?: number
  targetHeight?: number
  // Advanced options
  dithering?: number // 0.0 - 1.0 (for PNG)
  chromaSubsampling?: boolean // true = 4:2:0, false = 4:4:4 (for JPEG)
  lossless?: boolean // Force lossless (PNG/WebP)
  targetSizeKb?: number
  // Speed optimization
  speedMode?: boolean // Use faster encoding presets
  skipProbe?: boolean // Skip quick probe (for manual control)
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/types/__tests__/compression.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/types/compression.ts lib/types/__tests__/compression.test.ts
git commit -m "feat: add speedMode and skipProbe to CompressionOptions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Speed Flag to Rust Config

**Files:**
- Modify: `crate/src/lib.rs`

**Step 1: Update Rust Config struct**

Modify `crate/src/lib.rs` - add speed field to Config:

```rust
#[derive(Serialize, Deserialize)]
pub struct Config {
    pub format: Format,
    pub quality: u8,       // 0-100
    pub transparent: bool, // Maintain transparency?
    pub lossless: bool,    // Force lossless?
    pub dithering: f32,    // 0.0 - 1.0 (for PNG/quantization)
    pub resize: Option<ResizeConfig>,
    pub chroma_subsampling: bool, // true = 4:2:0, false = 4:4:4
    pub speed: u8,         // 1-10 (1=best quality, 10=fastest)
}
```

**Step 2: Pass speed to encoders**

Update `process_image` function to pass speed:

```rust
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
        config.speed,
    )
    .map_err(|e| JsValue::from_str(&e)),
    Format::Avif => codecs::avif::encode_avif(
        &current_data,
        current_width,
        current_height,
        config.quality,
        config.speed,
    )
    .map_err(|e| JsValue::from_str(&e)),
}
```

**Step 3: Build WASM to verify it compiles**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression/crate && wasm-pack build --target web --out-dir ../public/wasm`

Expected: Build fails (codec functions need updating)

**Step 4: Commit partial progress**

```bash
git add crate/src/lib.rs
git commit -m "feat: add speed parameter to Rust Config

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Speed to PNG Encoder

**Files:**
- Modify: `crate/src/codecs/png.rs`

**Step 1: Update encode_png signature**

Modify `crate/src/codecs/png.rs`:

```rust
use imagequant::{Attributes, RGBA};
use png::{BitDepth, ColorType, Compression, Encoder};

pub fn encode_png(
    data: &[u8],
    width: u32,
    height: u32,
    lossless: bool,
    dithering_level: f32,
    speed: u8,
) -> Result<Vec<u8>, String> {
    if lossless {
        encode_lossless(data, width, height, speed)
    } else {
        encode_lossy(data, width, height, dithering_level, speed)
    }
}

fn encode_lossless(data: &[u8], width: u32, height: u32, speed: u8) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();

    {
        let mut encoder = Encoder::new(&mut output, width, height);
        encoder.set_color(ColorType::Rgba);
        encoder.set_depth(BitDepth::Eight);

        // Speed 1-5 = Best compression, 6-10 = Fast compression
        let compression = if speed <= 5 {
            Compression::Best
        } else {
            Compression::Fast
        };
        encoder.set_compression(compression);

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header write failed: {:?}", e))?;

        writer
            .write_image_data(data)
            .map_err(|e| format!("PNG data write failed: {:?}", e))?;
    }

    Ok(output)
}

fn encode_lossy(
    data: &[u8],
    width: u32,
    height: u32,
    dithering_level: f32,
    speed: u8,
) -> Result<Vec<u8>, String> {
    // 1. Convert raw bytes to RGBA pixels
    let pixels: Vec<RGBA> = data
        .chunks(4)
        .map(|chunk| RGBA {
            r: chunk[0],
            g: chunk[1],
            b: chunk[2],
            a: chunk[3],
        })
        .collect();

    // 2. Quantize with libimagequant
    let mut attr = Attributes::new();

    // Speed: 1 (slowest/best) to 10 (fastest)
    // imagequant speed is 1-10, map our speed directly
    let liq_speed = speed.clamp(1, 10) as i32;
    attr.set_speed(liq_speed)
        .map_err(|e| format!("Failed to set LIQ speed: {:?}", e))?;
    attr.set_quality(0, 100)
        .map_err(|e| format!("Failed to set LIQ quality: {:?}", e))?;

    let mut img = attr
        .new_image(pixels, width as usize, height as usize, 0.0)
        .map_err(|e| format!("Failed to create LIQ image: {:?}", e))?;

    let mut res = attr
        .quantize(&mut img)
        .map_err(|e| format!("Quantization failed: {:?}", e))?;

    res.set_dithering_level(dithering_level)
        .map_err(|e| format!("Failed to set dithering: {:?}", e))?;

    let (palette, indexed_pixels) = res
        .remapped(&mut img)
        .map_err(|e| format!("Remapping failed: {:?}", e))?;

    // 3. Encode to PNG with palette
    let mut output = Vec::new();

    {
        let mut encoder = Encoder::new(&mut output, width, height);
        encoder.set_color(ColorType::Indexed);
        encoder.set_depth(BitDepth::Eight);

        let compression = if speed <= 5 {
            Compression::Best
        } else {
            Compression::Fast
        };
        encoder.set_compression(compression);

        let mut rgb_palette: Vec<u8> = Vec::with_capacity(palette.len() * 3);
        let mut trns: Vec<u8> = Vec::with_capacity(palette.len());

        for px in &palette {
            rgb_palette.push(px.r);
            rgb_palette.push(px.g);
            rgb_palette.push(px.b);
            trns.push(px.a);
        }

        encoder.set_palette(rgb_palette);
        encoder.set_trns(trns);

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header write failed: {:?}", e))?;

        writer
            .write_image_data(&indexed_pixels)
            .map_err(|e| format!("PNG data write failed: {:?}", e))?;
    }

    Ok(output)
}
```

**Step 2: Build to verify**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression/crate && cargo check`

Expected: Build fails (AVIF encoder needs speed parameter)

**Step 3: Commit**

```bash
git add crate/src/codecs/png.rs
git commit -m "feat: add speed parameter to PNG encoder

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update AVIF Encoder Speed

**Files:**
- Modify: `crate/src/codecs/avif.rs`

**Step 1: Update encode_avif to use speed parameter**

The function already accepts speed, but it's hardcoded to 4 in lib.rs. We already pass `config.speed` from Task 3. Verify the signature matches:

```rust
pub fn encode_avif(
    data: &[u8],
    width: u32,
    height: u32,
    quality: u8,
    speed: u8
) -> Result<Vec<u8>, String> {
    // ... existing code uses speed parameter correctly
}
```

**Step 2: Build full WASM**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression/crate && wasm-pack build --target web --out-dir ../public/wasm`

Expected: PASS

**Step 3: Commit**

```bash
git add crate/src/codecs/avif.rs public/wasm/
git commit -m "feat: wire speed parameter through all Rust encoders

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Update Worker to Pass Speed

**Files:**
- Modify: `lib/workers/processor.worker.ts`

**Step 1: Add speed to config object**

Modify `processor.worker.ts` - update the config object in `processImage`:

```typescript
const config = {
    format: opt.format === 'jpg' ? 'Jpeg' :
        opt.format === 'png' ? 'Png' :
            opt.format === 'avif' ? 'Avif' : 'Jpeg',
    quality: Math.round((opt.quality || 0.8) * 100),
    transparent: true,
    lossless: opt.lossless || false,
    dithering: opt.dithering || 1.0,
    resize: fitDimensions ? {
        width: fitDimensions.width,
        height: fitDimensions.height,
        filter: "Lanczos3"
    } : null,
    chroma_subsampling: opt.chromaSubsampling !== false,
    speed: opt.speedMode ? 8 : 5,  // Fast mode uses speed 8, normal uses 5
};
```

**Step 2: Update WebP encoding for speed mode**

Modify `processWebP` function:

```typescript
// Build encoding options
const quality = Math.round((opt.quality || 0.8) * 100);
const encodeOptions = {
    ...webpDefaultOptions,
    quality,
    lossless: opt.lossless ? 1 : 0,
    method: opt.speedMode ? 0 : 4,  // 0 = fastest, 4 = balanced
};
```

**Step 3: Run tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test`

Expected: PASS

**Step 4: Commit**

```bash
git add lib/workers/processor.worker.ts
git commit -m "feat: pass speed mode to WASM and WebP encoders

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Quick Probe Logic

**Files:**
- Create: `lib/services/quick-probe.ts`
- Create: `lib/services/__tests__/quick-probe.test.ts`

**Step 1: Write the failing test**

Create `lib/services/__tests__/quick-probe.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quickProbe, ProbeResult } from '../quick-probe';

// Mock the worker pool
vi.mock('@/lib/workers/worker-pool', () => ({
  getWorkerPool: () => ({
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: new Uint8Array([1, 2, 3, 4]) // 4 bytes = tiny result
    })
  })
}));

describe('quickProbe', () => {
  it('returns skip when estimated savings below threshold', async () => {
    const originalSize = 100; // 100 bytes original
    const pixelData = new Uint8Array(40 * 40 * 4); // 40x40 image

    const result = await quickProbe({
      pixelData,
      width: 40,
      height: 40,
      originalSize,
      format: 'png',
      threshold: 0.03, // 3% threshold
    });

    expect(result.shouldSkip).toBe(true);
    expect(result.estimatedSavings).toBeDefined();
  });

  it('returns proceed when estimated savings above threshold', async () => {
    const originalSize = 10000; // 10KB original
    const pixelData = new Uint8Array(100 * 100 * 4);

    const result = await quickProbe({
      pixelData,
      width: 100,
      height: 100,
      originalSize,
      format: 'png',
      threshold: 0.03,
    });

    expect(result.shouldSkip).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/services/__tests__/quick-probe.test.ts`

Expected: FAIL with "Cannot find module '../quick-probe'"

**Step 3: Write minimal implementation**

Create `lib/services/quick-probe.ts`:

```typescript
import { getWorkerPool } from "@/lib/workers/worker-pool";
import { ImageFormat } from "@/lib/types/compression";

export interface ProbeOptions {
  pixelData: Uint8Array;
  width: number;
  height: number;
  originalSize: number;
  format: ImageFormat;
  threshold: number; // e.g., 0.03 for 3%
}

export interface ProbeResult {
  shouldSkip: boolean;
  estimatedSavings: number;
  probeTimeMs: number;
}

const PROBE_MAX_DIMENSION = 512;

/**
 * Quick probe to estimate if full compression is worthwhile.
 * Encodes at reduced resolution with fast settings.
 */
export async function quickProbe(options: ProbeOptions): Promise<ProbeResult> {
  const startTime = performance.now();
  const { pixelData, width, height, originalSize, format, threshold } = options;

  // Calculate probe dimensions (50% or max 512px)
  const scale = Math.min(0.5, PROBE_MAX_DIMENSION / Math.max(width, height));
  const probeWidth = Math.max(1, Math.round(width * scale));
  const probeHeight = Math.max(1, Math.round(height * scale));

  // Downsample pixel data for probe
  const probePixels = downsamplePixels(pixelData, width, height, probeWidth, probeHeight);

  // Create SharedArrayBuffer for worker
  const sab = new SharedArrayBuffer(probePixels.length);
  const sabView = new Uint8Array(sab);
  sabView.set(probePixels);

  // Execute fast probe encode
  const workerPool = getWorkerPool();
  const result = await workerPool.execute(async (api) => {
    return api.processImage(
      'probe',
      probeWidth,
      probeHeight,
      {
        format,
        quality: 0.5, // Low quality for speed
        speedMode: true,
        lossless: false,
      },
      sab
    );
  });

  const probeTimeMs = performance.now() - startTime;

  if (!result.success || !result.data) {
    // If probe fails, don't skip (let full compression try)
    return { shouldSkip: false, estimatedSavings: 0, probeTimeMs };
  }

  // Estimate full-size savings based on probe
  // Probe compression ratio should roughly correlate with full image
  const probeSize = result.data.length;
  const probeOriginalSize = probeWidth * probeHeight * 4; // Raw RGBA size
  const probeRatio = probeSize / probeOriginalSize;

  // Estimate compressed size at full resolution
  const estimatedFullSize = width * height * 4 * probeRatio;
  const estimatedSavings = Math.max(0, (originalSize - estimatedFullSize) / originalSize);

  return {
    shouldSkip: estimatedSavings < threshold,
    estimatedSavings,
    probeTimeMs,
  };
}

/**
 * Simple nearest-neighbor downsampling for probe.
 */
function downsamplePixels(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.floor(y * yRatio);
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;

      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return dst;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/services/__tests__/quick-probe.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/quick-probe.ts lib/services/__tests__/quick-probe.test.ts
git commit -m "feat: add quick probe for estimating compression savings

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Integrate Probe and Detection into Orchestrator

**Files:**
- Modify: `lib/services/compression-orchestrator.ts`
- Modify: `lib/services/__tests__/compression-orchestrator.test.ts`

**Step 1: Write the failing test**

Add to `lib/services/__tests__/compression-orchestrator.test.ts`:

```typescript
it('skips compression when probe detects already-optimized image', async () => {
  const file = new File(['test'], 'test.png', { type: 'image/png' });

  // Mock ImageService to return minimal savings
  vi.mocked(ImageService.compress).mockResolvedValueOnce({
    id: 'test-id',
    compressedBlob: new Blob(['test-same-size'], { type: 'image/png' }),
    format: 'png',
    analysis: { isPhoto: false, hasTransparency: false, complexity: 0.5, suggestedFormat: 'png' },
    originalWidth: 100,
    originalHeight: 100,
    width: 100,
    height: 100,
    originalSize: 100,
    compressedSize: 99,
    savings: 1,
    status: 'already-optimized',
  } as any);

  const result = await orchestrator.compress({
    id: 'test-id',
    file,
    options: { format: 'png', quality: 80 }
  });

  expect(result).toBeDefined();
});

it('auto-selects lossy for graphic images', async () => {
  const file = new File(['test'], 'test.png', { type: 'image/png' });

  const result = await orchestrator.compress({
    id: 'test-id',
    file,
    options: { format: 'png', quality: 80 }
  });

  // Should complete without error
  expect(result).toBeDefined();
});
```

**Step 2: Run test to verify current behavior**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test -- lib/services/__tests__/compression-orchestrator.test.ts`

Expected: PASS (existing tests still work)

**Step 3: Update orchestrator with probe logic**

Modify `lib/services/compression-orchestrator.ts`:

```typescript
import { ImageService } from "./image-service"
import { CompressionOptions, CompressionResult } from "@/lib/types/compression"
import { analyzeImageType } from "@/lib/core/image-analyzer"
import { quickProbe } from "./quick-probe"

export class CompressionOrchestrator {
  private static instance: CompressionOrchestrator

  private constructor() { }

  static getInstance(): CompressionOrchestrator {
    if (!CompressionOrchestrator.instance) {
      CompressionOrchestrator.instance = new CompressionOrchestrator()
    }
    return CompressionOrchestrator.instance
  }

  async compress(payload: { id: string; file: File; options: CompressionOptions }): Promise<CompressionResult> {
    const { id, file, options } = payload

    // Determine target format
    const targetFormat = options.format === 'auto' ? undefined : options.format

    // Decode image to get pixel data for analysis
    const img = await createImageBitmap(file)
    const width = img.width
    const height = img.height

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, width, height)
    const pixelData = new Uint8Array(imageData.data.buffer)

    // Analyze image type for auto-lossless decision
    const analysis = analyzeImageType(pixelData, width, height)

    // Auto-select lossless based on image type (only for PNG)
    let effectiveLossless = options.lossless
    if (effectiveLossless === undefined && options.format === 'png') {
      // Graphics use lossy (palette reduction), photos use lossless
      effectiveLossless = analysis.type === 'photo' || analysis.type === 'mixed'
    }

    // Quick probe to check if compression is worthwhile
    if (!options.skipProbe && options.format !== 'auto') {
      const probeResult = await quickProbe({
        pixelData,
        width,
        height,
        originalSize: file.size,
        format: options.format,
        threshold: 0.03, // 3% minimum savings
      })

      if (probeResult.shouldSkip) {
        // Return early with "already-optimized" status
        return {
          blob: file,
          format: options.format,
          analysis: {
            isPhoto: analysis.type === 'photo',
            hasTransparency: false,
            complexity: 0.5,
            uniqueColors: analysis.uniqueColors,
            suggestedFormat: options.format,
          },
          resizeApplied: false,
          targetSizeMet: true,
          originalWidth: width,
          originalHeight: height,
          width,
          height,
          warning: `Skipped: estimated savings ${Math.round(probeResult.estimatedSavings * 100)}% below 3% threshold`,
        }
      }
    }

    // Target size in bytes (if specified)
    const targetSizeBytes = options.targetSizeKb ? options.targetSizeKb * 1024 : null

    // Binary search parameters for target size
    let quality = options.quality || 85
    let minQuality = 1
    let maxQuality = quality
    const maxIterations = 12

    let currentWidth = options.targetWidth
    let currentHeight = options.targetHeight
    let resizeAttempts = 0
    let warning: string | undefined

    // First pass at requested quality
    let imageServiceResult = await ImageService.compress(
      file,
      id,
      0,
      undefined,
      targetFormat,
      quality / 100,
      currentWidth,
      currentHeight,
      options.dithering,
      options.chromaSubsampling,
      effectiveLossless,
      options.speedMode
    )

    // If target size is specified and exceeded, iterate with binary search
    if (targetSizeBytes && imageServiceResult.compressedBlob && imageServiceResult.compressedBlob.size > targetSizeBytes) {
      let iterations = 0

      while (iterations < maxIterations && maxQuality - minQuality > 1) {
        quality = Math.floor((minQuality + maxQuality) / 2)

        imageServiceResult = await ImageService.compress(
          file,
          id,
          0,
          undefined,
          targetFormat,
          quality / 100,
          currentWidth,
          currentHeight,
          options.dithering,
          options.chromaSubsampling,
          effectiveLossless,
          options.speedMode
        )

        const currentSize = imageServiceResult.compressedBlob?.size || 0

        if (currentSize <= targetSizeBytes) {
          minQuality = quality
        } else {
          maxQuality = quality
        }

        iterations++
      }

      // Resize fallback if still exceeds target
      let currentSize = imageServiceResult.compressedBlob?.size || 0
      const maxResizeAttempts = 3

      while (currentSize > targetSizeBytes && resizeAttempts < maxResizeAttempts) {
        resizeAttempts++

        const baseWidth = imageServiceResult.width || imageServiceResult.originalWidth || 1920
        const baseHeight = imageServiceResult.height || imageServiceResult.originalHeight || 1080

        currentWidth = Math.round(baseWidth * 0.75)
        currentHeight = Math.round(baseHeight * 0.75)
        currentWidth = Math.max(currentWidth, 100)
        currentHeight = Math.max(currentHeight, 100)

        quality = options.quality || 85
        minQuality = 1
        maxQuality = quality
        iterations = 0

        while (iterations < maxIterations && maxQuality - minQuality > 1) {
          quality = Math.floor((minQuality + maxQuality) / 2)

          imageServiceResult = await ImageService.compress(
            file,
            id,
            0,
            undefined,
            targetFormat,
            quality / 100,
            currentWidth,
            currentHeight,
            options.dithering,
            options.chromaSubsampling,
            effectiveLossless,
            options.speedMode
          )

          currentSize = imageServiceResult.compressedBlob?.size || 0

          if (currentSize <= targetSizeBytes) {
            minQuality = quality
          } else {
            maxQuality = quality
          }

          iterations++
        }

        currentSize = imageServiceResult.compressedBlob?.size || 0
      }

      if (resizeAttempts > 0) {
        warning = `Image was resized to ${currentWidth}x${currentHeight} to meet target size`
      }
    }

    const finalSize = imageServiceResult.compressedBlob?.size || 0
    const targetSizeMet = !targetSizeBytes || finalSize <= targetSizeBytes

    if (!targetSizeMet) {
      warning = `Could not meet target size of ${options.targetSizeKb}KB (best: ${Math.round(finalSize / 1024)}KB)`
    }

    return {
      blob: imageServiceResult.compressedBlob || null,
      format: imageServiceResult.format,
      analysis: imageServiceResult.analysis!,
      resizeApplied: !!(options.targetWidth || options.targetHeight) || resizeAttempts > 0,
      targetSizeMet,
      originalWidth: imageServiceResult.originalWidth,
      originalHeight: imageServiceResult.originalHeight,
      width: imageServiceResult.width,
      height: imageServiceResult.height,
      warning,
    }
  }
}
```

**Step 4: Run tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/compression-orchestrator.ts lib/services/__tests__/compression-orchestrator.test.ts
git commit -m "feat: integrate quick probe and image type detection into orchestrator

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update ImageService to Accept Speed Mode

**Files:**
- Modify: `lib/services/image-service.ts`

**Step 1: Add speedMode parameter**

Modify `ImageService.compress` signature and pass to worker:

```typescript
static async compress(
  file: File,
  id: string,
  generation: number,
  analysis?: ImageAnalysis,
  format?: ImageFormat | "auto",
  quality?: number,
  targetWidth?: number,
  targetHeight?: number,
  dithering?: number,
  chromaSubsampling?: boolean,
  lossless?: boolean,
  speedMode?: boolean  // NEW PARAMETER
): Promise<CompressedImage> {
  // ... existing code ...

  const result = await workerPool.execute(async (api) => {
    return api.processImage(
      id,
      oriWidth,
      oriHeight,
      {
        format: (format || "jpeg") as ImageFormat | "auto",
        quality: quality ?? 0.85,
        targetWidth,
        targetHeight,
        dithering,
        chromaSubsampling,
        lossless,
        speedMode,  // PASS TO WORKER
      },
      sab
    );
  });

  // ... rest unchanged ...
}
```

**Step 2: Run tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test`

Expected: PASS

**Step 3: Commit**

```bash
git add lib/services/image-service.ts
git commit -m "feat: pass speedMode through ImageService to worker

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Run Full Test Suite and Build

**Step 1: Run all tests**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm test`

Expected: All tests pass

**Step 2: Build WASM**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression/crate && wasm-pack build --target web --out-dir ../public/wasm`

Expected: PASS

**Step 3: Build Next.js app**

Run: `cd /Users/aditya.nawal/Projects/nanopng/.worktrees/smart-compression && npm run build`

Expected: PASS

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: ensure all tests pass and build succeeds

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Image type detection | `lib/core/image-analyzer.ts` |
| 2 | Add speedMode to options | `lib/types/compression.ts` |
| 3 | Rust Config speed field | `crate/src/lib.rs` |
| 4 | PNG encoder speed | `crate/src/codecs/png.rs` |
| 5 | AVIF encoder wiring | `crate/src/codecs/avif.rs` |
| 6 | Worker speed mode | `lib/workers/processor.worker.ts` |
| 7 | Quick probe logic | `lib/services/quick-probe.ts` |
| 8 | Orchestrator integration | `lib/services/compression-orchestrator.ts` |
| 9 | ImageService speedMode | `lib/services/image-service.ts` |
| 10 | Full build verification | All files |
