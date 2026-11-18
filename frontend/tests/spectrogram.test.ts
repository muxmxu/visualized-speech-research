import { describe, expect, it } from 'vitest';
import { autoRange, halfToNumber, spectralRequestBounds } from '../src/render/spectrogram';

describe('spectrogram data', () => {
  it('decodes half-precision values including subnormals', () => {
    expect(halfToNumber(0x0001)).toBe(2 ** -24);
    expect(halfToNumber(0x3c00)).toBe(1);
    expect(halfToNumber(0xc000)).toBe(-2);
  });
  it('buffers requests in CSS pixels', () => {
    expect(spectralRequestBounds({ t0: 1, secondsPerPx: 0.01 }, 200, 80))
      .toEqual({ t0: 0.5, t1: 3.5, width: 300, height: 80 });
  });
  it('derives auto80 from the lane maximum', () => {
    expect(autoRange(-12.25)).toEqual([-90, -10]);
  });
});

describe('heat palette', () => {
  it('uses the specified endpoints', async () => {
    const { heatLut } = await import('../src/render/colormap');
    const lut = heatLut();
    expect([...lut.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...lut.slice(-4)]).toEqual([255, 251, 230, 255]);
  });
});

describe('viewport scheduling', () => {
  it('redraws each change, debounces requests and disposes timers', async () => {
    const { vi } = await import('vitest');
    const { waveformUpdates } = await import('../src/render/waveform');
    vi.useFakeTimers();
    const draw = vi.fn(); const request = vi.fn();
    const updates = waveformUpdates(draw, request);
    const view = { t0: 1, secondsPerPx: 0.01 };
    updates.change(view);
    vi.advanceTimersByTime(30); updates.change({ ...view, t0: 2 });
    vi.advanceTimersByTime(25); updates.change({ ...view, t0: 3 });
    expect(draw).toHaveBeenCalledTimes(3);
    expect(request).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenLastCalledWith({ ...view, t0: 3 });
    updates.change(view);
    updates.dispose();
    vi.advanceTimersByTime(200);
    expect(request).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('requests at least every 150 ms during sustained changes', async () => {
    const { vi } = await import('vitest');
    const { waveformUpdates } = await import('../src/render/waveform');
    vi.useFakeTimers();
    const request = vi.fn();
    const updates = waveformUpdates(() => undefined, request);
    for (let t = 0; t < 300; t += 30) {
      updates.change({ t0: t, secondsPerPx: 0.01 });
      vi.advanceTimersByTime(30);
    }
    expect(request).toHaveBeenCalledTimes(2);
    updates.dispose();
    vi.useRealTimers();
  });
});

describe('returned grid placement', () => {
  it('uses returned column centers and irregular row frequencies', async () => {
    const { columnTime, nearestRow } = await import('../src/render/spectrogram');
    expect(columnTime(128, 0, 0.008)).toBeCloseTo(1.024);
    expect(nearestRow(240, [100, 200, 280, 400])).toBe(2);
    expect(nearestRow(210, [100, 200, 280, 400])).toBe(1);
  });
});

describe('spec line', () => {
  it('uses the prescribed key order and identifies changed preset parameters', async () => {
    const { specLine } = await import('../src/state/spectralViews');
    const preset = { name: 'analysis', sr: 16000, n_fft: 512, win_length: 512, hop: 128, window: 'hann', yscale: 'linear' as const, f_min_hz: 0, f_max_hz: 8000, cmap: 'magma' };
    const view = { id: 'v', laneId: 'l', kind: 'audio' as const, transform: 'stft' as const, mel: {n_mels: 80, fmin: 0, fmax: 8000, htk: false}, preset: 'analysis', n_fft: 1024, win_length: 512, hop: 128, window: 'hann', window_param: 0, yscale: 'linear' as const, f_lo: 0, f_hi: 8000, cmap: 'heat', filter: 'LINEAR' as const, colorbar: true, range: 'auto80' as const, mode: 'W+S' as const, height: 160, split: 0.3 };
    expect(specLine(view, preset, 16000, [-90, -10])).toBe('vsr-spec v1 | preset=analysis | sr=16000 | window=hann | win=512 | hop=128 | n_fft=1024 | y=linear 0-8000Hz | db=[-90,-10] dBFS | cmap=heat | overrides=n_fft,cmap');
  });
});
