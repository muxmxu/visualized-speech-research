import { describe, expect, it } from 'vitest';
import { tfDrag, tfPoint, tfRect, type TfSelection } from '../src/state/tfSelection';
import { viewFromPreset } from '../src/state/spectralViews';

const config = viewFromPreset('lane', { name: 'analysis', sr: 8000, n_fft: 256, win_length: 256, hop: 64, window: 'hann', yscale: 'linear', f_min_hz: 0, f_max_hz: 4000, cmap: 'heat' });
const viewport = { t0: 1, secondsPerPx: 0.01 };
const selection: TfSelection = { laneId: 'lane', viewId: config.id, channel: 0, t0: 1.2, t1: 1.6, f_lo: 1000, f_hi: 3000 };
describe('time frequency selection geometry', () => {
  it('maps the rectangle to time and frequency coordinates', () => {
    expect(tfPoint(20, 25, 100, 100, viewport, config)).toEqual([1.2, 3000]);
    const rectangle = tfRect(selection, viewport, config, 100);
    expect(rectangle.left).toBeCloseTo(20); expect(rectangle.right).toBeCloseTo(60);
    expect(rectangle.top).toBe(25); expect(rectangle.bottom).toBe(75);
  });
  it('moves and resizes without changing identity', () => {
    expect(tfDrag(selection, 'move', [1.2, 1000], [1.4, 2000], 0, 4000, 'linear')).toMatchObject({ laneId: 'lane', t0: 1.4, t1: 1.8, f_lo: 2000, f_hi: 4000 });
    expect(tfDrag(selection, 'ne', [1.6, 3000], [1.8, 3500], 0, 4000, 'linear')).toMatchObject({ t0: 1.2, t1: 1.8, f_lo: 1000, f_hi: 3500 });
  });
  it('moves a log-frequency selection by the same visual ratio', () => {
    const moved = tfDrag(selection, 'move', [1.2, 1000], [1.2, 1200], 100, 4000, 'log');
    expect(moved.f_lo).toBeCloseTo(1200); expect(moved.f_hi).toBeCloseTo(3600);
    const spanningZero = tfDrag({ ...selection, f_lo: 0 }, 'move', [1.2, 1000], [1.2, 1200], 100, 4000, 'log');
    expect(spanningZero.f_lo).toBe(0); expect(spanningZero.f_hi).toBeCloseTo(3600);
  });
});
