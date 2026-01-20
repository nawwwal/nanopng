import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHeicFile, ensureDecodable } from '../format-decoder';

describe('FormatDecoder', () => {
    describe('isHeicFile', () => {
        it('detects HEIC by MIME type', async () => {
            const file = new File([''], 'photo.heic', { type: 'image/heic' });
            expect(await isHeicFile(file)).toBe(true);
        });

        it('detects HEIF by MIME type', async () => {
            const file = new File([''], 'photo.heif', { type: 'image/heif' });
            expect(await isHeicFile(file)).toBe(true);
        });

        it('detects HEIC by extension', async () => {
            const file = new File([''], 'photo.HEIC', { type: '' });
            expect(await isHeicFile(file)).toBe(true);
        });

        it('returns false for PNG', async () => {
            const file = new File([''], 'image.png', { type: 'image/png' });
            expect(await isHeicFile(file)).toBe(false);
        });

        it('returns false for JPEG', async () => {
            const file = new File([''], 'image.jpg', { type: 'image/jpeg' });
            expect(await isHeicFile(file)).toBe(false);
        });

        it('checks magic bytes for HEIC identification', async () => {
            // Create fake HEIC magic bytes: ftyp + heic brand
            const ftypBox = new Uint8Array([
                0, 0, 0, 24, // box size
                102, 116, 121, 112, // 'ftyp'
                104, 101, 105, 99, // 'heic' brand
            ]);
            const file = new File([ftypBox], 'unknown.bin', { type: '' });
            expect(await isHeicFile(file)).toBe(true);
        });
    });

    describe('ensureDecodable', () => {
        it('returns non-HEIC files unchanged', async () => {
            const file = new File(['PNG content'], 'test.png', { type: 'image/png' });
            const result = await ensureDecodable(file);
            expect(result).toBe(file);
        });

        it('returns JPEG files unchanged', async () => {
            const file = new File(['JPEG content'], 'test.jpg', { type: 'image/jpeg' });
            const result = await ensureDecodable(file);
            expect(result).toBe(file);
        });

        it('returns WebP files unchanged', async () => {
            const file = new File(['WebP content'], 'test.webp', { type: 'image/webp' });
            const result = await ensureDecodable(file);
            expect(result).toBe(file);
        });
    });
});
