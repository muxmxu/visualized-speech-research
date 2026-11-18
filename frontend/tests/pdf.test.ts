import { describe, expect, it } from 'vitest';
import { physicalCrop } from '../src/state/pdfSelection';
import { rasterPdf } from '../src/render/pdf';

describe('visible area PDF', () => {
  it('intersects before inward device pixel rounding in either direction', () => {
    const clips = [{ left: 20.2, top: 10.2, right: 120.75, bottom: 80.75 }, { left: 25.1, top: 24.1, right: 112.4, bottom: 74.4 }];
    const a = { x: 34.2, y: 28.2 }; const b = { x: 130.2, y: 69.2 };
    expect(physicalCrop(a, b, clips, 1.5)).toEqual({ left: 52, top: 43, right: 168, bottom: 103 });
    expect(physicalCrop(b, a, clips, 1.5)).toEqual({ left: 52, top: 43, right: 168, bottom: 103 });
    expect(physicalCrop({ x: 1, y: 1 }, { x: 1.1, y: 1.1 }, clips, 1.5)).toBeNull();
    expect(physicalCrop({ x: 0, y: 0 }, { x: 66.66666412353516, y: 20 }, [], 1.5)?.right).toBe(99);
  });
  it('writes a one-page PDF with byte-accurate image stream and cross references', async () => {
    const bytes = new Uint8Array(await rasterPdf(new Uint8Array([0xff, 0xd8, 0, 0xff, 0xd9]), 116, 60).arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('/MediaBox [0 0 116 60]'); expect(text).toContain('/Width 116 /Height 60');
    expect(text).toContain('/Filter /DCTDecode /Length 5');
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = text.slice(xref).split('\n').slice(3, 8);
    entries.forEach((entry, index) => expect(text.slice(Number(entry.slice(0, 10))).startsWith(`${index + 1} 0 obj`)).toBe(true));
  });
});
