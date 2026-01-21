# Smart Compression: Copilot Feedback Fixes

**Date:** 2026-01-21
**Status:** Approved
**Scope:** Address all Copilot review feedback from smart compression PR

## Overview

Single PR to fix correctness, accuracy, performance, and hygiene issues identified in the smart compression implementation.

## Changes

### 1. Image Analyzer (`lib/core/image-analyzer.ts`)

#### Unique Colors - Logarithmic Scaling

Replace raw count with diminishing-returns estimator:

```typescript
const sampledPixels = Math.ceil(totalPixels / sampleStep);
const saturationFactor = Math.log(totalPixels) / Math.log(sampledPixels);
const estimatedUniqueColors = Math.min(
  Math.round(uniqueColors * saturationFactor),
  totalPixels
);
```

#### Transparency Ratio Fix

Use actual sampled pixel count as denominator:

```typescript
const actualSampledPixels = Math.min(
  Math.ceil(totalPixels / sampleStep),
  sampleSize
);
const transparencyRatio = transparentPixels / actualSampledPixels;
```

#### Bounds Checks

- **Sampling loop**: Add `idx + 3 < data.length` check
- **Edge detection**: Change loop to `x < width - 1` to prevent `nextIdx` overflow
- **Texture analysis**: Clamp block coordinates to `(width - 1, height - 1)`

#### Add `hasSignificantTransparency` Flag

New field in analysis result, true if transparency ratio > 5%.

#### Remove Dead Code

Delete unused `estimateSavings` export.

### 2. Compression Orchestrator (`lib/services/compression-orchestrator.ts`)

#### Probe Savings Calculation

Replace quadratic assumption with pixel-ratio based estimation:

```typescript
const probePixels = probeWidth * probeHeight;
const originalPixels = originalWidth * originalHeight;
const pixelRatio = originalPixels / probePixels;

const probeCompressionRatio = probeCompressedSize / probeOriginalSize;
const estimatedFullCompressedSize = originalSize * probeCompressionRatio;
const estimatedSavings = (originalSize - estimatedFullCompressedSize) / originalSize;

if (estimatedSavings < 0.03) {
  return { skip: true, reason: 'already-optimized' };
}
```

#### PNG Mixed Mode - Transparency-Based

```typescript
if (imageAnalysis.type === 'photo') {
  effectiveLossless = true;
} else if (imageAnalysis.type === 'mixed') {
  effectiveLossless = imageAnalysis.hasSignificantTransparency;
} else {
  effectiveLossless = false;
}
```

#### Speed Mode Propagation

Pass `speedMode` through to resize-fallback compression path.

### 3. Worker Pool (`lib/workers/worker-pool.ts`)

#### Priority Queue - O(1) Access

Replace single queue with priority-level queues:

```typescript
private queues = {
  high: [] as QueuedTask[],
  normal: [] as QueuedTask[],
  low: [] as QueuedTask[],
};

private dequeue(): QueuedTask | undefined {
  return (
    this.queues.high.shift() ||
    this.queues.normal.shift() ||
    this.queues.low.shift()
  );
}
```

#### Dynamic Pool Scaling

Implement pool expansion/contraction using `maxPoolSize`:

- `normalPoolSize` (50% cores) for heavy compression work
- `maxPoolSize` (100% cores) for lightweight probe batches
- `expandPool()` scales up when probe work is queued
- `shrinkPool()` scales down when returning to full compression

### 4. Documentation Cleanup

Delete `docs/plans/2026-01-21-smart-compression-implementation.md` (contains hardcoded paths, no longer needed).

## Files Changed

| File | Changes |
|------|---------|
| `lib/core/image-analyzer.ts` | Logarithmic color scaling, transparency fix, bounds checks, add `hasSignificantTransparency`, remove dead code |
| `lib/services/compression-orchestrator.ts` | Fix probe savings, transparency-based mixed mode, speedMode propagation |
| `lib/workers/worker-pool.ts` | Priority queues, dynamic pool scaling |
| `docs/plans/2026-01-21-smart-compression-implementation.md` | Delete |

## Testing

- Unit tests for logarithmic color estimation accuracy
- Verify probe skip/proceed decisions with already-optimized images
- Test pool expansion/contraction behavior under load
