import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/api/client', () => ({ body: () => ({}), request: () => Promise.resolve() }));
import { alignedCurves, sampleIndex, type Curve } from '../src/panels/FrequencyAnalysis';

describe('frequency plot alignment', () => {
  const curves: Curve[] = [
    { id: 'a:mean', label: 'A', frequencies: [0, 100, 200], values: [-10, -20, -30] },
    { id: 'b:mean', label: 'B', frequencies: [0, 200, 400], values: [-40, -50, -60] },
  ];
  it('retains independent lane frequency coordinates and values', () => {
    const data = alignedCurves(curves, false);
    expect(Array.from(data[0])).toEqual([0, 100, 200, 400]);
    expect(Array.from(data[1])).toEqual([-10, -20, -30, undefined]);
    expect(Array.from(data[2])).toEqual([-40, undefined, -50, -60]);
  });
  it('omits zero frequency on the logarithmic axis', () => {
    expect(Array.from(alignedCurves(curves, true)[0])).toEqual([100, 200, 400]);
  });
});

describe('lane-relative sample rounding', () => {
  it('rounds ties to even for positive and negative lane-relative times', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5].map(x => sampleIndex(x / 8, 0, 8))).toEqual([0, 2, 2, 0, -2]);
    expect(sampleIndex(1.000055, 1, 8000)).toBe(0);
    expect(sampleIndex(1.031956, 1, 8000)).toBe(256);
  });
});
