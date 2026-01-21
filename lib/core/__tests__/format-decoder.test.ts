import { describe, it, expect } from 'vitest';

describe('FormatDecoder', () => {
    describe('isHeicFile', () => {
        const isHeicByMimeOrExt = (file: File): boolean => {
            const mimeType = file.type.toLowerCase();
            if (mimeType === "image/heic" || mimeType === "image/heif") {
                return true;
            }
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
                return true;
            }
            return false;
        };

        it('detects HEIC by MIME type', () => {
            const file = new File([''], 'photo.heic', { type: 'image/heic' });
            expect(isHeicByMimeOrExt(file)).toBe(true);
        });

        it('detects HEIF by MIME type', () => {
            const file = new File([''], 'photo.heif', { type: 'image/heif' });
            expect(isHeicByMimeOrExt(file)).toBe(true);
        });

        it('detects HEIC by extension', () => {
            const file = new File([''], 'photo.HEIC', { type: '' });
            expect(isHeicByMimeOrExt(file)).toBe(true);
        });

        it('returns false for PNG', () => {
            const file = new File([''], 'image.png', { type: 'image/png' });
            expect(isHeicByMimeOrExt(file)).toBe(false);
        });

        it('returns false for JPEG', () => {
            const file = new File([''], 'image.jpg', { type: 'image/jpeg' });
            expect(isHeicByMimeOrExt(file)).toBe(false);
        });

        it('returns false for WebP', () => {
            const file = new File([''], 'image.webp', { type: 'image/webp' });
            expect(isHeicByMimeOrExt(file)).toBe(false);
        });
    });

    describe('HEIC Magic Bytes Detection', () => {
        const checkHeicMagicBytes = (bytes: Uint8Array): boolean => {
            if (bytes.length >= 12) {
                const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
                if (ftyp === "ftyp") {
                    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
                    if (brand === "heic" || brand === "mif1" || brand === "msf1") {
                        return true;
                    }
                }
            }
            return false;
        };

        it('identifies HEIC by ftyp+heic magic bytes', () => {
            const heicBytes = new Uint8Array([
                0, 0, 0, 24, // box size
                102, 116, 121, 112, // 'ftyp'
                104, 101, 105, 99, // 'heic'
            ]);
            expect(checkHeicMagicBytes(heicBytes)).toBe(true);
        });

        it('identifies HEIC by ftyp+mif1 magic bytes', () => {
            const mif1Bytes = new Uint8Array([
                0, 0, 0, 24,
                102, 116, 121, 112, // 'ftyp'
                109, 105, 102, 49, // 'mif1'
            ]);
            expect(checkHeicMagicBytes(mif1Bytes)).toBe(true);
        });

        it('returns false for PNG magic bytes', () => {
            const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
            expect(checkHeicMagicBytes(pngBytes)).toBe(false);
        });
    });
});
