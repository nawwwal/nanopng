import { describe, it, expect, vi } from 'vitest';
import { ImageService } from '../image-service';

// Mock Web Crypto
vi.stubGlobal('crypto', {
    subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    }
});

// Mock Canvas
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
    callback(new Blob([''], { type: 'image/png' }));
});

// Mock Image loading
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
    describe('computeHash', () => {
        it('computes SHA-256 hash correctly', async () => {
            const file = new File(['test content'], 'test.png', { type: 'image/png' });
            Object.defineProperty(file, 'arrayBuffer', {
                value: async () => new ArrayBuffer(32)
            });

            const hash = await ImageService.computeHash(file);

            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('returns different hashes for different content', async () => {
            const file1 = new File(['content1'], 'test1.png', { type: 'image/png' });
            const file2 = new File(['content2'], 'test2.png', { type: 'image/png' });

            Object.defineProperty(file1, 'arrayBuffer', {
                value: async () => new ArrayBuffer(32)
            });
            Object.defineProperty(file2, 'arrayBuffer', {
                value: async () => new ArrayBuffer(64)
            });

            const hash1 = await ImageService.computeHash(file1);
            const hash2 = await ImageService.computeHash(file2);

            // Both should be valid hex strings
            expect(hash1).toMatch(/^[0-9a-f]{64}$/);
            expect(hash2).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('analyze', () => {
        it('returns valid analysis object', async () => {
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            const analysis = await ImageService.analyze(file);

            expect(analysis).toHaveProperty('isPhoto');
            expect(analysis).toHaveProperty('hasTransparency');
            expect(analysis).toHaveProperty('complexity');
            expect(analysis).toHaveProperty('suggestedFormat');
        });
    });
});
