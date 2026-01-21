import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canEncodeAvif, canDecodeAvif } from '../format-capabilities';

// Mock Canvas.toBlob
HTMLCanvasElement.prototype.toBlob = vi.fn((callback, type) => {
    if (type === 'image/avif') {
        callback(new Blob([''], { type: 'image/avif' }));
    } else {
        callback(new Blob([''], { type: type || 'image/png' }));
    }
});

// Mock Image loading
Object.defineProperty(global.Image.prototype, 'src', {
    set(src) {
        setTimeout(() => this.onload?.(new Event('load')), 0);
    }
});

describe('FormatCapabilities', () => {
    describe('canEncodeAvif', () => {
        it('returns a boolean', async () => {
            const result = await canEncodeAvif();
            expect(typeof result).toBe('boolean');
        });

        it('caches the result', async () => {
            const result1 = await canEncodeAvif();
            const result2 = await canEncodeAvif();
            expect(result1).toBe(result2);
        });
    });

    describe('canDecodeAvif', () => {
        it('returns a boolean', async () => {
            const result = await canDecodeAvif();
            expect(typeof result).toBe('boolean');
        });

        it('caches the result', async () => {
            const result1 = await canDecodeAvif();
            const result2 = await canDecodeAvif();
            expect(result1).toBe(result2);
        });
    });
});
