# NanoPNG - Local Development & Deployment Guide

## Prerequisites

### Required Tools
- **Node.js** 18+ (recommended: 20 LTS)
- **npm** 9+ or **pnpm**
- **Rust** toolchain (for Wasm compilation)
- **wasm-pack** CLI tool

### Install Rust & wasm-pack

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add wasm32 target
# Install wasm-pack
cargo install wasm-pack
```

---

## Local Development

### 1. Clone & Install Dependencies

```bash
git clone <your-repo>
cd nanopng
npm install
```

### 2. Build Wasm Module (if Rust crate changed)

```bash
npm run wasm:build
```

This generates WASM artifacts in `lib/wasm/nanopng-core/pkg/`:
- `nanopng_core.js` (JS glue code)
- `nanopng_core_bg.wasm` (Wasm binary)

**Note**: These artifacts are committed to the repo. You only need to rebuild if you modify the Rust crate (`crate/src/`).

### 3. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 4. Run Tests

```bash
# Unit tests
npm test

# Type check
npx tsc --noEmit
```

---

## Production Build

### Full Build Command

```bash
# 1. Prepare WASM (copies prebuilt artifacts to public/wasm/)
# This happens automatically during npm run build, but you can run it separately:
npm run wasm:prepare

# 2. Build Next.js
npm run build

# 3. Start production server (local testing)
npm run start
```

**Note**: The build process copies prebuilt WASM artifacts from `lib/wasm/nanopng-core/pkg/` to `public/wasm/`. If you've modified the Rust crate, rebuild it first with `npm run wasm:build` and commit the updated artifacts.

---

## Deploying to Vercel

### Option 1: GitHub Integration (Recommended)

1. **Push to GitHub**
2. **Connect to Vercel**: https://vercel.com/new
3. **Configure Build**:
   - Framework: Next.js (auto-detected)
   - Build Command: Custom (see below)
   - Install Command: `npm install`

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Build Configuration

The `vercel.json` file is configured to use the standard Next.js build:

```json
{
  "buildCommand": "npm run build"
}
```

**How it works**:
- Vercel runs `npm install` (standard Next.js install)
- Then runs `npm run build`, which:
  1. Copies prebuilt WASM artifacts from `lib/wasm/nanopng-core/pkg/` to `public/wasm/` via `wasm:prepare`
  2. Builds the Next.js application

**Important**: WASM artifacts are **prebuilt and committed** to the repo. Vercel does **not** compile Rust during deployment. If you modify the Rust crate (`crate/src/`), rebuild locally with `npm run wasm:build` and commit the updated artifacts in `lib/wasm/nanopng-core/pkg/`.

### Environment Variables

No special environment variables required.

### Headers

The `next.config.mjs` already configures required headers:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These enable `SharedArrayBuffer` for multithreading.

---

## Troubleshooting

### "Missing WASM artifact" error during build
This means the prebuilt WASM files are missing from `lib/wasm/nanopng-core/pkg/`. Rebuild them:

```bash
npm run wasm:build
```

Then commit the updated artifacts and redeploy.

### Wasm module fails to load in browser
1. Check `public/wasm/` contains both `.js` and `.wasm` files
2. Verify dev server is running
3. Check browser console for CORS errors
4. Ensure `npm run wasm:prepare` ran successfully (it's part of `npm run build`)

### SharedArrayBuffer not available
- Ensure COOP/COEP headers are being served
- Check Network tab for header presence
- Note: These headers may break third-party embeds

### Vercel build fails with "failed to find Rust installation"
This should no longer happen with the updated configuration. If it does, ensure:
- `vercel.json` only contains `{"buildCommand": "npm run build"}`
- No custom `installCommand` is set
- WASM artifacts exist in `lib/wasm/nanopng-core/pkg/`

---

## CI/CD Pipeline

GitHub Actions workflow at `.github/workflows/wasm-build.yml`:

```yaml
# Pre-configured to:
# 1. Install Rust + wasm-pack
# 2. Build Wasm
# 3. Build Next.js
# 4. Run tests (optional)
```

Vercel automatically runs on push to main.

---

## Quick Reference

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build Wasm (Rust crate) | `npm run wasm:build` |
| Prepare WASM (copy to public) | `npm run wasm:prepare` |
| Prod build | `npm run build` |
| Run tests | `npm test` |
| Type check | `npx tsc --noEmit` |
| Deploy | `vercel` |
