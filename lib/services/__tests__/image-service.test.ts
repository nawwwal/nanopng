import { describe, it, expect, vi } from 'vitest';
import { ImageService } from '../image-service';
import { canEncodeAvif, canDecodeAvif } from '../../core/format-capabilities';

// Mock Web Crypto API for hash test
Object.defineProperty(global, 'crypto', {
    value: {
        subtle: {
            digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) // Mock empty hash
        }
    }
});

describe('ImageService', () => {
    it('computes SHA-256 hash correctly (mocked)', async () => {
        const file = new File(['test'], 'test.png', { type: 'image/png' });
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
