import { frequencyToY, yToFrequency, type Viewport } from './viewport';
import type { SpectralView } from './spectralViews';

export interface TfSelection { laneId: string; viewId: string; channel: number; t0: number; t1: number; f_lo: number; f_hi: number }
export type TfHandle = 'new' | 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export function tfPoint(x: number, y: number, width: number, height: number, viewport: Viewport, config: SpectralView): [number, number] {
  const px = Math.max(0, Math.min(width, x)); const py = Math.max(0, Math.min(height, y));
  return [viewport.t0 + px * viewport.secondsPerPx, yToFrequency(py, config.f_lo, config.f_hi, config.yscale, height)];
}
export function tfRect(selection: TfSelection, viewport: Viewport, config: SpectralView, height: number) {
  return { left: (selection.t0 - viewport.t0) / viewport.secondsPerPx, right: (selection.t1 - viewport.t0) / viewport.secondsPerPx,
    top: frequencyToY(Math.max(config.f_lo, Math.min(config.f_hi, selection.f_hi)), config.f_lo, config.f_hi, config.yscale, height), bottom: frequencyToY(Math.max(config.f_lo, Math.min(config.f_hi, selection.f_lo)), config.f_lo, config.f_hi, config.yscale, height) };
}
export function tfDrag(initial: TfSelection, handle: TfHandle, origin: [number, number], point: [number, number], lo: number, hi: number, scale: 'linear' | 'log'): TfSelection {
  const [t, f] = point; const [start, frequency] = origin;
  if (handle === 'new') return { ...initial, t0: Math.min(start, t), t1: Math.max(start, t), f_lo: Math.min(frequency, f), f_hi: Math.max(frequency, f) };
  if (handle === 'move') {
    const dt = t - start;
    if (scale === 'log') { const ratio = Math.max(initial.f_lo > 0 ? lo / initial.f_lo : 0, Math.min(hi / initial.f_hi, f / frequency)); return { ...initial, t0: initial.t0 + dt, t1: initial.t1 + dt, f_lo: initial.f_lo * ratio, f_hi: initial.f_hi * ratio }; }
    const df = Math.max(lo - initial.f_lo, Math.min(hi - initial.f_hi, f - frequency));
    return { ...initial, t0: initial.t0 + dt, t1: initial.t1 + dt, f_lo: initial.f_lo + df, f_hi: initial.f_hi + df };
  }
  const a = handle.includes('w') ? t : initial.t0; const b = handle.includes('e') ? t : initial.t1;
  const c = handle.includes('s') ? f : initial.f_lo; const d = handle.includes('n') ? f : initial.f_hi;
  return { ...initial, t0: Math.min(a, b), t1: Math.max(a, b), f_lo: Math.min(c, d), f_hi: Math.max(c, d) };
}
