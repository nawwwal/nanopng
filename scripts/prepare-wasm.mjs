import { mkdir, copyFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sourceDir = join(projectRoot, 'lib/wasm/nanopng-core/pkg');
const targetDir = join(projectRoot, 'public/wasm');

const filesToCopy = [
    { src: 'nanopng_core.js', dest: 'nanopng_core.js' },
    { src: 'nanopng_core_bg.wasm', dest: 'nanopng_core_bg.wasm' },
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
    for (const { src, dest } of filesToCopy) {
        const srcPath = join(sourceDir, src);
        const destPath = join(targetDir, dest);
        
        // Check if source file exists
        if (!(await fileExists(srcPath))) {
            throw new Error(
                `Missing WASM artifact: ${srcPath}\n` +
                `Please rebuild the Rust crate with: cd crate && wasm-pack build --target web --out-dir ../lib/wasm/nanopng-core/pkg`
            );
        }
        
        await copyFile(srcPath, destPath);
        console.log(`✓ Copied ${src} → ${dest}`);
    }
    
    console.log('WASM artifacts prepared successfully!');
}

prepareWasm().catch((err) => {
    console.error('Error preparing WASM:', err.message);
    process.exit(1);
});
