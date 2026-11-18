import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import { notifications } from '@mantine/notifications';
import 'uplot/dist/uPlot.min.css';
import { ApiError, NetworkError, body, request } from '../api/client';
import { decodeFrame } from '../api/frame';
import type { FrameArray } from '../api/frame';
import type { Lane } from '../api/types';
import type { SpectralView } from '../state/spectralViews';
import type { TfSelection } from '../state/tfSelection';

type Method = 'frame' | 'welch' | 'full';
type Statistic = 'mean' | 'median' | 'p10' | 'p90' | 'max';
type Unit = 'dbfs' | 'db_per_hz';
export interface Curve { id: string; label: string; frequencies: number[]; values: number[] }
export interface AnalyzerSpectrumResult { id: string; lane: string; label: string; unit: string; curves: Curve[] }
type AnalysisLane = Pick<Lane, 'id' | 'name' | 'sr' | 'samples' | 'offset' | 'version'>;
type AnalysisView = Pick<SpectralView, 'n_fft' | 'win_length' | 'hop' | 'window' | 'window_param'>;
type AnalysisSource = { lane: AnalysisLane; view: AnalysisView };
export function sampleIndex(time: number, offset: number, sr: number): number {
  const scaled = (time - offset) * sr;
  const lower = Math.floor(scaled);
  return scaled - lower === 0.5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(scaled);
}
export function alignedCurves(curves: Curve[], logarithmic: boolean): uPlot.AlignedData {
  const tables: uPlot.AlignedData[] = curves.map(curve => {
    const start = logarithmic && curve.frequencies[0] === 0 ? 1 : 0;
    return [curve.frequencies.slice(start), curve.values.slice(start)];
  });
  return tables.length ? uPlot.join(tables, tables.map(() => [0])) : [[], []];
}
const palette = ['#4aa3ff', '#3ddc97', '#ffd166', '#ef88c3', '#b4a2ff', '#ff986b'];

export function FrequencyAnalysis({ lanes, views, selectedView, channels, selection, playhead, hoverTime, tfSelection, analyzerSpectra, selectedSpectrum, onSelectSpectrum }: {
  lanes: Lane[]; views: SpectralView[]; selectedView: string; channels: Record<string, number>;
  selection: [number, number] | null; tfSelection?: TfSelection | null; playhead: number; hoverTime: { time: number; laneId: string; channel: number } | null;
  analyzerSpectra: AnalyzerSpectrumResult[]; selectedSpectrum: string; onSelectSpectrum: (id: string) => void;
}) {
  const [method, setMethod] = useState<Method>('frame');
  const [stats, setStats] = useState<Statistic[]>(['mean']);
  const [unit, setUnit] = useState<Unit>('dbfs');
  const [activeOnly, setActiveOnly] = useState(false);
  const [logarithmic, setLogarithmic] = useState(false);
  const [result, setResult] = useState<{ curves: Curve[]; unit: string }>({ curves: [], unit: 'dBFS' });
  const analyzerSpectrum = analyzerSpectra.find(item => item.id === selectedSpectrum);
  const { curves, unit: displayUnit } = analyzerSpectrum ?? result;
  const frequencySelection = analyzerSpectrum ? null : tfSelection;
  const [pending, setPending] = useState(false);
  const plotRoot = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const time = method === 'frame' ? tfSelection?.t0 ?? hoverTime?.time ?? playhead : 0;
  const hoverLane = method === 'frame' ? hoverTime?.laneId : undefined;
  const hoverChannel = method === 'frame' ? hoverTime?.channel : undefined;
  const analysisKey = JSON.stringify(lanes.filter(lane => !tfSelection || lane.id === tfSelection.laneId).flatMap(lane => {
    const view = views.find(item => item.id === (tfSelection?.viewId ?? selectedView) && item.laneId === lane.id) ?? views.find(item => item.laneId === lane.id);
    if (!view) return [];
    return [{ lane: { id: lane.id, name: lane.name, sr: lane.sr, samples: lane.samples, offset: lane.offset, version: lane.version },
      view: { n_fft: view.n_fft, win_length: view.win_length, hop: view.hop, window: view.window, window_param: view.window_param } }];
  }));
  const chosenViews = useMemo(() => JSON.parse(analysisKey) as AnalysisSource[], [analysisKey]);
  const analysisSelection = tfSelection ? [tfSelection.t0, tfSelection.t1] as [number, number] : selection;
  const selectionKey = JSON.stringify(analysisSelection);
  const timeSelection = useMemo(() => JSON.parse(selectionKey) as [number, number] | null, [selectionKey]);
  useEffect(() => {
    if (analyzerSpectrum) return;
    const controller = new AbortController();
    const eligible = chosenViews.filter(({ lane, view }) => {
      const start = timeSelection ? Math.max(timeSelection[0], lane.offset) : lane.offset;
      const end = timeSelection ? Math.min(timeSelection[1], lane.offset + lane.samples / lane.sr) : lane.offset + lane.samples / lane.sr;
      return method === 'frame' ? time >= lane.offset && time < lane.offset + lane.samples / lane.sr : end > start && (method !== 'welch' || Math.min(lane.samples, sampleIndex(end, lane.offset, lane.sr)) - Math.max(0, sampleIndex(start, lane.offset, lane.sr)) >= view.win_length);
    });
    if (!eligible.length) { setResult(old => ({ ...old, curves: [] })); setPending(false); return () => controller.abort(); }
    setPending(true);
    void Promise.all(eligible.map(async ({ lane, view }) => {
      const start = timeSelection ? Math.max(timeSelection[0], lane.offset) : lane.offset;
      const end = timeSelection ? Math.min(timeSelection[1], lane.offset + lane.samples / lane.sr) : lane.offset + lane.samples / lane.sr;
      const params = { t0: method === 'frame' ? time : start, t1: method === 'frame' ? time + 1 / lane.sr : end,
        channel: tfSelection ? tfSelection.channel : hoverLane === lane.id ? hoverChannel : channels[lane.id] ?? 0, method, n_fft: view.n_fft, win_length: view.win_length, hop: view.hop,
        window: method === 'full' ? 'boxcar' : view.window, window_param: view.window_param, stats, unit, active_only: activeOnly };
      const response = await request(`/lanes/${lane.id}/spectrum`, { ...body(params), signal: controller.signal });
      const { arrays, header } = decodeFrame(await response.arrayBuffer());
      const data = arrays as Record<string, FrameArray>;
      const frequencies = Array.from(data.freqs.data); const values = data.values.data;
      const curves = (header.stats as string[]).map((stat, index) => ({ id: `${lane.id}:${stat}`, label: `${lane.name} · ${stat}`, frequencies, values: Array.from(values.slice(index * frequencies.length, (index + 1) * frequencies.length)) }));
      return { curves, unit: { dbfs: 'dBFS', db_per_hz: 'dB/Hz', db: 'dB' }[header.unit as 'dbfs' | 'db_per_hz' | 'db'] };
    })).then(results => { if (!controller.signal.aborted) { setResult({ curves: results.flatMap(item => item.curves), unit: results[0].unit }); setPending(false); } }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setResult(old => ({ ...old, curves: [] })); setPending(false); if (error instanceof NetworkError) notifications.show({ title: 'Request failed', message: error.message, color: 'red' }); else if (!(error instanceof ApiError)) throw error; }
    });
    return () => controller.abort();
  }, [chosenViews, channels, timeSelection, time, method, stats, unit, activeOnly, hoverLane, hoverChannel, tfSelection?.channel, analyzerSpectrum]);
  useEffect(() => {
    const root = plotRoot.current; if (!root || !curves.length) return;
    const data = alignedCurves(curves, logarithmic);
    const options: uPlot.Options = {
      width: Math.max(1, root.clientWidth), height: Math.max(100, root.clientHeight),
      scales: { x: { time: false, distr: logarithmic ? 3 : 1, ...(frequencySelection ? { range: [logarithmic ? Math.max(frequencySelection.f_lo, 1e-6) : frequencySelection.f_lo, frequencySelection.f_hi] as [number, number] } : {}) }, y: { auto: true } },
      axes: [{ label: 'Frequency (Hz)', stroke: '#d7dbe0', grid: { stroke: '#343941', width: 1 } },
        { label: displayUnit, stroke: '#d7dbe0', grid: { stroke: '#343941', width: 1 } }],
      series: [{}, ...curves.map((curve, index) => ({ label: curve.label, stroke: palette[index % palette.length], width: 1.5, spanGaps: true }))],
      legend: { show: true },
    };
    const chart = new uPlot(options, data, root); plot.current = chart;
    const observer = new ResizeObserver(() => chart.setSize({ width: Math.max(1, root.clientWidth), height: Math.max(100, root.clientHeight) }));
    observer.observe(root);
    return () => { observer.disconnect(); chart.destroy(); plot.current = null; };
  }, [curves, logarithmic, displayUnit, frequencySelection?.f_lo, frequencySelection?.f_hi]);
  return <div className="frequency-analysis">
    <div className="frequency-controls">
      {analyzerSpectra.length > 0 && <label>Spectrum source <select value={analyzerSpectrum?.id ?? ''} onChange={event => onSelectSpectrum(event.currentTarget.value)}>
        <option value="">Lane analysis</option>
        {analyzerSpectra.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>}
      {!analyzerSpectrum && <><label>Method <select aria-label="Analysis method" value={method} onChange={event => setMethod(event.target.value as Method)}><option value="frame">Frame</option><option value="welch">Welch</option><option value="full">Full</option></select></label>
      {method === 'welch' && <><label>Unit <select aria-label="Analysis unit" value={unit} onChange={event => setUnit(event.target.value as Unit)}><option value="dbfs">dBFS</option><option value="db_per_hz">dB/Hz</option></select></label><label><input type="checkbox" checked={activeOnly} onChange={event => setActiveOnly(event.target.checked)} /> Active only</label>
        {(['mean', 'median', 'p10', 'p90', 'max'] as Statistic[]).map(stat => <label key={stat}><input type="checkbox" checked={stats.includes(stat)} onChange={event => setStats(old => event.target.checked ? [...old, stat] : old.length > 1 ? old.filter(value => value !== stat) : old)} /> {stat}</label>)}</>}</>}
      <label>Frequency axis <select aria-label="Frequency axis" value={logarithmic ? 'log' : 'linear'} onChange={event => setLogarithmic(event.target.value === 'log')}><option value="linear">Linear</option><option value="log">Log</option></select></label>
      {!analyzerSpectrum && pending && <span role="status">Analyzing…</span>}
    </div>
    <div className="frequency-plot" ref={plotRoot} aria-label="Frequency analysis plot" data-curve-ids={curves.map(curve => curve.id).join(',')} data-unit={displayUnit} data-series-count={curves.length} data-point-count={analyzerSpectrum?.curves.at(0)?.frequencies.length} />
    {!curves.length && !pending && <div className="frequency-empty">No spectrum available for the current time or selection.</div>}
  </div>;
}
