import type { AnnotationLane, FeatureLane, FrequencyAxis, MelSettings, SessionLane } from '../api/types';

export interface Preset {
  name: string; sr: number; n_fft: number; win_length: number; hop: number;
  window: string; window_param?: number; yscale: 'linear' | 'log'; f_min_hz: number; f_max_hz: number; cmap: string;
}
export interface ViewStyle {
  id: string; laneId: string; f_lo: number; f_hi: number;
  cmap: string; filter: 'LINEAR' | 'NEAREST'; colorbar: boolean; range: [number, number] | 'auto80';
  height: number;
}
export interface SpectralView extends ViewStyle {
  kind: 'audio'; preset: string; n_fft: number; win_length: number; hop: number;
  window: string; window_param: number; yscale: 'linear' | 'log';
  mode: 'W' | 'S' | 'W+S'; split: number; transform: 'stft' | 'mel'; mel: MelSettings;
}
export interface FeatureView extends ViewStyle { kind: 'feature' }
export type ViewConfig = SpectralView | FeatureView;
interface AnnotationView { id: string; laneId: string; kind: 'curve' | 'events'; height: number }
export type LaneView = ViewConfig | AnnotationView;
export function isSpectralView(view: LaneView): view is ViewConfig {
  return view.kind === 'audio' || view.kind === 'feature';
}
export function viewForAnnotation(lane: AnnotationLane): AnnotationView {
  return { id: crypto.randomUUID(), laneId: lane.id, kind: lane.kind, height: 120 };
}
export type ViewPatch = Partial<Omit<SpectralView, 'kind'>>;

function viewStyle(laneId: string, f_lo: number, f_hi: number): ViewStyle {
  return { id: crypto.randomUUID(), laneId, f_lo, f_hi, cmap: 'heat', filter: 'LINEAR',
    colorbar: true, range: 'auto80', height: 160 };
}
export function viewFromPreset(laneId: string, preset: Preset): SpectralView {
  return { ...viewStyle(laneId, preset.f_min_hz, preset.f_max_hz), kind: 'audio', preset: preset.name,
    n_fft: preset.n_fft, win_length: preset.win_length, hop: preset.hop, window: preset.window,
    window_param: preset.window_param ?? 0, yscale: preset.yscale, mode: 'W+S', split: 0.3,
    transform: 'stft', mel: { n_mels: 80, fmin: 0, fmax: preset.sr / 2, htk: false } };
}
export function viewForFeature(lane: FeatureLane): FeatureView {
  return { ...viewStyle(lane.id, 0, lane.rows - 1), kind: 'feature' };
}
export function displayUnit(lane: SessionLane): 'value' | 'dB' | 'dBFS' {
  if (lane.kind === 'audio') return 'dBFS';
  return lane.value_scale === 'raw' ? 'value' : 'dB';
}
export function viewScale(view: ViewConfig): 'linear' | 'log' {
  return view.kind === 'audio' && view.transform === 'stft' ? view.yscale : 'linear';
}
export function frequencyViewport(view: ViewConfig) {
  const padding = view.kind === 'feature' ? 0.5 : 0;
  return { lo: view.f_lo - padding, hi: view.f_hi + padding, scale: viewScale(view) };
}

function melLabel({ n_mels, fmin, fmax, htk }: MelSettings) {
  return `mel(${n_mels}, ${fmin}-${fmax}Hz, ${htk ? 'htk' : 'slaney'})`;
}
export function featureAxisLabel(axis: FrequencyAxis) {
  if (axis.type === 'mel') return melLabel(axis);
  return axis.type === 'linear' ? `linear 0-${axis.f_max}Hz` : 'index';
}

export function specLine(view: SpectralView, preset: Preset, sr: number, range: [number, number]): string {
  const window = view.window === 'kaiser' || view.window === 'gaussian' ? `${view.window}(${view.window_param})` : view.window;
  const yscale = viewScale(view);
  const fields: [string, number | string, number | string][] = [
    ['window', view.window, preset.window], ['win_length', view.win_length, preset.win_length],
    ['hop', view.hop, preset.hop], ['n_fft', view.n_fft, preset.n_fft],
    ['yscale', yscale, preset.yscale], ['f_min_hz', view.f_lo, preset.f_min_hz],
    ['f_max_hz', view.f_hi, preset.f_max_hz], ['cmap', view.cmap, preset.cmap],
  ];
  const overrides = fields.filter(([, value, original]) => value !== original).map(([key]) => key);
  if ((view.window === 'kaiser' || view.window === 'gaussian') && view.window_param !== (preset.window_param ?? (view.window === 'kaiser' ? 8.6 : 0.125))) overrides.push('window_param');
  if (view.range !== 'auto80') overrides.push('db');
  const y = view.transform === 'mel' ? `${melLabel(view.mel)} ${view.f_lo}-${view.f_hi}Hz` : `${yscale} ${view.f_lo}-${view.f_hi}Hz`;
  return `vsr-spec v1 | preset=${view.preset} | sr=${sr} | window=${window} | win=${view.win_length} | hop=${view.hop} | n_fft=${view.n_fft} | y=${y} | db=[${range[0]},${range[1]}] dBFS | cmap=${view.cmap}${overrides.length ? ` | overrides=${overrides.join(',')}` : ''}`;
}

export function featureSpecLine(view: FeatureView, lane: FeatureLane, range: [number, number]): string {
  const unit = displayUnit(lane);
  return `vsr-spec v1 | kind=feature | sr=${lane.sr} | hop=${Math.round(lane.sr / lane.frame_rate)} | y=${featureAxisLabel(lane.freq_axis)} rows=${view.f_lo}-${view.f_hi} | value_scale=${lane.value_scale} | ${unit === 'value' ? 'value' : 'db'}=[${range[0]},${range[1]}] ${unit} | cmap=${view.cmap}`;
}
