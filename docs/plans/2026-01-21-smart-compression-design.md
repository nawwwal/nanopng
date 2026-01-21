# Smart Compression: Quick Probe, Speed Optimization, and Auto-Detection

**Date:** 2026-01-21
**Status:** Approved
**Scope:** All same-format conversions (PNG, JPEG, WebP, AVIF)

## Problem Statement

1. Same-format conversions (PNG→PNG, JPEG→JPEG, etc.) always run full compression even when the image is already optimized, wasting CPU time
2. Processing is slower than necessary due to conservative encoding presets
3. PNG compression uses a one-size-fits-all approach that doesn't account for image type (photo vs graphic)

## Solution Overview

Three interconnected improvements:

1. **Quick Probe** - Fast test encode to skip already-optimized images
2. **Speed Optimizations** - Faster presets, better parallelization, reduced redundant operations
3. **Auto-Detection** - Classify images as photo/graphic to choose optimal compression strategy

## Design Details

### 1. Quick Probe Architecture

Two-phase compression pipeline:

```
Phase 1: Quick Probe (fast, low quality)
├── Use fastest encoding preset (PNG: Fast, JPEG: quality 50, WebP: effort 0)
├── Encode at reduced resolution (50% or max 512px on longest side)
├── Compare: estimated_full_savings = probe_savings × scale_factor
├── If estimated < 3% → Skip, mark as "already-optimized"
└── If estimated ≥ 3% → Proceed to Phase 2

Phase 2: Full Compression (current pipeline)
├── Use user's quality settings
├── Full resolution encoding
└── Apply all optimizations (dithering, quantization, etc.)
```

**Rationale:**
- Probe takes ~10-20% of full encode time
- Already-optimized images skip 80%+ of work
- False negatives are rare (probe correlates well with full encode)
- 3% threshold balances speed vs missing small gains

**Implementation:**
- New `quickProbe()` function in `compression-orchestrator.ts`
- Reuses existing worker pool infrastructure
- Probe runs on same worker to avoid extra thread overhead

### 2. Speed Optimizations

#### A. Faster Encoding Presets

| Format | Current | Proposed | Expected Speedup |
|--------|---------|----------|------------------|
| PNG lossless | `Compression::Best` | `Compression::Fast` | 3-5x |
| PNG lossy | Full quantization | Reduced iterations | 2x |
| JPEG | Quality only | Add `fast_dct` flag | 1.5x |
| WebP | Default effort | `method: 0` (fastest) | 2-3x |
| AVIF | `speed: 6` | `speed: 8` | 2x |

These are for "speed" mode. Quality mode retains current behavior.

#### B. Parallelization Improvements

- Quick probes run at 100% cores (lightweight operations)
- Batch small images together (<500KB) to reduce worker dispatch overhead
- Pipeline decode/encode: start encoding image N while decoding image N+1

#### C. Reduce Redundant Operations

- Skip `createImageBitmap()` re-decode if image is already RGBA in memory
- Cache decoded pixel buffers for retry attempts (quality binary search)
- Avoid SharedArrayBuffer copy when worker can read directly

### 3. Auto-Detect Photo vs Graphic

**Analysis algorithm:**

```
Analyze image characteristics:
├── Color count: Sample 10,000 pixels, count unique colors
├── Gradient detection: Check for smooth color transitions
├── Edge sharpness: Detect hard edges vs soft edges
└── Alpha channel: Check if transparency is used

Classification:
├── GRAPHIC (screenshot, icon, illustration):
│   └── < 5,000 unique colors OR hard edges + flat regions
│   └── → Use LOSSY (palette reduction + dithering)
│
├── PHOTO (camera image, artwork):
│   └── > 50,000 unique colors AND smooth gradients
│   └── → Use LOSSLESS (better encoding only)
│
└── MIXED (graphic with photo elements):
    └── Between thresholds
    └── → Use LOSSLESS (safer default)
```

**Format-specific behavior:**

| Format | Photo | Graphic |
|--------|-------|---------|
| PNG | Lossless encoding | Lossy (palette reduction) |
| JPEG | Higher quality floor (70+) | Lower quality OK (50+) |
| WebP | Lossy standard | Lossy + sharp_yuv disabled |

**Implementation:**
- New `analyzeImageType()` function in `lib/core/image-analyzer.ts`
- Runs on decoded pixel buffer (already available in pipeline)
- Takes ~5-10ms for typical image
- Result cached for retry attempts

## Files to Modify

| File | Changes |
|------|---------|
| `lib/services/compression-orchestrator.ts` | Add quick probe logic, integrate with main pipeline |
| `lib/workers/processor.worker.ts` | Fast encoding presets, speed mode flag |
| `lib/core/image-analyzer.ts` | New file: photo/graphic detection algorithm |
| `lib/services/image-service.ts` | Integrate detection + probe flow |
| `crate/src/lib.rs` | Accept speed flag, pass to codecs |
| `crate/src/codecs/png.rs` | Add `Compression::Fast` option |
| `crate/src/codecs/jpeg.rs` | Add fast DCT flag |
| `crate/src/codecs/avif.rs` | Configurable speed parameter |
| `lib/workers/worker-pool.ts` | Dynamic concurrency for probes vs full encode |

## Success Criteria

1. Already-optimized images complete in <100ms (currently several seconds)
2. Full compression pipeline is 2-3x faster for typical images
3. PNG graphics achieve 50%+ size reduction via auto-detected lossy mode
4. PNG photos preserve quality with lossless mode
5. No regression in output quality for existing workflows

## Out of Scope

- UI changes to expose speed/quality toggle (future enhancement)
- New format support
- Metadata preservation improvements (separate effort)
