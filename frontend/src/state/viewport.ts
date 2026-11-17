export interface Viewport { t0: number; secondsPerPx: number }
export function zoom(view: Viewport, x: number, factor: number): Viewport {
  const secondsPerPx = Math.max(1e-8, view.secondsPerPx * factor);
  return { t0: view.t0 + x * (view.secondsPerPx - secondsPerPx), secondsPerPx };
}
export function pan(view: Viewport, pixels: number): Viewport { return { ...view, t0: view.t0 + pixels * view.secondsPerPx }; }
export function fit(start: number, end: number, width: number): Viewport { return { t0: start, secondsPerPx: Math.max(end - start, 0.001) / Math.max(width, 1) }; }
