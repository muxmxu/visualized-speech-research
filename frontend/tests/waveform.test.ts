import { describe, expect, it, vi } from 'vitest';
import type { Viewport } from '../src/state/viewport';
import { drawWaveform, waveformUpdates } from '../src/render/waveform';

describe('waveform display', () => {
  it('draws sample points only when samples are at least six pixels apart', () => {
    const arc = vi.fn();
    const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc, fill: vi.fn() } as unknown as CanvasRenderingContext2D;
    const frame = { dtype: 'f32' as const, shape: [1, 2], data: new Float32Array([0, 1]) };
    drawWaveform(ctx, frame, { first_sample: 0 }, { t0: 0, secondsPerPx: 1 / 60 }, 100, 100, 10, 0);
    expect(arc).toHaveBeenCalledTimes(2);
    arc.mockClear();
    drawWaveform(ctx, frame, { first_sample: 0 }, { t0: 0, secondsPerPx: 1 / 50 }, 100, 100, 10, 0);
    expect(arc).not.toHaveBeenCalled();
  });
});

it('redraws cached data immediately and requests after a quiet 60 ms', async () => {
  vi.useFakeTimers();
  const { waveformUpdates } = await import('../src/render/waveform');
  const draw = vi.fn();
  const request = vi.fn<(view: Viewport) => void>();
  const updates = waveformUpdates(draw, request);
  updates.change({ t0: 1, secondsPerPx: 0.1 });
  expect(draw).toHaveBeenLastCalledWith({ t0: 1, secondsPerPx: 0.1 });
  vi.advanceTimersByTime(59);
  expect(request).not.toHaveBeenCalled();
  updates.change({ t0: 2, secondsPerPx: 0.1 });
  expect(draw).toHaveBeenLastCalledWith({ t0: 2, secondsPerPx: 0.1 });
  vi.advanceTimersByTime(60);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenLastCalledWith({ t0: 2, secondsPerPx: 0.1 });
  updates.dispose();
  vi.useRealTimers();
});

it('issues requests at least every 150 ms during continuous changes', async () => {
  vi.useFakeTimers();
  const { waveformUpdates } = await import('../src/render/waveform');
  const request = vi.fn<(view: Viewport) => void>();
  const updates = waveformUpdates(vi.fn(), request);
  for (let time = 0; time <= 300; time += 30) {
    updates.change({ t0: time, secondsPerPx: 1 });
    vi.advanceTimersByTime(30);
  }
  expect(request.mock.calls.map(call => call[0].t0)).toEqual([120, 270]);
  vi.advanceTimersByTime(60);
  expect(request.mock.calls.map(call => call[0].t0)).toEqual([120, 270, 300]);
  updates.dispose();
  vi.useRealTimers();
});

it('maps the same cached waveform to the changed viewport', () => {
  const fillRect = vi.fn();
  const ctx = { fillRect } as unknown as CanvasRenderingContext2D;
  const frame = { dtype: 'f32' as const, shape: [1, 3, 1], data: new Float32Array([-1, 1, 0.5]) };
  drawWaveform(ctx, frame, { t0: 1, t1: 2 }, { t0: 0, secondsPerPx: 0.1 }, 100, 100, 10, 0);
  expect(fillRect.mock.calls[0][0]).toBe(10);
  fillRect.mockClear();
  drawWaveform(ctx, frame, { t0: 1, t1: 2 }, { t0: 0.5, secondsPerPx: 0.05 }, 100, 100, 10, 0);
  expect(fillRect.mock.calls[0][0]).toBe(10);
  expect(fillRect.mock.calls[0][2]).toBe(20);
});

 it('measures the continuous-interaction deadline from the last request', () => {
  vi.useFakeTimers();
  const times: number[] = [];
  const updates = waveformUpdates(vi.fn(), () => { times.push(Date.now()); });
  for (let i = 0; i < 12; i++) {
    updates.change({ t0: i, secondsPerPx: 1 });
    vi.advanceTimersByTime(40);
  }
  expect(times.length).toBeGreaterThanOrEqual(3);
  expect(times[1] - times[0]).toBeLessThanOrEqual(150);
  expect(times[2] - times[1]).toBeLessThanOrEqual(150);
  updates.dispose();
  vi.useRealTimers();
});
