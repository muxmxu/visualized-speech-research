import type { FrameArray, FrameHeader } from '../api/frame';
import type { Viewport } from '../state/viewport';

export function drawWaveform(ctx: CanvasRenderingContext2D, frame: FrameArray, header: FrameHeader, view: Viewport, width: number, height: number, sr: number, offset: number): void {
  const samples = frame.data as Float32Array;
  const channels = frame.shape[0];
  const channelHeight = height / channels;
  const pooled = frame.shape.length === 3;
  const count = frame.shape[pooled ? 2 : 1];
  const start = pooled ? header.t0 as number : (header.first_sample as number) / sr + offset;
  const step = pooled ? ((header.t1 as number) - start) / count : 1 / sr;
  for (let c = 0; c < channels; c++) {
    const mid = (c + 0.5) * channelHeight;
    const scale = channelHeight * 0.45;
    if (pooled) {
      for (let i = 0; i < count; i++) {
        const x = (start + i * step - view.t0) / view.secondsPerPx;
        const w = Math.max(1, step / view.secondsPerPx);
        const base = c * 3 * count;
        ctx.fillStyle = '#3ddc97';
        ctx.fillRect(x, mid - samples[base + count + i] * scale, w, (samples[base + count + i] - samples[base + i]) * scale);
        ctx.fillStyle = '#9ff0cb';
        ctx.fillRect(x, mid - samples[base + 2 * count + i] * scale, w, 2 * samples[base + 2 * count + i] * scale);
      }
    } else {
      ctx.strokeStyle = '#3ddc97'; ctx.fillStyle = '#3ddc97'; ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = (start + i * step - view.t0) / view.secondsPerPx;
        const y = mid - samples[c * count + i] * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (step / view.secondsPerPx >= 6) for (let i = 0; i < count; i++) {
        const x = (start + i * step - view.t0) / view.secondsPerPx;
        ctx.beginPath(); ctx.arc(x, mid - samples[c * count + i] * scale, 2, 0, 2 * Math.PI); ctx.fill();
      }
    }
  }
}

export function waveformUpdates(draw: (view: Viewport) => void, request: (view: Viewport) => void) {
  let quiet: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let latest: Viewport;
  let lastRequest: number | undefined;
  function send() {
    clearTimeout(quiet);
    clearTimeout(deadline);
    deadline = undefined;
    lastRequest = Date.now();
    request(latest);
  }
  return {
    change(view: Viewport) {
      latest = view;
      draw(view);
      clearTimeout(quiet);
      quiet = setTimeout(send, 60);
      deadline ??= setTimeout(send, lastRequest === undefined ? 150 : Math.max(0, 150 - (Date.now() - lastRequest)));
    },
    dispose() { clearTimeout(quiet); clearTimeout(deadline); },
  };
}
