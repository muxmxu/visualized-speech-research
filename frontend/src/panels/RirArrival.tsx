import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { ApiError, request } from '../api/client';
import { decodeFrame } from '../api/frame';
import type { FrameArray } from '../api/frame';
import type { Lane } from '../api/types';
import { pan, zoom } from '../state/viewport';

interface Arrival { sample: number; value: number }
interface Wave { data: Float32Array; columns: number; first: number | undefined; t0: number; t1: number }
type Window = [start: number, end: number];

async function readWave(lane: Lane, channel: number, [start, end]: Window, width: number, signal?: AbortSignal): Promise<Wave> {
  const query = new URLSearchParams({
    t0: String(lane.offset + start), t1: String(lane.offset + end), width: String(width), channel: String(channel),
  });
  const response = await request(`/lanes/${lane.id}/waveform?${query}`, { signal });
  const { arrays, header } = decodeFrame(await response.arrayBuffer());
  const frame = arrays as FrameArray;
  return {
    data: frame.data as Float32Array, columns: frame.shape[frame.shape.length - 1],
    first: header.first_sample as number | undefined, t0: (header.t0 as number) - lane.offset, t1: (header.t1 as number) - lane.offset,
  };
}

function sampleInWave(wave: Wave | null, sample: number): number | undefined {
  if (wave?.first === undefined || sample < wave.first || sample >= wave.first + wave.columns) return;
  return wave.data[sample - wave.first];
}

async function readSample(lane: Lane, channel: number, sample: number, signal?: AbortSignal): Promise<Arrival> {
  const frame = await readWave(lane, channel, [sample / lane.sr, (sample + 1) / lane.sr], 2, signal);
  return { sample, value: frame.data[sample - (frame.first as number)] };
}

function report(error: unknown) {
  if (!(error instanceof ApiError)) notifications.show({ title: 'Could not read RIR samples', message: String(error), color: 'red' });
}

const milliseconds = (seconds: number) => (seconds * 1000).toFixed(3);
const signed = (value: number) => `${value < 0 ? '−' : '+'}${Number(Math.abs(value).toPrecision(8))}`;

export function RirArrival({ lane, channel, onset, active }: { lane: Lane; channel: number; onset: number | null; active: boolean }) {
  const duration = lane.samples / lane.sr;
  const [visible, setVisible] = useState<Window>([0, duration]);
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [wave, setWave] = useState<Wave | null>(null);
  const [automatic, setAutomatic] = useState<Arrival | null>(null);
  const [manual, setManual] = useState<Arrival | null>(null);
  const [later, setLater] = useState<Arrival[]>([]);
  const [settingReference, setSettingReference] = useState(false);
  const [reading, setReading] = useState(false);
  const direct = manual ?? (onset === null ? null : automatic);
  const [start, end] = visible;
  const span = end - start;
  const limit = useMemo(() => {
    let peak = 1;
    if (wave) {
      const values = wave.first === undefined ? wave.data.subarray(0, wave.columns * 2) : wave.data;
      for (const value of values) peak = Math.max(peak, Math.abs(value));
    }
    return peak;
  }, [wave]);

  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { id, offset, sr, samples, version } = lane;
  useEffect(() => {
    if (!active || width === 0) return;
    const abort = new AbortController();
    void readWave(lane, channel, [start, end], width, abort.signal).then(packet => {
      if (!abort.signal.aborted) setWave(packet);
    }).catch((error: unknown) => { if (!abort.signal.aborted) report(error); });
    return () => abort.abort();
  }, [active, id, offset, sr, version, channel, start, end, width]);
  useEffect(() => {
    if (!active || onset === null) return;
    const abort = new AbortController();
    const sample = Math.max(0, Math.min(samples - 1, Math.round(onset * sr)));
    void readSample(lane, channel, sample, abort.signal).then(arrival => {
      if (!abort.signal.aborted) setAutomatic(arrival);
    }).catch((error: unknown) => { if (!abort.signal.aborted) report(error); });
    return () => abort.abort();
  }, [active, id, offset, sr, version, samples, onset, channel]);

  const changeWindow = (factor: number, anchor: number, displacement = 0) => setVisible(([left, right]) => {
    const view = { t0: left, secondsPerPx: (right - left) / width };
    const changed = pan(zoom(view, anchor, factor), displacement);
    const length = Math.min(duration, Math.max(1 / sr, changed.secondsPerPx * width));
    const next = Math.max(0, Math.min(duration - length, changed.t0));
    return [next, next + length];
  });
  useEffect(() => {
    const element = surface.current;
    if (!element || width === 0) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        changeWindow(Math.exp(event.deltaY * 0.002), event.clientX - element.getBoundingClientRect().left - element.clientLeft);
      } else if (event.shiftKey || event.deltaX !== 0) {
        event.preventDefault();
        changeWindow(1, 0, event.deltaX || event.deltaY);
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [width, duration, sr]);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext('2d') as CanvasRenderingContext2D;
    const draw = () => {
      const { width: pixels, height } = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      element.width = Math.round(pixels * dpr);
      element.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);
      const xAt = (time: number) => (time - start) / span * pixels;
      const yAt = (value: number) => (0.5 - value / (2.2 * limit)) * height;
      ctx.fillStyle = '#59636f';
      ctx.fillRect(0, yAt(0), pixels, 1);
      if (!wave) return;
      ctx.strokeStyle = '#3ddc97';
      ctx.fillStyle = '#3ddc97';
      if (wave.first !== undefined) {
        const spacing = pixels / span / sr;
        ctx.beginPath();
        for (let i = 0; i < wave.columns; i++) {
          const x = xAt((wave.first + i) / sr), y = yAt(wave.data[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          if (spacing >= 4) ctx.fillRect(x - 1, y - 1, 2, 2);
        }
        ctx.stroke();
      } else {
        const step = (wave.t1 - wave.t0) / wave.columns;
        for (let i = 0; i < wave.columns; i++) {
          const y = yAt(wave.data[wave.columns + i]);
          ctx.fillRect(xAt(wave.t0 + i * step), y, Math.max(1, step * pixels / span), Math.max(1, yAt(wave.data[i]) - y));
        }
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [wave, start, span, sr, limit]);

  function choose(pointer: number, plotWidth: number) {
    if (reading) return;
    const sample = Math.max(0, Math.min(samples - 1, Math.round((start + pointer / plotWidth * span) * sr)));
    if (!settingReference && (!direct || sample <= direct.sample)) return;
    const commit = (arrival: Arrival) => {
      if (settingReference) {
        setManual(arrival);
        setLater(old => old.filter(item => item.sample > sample));
        setSettingReference(false);
      } else setLater(old => [...old.filter(item => item.sample !== sample), arrival].sort((a, b) => a.sample - b.sample));
    };
    const value = sampleInWave(wave, sample);
    if (value !== undefined) { commit({ sample, value }); return; }
    setReading(true);
    void readSample(lane, channel, sample).then(commit).catch(report).finally(() => setReading(false));
  }

  const markers = direct ? [direct, ...later] : [];
  return <section className="rir-card" aria-label="RIR arrivals">
    <div className="rir-card-heading">
      <h3>Impulse response</h3>
      <div className="rir-arrival-tools">
        <button type="button" title="Set direct reference by clicking a sample" aria-pressed={settingReference}
          disabled={reading} onClick={() => setSettingReference(value => !value)}>Set direct reference</button>
        <button type="button" title="Zoom in around the center (Ctrl/Cmd + wheel)" aria-label="Zoom in on arrival samples" onClick={() => changeWindow(0.5, width / 2)}>+</button>
        <button type="button" title="Zoom out around the center" aria-label="Zoom out on arrival samples" onClick={() => changeWindow(2, width / 2)}>−</button>
        <button type="button" title="Show full impulse response" onClick={() => setVisible([0, duration])}>Fit</button>
      </div>
    </div>
    <div className="rir-axis-grid">
      <div className="rir-coefficient-axis" aria-label="Signed coefficient axis"><span>+{limit.toFixed(2)}</span><span>0</span><span>−{limit.toFixed(2)}</span></div>
      <div className="rir-arrival-plot" ref={surface} aria-label="Signed coefficient plot" title="Click after the direct reference to mark an arrival"
        onClick={event => {
          const target = event.currentTarget;
          choose(event.clientX - target.getBoundingClientRect().left - target.clientLeft, target.clientWidth);
        }}>
        <canvas ref={canvas} aria-hidden="true" />
        {markers.map((marker, i) => {
          const x = (marker.sample / sr - start) / span;
          return x >= 0 && x <= 1 && <div key={marker.sample}
            className={`rir-marker${i === 0 ? ' direct' : ''}${x > 0.83 ? ' align-end' : ''}`}
            style={{ left: `${x * 100}%` }}><span>{i === 0 ? 'Direct' : `Arrival ${i}`}</span></div>;
        })}
      </div>
      <div className="rir-delay-axis" aria-label="Delay in milliseconds">
        {Array.from({ length: 5 }, (_, i) => <span key={i}>{milliseconds(start + span * i / 4)}</span>)}
      </div>
    </div>
    <div className="rir-arrival-caption">
      <span>Delay τ (ms) · Signed h[n]</span>
      <span>{wave?.first === undefined ? 'Min/max overview' : 'Raw samples'}</span>
    </div>
    {settingReference && <p className="rir-inline-status" role="status">Click the new direct reference.</p>}
    {markers.length > 0 && <table className="rir-table" aria-label="Arrival markers">
      <thead><tr><th scope="col">Marker</th><th scope="col">Sample</th><th scope="col">τ (ms)</th><th scope="col">h[n]</th><th scope="col">Δτ (ms)</th></tr></thead>
      <tbody>{markers.map(({ sample, value }, i) => <tr key={sample}>
        <th scope="row">{i === 0 ? 'Direct' : `Arrival ${i}`}</th><td>{sample}</td><td>{milliseconds(sample / sr)}</td>
        <td>{signed(value)}</td><td>{milliseconds((sample - markers[0].sample) / sr)}</td>
      </tr>)}</tbody>
    </table>}
  </section>;
}
