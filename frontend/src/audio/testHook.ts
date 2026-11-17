import type { Playback } from './playback';

declare global { interface Window { __vsr_test: { rms: () => number; playhead: () => number; playing: () => boolean } } }
export function exposePlayback(playback: Playback) {
  window.__vsr_test = {
    rms: () => { const data = new Float32Array(playback.analyser.fftSize); playback.analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length); },
    playhead: () => playback.position,
    playing: () => playback.playing,
  };
}
