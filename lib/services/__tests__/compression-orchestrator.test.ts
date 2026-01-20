import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompressionOrchestrator } from '../compression-orchestrator';

// Mock ImageService
vi.mock('../image-service', () => ({
    ImageService: {
        compress: vi.fn().mockResolvedValue({
            id: 'test-id',
            compressedBlob: new Blob(['test'], { type: 'image/png' }),
            format: 'png',
            analysis: { isPhoto: false, hasTransparency: false, complexity: 0.5, suggestedFormat: 'png' },
            originalWidth: 100,
            originalHeight: 100,
            width: 100,
            height: 100,
        })
    }
}));

describe('CompressionOrchestrator', () => {
    let orchestrator: CompressionOrchestrator;

    beforeEach(() => {
        orchestrator = CompressionOrchestrator.getInstance();
    });

    describe('getInstance', () => {
        it('returns singleton instance', () => {
            const instance1 = CompressionOrchestrator.getInstance();
            const instance2 = CompressionOrchestrator.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('compress', () => {
        it('compresses an image', async () => {
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            const result = await orchestrator.compress({
                id: 'test-id',
                file,
                options: { format: 'png', quality: 80 }
            });

            expect(result).toBeDefined();
            expect(result.format).toBe('png');
        });

        it('handles format auto-detection', async () => {
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            const result = await orchestrator.compress({
                id: 'test-id',
                file,
                options: { format: 'auto', quality: 80 }
            });

            expect(result).toBeDefined();
        });

        it('passes resize options correctly', async () => {
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            const result = await orchestrator.compress({
                id: 'test-id',
                file,
                options: {
                    format: 'jpeg',
                    quality: 75,
                    targetWidth: 800,
                    targetHeight: 600
                }
            });

            expect(result.resizeApplied).toBe(true);
        });

        it('passes advanced options', async () => {
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            const result = await orchestrator.compress({
                id: 'test-id',
                file,
                options: {
                    format: 'png',
                    quality: 100,
                    dithering: 0.5,
                    lossless: false
                }
            });

            expect(result).toBeDefined();
        });
    });
});
