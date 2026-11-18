interface LaneMetadata {
  id: string; name: string; source: string; sr: number;
  offset: number; gain_db: number; mute: boolean; solo: boolean; version: number;
}

export interface Lane extends LaneMetadata {
  kind: 'audio'; channels: number; samples: number; dirty: boolean;
  record_warnings: RecordingWarning[];
}

export type MelSettings = { n_mels: number; fmin: number; fmax: number; htk: boolean };
export type FrequencyAxis = { type: 'index' } | { type: 'linear'; f_max: number } | ({ type: 'mel' } & MelSettings);
export type ValueScale = 'magnitude' | 'power' | 'db' | 'ln_magnitude' | 'log10_magnitude' | 'raw';
export interface FeatureLane extends LaneMetadata {
  kind: 'feature'; rows: number; frames: number; frame_rate: number; frame_t0: number;
  freq_axis: FrequencyAxis; value_scale: ValueScale;
}
export type SessionLane = Lane | FeatureLane;
export function laneDuration(lane: SessionLane): number {
  return lane.kind === 'audio' ? lane.samples / lane.sr : lane.frame_t0 + lane.frames / lane.frame_rate;
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
