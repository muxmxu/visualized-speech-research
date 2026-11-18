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

describe('plot coordinates', () => {
  it('maps time to the visible plot and full-lane overview', async () => {
    const { timeToX, xToTime, overviewInterval } = await import('../src/state/viewport');
    const view = { t0: 1, secondsPerPx: 0.01 };
    expect(timeToX(1, view)).toBe(0);
    expect(timeToX(3, view)).toBe(200);
    expect(xToTime(200, view)).toBe(3);
    expect(overviewInterval(view, 200, 5, 200)).toEqual([40, 120]);
  });
  it('maps frequencies in both directions on linear and logarithmic axes', async () => {
    const { frequencyToY, yToFrequency } = await import('../src/state/viewport');
    for (const scale of ['linear', 'log'] as const) {
      for (const hz of [100, 200, 400]) {
        expect(yToFrequency(frequencyToY(hz, 100, 400, scale, 100), 100, 400, scale, 100)).toBeCloseTo(hz);
      }
    }
    expect(frequencyToY(100, 100, 400, 'log', 100)).toBeCloseTo(100);
    expect(frequencyToY(200, 100, 400, 'log', 100)).toBeCloseTo(50);
    expect(frequencyToY(400, 100, 400, 'log', 100)).toBeCloseTo(0);
  });
});

it('formats project time with millisecond precision', async () => {
  const { formatTime } = await import('../src/state/viewport');
  expect(formatTime(0)).toBe('0:00:00.000');
  expect(formatTime(3723.456)).toBe('1:02:03.456');
  expect(formatTime(-0.125)).toBe('-0:00:00.125');
});
