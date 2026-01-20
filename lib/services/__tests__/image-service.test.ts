import { describe, it, expect, vi } from 'vitest';
import { ImageService } from '../image-service';
import { canEncodeAvif, canDecodeAvif } from '../../core/format-capabilities';

// Mock Web Crypto
vi.stubGlobal('crypto', {
    subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    }
});

// Mock Canvas.toBlob (JSDOM may hang or not implement)
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    callback(new Blob([''], { type: 'image/avif' }));
});

// Mock Image loading (JSDOM handles it but expects resources)
// We rely on the src setter to trigger onload
const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(global.Image.prototype, 'src');
Object.defineProperty(global.Image.prototype, 'src', {
    set(src) {
        if (src === 'fail') {
            setTimeout(() => this.onerror?.(new Event('error')), 0);
        } else {
            setTimeout(() => this.onload?.(new Event('load')), 0);
        }
    }
});

describe('ImageService', () => {
    it('computes SHA-256 hash correctly (mocked)', async () => {
        const file = new File(['test'], 'test.png', { type: 'image/png' });
        // Mock arrayBuffer for JSDOM
        Object.defineProperty(file, 'arrayBuffer', {
            value: async () => new ArrayBuffer(32)
        });

        const hash = await ImageService.computeHash(file);
        // We expect 64 chars hex string for sha-256
        expect(hash).toHaveLength(64);
    });
});

describe('FormatCapabilities', () => {
    it('checks AVIF encode support safely', async () => {
        // jsdom canvas toBlob mocking if needed, 
        // but by default jsdom canvas might not support toBlob with specific formats.
        // Expect false or handle gracefully.
        const supported = await canEncodeAvif();
        expect(typeof supported).toBe('boolean');
    });

    it('checks AVIF decode support safely', async () => {
        const supported = await canDecodeAvif();
        expect(typeof supported).toBe('boolean');
    });
});
