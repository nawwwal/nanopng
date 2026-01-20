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

### 2. Build Wasm Module

```bash
cd crate
wasm-pack build --target web --out-dir ../public/wasm
cd ..
```

This generates:
- `public/wasm/nanopng_core.js` (JS glue code)
- `public/wasm/nanopng_core_bg.wasm` (Wasm binary)

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
# 1. Build Wasm
cd crate && wasm-pack build --target web --out-dir ../public/wasm && cd ..

# 2. Build Next.js
npm run build

# 3. Start production server (local testing)
npm run start
```

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

Create `vercel.json` in project root:

```json
{
  "buildCommand": "cd crate && wasm-pack build --target web --out-dir ../public/wasm && cd .. && npm run build",
  "installCommand": "curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh && npm install"
}
```

> **Note**: Vercel's build environment includes Rust. The custom install command adds wasm-pack.

### Environment Variables

No special environment variables required.

### Headers

The `next.config.mjs` already configures required headers:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These enable `SharedArrayBuffer` for multithreading.

---

## Troubleshooting

### "wasm-pack: command not found"
```bash
cargo install wasm-pack
```

### Wasm module fails to load in browser
1. Check `public/wasm/` contains both `.js` and `.wasm` files
2. Verify dev server is running
3. Check browser console for CORS errors

### SharedArrayBuffer not available
- Ensure COOP/COEP headers are being served
- Check Network tab for header presence
- Note: These headers may break third-party embeds

### Slow first Wasm compilation
Normal for first build (2-5 mins). Subsequent builds are cached (~30s).

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
| Build Wasm | `cd crate && wasm-pack build --target web --out-dir ../public/wasm` |
| Prod build | `npm run build` |
| Run tests | `npm test` |
| Type check | `npx tsc --noEmit` |
| Deploy | `vercel` |
