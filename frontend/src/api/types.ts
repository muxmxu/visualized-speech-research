interface LaneMetadata {
  id: string; name: string; source: string; parent: string | null; stale: boolean;
  offset: number; gain_db: number; mute: boolean; solo: boolean; version: number;
}

export interface Lane extends LaneMetadata {
  kind: 'audio'; sr: number; channels: number; samples: number; dirty: boolean;
  record_warnings: RecordingWarning[];
}

export type MelSettings = { n_mels: number; fmin: number; fmax: number; htk: boolean };
export type FrequencyAxis = { type: 'index' } | { type: 'linear'; f_max: number } | ({ type: 'mel' } & MelSettings);
export type ValueScale = 'magnitude' | 'power' | 'db' | 'ln_magnitude' | 'log10_magnitude' | 'raw';
export interface FeatureLane extends LaneMetadata {
  kind: 'feature'; sr: number; rows: number; frames: number; frame_rate: number; frame_t0: number;
  freq_axis: FrequencyAxis; value_scale: ValueScale;
}
export type SessionLane = Lane | FeatureLane;
export interface CurveLane extends LaneMetadata {
  kind: 'curve'; overlay: boolean; unit: string; y_scale: 'linear' | 'log';
  curves: number; points: number; labels: string[]; duration: number;
}
export interface EventsLane extends LaneMetadata { kind: 'events'; duration: number }
export type AnnotationLane = CurveLane | EventsLane;
export type WorkspaceLane = SessionLane | AnnotationLane;
export function isSpectralLane(lane: WorkspaceLane): lane is SessionLane {
  return lane.kind === 'audio' || lane.kind === 'feature';
}
export function laneDuration(lane: WorkspaceLane): number {
  if (lane.kind === 'audio') return lane.samples / lane.sr;
  if (lane.kind === 'feature') return lane.frame_t0 + lane.frames / lane.frame_rate;
  return lane.duration;
}

export type AudioLayout = '[N]' | '[C,N]' | '[N,C]' | '[B,N]' | '[B,C,N]';
export type FeatureAxes = '[F,T]' | '[T,F]' | '[B,F,T]' | '[B,T,F]';
export type Interpretation = { kind: 'audio'; layout: AudioLayout; sr: number } |
  { kind: 'feature'; axes: FeatureAxes; sr: number; hop: number; freq_axis: FrequencyAxis; value_scale: ValueScale };
export interface TensorLeaf { key_path: unknown[]; shape: number[]; dtype: string }
export interface TensorIntake { needs_interpretation: true; path: string; tree: TensorLeaf[] }
export type OpenResult = TensorIntake | { lanes: SessionLane[] };

export interface Settings { compute_device: string; available_devices: string[]; self_check: Record<string, number> | null; reason: string | null }
export interface Directory { path: string; entries: { name: string; is_dir: boolean; size: number; mtime: number }[] }

export type EditOperation = 'delete' | 'cut' | 'copy' | 'paste' | 'silence' | 'insert_silence' |
  'trim' | 'gain' | 'normalize' | 'fade_in' | 'fade_out' | 'invert' | 'mixdown_channels' |
  'spectral_attenuate' | 'spectral_extract';
export interface LaneEdit {
  op: EditOperation; t0?: number; t1?: number; channel?: number;
  params?: {
    gain_db?: number | '-inf'; target_dbfs?: number; duration_s?: number; curve?: 'linear' | 'equal-power';
    lane_ids?: string[]; f_lo?: number; f_hi?: number; n_fft?: number; win_length?: number;
    window?: string; window_param?: number;
  };
}
export type SaveSubtype = 'PCM_16' | 'PCM_24' | 'FLOAT';

export type RecordingWarning = { time_s: number; type: 'input_overflow' | 'output_underflow' };
export interface AudioDevice {
  id: number; name: string; max_input_channels: number; max_output_channels: number; default_samplerate: number;
}
export interface AudioDevices {
  hostname: string; devices: AudioDevice[]; default_input: number | null; default_output: number | null; reason: string | null;
}
export interface RecordMapping { lane: string | null; channels: number[] }
export interface RecordDeviceSettings { input_device: number | null; sr: number; blocksize: number }
export interface RecordArm extends RecordDeviceSettings { mapping: RecordMapping[] }
export interface RecordStart extends RecordArm {
  output_device?: number; subtype: SaveSubtype; overdub: boolean; latency_ms: number | null; start_time: number;
}
export interface RecordState {
  type: 'record_state'; state: 'idle' | 'armed' | 'recording'; mapping: RecordMapping[]; start_time: number | null;
  notice: 'microphone_permission' | 'device_clock_drift' | null;
}
export interface RecordMeter {
  type: 'record_meter'; channels: { peak_dbfs: number | null; rms_dbfs: number | null; clip: boolean }[];
}
export interface RecordPreview {
  type: 'record_preview'; target: number; sr: number; first_sample: number; samples_per_column: number; sample_count: number;
}
export type RecordCalibrate = RecordDeviceSettings & { output_device: number | null };
export interface MixdownRequest { t0: number; t1: number; sr: number; path: string; subtype: SaveSubtype }

export type AnalyzerValue = number | string | boolean;
export interface AnalyzerParam {
  type: 'float' | 'int' | 'bool' | 'str'; default: AnalyzerValue;
  min: number | null; max: number | null; step: number | null;
  choices: AnalyzerValue[] | null; unit: string | null; label: string | null;
}
export interface AnalyzerDefinition {
  id: string; label: string; version: number; input: 'audio' | 'feature'; params: Record<string, AnalyzerParam>;
}
export interface AnalyzerCatalog { analyzers: AnalyzerDefinition[]; errors: { file: string; error: string }[] }
export interface AnalyzerRequest {
  lane: string; t0?: number; t1?: number; channel?: number; params: Record<string, AnalyzerValue>;
}
export type AnalyzerLaneResult = { kind: 'time_freq_image' | 'time_curve' | 'events' | 'audio'; lanes: string[]; result: null };
export type AnalyzerScalarResult = { kind: 'scalars'; lanes: string[]; result: Record<string, number> };
export interface AnalyzerSpectrum {
  kind: 'spectrum'; lanes: string[]; result: { unit: string; labels: string[] };
  frequencies: Float32Array; values: Float32Array;
}
export type AnalyzerResult = AnalyzerLaneResult | AnalyzerScalarResult | AnalyzerSpectrum;
export type EventInterval = [t0: number, t1: number, label: string];
export interface AnalyzerCurveData { times: Float32Array; values: Float32Array }
