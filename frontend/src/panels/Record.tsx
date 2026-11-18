import { useLayoutEffect, useRef, useState } from 'react';
import { IconWaveSine } from '@tabler/icons-react';
import type { AudioDevices, Lane, MixdownRequest, RecordMapping, RecordMeter, RecordPreview, SaveSubtype } from '../api/types';
import type { Viewport } from '../state/viewport';

export interface RecordSetup {
  input_device: number | null;
  output_device: number | null;
  sr: number;
  blocksize: number;
  subtype: SaveSubtype;
  overdub: boolean;
  latency_ms: number | null;
}

export const initialRecordSetup: RecordSetup = {
  input_device: null, output_device: null, sr: 48000, blocksize: 256, subtype: 'FLOAT', overdub: false, latency_ms: null,
};

export interface PreviewFrame extends RecordPreview {
  shape: number[];
  data: Float32Array;
}

const subtypes: SaveSubtype[] = ['FLOAT', 'PCM_24', 'PCM_16'];

export function RecordingPanel({ devices, lanes, setup, mapping, disabled, changeSetup, changeMapping, calibrate }: {
  devices: AudioDevices | null; lanes: Lane[]; setup: RecordSetup; mapping: RecordMapping[]; disabled: boolean;
  changeSetup: (setup: RecordSetup) => void; changeMapping: (mapping: RecordMapping[]) => void; calibrate: () => void;
}) {
  if (!devices) return <div className="panel">Loading audio devices…</div>;
  const inputs = devices.devices.filter(device => device.max_input_channels > 0);
  const outputs = devices.devices.filter(device => device.max_output_channels > 0);
  const input = inputs.find(device => device.id === (setup.input_device ?? devices.default_input));
  const output = outputs.find(device => device.id === (setup.output_device ?? devices.default_output));
  const channels = Array.from({ length: input?.max_input_channels ?? 0 }, (_, index) => index);
  return <section className="panel record-panel" aria-label="Record panel">
    <div className="record-host"><IconWaveSine size={16} /><span>{devices.hostname}</span>{devices.reason && <span role="status">{devices.reason}</span>}
      {!devices.reason && !inputs.length && <span role="status">No audio inputs available</span>}
    </div>
    <div className="record-grid">
      <fieldset disabled={disabled}>
        <legend>Devices and format</legend>
        <label>Input device<select value={setup.input_device ?? ''} onChange={event => {
          const id = event.currentTarget.value === '' ? null : Number(event.currentTarget.value);
          const device = inputs.find(item => item.id === (id ?? devices.default_input));
          changeSetup({ ...setup, input_device: id, sr: device ? Math.round(device.default_samplerate) : setup.sr });
        }}>
          <option value="">Default input</option>
          {inputs.map(device => <option key={device.id} value={device.id}>{device.name} · {device.max_input_channels} in</option>)}
        </select></label>
        <label>Output device<select value={setup.output_device ?? ''} onChange={event => {
          changeSetup({ ...setup, output_device: event.currentTarget.value === '' ? null : Number(event.currentTarget.value) });
        }}>
          <option value="">Default output</option>
          {outputs.map(device => <option key={device.id} value={device.id}>{device.name} · {device.max_output_channels} out</option>)}
        </select></label>
        <div className="record-format">
          <label>Rate (Hz)<input aria-label="Sample rate (Hz)" type="number" min={1} step={1} value={setup.sr} onChange={event => {
            const sr = event.currentTarget.valueAsNumber;
            if (Number.isInteger(sr) && sr > 0) changeSetup({ ...setup, sr });
          }} /></label>
          <label>Block size<input type="number" min={1} step={1} value={setup.blocksize} onChange={event => {
            const blocksize = event.currentTarget.valueAsNumber;
            if (Number.isInteger(blocksize) && blocksize > 0) changeSetup({ ...setup, blocksize });
          }} /></label>
          <label>Subtype<select value={setup.subtype} onChange={event => changeSetup({ ...setup, subtype: event.currentTarget.value as SaveSubtype })}>
            {subtypes.map(subtype => <option key={subtype}>{subtype}</option>)}
          </select></label>
        </div>
      </fieldset>
      <fieldset disabled={disabled || !input}>
        <legend>Input routing</legend>
        {!mapping.length && <p>Arm a lane with R or select inputs below. Record uses the default device’s first input when no lanes are armed.</p>}
        {mapping.map((target, index) => target.lane !== null && <label key={target.lane}>{lanes.find(lane => lane.id === target.lane)?.name ?? 'Closed lane'}
          <select aria-label={`Inputs for ${lanes.find(lane => lane.id === target.lane)?.name ?? 'closed lane'}`} value={target.channels.join(',')} onChange={event => {
            const next = event.currentTarget.value.split(',').map(Number);
            changeMapping(mapping.map((item, ordinal) => ordinal === index ? { ...item, channels: next } : item));
          }}>
            {channels.map(channel => <option key={channel} value={channel}>Input {channel + 1} · Mono</option>)}
            {channels.slice(0, -1).map(channel => <option key={channel} value={`${channel},${channel + 1}`}>Inputs {channel + 1}–{channel + 2} · Stereo</option>)}
          </select>
        </label>)}
        {channels.length > 0 && <div className="record-new-lanes"><span>+ New lane</span>
          <div>{channels.map(channel => {
            const selected = mapping.some(item => item.lane === null && item.channels[0] === channel);
            return <label key={channel} className="record-choice">
              <input type="checkbox" checked={selected} onChange={() => changeMapping(selected
                ? mapping.filter(item => item.lane !== null || item.channels[0] !== channel)
                : [...mapping, { lane: null, channels: [channel] }])} /> Input {channel + 1}
            </label>;
          })}</div>
        </div>}
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>Overdub</legend>
        <label className="record-choice"><input type="checkbox" checked={setup.overdub} disabled={!output}
          onChange={event => changeSetup({ ...setup, overdub: event.currentTarget.checked })} /> Play other audible lanes while recording</label>
        <label>Latency compensation (ms)<input type="number" min={0} step="any" placeholder="Stream latency"
          value={setup.latency_ms ?? ''} onChange={event => {
            const latency = event.currentTarget.valueAsNumber;
            if (event.currentTarget.value === '' || latency >= 0) changeSetup({ ...setup, latency_ms: Number.isNaN(latency) ? null : latency });
          }} /></label>
        <button title="Measure round-trip latency" disabled={!input || !output} onClick={calibrate}>Calibrate</button>
        <p>Connect output 1 to input 1 before calibrating.</p>
      </fieldset>
    </div>
  </section>;
}

function level(db: number | null): number {
  return db === null ? 0 : Math.max(0, Math.min(1, (db + 60) / 60));
}

function dbText(db: number | null): string {
  return db === null ? '−∞' : db.toFixed(1);
}

export function InputMeter({ meter }: { meter: RecordMeter }) {
  return <div className="toolbar-group input-meter" aria-label="Input levels">
    <span>Input dBFS</span>
    <div className="input-channels">{meter.channels.map(({ peak_dbfs, rms_dbfs, clip }, i) =>
      <span className={clip ? 'input-channel clipped' : 'input-channel'} key={i}
        title={`Input ${i + 1} · Peak ${dbText(peak_dbfs)} dBFS · RMS ${dbText(rms_dbfs)} dBFS${clip ? ' · Clip' : ''}`}>
        <span>{i + 1}</span>
        <span className="input-level"><i style={{ width: `${level(rms_dbfs) * 100}%` }} />
          <b style={{ left: `${level(peak_dbfs) * 100}%` }} /></span>
        <span>{clip ? 'Clip' : dbText(peak_dbfs)}</span>
      </span>)}</div>
  </div>;
}

export function RecordingWave({ frames, origin, view, label, onWidth }: {
  frames: PreviewFrame[]; origin: number; view: Viewport; label: string; onWidth?: (width: number) => void;
}) {
  const surface = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = surface.current as HTMLCanvasElement;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (onWidth) onWidth(width);
      const dpr = window.devicePixelRatio;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.scale(dpr, dpr);
      const color = getComputedStyle(canvas).getPropertyValue('--record');
      const xAt = (sample: number, sr: number) => (origin + sample / sr - view.t0) / view.secondsPerPx;
      const firstFrame = frames[0];
      const lastFrame = frames[frames.length - 1];
      const left = xAt(firstFrame.first_sample, firstFrame.sr);
      const right = xAt(lastFrame.first_sample + lastFrame.sample_count, lastFrame.sr);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(left, 0, right - left, height);
      ctx.globalAlpha = 1;
      for (const frame of frames) {
        const [channels, , columns] = frame.shape;
        const channelHeight = height / channels;
        const base = xAt(frame.first_sample, frame.sr);
        const stride = frame.samples_per_column / frame.sr / view.secondsPerPx;
        const lo = Math.max(0, Math.floor(-base / stride));
        const hi = Math.min(columns, Math.ceil((width - base) / stride));
        for (let c = 0; c < channels; c++) {
          const mid = (c + 0.5) * channelHeight;
          const scale = 0.44 * channelHeight;
          for (let i = lo; i < hi; i++) {
            const min = frame.data[c * columns * 2 + i];
            const max = frame.data[(c * 2 + 1) * columns + i];
            const columnWidth = Math.min(frame.samples_per_column, frame.sample_count - i * frame.samples_per_column) / frame.sr / view.secondsPerPx;
            ctx.fillRect(base + i * stride, mid - max * scale, Math.max(1, columnWidth), Math.max(1, (max - min) * scale));
          }
        }
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [frames, origin, view, onWidth]);
  return <canvas className="record-preview" ref={surface} aria-label={`Recording preview ${label}`} />;
}

export function MixdownForm({ interval: [t0, t1], sr, disabled, submit }: {
  interval: [number, number]; sr: number; disabled: boolean; submit: (settings: MixdownRequest) => void;
}) {
  const [path, setPath] = useState('');
  const flac = /\.flac$/i.test(path.trim());
  return <form className="edit-form" onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    submit({ t0, t1, sr: Number(fields.get('sr')), path: path.trim(), subtype: fields.get('subtype') as SaveSubtype });
  }}>
    <p>{t0.toFixed(3)}–{t1.toFixed(3)} s</p>
    <label>Destination path<input name="path" value={path} required placeholder="/path/to/mix.wav"
      onChange={event => setPath(event.currentTarget.value)} /></label>
    <label>Sample rate (Hz)<input name="sr" type="number" min={1} step={1} required defaultValue={sr} /></label>
    <label>Subtype<select name="subtype" defaultValue="PCM_24">
      {subtypes.filter(subtype => !flac || subtype !== 'FLOAT').map(subtype => <option key={subtype}>{subtype}</option>)}
    </select></label>
    <button title="Write session mix to destination" disabled={disabled || !/\.(wav|flac)$/i.test(path.trim())}>Mixdown</button>
  </form>;
}
