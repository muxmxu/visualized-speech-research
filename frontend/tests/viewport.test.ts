import { describe, expect, it } from 'vitest';
import { fit as fitViewport, pan, zoom } from '../src/state/viewport';

describe('shared viewport', () => {
  it('zooms around the pointer and pans by pixels', () => {
    const original = { t0: 2, secondsPerPx: 0.01 };
    const result = zoom(original, 100, 0.5);
    expect(result.t0 + 100 * result.secondsPerPx).toBeCloseTo(3);
    expect(pan(result, 20).t0).toBeCloseTo(2.6);
  });
  it('fits an interval to the available width', () => {
    const result = fitViewport(2, 6, 400);
    expect(result).toEqual({ t0: 2, secondsPerPx: 0.01 });
  });
});
