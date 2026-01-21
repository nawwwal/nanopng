import { describe, it, expect, vi } from 'vitest';
import type { CompressionOptions, ImageFormat } from '../compression';

describe('CompressionTypes', () => {
    describe('ImageFormat type', () => {
        it('accepts valid formats', () => {
            const validFormats: ImageFormat[] = ['jpeg', 'png', 'webp', 'avif'];
            validFormats.forEach(format => {
                expect(typeof format).toBe('string');
            });
        });
    });

    describe('CompressionOptions interface', () => {
        it('accepts valid compression options', () => {
            const options: CompressionOptions = {
                format: 'jpeg',
                quality: 85,
            };
            expect(options.format).toBe('jpeg');
            expect(options.quality).toBe(85);
        });

        it('accepts advanced options', () => {
            const options: CompressionOptions = {
                format: 'png',
                quality: 100,
                dithering: 0.8,
                lossless: true,
            };
            expect(options.dithering).toBe(0.8);
            expect(options.lossless).toBe(true);
        });

        it('accepts JPEG-specific options', () => {
            const options: CompressionOptions = {
                format: 'jpeg',
                quality: 75,
                chromaSubsampling: false, // 4:4:4 mode
            };
            expect(options.chromaSubsampling).toBe(false);
        });

        it('accepts resize options', () => {
            const options: CompressionOptions = {
                format: 'auto',
                quality: 80,
                targetWidth: 1920,
                targetHeight: 1080,
            };
            expect(options.targetWidth).toBe(1920);
            expect(options.targetHeight).toBe(1080);
        });
    });
});
