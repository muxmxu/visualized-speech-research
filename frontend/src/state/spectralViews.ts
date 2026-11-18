export interface Preset {
  name: string; sr: number; n_fft: number; win_length: number; hop: number;
  window: string; window_param?: number; yscale: 'linear' | 'log'; f_min_hz: number; f_max_hz: number; cmap: string;
}
export interface SpectralView {
  id: string; laneId: string; preset: string; n_fft: number; win_length: number; hop: number;
  window: string; window_param: number; yscale: 'linear' | 'log'; f_lo: number; f_hi: number;
  cmap: string; filter: 'LINEAR' | 'NEAREST'; colorbar: boolean; range: [number, number] | 'auto80';
  mode: 'W' | 'S' | 'W+S'; height: number; split: number;
}
export function viewFromPreset(laneId: string, preset: Preset): SpectralView {
  return { id: crypto.randomUUID(), laneId, preset: preset.name, n_fft: preset.n_fft,
    win_length: preset.win_length, hop: preset.hop, window: preset.window,
    window_param: preset.window_param ?? 0, yscale: preset.yscale,
    f_lo: preset.f_min_hz, f_hi: preset.f_max_hz, cmap: 'heat', filter: 'LINEAR',
    colorbar: true, range: 'auto80', mode: 'W+S', height: 160, split: 0.3 };
}

export function specLine(view: SpectralView, preset: Preset, sr: number, range: [number, number]): string {
  const window = view.window === 'kaiser' || view.window === 'gaussian' ? `${view.window}(${view.window_param})` : view.window;
  const fields: [string, number | string, number | string][] = [
    ['window', view.window, preset.window], ['win_length', view.win_length, preset.win_length],
    ['hop', view.hop, preset.hop], ['n_fft', view.n_fft, preset.n_fft],
    ['yscale', view.yscale, preset.yscale], ['f_min_hz', view.f_lo, preset.f_min_hz],
    ['f_max_hz', view.f_hi, preset.f_max_hz], ['cmap', view.cmap, preset.cmap],
  ];
  const overrides = fields.filter(([, value, original]) => value !== original).map(([key]) => key);
  if ((view.window === 'kaiser' || view.window === 'gaussian') && view.window_param !== (preset.window_param ?? (view.window === 'kaiser' ? 8.6 : 0.125))) overrides.push('window_param');
  if (view.range !== 'auto80') overrides.push('db');
  return `vsr-spec v1 | preset=${view.preset} | sr=${sr} | window=${window} | win=${view.win_length} | hop=${view.hop} | n_fft=${view.n_fft} | y=${view.yscale} ${view.f_lo}-${view.f_hi}Hz | db=[${range[0]},${range[1]}] dBFS | cmap=${view.cmap}${overrides.length ? ` | overrides=${overrides.join(',')}` : ''}`;
}
