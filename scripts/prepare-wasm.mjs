import { mkdir, copyFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sourceDir = join(projectRoot, 'lib/wasm/nanopng-core/pkg');
const webpSourceDir = join(projectRoot, 'node_modules/@jsquash/webp/codec/enc');
const jpegSourceDir = join(projectRoot, 'node_modules/@jsquash/jpeg/codec/enc');
const jxlSourceDir = join(projectRoot, 'node_modules/@jsquash/jxl/codec/enc');
const wasmFeatureDetectDir = join(projectRoot, 'node_modules/wasm-feature-detect/dist/esm');
const targetDir = join(projectRoot, 'public/wasm');

const filesToCopy = [
    { src: 'nanopng_core.js', dest: 'nanopng_core.js', sourceDir },
    { src: 'nanopng_core_bg.wasm', dest: 'nanopng_core_bg.wasm', sourceDir },
    // WebP encoder WASM files
    { src: 'webp_enc.wasm', dest: 'webp_enc.wasm', sourceDir: webpSourceDir },
    { src: 'webp_enc_simd.wasm', dest: 'webp_enc_simd.wasm', sourceDir: webpSourceDir },
    // WebP encoder JS files (for runtime loading, bypassing Webpack)
    { src: 'webp_enc.js', dest: 'webp_enc.js', sourceDir: webpSourceDir },
    { src: 'webp_enc_simd.js', dest: 'webp_enc_simd.js', sourceDir: webpSourceDir },
    // MozJPEG encoder WASM files (for progressive JPEG encoding)
    { src: 'mozjpeg_enc.wasm', dest: 'mozjpeg_enc.wasm', sourceDir: jpegSourceDir },
    { src: 'mozjpeg_enc.js', dest: 'mozjpeg_enc.js', sourceDir: jpegSourceDir },
    // JPEG-XL encoder WASM files (experimental - limited browser support)
    { src: 'jxl_enc.wasm', dest: 'jxl_enc.wasm', sourceDir: jxlSourceDir, optional: true },
    { src: 'jxl_enc.js', dest: 'jxl_enc.js', sourceDir: jxlSourceDir, optional: true },
    // WASM feature detection for SIMD support check
    { src: 'index.js', dest: 'wasm-feature-detect.js', sourceDir: wasmFeatureDetectDir },
];

async function fileExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function prepareWasm() {
    console.log('Preparing WASM artifacts...');
    
    // Ensure target directory exists
    try {
        await mkdir(targetDir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    
    // Copy each required file
    for (const file of filesToCopy) {
        const srcPath = join(file.sourceDir, file.src);
        const destPath = join(targetDir, file.dest);

        // Check if source file exists
        if (!(await fileExists(srcPath))) {
            if (file.optional) {
                console.warn(`⚠️  Optional file ${file.src} not found, skipping...`);
                continue;
            }
            console.warn('⚠️  WASM files not found. Run "npm run wasm:build" first.');
            console.warn('   Skipping WASM preparation.');
            process.exit(0);
        }

        await copyFile(srcPath, destPath);
        console.log(`✓ Copied ${file.src} → ${file.dest}`);
    }
    
    console.log('WASM artifacts prepared successfully!');
}

prepareWasm().catch((err) => {
    console.error('Error preparing WASM:', err.message);
    process.exit(1);
});
