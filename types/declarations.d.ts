declare module 'png-chunks-extract' {
    export interface Chunk {
        name: string;
        data: Uint8Array;
    }
    export default function extract(buffer: Uint8Array | ArrayBuffer): Chunk[];
}

declare module 'png-chunks-encode' {
    import { Chunk } from 'png-chunks-extract';
    export default function encode(chunks: Chunk[]): Uint8Array;
}

declare module 'png-chunk-text' {
    export interface TextChunk {
        keyword: string;
        text: string;
    }
    export function encode(keyword: string, text: string): { name: 'tEXt', data: Uint8Array };
    export function decode(data: Uint8Array): TextChunk;
}
