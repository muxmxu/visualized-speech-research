import type { Playback } from './playback';
import type { SpectralFrame } from '../render/spectrogram';

type TestHook = { rms: () => number; playhead: () => number; playing: () => boolean; spectra: () => Record<string, SpectralFrame> };
declare global { interface Window { __vsr_test: TestHook } }
export function exposePlayback(playback: Playback) {
  window.__vsr_test = {
    ...window.__vsr_test,
    rms: () => { const data = new Float32Array(playback.analyser.fftSize); playback.analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length); },
    playhead: () => playback.position,
    playing: () => playback.playing,
  };
}
export function exposeSpectra(spectra: () => Record<string, SpectralFrame>) {
  window.__vsr_test = { ...window.__vsr_test, spectra };
}
