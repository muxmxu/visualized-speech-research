export interface Viewport { t0: number; secondsPerPx: number }
export function zoom(view: Viewport, x: number, factor: number): Viewport {
  const secondsPerPx = Math.max(1e-8, view.secondsPerPx * factor);
  return { t0: view.t0 + x * (view.secondsPerPx - secondsPerPx), secondsPerPx };
}
export function pan(view: Viewport, pixels: number): Viewport { return { ...view, t0: view.t0 + pixels * view.secondsPerPx }; }
export function fit(start: number, end: number, width: number): Viewport { return { t0: start, secondsPerPx: Math.max(end - start, 0.001) / Math.max(width, 1) }; }

export function timeToX(time: number, view: Viewport): number { return (time - view.t0) / view.secondsPerPx; }
export function xToTime(x: number, view: Viewport): number { return view.t0 + x * view.secondsPerPx; }
export function overviewInterval(view: Viewport, plotWidth: number, end: number, overviewWidth: number): [number, number] {
  return [view.t0 / end * overviewWidth, (view.t0 + plotWidth * view.secondsPerPx) / end * overviewWidth];
}
export function frequencyToY(frequency: number, lo: number, hi: number, scale: 'linear' | 'log', height: number): number {
  const fraction = scale === 'log' ? Math.log(frequency / lo) / Math.log(hi / lo) : (frequency - lo) / (hi - lo);
  return (1 - fraction) * height;
}
export function yToFrequency(y: number, lo: number, hi: number, scale: 'linear' | 'log', height: number): number {
  const fraction = 1 - y / height;
  return scale === 'log' ? lo * (hi / lo) ** fraction : lo + fraction * (hi - lo);
}

export function formatTime(seconds: number): string {
  const millis = Math.round(Math.abs(seconds) * 1000);
  const hours = Math.floor(millis / 3600000);
  const minutes = Math.floor(millis / 60000) % 60;
  const secs = Math.floor(millis / 1000) % 60;
  return `${seconds < 0 ? '-' : ''}${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis % 1000).padStart(3, '0')}`;
}
