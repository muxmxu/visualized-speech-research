import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { ApiError, analyzeRir, measureRir, previewRirSweep } from '../api/client';
import type { AudioDevices, Lane, RirAnalysisResult, RirDecay, RirFit, RirMeasureRequest, RirMeasureResult, RirMetric } from '../api/types';
import { RirArrival } from './RirArrival';

const octaveCenters = [125, 250, 500, 1000, 2000, 4000, 8000];
const fits: RirFit[] = ['EDT', 'T20', 'T30'];
const metrics: RirMetric[] = [...fits, 'C50', 'C80', 'D50', 'DRR'];
const bandColors = ['#4aa3ff', '#3ddc97', '#ffd166', '#ef88c3', '#b4a2ff', '#ff986b', '#c9d680', '#70d5e8'];
const bandLabel = (band: string) => band === 'broadband' ? 'Broadband' : `${band} Hz`;
const numberText = (value: number | null, digits = 3) => value === null ? '—' : value.toFixed(digits);

interface Trace {
  label: string;
  stroke: string;
  width: number;
  data: uPlot.AlignedData;
}
interface Cutoff {
  seconds: number;
  minimum: number;
  apply: (seconds: number) => void;
}
function RirPlot({ label, traces, duration, cutoff }: { label: string; traces: Trace[]; duration: number; cutoff?: Cutoff }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => {
    if (!root) return;
    const chart = new uPlot({
      width: Math.max(1, root.clientWidth), height: 152,
      scales: { x: { time: false, range: [0, duration] } },
      axes: [
        { label: 'Delay τ (ms)', stroke: '#d7dbe0', values: (_chart, values) => values.map(value => String(Number((1000 * value).toPrecision(5)))), grid: { stroke: '#343941' }, size: 24 },
        { label: 'dB', stroke: '#d7dbe0', grid: { stroke: '#343941' }, size: 40 },
      ],
      series: [{}, ...traces.map(({ label: name, stroke, width }) => ({ label: name, stroke, width }))],
      cursor: { drag: { x: false, y: false } },
    }, uPlot.join(traces.map(trace => trace.data)), root);
    setArea(chart.over);
    const resize = new ResizeObserver(() => chart.setSize({ width: Math.max(1, root.clientWidth), height: 152 }));
    resize.observe(root);
    return () => { resize.disconnect(); chart.destroy(); };
  }, [root, traces, duration]);
  const seconds = drag ?? cutoff?.seconds;
  const fromPointer = (clientX: number, plotArea: HTMLDivElement, minimum: number) => {
    const bounds = plotArea.getBoundingClientRect();
    return Math.max(minimum, Math.min(duration, (clientX - bounds.left) / bounds.width * duration));
  };
  return <><div ref={setRoot} className="rir-db-plot" role="group" aria-label={label} />
    {area && cutoff && seconds !== undefined && createPortal(<button className="rir-cutoff" type="button" role="slider"
      aria-label="Decay cutoff" aria-valuemin={cutoff.minimum} aria-valuemax={duration} aria-valuenow={seconds}
      aria-valuetext={`${(seconds * 1000).toFixed(3)} ms`} title={`Cutoff ${(seconds * 1000).toFixed(3)} ms`}
      style={{ left: `${seconds / duration * 100}%` }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag(seconds);
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) setDrag(fromPointer(event.clientX, area, cutoff.minimum));
      }}
      onPointerUp={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        setDrag(null);
        const next = fromPointer(event.clientX, area, cutoff.minimum);
        if (drag !== null && drag !== cutoff.seconds) cutoff.apply(next);
      }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={event => {
        const step = Math.max(cutoff.minimum, duration / 100);
        const values: Record<string, number> = {
          ArrowLeft: seconds - step, ArrowRight: seconds + step, ArrowDown: seconds - step, ArrowUp: seconds + step,
          Home: cutoff.minimum, End: duration,
        };
        if (!(event.key in values)) return;
        event.preventDefault();
        cutoff.apply(Math.max(cutoff.minimum, Math.min(duration, values[event.key])));
      }} />, area)}
  </>;
}

function broadbandTraces(curve: RirDecay): Trace[] {
  const traces: Trace[] = [
    { label: 'Envelope', stroke: '#748e9b', width: 1, data: [curve.times_s, curve.envelope_db] },
    { label: 'EDC', stroke: bandColors[0], width: 2, data: [curve.times_s, curve.edc_db] },
  ];
  for (const [index, fit] of fits.entries()) {
    const endpoints = curve.fits[fit];
    if (endpoints) traces.push({
      label: fit, stroke: bandColors[index + 1], width: 1.5,
      data: [endpoints.map(point => point[0]), endpoints.map(point => point[1])],
    });
  }
  return traces;
}

function RirResults({ result, duration, minimum, cutoff, setCutoff }: {
  result: RirAnalysisResult; duration: number; minimum: number; cutoff: number | undefined; setCutoff: (seconds: number) => void;
}) {
  const broadband = useMemo(() => broadbandTraces(result.curves.broadband), [result.curves]);
  const bands = useMemo(() => Object.entries(result.curves).map(([band, curve], index): Trace => ({
    label: bandLabel(band), stroke: bandColors[index], width: 1.5, data: [curve.times_s, curve.edc_db],
  })), [result.curves]);
  const { crosspoint_s, PNR, reasons } = result.bands.broadband;
  return <>
    <section className="rir-card" aria-labelledby="rir-broadband-label">
      <div className="rir-card-heading"><h3 id="rir-broadband-label">Broadband envelope, EDC and fits</h3>
        <button type="button" disabled={cutoff === undefined} onClick={() => setCutoff(0)}>Reset cutoff</button>
      </div>
      <RirPlot label="Broadband envelope, EDC and fits" traces={broadband} duration={duration}
        cutoff={{ seconds: cutoff ?? crosspoint_s ?? duration, minimum, apply: setCutoff }} />
      <p className="rir-inline-status" title={reasons.PNR}>Peak-to-noise ratio {numberText(PNR, 1)} dB {reasons.PNR && `· ${reasons.PNR}`}</p>
    </section>
    <section className="rir-card">
      <h3>Band energy decay</h3>
      <RirPlot label="Band energy decay" traces={bands} duration={duration} />
    </section>
    <section className="rir-card">
      <h3>RIR metrics</h3>
      <div className="rir-table-wrap"><table className="rir-table" aria-label="RIR metrics">
        <thead><tr><th scope="col">Band</th>{metrics.map(metric => <th scope="col" key={metric}>
          {metric}{metric === 'D50' ? '' : fits.some(fit => fit === metric) ? ' (s)' : ' (dB)'}</th>)}
          <th scope="col">Noise floor (dB)</th><th scope="col">Crosspoint (ms)</th>
        </tr></thead>
        <tbody>{Object.entries(result.bands).map(([band, values]) => <tr key={band}>
          <th scope="row">{bandLabel(band)}</th>
          {metrics.map(metric => {
            const fit = fits.find(name => name === metric);
            return <td key={metric} title={values.reasons[metric]}>
              {numberText(values[metric])}
              {fit && values.r2[fit] !== null && <small>r² {numberText(values.r2[fit])}</small>}
              {values.reasons[metric] && <small>{values.reasons[metric]}</small>}
            </td>;
          })}
          <td title={values.reasons.noise_floor_db}>{numberText(values.noise_floor_db, 1)}
            {values.reasons.noise_floor_db && <small>{values.reasons.noise_floor_db}</small>}</td>
          <td>{numberText(values.crosspoint_s === null ? null : 1000 * values.crosspoint_s)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>;
}

function RirAnalysis({ lane, channel, changeChannel, active }: {
  lane: Lane; channel: number; changeChannel: (channel: number) => void; active: boolean;
}) {
  const [selectedBands, setSelectedBands] = useState(octaveCenters);
  const [lundeby, setLundeby] = useState(true);
  const [override, setOverride] = useState<{ channel: number; seconds: number }>();
  const [result, setResult] = useState<{ channel: number; value: RirAnalysisResult } | null>(null);
  const [pending, setPending] = useState(false);
  const cutoff = override?.channel === channel ? override.seconds : undefined;
  const { id, sr, samples, version } = lane;
  const allowed = octaveCenters.filter(center => center * Math.SQRT2 < 0.95 * sr / 2);
  const current = result?.channel === channel ? result.value : null;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => setPending(true), 300);
    const bands = selectedBands.filter(center => center * Math.SQRT2 < 0.95 * sr / 2);
    const finish = () => {
      window.clearTimeout(timer);
      setPending(false);
    };
    void analyzeRir({ lane: id, channel, bands, use_lundeby: lundeby, truncation_s: cutoff }, controller.signal).then(value => {
      if (!controller.signal.aborted) setResult({ channel, value });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult(null);
      if (!(error instanceof ApiError)) notifications.show({ title: 'RIR analysis failed', message: String(error), color: 'red' });
    }).finally(() => {
      if (!controller.signal.aborted) finish();
    });
    return () => { controller.abort(); finish(); };
  }, [active, id, sr, version, channel, selectedBands, lundeby, cutoff]);
  return <>
    <div className="rir-controls">
      <strong title={lane.name}>{lane.name}</strong>
      <label>Channel <select aria-label="RIR channel" value={channel} onChange={event => {
        setOverride(undefined); changeChannel(Number(event.currentTarget.value));
      }}>
        {Array.from({ length: lane.channels }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
      </select></label>
      <label><input type="checkbox" checked={lundeby} onChange={event => setLundeby(event.currentTarget.checked)} /> Lundeby</label>
      <div className="rir-band-controls" role="group" aria-label="Octave bands">
        {allowed.map(center => <label key={center}>
          <input type="checkbox" checked={selectedBands.includes(center)} onChange={event => {
            setSelectedBands(event.currentTarget.checked ? [...selectedBands, center] : selectedBands.filter(value => value !== center));
          }} /> {center} Hz
        </label>)}
      </div>
      {pending && <span className="rir-inline-status" role="status"><Loader size="xs" /> Working…</span>}
    </div>
    {lane.rir_time_zero_calibrated !== true && <p className="rir-inline-status">Time zero uncalibrated</p>}
    <RirArrival key={`${id}:${version}:${channel}`} lane={lane} channel={channel} active={active}
      onset={current?.bands.broadband.onset_s ?? null} />
    {current && <RirResults result={current} duration={samples / sr} minimum={1 / sr} cutoff={cutoff}
      setCutoff={seconds => setOverride(seconds === 0 ? undefined : { channel, seconds })} />}
  </>;
}

const measurementFields = [
  { key: 'f1_hz', label: 'Start frequency (Hz)', value: 20, min: 0, step: 'any' },
  { key: 'f2_hz', label: 'End frequency (Hz)', value: undefined, min: 0, step: 'any' },
  { key: 'duration_s', label: 'Sweep duration (s)', value: 5, min: 0, step: 'any' },
  { key: 'amplitude_dbfs', label: 'Amplitude (dBFS)', value: -12, max: 0, step: 'any' },
  { key: 'fade_in_s', label: 'Fade in (s)', value: 0.05, min: 0, step: 'any' },
  { key: 'fade_out_s', label: 'Fade out (s)', value: 0.01, min: 0, step: 'any' },
  { key: 'pre_silence_s', label: 'Pre-silence (s)', value: 0.5, min: 0, step: 'any' },
  { key: 'tail_silence_s', label: 'Tail silence (s)', value: 3, min: 0, step: 'any' },
  { key: 'repeats', label: 'Repeats', value: 1, min: 1, step: 1 },
  { key: 'ir_length_s', label: 'IR length (s)', value: 1, min: 0, step: 'any' },
];

function RirMeasurement({ devices, disabled, perform, selectMeasuredLane }: {
  devices: AudioDevices | null; disabled: boolean; perform: (action: () => Promise<unknown>) => void;
  selectMeasuredLane: (lane: Lane) => void;
}) {
  const [inputId, setInputId] = useState<number | null>(null);
  const [outputId, setOutputId] = useState<number | null>(null);
  const [inputChannels, setInputChannels] = useState([0]);
  const [outputChannel, setOutputChannel] = useState(0);
  const [loopback, setLoopback] = useState<number | null>(null);
  const [rate, setRate] = useState('48000');
  const [confirmation, setConfirmation] = useState<RirMeasureRequest | null>(null);
  const [result, setResult] = useState<RirMeasureResult | null>(null);
  const inputs = devices?.devices.filter(device => device.max_input_channels > 0) ?? [];
  const outputs = devices?.devices.filter(device => device.max_output_channels > 0) ?? [];
  const input = inputs.find(device => device.id === (inputId ?? devices?.default_input));
  const output = outputs.find(device => device.id === (outputId ?? devices?.default_output));
  const inChannels = Array.from({ length: input?.max_input_channels ?? 0 }, (_, index) => index);
  const outChannels = Array.from({ length: output?.max_output_channels ?? 0 }, (_, index) => index);
  const validInputs = inputChannels.filter(channel => channel !== loopback);
  const measure = (settings: RirMeasureRequest) => perform(async () => {
    setResult(null);
    const take = await measureRir(settings);
    setResult(take);
    if (take.valid) selectMeasuredLane(take.lanes[0]);
  });
  return <details className="rir-card rir-measure">
    <summary>ESS measurement</summary>
    {devices?.reason && <p role="status">{devices.reason}</p>}
    {devices && !devices.reason && (!input || !output) && <p role="status">Select available input and output devices to measure.</p>}
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const number = (name: string) => Number(data.get(name));
      const sweep = {
        output_device: outputId, output_channel: outputChannel, sr: number('sr'), f1_hz: number('f1_hz'),
        f2_hz: data.get('f2_hz') === '' ? undefined : number('f2_hz'),
      };
      if (event.nativeEvent.submitter?.getAttribute('value') === 'preview') {
        perform(() => previewRirSweep(sweep));
        return;
      }
      const settings: RirMeasureRequest = {
        ...sweep, input_device: inputId, input_channels: validInputs, loopback_channel: loopback,
        duration_s: number('duration_s'), amplitude_dbfs: number('amplitude_dbfs'), fade_in_s: number('fade_in_s'),
        fade_out_s: number('fade_out_s'), pre_silence_s: number('pre_silence_s'), tail_silence_s: number('tail_silence_s'),
        repeats: number('repeats'), ir_length_s: number('ir_length_s'), confirm_loud: false,
      };
      if (settings.amplitude_dbfs > -6) setConfirmation(settings);
      else measure(settings);
    }}><fieldset disabled={disabled}>
      <legend>Devices and sweep</legend>
      <div className="rir-measure-fields">
        <label>Input device<select value={inputId ?? ''} onChange={event => {
          setInputId(event.currentTarget.value === '' ? null : Number(event.currentTarget.value));
          setInputChannels([0]); setLoopback(null);
        }}>
          <option value="">Default input</option>
          {inputs.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
        </select></label>
        <label>Output device<select value={outputId ?? ''} onChange={event => {
          setOutputId(event.currentTarget.value === '' ? null : Number(event.currentTarget.value));
          setOutputChannel(0);
        }}>
          <option value="">Default output</option>
          {outputs.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
        </select></label>
        <label>Output channel<select value={outputChannel} onChange={event => setOutputChannel(Number(event.currentTarget.value))}>
          {outChannels.map(channel => <option key={channel} value={channel}>{channel + 1}</option>)}
        </select></label>
        <label>Loopback channel<select value={loopback ?? ''} onChange={event => setLoopback(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}>
          <option value="">None</option>
          {inChannels.map(channel => <option key={channel} value={channel}>{channel + 1}</option>)}
        </select></label>
        <label>Sample rate (Hz)<input name="sr" type="number" min={1} step={1} required defaultValue={48000}
          onChange={event => setRate(event.currentTarget.value)} /></label>
        {measurementFields.map(({ key, label, value, ...bounds }) => <label key={key}>{label}<input name={key} type="number"
          defaultValue={value} required={value !== undefined} {...bounds}
          placeholder={key === 'f2_hz' && rate !== '' ? String(Math.min(20000, 0.95 * Number(rate) / 2)) : undefined} /></label>)}
      </div>
      <div className="rir-band-controls" role="group" aria-label="Acoustic input channels">
        <span>Acoustic inputs</span>
        {inChannels.filter(channel => channel !== loopback).map(channel => <label key={channel}>
          <input type="checkbox" checked={inputChannels.includes(channel)} onChange={event => setInputChannels(event.currentTarget.checked
            ? [...inputChannels, channel].sort((a, b) => a - b) : inputChannels.filter(value => value !== channel))} /> {channel + 1}
        </label>)}
      </div>
      <div className="rir-controls">
        <button type="submit" value="preview" disabled={!output}>Preview</button>
        <button type="submit" value="measure" disabled={!input || !output || validInputs.length === 0}>Measure</button>
        <span>Preview · 1 s at −30 dBFS</span>
      </div>
    </fieldset></form>
    {result && <div role="status" className="rir-measure-result">
      <strong>{result.valid ? 'Measurement saved' : 'Invalid measurement'}</strong>
      {result.reason && <span>{result.reason}</span>}
      {result.valid && <span>{result.time_zero_calibrated ? 'Time zero calibrated' : 'Time zero uncalibrated'}</span>}
      {result.ir_path && <span>{result.ir_path}</span>}
      {result.raw_paths.map(path => <span key={path}>{path}</span>)}
      <span>{result.metadata_path}</span>
    </div>}
    <Modal opened={confirmation !== null} onClose={() => setConfirmation(null)} title="Confirm loud sweep">
      {confirmation && <><p>A sweep at {confirmation.amplitude_dbfs} dBFS can damage hearing. Confirm the playback level before measuring.</p>
        <div className="rir-controls"><button type="button" onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" disabled={disabled} onClick={() => {
            measure({ ...confirmation, confirm_loud: true }); setConfirmation(null);
          }}>Measure at {confirmation.amplitude_dbfs} dBFS</button></div></>}
    </Modal>
  </details>;
}

export function Rir({ lane, channel, changeChannel, active, devices, disabled, perform, selectMeasuredLane }: {
  lane: Lane | undefined; channel: number; changeChannel: (channel: number) => void; active: boolean;
  devices: AudioDevices | null; disabled: boolean; perform: (action: () => Promise<unknown>) => void; selectMeasuredLane: (lane: Lane) => void;
}) {
  return <div className="panel rir-panel" aria-label="RIR workbench">
    <RirMeasurement devices={devices} disabled={disabled} perform={perform} selectMeasuredLane={selectMeasuredLane} />
    {lane ? <RirAnalysis key={lane.id} lane={lane} channel={channel} changeChannel={changeChannel} active={active} />
      : <p>Select an audio lane to analyze its impulse response.</p>}
  </div>;
}
