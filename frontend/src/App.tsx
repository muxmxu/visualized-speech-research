import { DockviewComponent, themeDark } from 'dockview';
import type { SerializedDockview } from 'dockview';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { notifications } from '@mantine/notifications';
import { Loader, Modal } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconPlayerRecord, IconRepeat, IconCursorText, IconArrowsMove, IconDots } from '@tabler/icons-react';
import { ApiError, analyze, analyzers, armRecording, audioDevices, body, calibrateRecording, editLane, json, mixdown, notifyApiFailure, request, saveLane, startRecording, stepHistory, stopRecording, token } from './api/client';
import { decodeFrame } from './api/frame';
import type { FrameArray } from './api/frame';
import { isSpectralLane, laneDuration } from './api/types';
import type { AnalyzerCatalog, AnalyzerDefinition, AnalyzerValue, CurveLane, DatasetProgress, WorkspaceLane } from './api/types';
import type { AudioDevices, Directory, EditOperation, Lane, LaneEdit, MixdownRequest, OpenResult, RecordMapping, RecordMeter, RecordPreview, RecordState, RecordingWarning, SaveSubtype, SessionLane, Settings, TensorIntake } from './api/types';
import { drawWaveform, waveformUpdates } from './render/waveform';
import { fit, pan, zoom, formatTime, yToFrequency } from './state/viewport';
import { SpectralLabels, SpectralLane } from './lanes/SpectralLane';
import { AnalyzerLanePlot } from './lanes/AnalyzerLane';
import { ExportSelection } from './lanes/ExportSelection';
import { TfSelection } from './lanes/TfSelection';
import { EditMenu, SelectionActions, type SelectionCommands } from './lanes/SelectionActions';
import type { TfSelection as TfSelectionState } from './state/tfSelection';
import { Display } from './panels/Display';
import { Rir } from './panels/Rir';
import { Dataset } from './panels/Dataset';
import { FrequencyAnalysis } from './panels/FrequencyAnalysis';
import type { AnalyzerSpectrumResult } from './panels/FrequencyAnalysis';
import { Analyzers } from './panels/Analyzers';
import type { AnalyzerFeedback } from './panels/Analyzers';
import { initialRecordSetup, InputMeter, MixdownForm, RecordingPanel, RecordingWave } from './panels/Record';
import type { PreviewFrame, RecordSetup } from './panels/Record';
import { displayUnit, featureAxisLabel, frequencyViewport, isSpectralView, viewForAnnotation, viewForFeature, viewFromPreset, viewScale } from './state/spectralViews';
import { TensorInterpretation } from './panels/TensorInterpretation';
import type { LaneView, Preset, SpectralView, ViewConfig, ViewPatch } from './state/spectralViews';
import { createSpectrogramRenderer, frameValue, melChannel, nearestRow, rowCoordinate, spectralRange } from './render/spectrogram';
import type { SpectralFrame } from './render/spectrogram';
import { colorLut } from './render/colormap';
import type { Viewport } from './state/viewport';
import { Playback } from './audio/playback';
import { exposePlayback, exposeSpectra } from './audio/testHook';

function report(error: unknown) { notifications.show({ title: 'Request failed', message: String(error), color: 'red' }); }
function run(action: Promise<unknown>) { void action.catch(report); }

const idleRecording: RecordState = { type: 'record_state', state: 'idle', mapping: [], start_time: null, notice: null };
const warningLabels: Record<RecordingWarning['type'], string> = {
  input_overflow: 'Input overflow', output_underflow: 'Output underflow',
};
type WorkspaceEvent = RecordState | RecordMeter | DatasetProgress | { type: 'lanes_changed' | 'plugins_changed' } |
  { type: 'error'; error: string; detail: string; traceback: string | null };

type Menu = { x: number; y: number } & ({ kind: 'lane'; lane: Lane } | { kind: 'time'; lane: Lane } | { kind: 'frequency' } | { kind: 'empty' });
const editFields = {
  gain: { title: 'Gain', label: 'Gain (dB)', value: 0 },
  normalize: { title: 'Normalize', label: 'Target peak (dBFS)', value: -1 },
  insert_silence: { title: 'Insert silence', label: 'Duration (seconds)', value: 1 },
  fade_in: { title: 'Fade in', label: 'Curve', value: 'linear' },
  fade_out: { title: 'Fade out', label: 'Curve', value: 'linear' },
} as const;
type EditField = keyof typeof editFields;
type EditDialog = { op: EditField; submit: (params: LaneEdit['params']) => void };

type QueuedTensor = { id: number; tensor: TensorIntake; remember: boolean };
type LaunchResult = TensorIntake | { lanes: SessionLane[]; interpretations: TensorIntake[] };

function WaveCanvas({ lane, view, channel }: { lane: Lane; view: Viewport; channel: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 160 });
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => { setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(canvas); return () => observer.disconnect();
  }, []);
  const current = useRef({ lane, view, size });
  current.current = { lane, view, size };
  const cache = useRef<{ arrays: FrameArray; header: import('./api/frame').FrameHeader } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const updates = useRef<ReturnType<typeof waveformUpdates> | null>(null);
  useEffect(() => {
    cache.current = null;
    const draw = (next: Viewport) => {
      const canvas = ref.current; const data = cache.current;
      if (!canvas || !data) return;
      const { lane: currentLane, size: currentSize } = current.current;
      const dpr = window.devicePixelRatio;
      canvas.width = Math.round(currentSize.width * dpr); canvas.height = Math.round(currentSize.height * dpr);
      const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
      drawWaveform(ctx, data.arrays, data.header, next, currentSize.width, currentSize.height, currentLane.sr, currentLane.offset);
    };
    const scheduler = waveformUpdates(draw, next => {
      controller.current?.abort();
      const active = new AbortController(); controller.current = active;
      const { lane: currentLane, size: currentSize } = current.current;
      const width = Math.max(1, Math.round(currentSize.width * 1.5));
      const t0 = next.t0 - currentSize.width * next.secondsPerPx * 0.25;
      const t1 = next.t0 + currentSize.width * next.secondsPerPx * 1.25;
      void request(`/lanes/${currentLane.id}/waveform?${new URLSearchParams({ t0: String(t0), t1: String(t1), width: String(width), ...(currentLane.channels > 2 ? { channel: String(channel) } : {}) })}`, { signal: active.signal }).then(r => r.arrayBuffer()).then(buffer => {
        if (active.signal.aborted) return;
        const { arrays, header } = decodeFrame(buffer);
        cache.current = { arrays: arrays as FrameArray, header };
        draw(current.current.view);
      }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });
    });
    updates.current = scheduler;
    scheduler.change(current.current.view);
    return () => { scheduler.dispose(); controller.current?.abort(); updates.current = null; };
  }, [lane.id, lane.version, lane.offset, lane.sr, size, channel]);
  useLayoutEffect(() => {
    controller.current?.abort();
    updates.current?.change(view);
  }, [view]);
  return <canvas ref={ref} aria-label={`Waveform ${lane.name}`} />;
}

function LanePlot({ lane, view, onWidth, selection, setSelection, setPlayhead, tool, moveLane, playhead, channel, children, mode, split, setSplit, onHover, commands, working, onTimeGroup, onMenu, showSelection, isSelected }: { lane: WorkspaceLane; view: Viewport; onWidth: (width: number) => void; selection: [number, number] | null; setSelection: (value: [number, number] | null) => void; setPlayhead: (value: number) => void; tool: 'time' | 'move' | 'frequency'; moveLane: (offset: number) => void; playhead: number; channel: number; children: React.ReactNode; mode: SpectralView['mode']; split: number; setSplit: (value: number) => void; onHover: (event: ReactPointerEvent<HTMLDivElement> | null) => void; commands?: SelectionCommands; working: boolean; onTimeGroup: (extend: boolean, grouped: boolean) => void; onMenu: (x: number, y: number) => void; showSelection: boolean; isSelected: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; keepSelection: boolean } | null>(null);
  const handle = useRef<0 | 1 | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => onWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [onWidth]);
  function time(event: { clientX: number; currentTarget: HTMLDivElement }) { return view.t0 + (event.clientX - event.currentTarget.getBoundingClientRect().left) * view.secondsPerPx; }
  return <div ref={root} className="wave" onPointerDown={event => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = time(event);
    const grouped = event.metaKey || event.ctrlKey;
    drag.current = { start, keepSelection: grouped && selection !== null };
    setPlayhead(start);
    if (tool === 'time') {
      onTimeGroup(event.shiftKey, grouped);
      if (!event.shiftKey && !grouped) setSelection(null);
    }
  }} onPointerMove={event => {
    onHover(event);
    if (handle.current !== null && selection) {
      const fixed = selection[1 - handle.current];
      const moving = time(event);
      handle.current = moving < fixed ? 0 : 1;
      setSelection([Math.min(fixed, moving), Math.max(fixed, moving)]);
    } else if (drag.current && tool === 'time' && !drag.current.keepSelection) {
      const start = event.shiftKey && selection ? selection[0] : drag.current.start;
      const finish = time(event);
      setSelection([Math.min(start, finish), Math.max(start, finish)]);
    }
  }} onPointerLeave={() => onHover(null)} onPointerUp={event => {
    if (tool === 'move' && drag.current) moveLane(lane.offset + time(event) - drag.current.start);
    drag.current = null;
    handle.current = null;
  }} onDoubleClick={() => setSelection([lane.offset, lane.offset + laneDuration(lane)])} onContextMenu={event => {
    const at = time(event);
    if (!commands || !showSelection || !selection || at < selection[0] || at > selection[1]) return;
    event.preventDefault(); event.stopPropagation(); onMenu(event.clientX, event.clientY);
  }}>
    {lane.kind === 'audio' && <div className="waveform-part" style={{ height: mode === 'W' ? '100%' : mode === 'S' ? 0 : `${split * 100}%` }}><WaveCanvas lane={lane} view={view} channel={channel} /></div>}{children}
    {mode === 'W+S' && <div className="split-resizer" style={{ top: `${split * 100}%` }} onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) { const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setSplit(Math.max(0.1, Math.min(0.9, (event.clientY - rect.top) / rect.height))); } }} onPointerUp={event => event.stopPropagation()} />}
    <div className="playhead" style={{ position: 'absolute', left: (playhead - view.t0) / view.secondsPerPx, top: 0, bottom: 0, width: 1, background: '#ffd166', pointerEvents: 'none' }} />
    {showSelection && selection && <div className="selection" style={{ left: (selection[0] - view.t0) / view.secondsPerPx, width: (selection[1] - selection[0]) / view.secondsPerPx }}>{commands && isSelected && selection[1] > selection[0] && <SelectionActions commands={commands} time disabled={working} />}{([0, 1] as const).map(index => <div key={index} className={`selection-handle handle-${index}`} onPointerDown={event => { event.stopPropagation(); event.currentTarget.parentElement?.parentElement?.setPointerCapture(event.pointerId); handle.current = index; }} />)}</div>}
  </div>;
}

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => number }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value.toFixed(3));
  useEffect(() => { if (!editing) setDraft(value.toFixed(3)); }, [editing, value]);
  return <input aria-label={label} type="number" step="0.001" value={editing ? draft : value.toFixed(3)}
    onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
    onChange={event => { const text = event.target.value; const number = Number(text); const result = onChange(number); setDraft(result === number ? text : String(result)); }} />;
}

function FrequencyAxis({ config, lane, frame, change }: { config: ViewConfig; lane: SessionLane; frame?: SpectralFrame; change: (patch: ViewPatch) => void }) {
  const drag = useRef<{ y: number; lo: number; hi: number } | null>(null);
  const scale = viewScale(config);
  const isFeature = lane.kind === 'feature';
  const isMel = config.kind === 'audio' && config.transform === 'mel';
  const label = (frequency: number) => frequency >= 1000 ? `${(frequency / 1000).toFixed(frequency % 1000 ? 1 : 0)}k` : String(Math.round(frequency));
  const height = config.kind === 'audio' && config.mode === 'W+S' ? `${config.split * 100}%` : 0;
  const bounds = frequencyViewport(config);
  const packetLabels = (isFeature || isMel) && frame && frame.rows > 0
    ? [...new Set([0, Math.floor((frame.rows - 1) / 2), frame.rows - 1])].flatMap(row => {
      const coordinate = rowCoordinate(frame, row, isFeature);
      const position = (bounds.hi - coordinate) / (bounds.hi - bounds.lo);
      return position >= 0 && position <= 1 ? [{ position, value: frame.f_axis.scale === 'index' ? String(coordinate) : label(frame.row_freqs[row]) }] : [];
    }) : [];
  const description = isFeature ? featureAxisLabel(lane.freq_axis) : isMel ? 'Mel channel frequencies (Hz)' : undefined;
  return <div className="frequency-axis" aria-label={description} title={description}
    onPointerDown={event => { drag.current = { y: event.clientY, lo: config.f_lo, hi: config.f_hi }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      if (!drag.current) return;
      const delta = (event.clientY - drag.current.y) / event.currentTarget.clientHeight;
      const span = drag.current.hi - drag.current.lo;
      if (isFeature) {
        const lo = Math.max(0, Math.min(lane.rows - 1 - span, drag.current.lo + Math.round(delta * (span + 1))));
        change({ f_lo: lo, f_hi: lo + span });
      } else if (scale === 'linear') {
        const lo = Math.max(0, Math.min(lane.sr / 2 - span, drag.current.lo + delta * span));
        change({ f_lo: lo, f_hi: lo + span });
      } else if (config.kind === 'audio') {
        const ratio = drag.current.hi / drag.current.lo;
        const lo = Math.max(Math.max(20, lane.sr / config.n_fft), Math.min(lane.sr / 2 / ratio, drag.current.lo * ratio ** delta));
        change({ f_lo: lo, f_hi: lo * ratio });
      }
    }} onPointerUp={() => { drag.current = null; }}>
    {isFeature || isMel ? <div className="axis-labels packet-axis" style={{ top: height }}>
      <SpectralLabels labels={packetLabels} align="right" />
    </div> : <div className="axis-labels" style={{ top: height }}><span>{label(config.f_hi)}</span><span>{label(scale === 'log' ? Math.sqrt(config.f_lo * config.f_hi) : (config.f_lo + config.f_hi) / 2)}</span><span>{label(config.f_lo)}</span></div>}
  </div>;
}

function OverviewWave({ lane, start, end }: { lane: Lane; start: number; end: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const controller = new AbortController();
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.round(entry.contentRect.width));
      void request(`/lanes/${lane.id}/waveform?${new URLSearchParams({ t0: String(start), t1: String(end), width: String(width) })}`, { signal: controller.signal }).then(r => r.arrayBuffer()).then(buffer => {
        const { arrays, header } = decodeFrame(buffer); const dpr = window.devicePixelRatio;
        canvas.width = width * dpr; canvas.height = 30 * dpr;
        const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
        drawWaveform(ctx, arrays as FrameArray, header, fit(start, end, width), width, 30, lane.sr, lane.offset);
      }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });
    });
    observer.observe(canvas); return () => { controller.abort(); observer.disconnect(); };
  }, [lane, start, end]);
  return <canvas aria-label="Overview waveform" ref={ref} />;
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const dockRef = useRef<DockviewComponent | null>(null);
  const overviewDrag = useRef<{ x: number; view: Viewport; mode: 'move' | 'start' | 'end' } | null>(null);
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({});
  const [lanes, setLanes] = useState<WorkspaceLane[]>([]); const [selected, setSelected] = useState('');
  const [view, setView] = useState<Viewport>({ t0: 0, secondsPerPx: 0.01 }); const [width, setWidth] = useState(600);
  const widthRef = useRef(width); widthRef.current = width;
  const [tool, setTool] = useState<'time' | 'move' | 'frequency'>('time');
  const [tfSelection, setTfSelection] = useState<TfSelectionState | null>(null);
  const showFrequencyMeasurements = tool === 'frequency' || tfSelection !== null;
  const [selection, setSelection] = useState<[number, number] | null>(null); const [playhead, setPlayhead] = useState(0);
  const [timeGroup, setTimeGroup] = useState<string[]>([]);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editDialog, setEditDialog] = useState<EditDialog | null>(null);
  const [saveDialog, setSaveDialog] = useState<{ lane: Lane; as: boolean } | null>(null);
  const [shortcutHelp, setShortcutHelp] = useState(false);
  const [mixdownDialog, setMixdownDialog] = useState<{ interval: [number, number]; sr: number } | null>(null);
  const [devices, setDevices] = useState<AudioDevices | null>(null);
  const [recordSetup, setRecordSetup] = useState(initialRecordSetup);
  const [recordState, setRecordState] = useState(idleRecording);
  const recordStateRef = useRef(idleRecording);
  const recordNotices = useRef(new Set<RecordState['notice']>());
  const [meter, setMeter] = useState<RecordMeter | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<number, PreviewFrame[]>>>({});
  const savedTakeLane = useRef<string | null>(null);
  const operation = useRef(false);
  const recordingTransition = useRef(false);
  const [working, setWorking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rirVisible, setRirVisible] = useState(false);
  const [directory, setDirectory] = useState<Directory | null>(null); const [path, setPath] = useState('~');
  const [tensorIntakes, setTensorIntakes] = useState<QueuedTensor[]>([]);
  const nextTensorId = useRef(0);
  const queueTensors = useCallback((tensors: TensorIntake[], remember: boolean) => {
    const queued = tensors.map(tensor => ({ id: nextTensorId.current++, tensor, remember }));
    setTensorIntakes(old => [...old, ...queued]);
  }, []);
  const [recent, setRecent] = useState<string[]>(() => JSON.parse(localStorage.getItem('vsr-recent') ?? '[]') as string[]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const playback = useRef<Playback | null>(null);
  const [playing, setPlaying] = useState(false); const [loop, setLoop] = useState(false);
  const [channels, setChannels] = useState<Record<string, number>>({});
  const [views, setViews] = useState<LaneView[]>([]);
  const [catalog, setCatalog] = useState<AnalyzerCatalog | null>(null);
  const [datasetProgress, setDatasetProgress] = useState<Partial<Record<string, DatasetProgress>>>({});
  const [analyzerFeedback, setAnalyzerFeedback] = useState<AnalyzerFeedback | null>(null);
  const [analyzerPending, setAnalyzerPending] = useState(false);
  const [analyzerSpectra, setAnalyzerSpectra] = useState<AnalyzerSpectrumResult[]>([]);
  const [selectedSpectrum, setSelectedSpectrum] = useState('');
  const [hiddenOverlays, setHiddenOverlays] = useState<string[]>([]);
  const [analyzerReveal, setAnalyzerReveal] = useState<string | null>(null);
  const laneOrder = useRef(lanes); laneOrder.current = lanes;
  const [selectedView, setSelectedView] = useState('');
  const [presets, setPresets] = useState<Record<number, Record<string, Preset>>>({});
  const loading = useRef(new Set<string>());
  const plotHost = useRef<HTMLDivElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createSpectrogramRenderer> | null>(null);
  const redraw = useRef<() => void>(() => undefined);
  const frames = useRef(new Map<string, { frame: SpectralFrame; element: HTMLElement }>());
  const [frameRevision, setFrameRevision] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [hover, setHover] = useState('');
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(false);
  const finishExport = useCallback(() => { exportRef.current = false; setExporting(false); }, []);
  const [analysisHover, setAnalysisHover] = useState<{ time: number; laneId: string; channel: number } | null>(null);
  const hoverFrame = useRef<number | null>(null);
  const queueAnalysisHover = (value: { time: number; laneId: string; channel: number } | null) => {
    if (exportRef.current) return;
    if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = requestAnimationFrame(() => { hoverFrame.current = null; setAnalysisHover(value); });
  };
  useEffect(() => () => { if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current); }, []);
  const onFrame = useCallback((id: string, channel: number, frame: SpectralFrame | null, element: HTMLElement | null) => {
    const key = `${id}:${channel}`;
    const previous = frames.current.get(key); if (previous && previous.frame !== frame) renderer.current?.release(previous.frame);
    if (frame && element) frames.current.set(key, { frame, element }); else frames.current.delete(key);
    setFrameRevision(old => old + 1);
  }, []);
  useEffect(() => {
    const owned = new Map(lanes.filter(lane => lane.kind !== 'curve' || !lane.overlay).map(lane => [lane.id, lane]));
    setViews(old => {
      const next = old.filter(item => owned.get(item.laneId)?.kind === item.kind)
        .sort((a, b) => lanes.findIndex(lane => lane.id === a.laneId) - lanes.findIndex(lane => lane.id === b.laneId));
      return next.length === old.length && next.every((item, index) => item === old[index]) ? old : next;
    });
    for (const lane of owned.values()) {
      if (views.some(item => item.laneId === lane.id && item.kind === lane.kind) || loading.current.has(lane.id)) continue;
      loading.current.add(lane.id);
      const addView = (next: LaneView) => {
        loading.current.delete(lane.id);
        if (!laneOrder.current.some(item => item.id === lane.id)) return;
        setViews(old => old.some(item => item.laneId === lane.id) ? old : [...old, next].sort((a, b) => laneOrder.current.findIndex(item => item.id === a.laneId) - laneOrder.current.findIndex(item => item.id === b.laneId)));
        setSelectedView(old => old || next.id); setSelected(old => old || lane.id);
      };
      if (lane.kind === 'feature') addView(viewForFeature(lane));
      else if (!isSpectralLane(lane)) addView(viewForAnnotation(lane));
      else run(json<Record<string, Preset>>(`/presets?sr=${lane.sr}`).then(data => {
        setPresets(old => ({ ...old, [lane.sr]: data }));
        addView(viewFromPreset(lane.id, data.analysis));
      }));
    }
  }, [lanes, views]);
  useEffect(() => {
    setTfSelection(old => old && (!lanes.some(lane => lane.id === old.laneId) || !views.some(item => item.id === old.viewId && item.laneId === old.laneId)) ? null : old);
  }, [lanes, views]);
  useEffect(() => {
    if (views.length && !views.some(item => item.id === selectedView)) {
      setSelectedView(views[0].id); setSelected(views[0].laneId);
    }
  }, [views, selectedView]);
  useLayoutEffect(() => {
    const list = plotHost.current?.querySelector<HTMLElement>('.lane-list'); if (!list) return;
    const measure = () => setScrollbarWidth(list.offsetWidth - list.clientWidth);
    measure(); const observer = new ResizeObserver(measure); observer.observe(list);
    return () => observer.disconnect();
  }, [targets, views]);
  const activeView = views.find(item => item.id === selectedView);
  const audioLanes = lanes.filter(lane => lane.kind === 'audio');
  const audioViews = views.filter(config => config.kind === 'audio');
  const updateView = useCallback((id: string, patch: ViewPatch) => setViews(old => old.map(item => item.id === id ? { ...item, ...patch } : item)), []);
  useEffect(() => {
    if (!glCanvas.current) return;
    renderer.current = createSpectrogramRenderer(glCanvas.current);
    return () => { renderer.current?.dispose(); renderer.current = null; };
  }, [targets]);
  useLayoutEffect(() => {
    const root = plotHost.current;
    if (!root) return;
    const draw = () => {
      const render = renderer.current; if (!render) return;
      const origin = root.getBoundingClientRect(); render.clear(origin.width, origin.height);
      const list = (root.querySelector('.lane-list') as HTMLElement).getBoundingClientRect();
      for (const [key, item] of frames.current) {
        const config = views.find(value => key.startsWith(`${value.id}:`));
        if (!config || !isSpectralView(config) || !item.element.isConnected) continue;
        const rect = item.element.getBoundingClientRect();
        const left = Math.max(rect.left, list.left, origin.left); const top = Math.max(rect.top, list.top, origin.top);
        const right = Math.min(rect.right, list.right, origin.right); const bottom = Math.min(rect.bottom, list.bottom, origin.bottom);
        if (right <= left || bottom <= top) continue;
        const packets = [...frames.current].filter(([key]) => key.startsWith(`${config.id}:`)).map(([, value]) => value.frame);
        render.draw(item.frame, view, rect, new DOMRect(left, top, right-left, bottom-top), origin,
          frequencyViewport(config), spectralRange(config.range, packets, item.frame.dtype === 'f32'),
          colorLut(config.cmap), config.filter, config.kind === 'feature');
      }
    };
    redraw.current = draw; draw();
  }, [targets, views, view, frameRevision]);
  useEffect(() => {
    const root = plotHost.current; if (!root) return;
    const draw = () => redraw.current();
    const observer = new ResizeObserver(draw); observer.observe(root);
    root.addEventListener('scroll', draw, true); window.addEventListener('resize', draw);
    return () => { observer.disconnect(); root.removeEventListener('scroll', draw, true); window.removeEventListener('resize', draw); };
  }, [targets]);
  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') exposeSpectra(() => Object.fromEntries([...frames.current].map(([key, value]) => [key, value.frame])));
  }, []);
  useEffect(() => { if (playback.current) run(playback.current.update(lanes.filter(lane => lane.kind === 'audio'), channels)); }, [lanes, channels]);
  useEffect(() => { playback.current?.setLoop(loop); }, [loop]);
  useEffect(() => () => { playback.current?.stop(); void playback.current?.context.close(); }, []);
  const refresh = useCallback(async () => { const result = await json<{ lanes: WorkspaceLane[] }>('/session'); setLanes(result.lanes); }, []);
  const refreshAnalyzers = useCallback(async () => { setCatalog(await analyzers()); }, []);
  const acceptRecordState = useCallback((state: RecordState) => {
    const previous = recordStateRef.current;
    recordStateRef.current = state;
    setRecordState(state);
    if (state.state === 'idle') setMeter(null);
    if (state.state !== 'recording') {
      setPreviews({});
      recordNotices.current.clear();
    } else if (previous.state !== 'recording') {
      setPlayhead(state.start_time as number);
    }
    if (!state.notice || recordNotices.current.has(state.notice)) return;
    recordNotices.current.add(state.notice);
    notifications.show({
      color: 'yellow', autoClose: false,
      title: state.notice === 'microphone_permission' ? 'Check microphone permission' : 'Input and output clocks may drift',
      message: state.notice === 'microphone_permission'
        ? 'The first second of input was silent. Check the recording device and microphone permission on the server.'
        : 'The input and output devices are different. Their clocks may drift during a long overdub.',
    });
  }, []);
  const browse = useCallback(async (value: string) => { const result = await json<Directory>(`/fs/list?path=${encodeURIComponent(value)}`); setDirectory(result); setPath(result.path); }, []);
  useEffect(() => {
    const launchId = new URLSearchParams(location.hash.slice(1)).get('open');
    if (launchId === null) run(refresh());
    else {
      history.replaceState(history.state, '', location.pathname + location.search);
      run(json<LaunchResult>('/open', {
        ...body({ paths: [] }), headers: { 'Content-Type': 'application/json', 'X-VSR-Open-Launch': launchId },
      }).finally(refresh).then(result => {
        queueTensors('needs_interpretation' in result ? [result] : result.interpretations, false);
      }));
    }
    run(browse('~')); run(json<Settings>('/settings').then(setSettings));
    run(audioDevices().then(result => {
      setDevices(result);
      const input = result.devices.find(device => device.id === result.default_input);
      if (input) setRecordSetup(old => ({ ...old, sr: Math.round(input.default_samplerate) }));
    }));
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?token=${encodeURIComponent(token)}`);
    socket.binaryType = 'arraybuffer';
    socket.onmessage = event => {
      const data: unknown = event.data;
      if (data instanceof ArrayBuffer) {
        const origin = recordStateRef.current.start_time;
        if (origin === null) return;
        const { arrays, header } = decodeFrame(data);
        if (header.type !== 'record_preview') return;
        const packet = arrays as FrameArray;
        const frame: PreviewFrame = { ...header as unknown as RecordPreview, shape: packet.shape, data: packet.data as Float32Array };
        setPreviews(old => ({ ...old, [frame.target]: [...(old[frame.target] ?? []), frame] }));
        const position = origin + (frame.first_sample + frame.sample_count) / frame.sr;
        setPlayhead(position);
        setView(old => {
          const span = widthRef.current * old.secondsPerPx;
          return span > 0 && (position < old.t0 || position > old.t0 + span) ? { ...old, t0: Math.floor(position / span) * span } : old;
        });
        return;
      }
      const message = JSON.parse(data as string) as WorkspaceEvent;
      switch (message.type) {
        case 'lanes_changed': run(refresh()); break;
        case 'plugins_changed': run(refreshAnalyzers()); break;
        case 'job_progress':
          setDatasetProgress(old => ({ ...old, [message.id]: message }));
          if (message.error) notifyApiFailure(message.error);
          break;
        case 'record_state': acceptRecordState(message); break;
        case 'record_meter': setMeter(message); break;
        case 'error':
          notifications.show({
            title: message.error, message: message.traceback ? `${message.detail}\n${message.traceback}` : message.detail,
            color: 'red', autoClose: false,
          });
          break;
      }
    };
    return () => socket.close();
  }, [refresh, browse, queueTensors, acceptRecordState, refreshAnalyzers]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const dock = new DockviewComponent(element, { theme: themeDark, createComponent: options => { const panel = document.createElement('div'); panel.style.height = '100%'; return { element: panel, init: () => { setTargets(old => ({ ...old, [options.name]: panel })); } }; } });
    dockRef.current = dock;
    const saved = localStorage.getItem('vsr-layout');
    if (saved) {
      dock.fromJSON(JSON.parse(saved) as SerializedDockview);
      if (!dock.api.getPanel('display')) {
        const inspector = dock.api.getPanel('properties') ?? dock.api.getPanel('settings');
        const previous = inspector?.group.activePanel;
        dock.addPanel({ id: 'display', component: 'display', title: 'Display', position: inspector ? { referencePanel: inspector.id, direction: 'within' } : { referencePanel: 'lanes', direction: 'right' } });
        previous?.api.setActive(); localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
      }
    }
    else {
      dock.addPanel({ id: 'lanes', component: 'lanes', title: 'Lanes' });
      dock.addPanel({ id: 'files', component: 'files', title: 'Files', position: { referencePanel: 'lanes', direction: 'left' }, initialWidth: Math.max(120, Math.min(240, Math.round(element.clientWidth * 0.18))) });
      dock.addPanel({ id: 'properties', component: 'properties', title: 'Properties', position: { referencePanel: 'lanes', direction: 'right' }, initialWidth: Math.max(120, Math.min(240, Math.round(element.clientWidth * 0.18))) });
      dock.addPanel({ id: 'settings', component: 'settings', title: 'Settings', position: { referencePanel: 'properties', direction: 'within' } });
      dock.addPanel({ id: 'display', component: 'display', title: 'Display', position: { referencePanel: 'properties', direction: 'within' } });
    }
    if (!dock.api.getPanel('dataset')) {
      dock.addPanel({ id: 'dataset', component: 'dataset', title: 'Dataset', inactive: true,
        position: { referencePanel: 'lanes', direction: 'within' } });
      localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
    }
    if (!dock.api.getPanel('analyzers')) {
      const previous = dock.api.getPanel('display')?.group.activePanel;
      dock.addPanel({ id: 'analyzers', component: 'analyzers', title: 'Analyzers', position: { referencePanel: 'display', direction: 'within' } });
      previous?.api.setActive();
      localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
    }
    if (!dock.api.getPanel('frequency-analysis')) {
      dock.addPanel({ id: 'frequency-analysis', component: 'frequency-analysis', title: 'Frequency Analysis', position: { referencePanel: 'lanes', direction: 'below' }, initialHeight: 220 });
      localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
    }
    if (!dock.api.getPanel('record')) {
      const previous = dock.api.getPanel('frequency-analysis')?.group.activePanel;
      dock.addPanel({ id: 'record', component: 'record', title: 'Record', position: { referencePanel: 'frequency-analysis', direction: 'within' } });
      previous?.api.setActive();
      localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
    }
    const rir = dock.api.getPanel('rir') ?? dock.addPanel({ id: 'rir', component: 'rir', title: 'RIR', inactive: true,
      position: { referencePanel: 'frequency-analysis', direction: 'within' } });
    setRirVisible(rir.api.isVisible);
    const rirVisibility = rir.api.onDidVisibilityChange(({ isVisible }) => setRirVisible(isVisible));
    localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
    const nameTabs = () => element.querySelectorAll<HTMLElement>('.dv-default-tab-content').forEach(tab => { tab.title = tab.innerText; });
    nameTabs();
    const listener = dock.onDidLayoutChange(() => { nameTabs(); localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON())); });
    const refreshCatalogForPanel = (id: string | undefined) => {
      if (id === 'analyzers' || id === 'dataset') run(refreshAnalyzers());
    };
    const activePanel = dock.api.onDidActivePanelChange(({ panel }) => refreshCatalogForPanel(panel?.id));
    refreshCatalogForPanel(dock.api.activePanel?.id);
    const resize = new ResizeObserver(() => dock.layout(element.clientWidth, element.clientHeight)); resize.observe(element);
    return () => { resize.disconnect(); activePanel.dispose(); rirVisibility.dispose(); listener.dispose(); dockRef.current = null; dock.dispose(); };
  }, [refreshAnalyzers]);
  const start = Math.min(0, ...lanes.map(lane => lane.offset));
  const end = Math.max(0.001, ...lanes.map(lane => lane.offset + laneDuration(lane)));
  const extent = end - start;
  const active = lanes.find(lane => lane.id === selected);
  const longest = audioLanes.reduce<Lane | undefined>((best, lane) => !best || lane.samples / lane.sr > best.samples / best.sr ? lane : best, undefined);
  const patch = (id: string, values: object) => run(request(`/lanes/${id}`, { ...body(values), method: 'PATCH' }));
  const remember = (file: string) => setRecent(old => {
    const next = [file, ...old.filter(item => item !== file)].slice(0, 10);
    localStorage.setItem('vsr-recent', JSON.stringify(next));
    return next;
  });
  const acceptOpen = (result: OpenResult, file?: string) => {
    if ('needs_interpretation' in result) queueTensors([result], true);
    else if (file) remember(file);
  };
  const open = async (file: string) => acceptOpen(await json<OpenResult>('/open', body({ paths: [file] })), file);
  const openDataset = () => {
    const dock = dockRef.current;
    if (!dock) return;
    const panel = dock.api.getPanel('dataset') ?? dock.addPanel({ id: 'dataset', component: 'dataset', title: 'Dataset',
      position: { referencePanel: 'lanes', direction: 'within' } });
    panel.api.setActive();
  };
  const closeTensor = () => setTensorIntakes(old => old.slice(1));
  const currentTensor = tensorIntakes.at(0);
  const reorder = (index: number, direction: number) => { const ids = lanes.map(lane => lane.id); const other = index + direction; if (other < 0 || other >= ids.length) return; [ids[index], ids[other]] = [ids[other], ids[index]]; run(json('/lanes/reorder', body({ ids }))); };
  const togglePlay = () => {
    if (recordStateRef.current.state === 'recording' || recordingTransition.current) return;
    if (playback.current?.playing) { const position = playback.current.position; playback.current.stop(); setPlayhead(position); setPlaying(false); return; }
    if (!audioLanes.length) return;
    const player = playback.current ?? new Playback(); playback.current = player;
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') exposePlayback(player);
    const start = tfSelection?.t0 ?? (selection ? selection[0] : playhead); const finish = tfSelection?.t1 ?? (selection ? selection[1] : end);
    const selectedLane = tfSelection ? audioLanes.find(lane => lane.id === tfSelection.laneId) : undefined;
    const selectedConfig = tfSelection ? audioViews.find(item => item.id === tfSelection.viewId) : undefined;
    if (tfSelection && (!selectedLane || !selectedConfig)) return;
    const audible = selectedLane ? [selectedLane] : audioLanes;
    const mask = tfSelection && selectedConfig ? { selection: tfSelection, view: selectedConfig } : undefined;
    run(player.play(audible, start, finish, loop, channels, (position, active) => { setPlayhead(position); setPlaying(active); setView(old => { const span = widthRef.current * old.secondsPerPx; return span > 0 && (position < old.t0 || position > old.t0 + span) ? { ...old, t0: Math.floor(position / span) * span } : old; }); }, undefined, undefined, mask));
  };
  const activeAudio = active?.kind === 'audio' ? active : undefined;
  const hasTimeSelection = selection !== null && selection[1] > selection[0];
  const dismissMenu = () => setMenu(null);
  const perform = (action: () => Promise<unknown>) => {
    if (operation.current) return;
    operation.current = true; setWorking(true);
    const timer = window.setTimeout(() => setBusy(true), 300);
    void action().catch((error: unknown) => { if (!(error instanceof ApiError)) report(error); }).finally(() => {
      window.clearTimeout(timer); operation.current = false; setWorking(false); setBusy(false);
    });
  };
  const analyzerLane = active && isSpectralLane(active) ? active : undefined;
  const analyzerSelection: [number, number] | null = tfSelection && tfSelection.laneId === analyzerLane?.id
    ? [tfSelection.t0, tfSelection.t1] : selection;
  const analyzerInterval = analyzerSelection && analyzerSelection[1] > analyzerSelection[0] ? analyzerSelection : null;
  const analyzerChannel = analyzerLane && (tfSelection?.laneId === analyzerLane.id ? tfSelection.channel : channels[analyzerLane.id]);
  const executeAnalyzer = (definition: AnalyzerDefinition, params: Record<string, AnalyzerValue>, channel?: number) => {
    if (!analyzerLane) return;
    const lane = analyzerLane;
    perform(async () => {
      setAnalyzerPending(true);
      try {
        const result = await analyze(definition.id, { lane: lane.id, params,
          ...(analyzerInterval ? { t0: analyzerInterval[0], t1: analyzerInterval[1] } : {}),
          ...(lane.kind === 'audio' && channel !== undefined ? { channel } : {}),
        });
        if (result.kind === 'spectrum') {
          const id = `${lane.id}:${definition.id}`;
          const frequencies = Array.from(result.frequencies);
          const curves = result.result.labels.map((label, i) => ({
            id: `${id}:${i}`, label, frequencies,
            values: Array.from(result.values.subarray(i * frequencies.length, (i + 1) * frequencies.length)),
          }));
          const spectrum = { id, lane: lane.id, label: `${definition.label} · ${lane.name}`, unit: result.result.unit, curves };
          setAnalyzerSpectra(old => [...old.filter(item => item.id !== id), spectrum]);
          setSelectedSpectrum(id);
          setAnalyzerFeedback({ lane: lane.id, analyzer: definition.id, message: 'Spectrum opened in Frequency Analysis.' });
          dockRef.current?.api.getPanel('frequency-analysis')?.api.setActive();
        } else if (result.kind === 'scalars') {
          setAnalyzerFeedback({ lane: lane.id, analyzer: definition.id, message: '', scalars: result.result });
        } else {
          setAnalyzerFeedback({ lane: lane.id, analyzer: definition.id, message: 'Result added to Lanes.' });
          setAnalyzerReveal(result.lanes[0]);
        }
      } finally {
        setAnalyzerPending(false);
      }
    });
  };
  useLayoutEffect(() => {
    const output = lanes.find(lane => lane.id === analyzerReveal);
    if (!output) return;
    const outputId = output.kind === 'curve' && output.overlay ? output.parent : output.id;
    if (outputId === null) return;
    const row = plotHost.current?.querySelector(`[data-lane-id="${CSS.escape(outputId)}"]`);
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
      setAnalyzerReveal(null);
    }
  }, [analyzerReveal, lanes, views]);
  const { state: takeState, mapping, start_time: takeOrigin } = recordState;
  const recording = takeState === 'recording';
  const input = devices?.devices.find(device => device.id === (recordSetup.input_device ?? devices.default_input) && device.max_input_channels > 0);
  const output = devices?.devices.find(device => device.id === (recordSetup.output_device ?? devices.default_output) && device.max_output_channels > 0);
  const canRecord = Boolean((mapping.length ? input : devices?.devices.find(device => device.id === devices.default_input && device.max_input_channels > 0))
    && (!recordSetup.overdub || output));
  const arm = async (next: RecordMapping[], setup = recordSetup) => {
    const { input_device, sr, blocksize } = setup;
    acceptRecordState(await armRecording({ input_device, sr, blocksize, mapping: next }));
  };
  const changeSetup = (setup: RecordSetup) => {
    if (setup.input_device !== recordSetup.input_device && mapping.length) {
      const device = devices?.devices.find(item => item.id === (setup.input_device ?? devices.default_input));
      const next = mapping.filter(target => target.channels.every(channel => channel < (device?.max_input_channels ?? 0)));
      perform(async () => {
        await arm(next, setup);
        setRecordSetup(setup);
      });
    } else setRecordSetup(setup);
  };
  const toggleArm = (lane: Lane) => {
    const armed = mapping.some(target => target.lane === lane.id);
    dockRef.current?.api.getPanel('record')?.api.setActive();
    const channel = Math.min(input?.max_input_channels ? input.max_input_channels - 1 : 0, channels[lane.id] ?? 0);
    perform(() => arm(armed ? mapping.filter(target => target.lane !== lane.id) : [...mapping, { lane: lane.id, channels: [channel] }]));
  };
  const calibrate = () => perform(async () => {
    const { input_device, output_device, sr, blocksize } = recordSetup;
    const result = await calibrateRecording({ input_device, output_device, sr, blocksize });
    setRecordSetup(old => ({ ...old, latency_ms: result.latency_ms }));
  });
  const stopTake = () => perform(async () => {
    const { lanes: recorded } = await stopRecording();
    setPreviews({});
    setLanes(old => [...old.map(lane => recorded.find(next => next.id === lane.id) ?? lane), ...recorded.filter(lane => !old.some(existing => existing.id === lane.id))]);
    savedTakeLane.current = recorded[0].id;
    const warnings = recorded.flatMap(lane => lane.record_warnings.map(warning => `${lane.name} · ${warning.time_s.toFixed(3)} s · ${warningLabels[warning.type]}`));
    if (warnings.length) notifications.show({ title: 'Recording warnings', message: warnings.join('\n'), color: 'yellow', autoClose: false });
  });
  const toggleRecord = () => {
    if (recording) { stopTake(); return; }
    if (!canRecord) return;
    perform(async () => {
      recordingTransition.current = true;
      const start_time = playback.current?.playing ? playback.current.position : playhead;
      playback.current?.stop(start_time);
      setPlaying(false);
      setPlayhead(start_time);
      const { input_device, output_device, sr, blocksize, subtype, overdub, latency_ms } = recordSetup;
      try {
        acceptRecordState(await startRecording({
          input_device: mapping.length ? input_device : null, sr, blocksize, subtype, mapping, overdub, latency_ms, start_time,
          ...(overdub && output_device !== null ? { output_device } : {}),
        }));
      } finally {
        recordingTransition.current = false;
      }
    });
  };
  useLayoutEffect(() => {
    const id = savedTakeLane.current;
    if (id === null) return;
    const recorded = views.find(item => item.laneId === id);
    if (!recorded) return;
    savedTakeLane.current = null;
    setSelected(id);
    setSelectedView(recorded.id);
    plotHost.current?.querySelector(`[data-view-id="${CSS.escape(recorded.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  });
  const newPreviews = Object.entries(previews).filter(([target]) => mapping[Number(target)]?.lane == null);
  const firstNewPreview = newPreviews.at(0)?.[0];
  useLayoutEffect(() => {
    if (firstNewPreview !== undefined) plotHost.current?.querySelector('.record-new-preview')?.scrollIntoView({ block: 'nearest' });
  }, [firstNewPreview]);
  const mixInterval = tfSelection && tfSelection.t1 > tfSelection.t0 ? [tfSelection.t0, tfSelection.t1] as [number, number]
    : hasTimeSelection ? selection : [start, end] as [number, number];
  const openMixdown = () => setMixdownDialog({ interval: mixInterval, sr: activeAudio?.sr ?? audioLanes[0].sr });
  const writeMix = (settings: MixdownRequest) => perform(async () => {
    const result = await mixdown(settings);
    setMixdownDialog(null);
    notifications.show({
      title: result.clipping ? 'Mixdown exceeds 0 dBFS' : 'Mixdown saved',
      message: result.path, color: result.clipping ? 'yellow' : 'green', autoClose: !result.clipping,
    });
  });
  const edit = (lane: Lane, op: EditOperation, params?: LaneEdit['params']) => {
    const requiresTime = op === 'delete' || op === 'cut' || op === 'trim' || op === 'spectral_extract';
    if (requiresTime && !hasTimeSelection) return;
    const insertion = op === 'paste' || op === 'insert_silence';
    const bounds = insertion ? { t0: playhead } : hasTimeSelection ? { t0: selection[0], t1: selection[1] } : {};
    const targets = timeGroup.includes(lane.id) ? audioLanes.filter(item => timeGroup.includes(item.id)) : [lane];
    const laneIds = targets.slice(1).map(item => item.id);
    const channel = lane.channels > 2 && laneIds.length === 0 && op !== 'mixdown_channels' ? channels[lane.id] ?? 0 : undefined;
    perform(() => editLane(targets[0].id, { op, ...bounds, channel, params: laneIds.length ? { ...params, lane_ids: laneIds } : params }));
  };
  const editSpectrum = (op: 'spectral_attenuate' | 'spectral_extract', gain_db?: number | '-inf') => {
    if (!tfSelection) return;
    const config = audioViews.find(item => item.id === tfSelection.viewId);
    if (!config) return;
    const { laneId, channel, t0, t1, f_lo, f_hi } = tfSelection;
    const { n_fft, win_length, window, window_param } = config;
    perform(() => editLane(laneId, { op, t0, t1, channel, params: { f_lo, f_hi, n_fft, win_length, window, window_param, gain_db } }));
  };
  const frequencyCommands: SelectionCommands = {
    play: togglePlay, remove: () => editSpectrum('spectral_attenuate', '-inf'),
    gain: db => editSpectrum('spectral_attenuate', db), extract: () => editSpectrum('spectral_extract'),
  };
  const timeCommands = (lane: Lane): SelectionCommands => ({
    play: togglePlay, remove: () => edit(lane, 'delete'), gain: db => edit(lane, 'gain', { gain_db: db }),
    extract: () => edit(lane, 'spectral_extract'),
  });
  const step = (direction: 'undo' | 'redo', lane = activeAudio ?? audioLanes.at(0)) => {
    if (lane) perform(() => stepHistory(lane.id, direction));
  };
  const startSave = (lane: Lane, as = false) => {
    const ordinary = /^(?:[\\/]|[a-z]:[\\/]).*\.(wav|flac)$/i.test(lane.source);
    const unique = audioLanes.filter(item => item.source === lane.source).length === 1;
    setSaveDialog({ lane, as: as || !ordinary || !unique });
  };
  const save = (lane: Lane, subtype: SaveSubtype, destination?: string) => perform(async () => {
    try {
      await saveLane(lane.id, subtype, destination);
      setSaveDialog(null);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 400 || destination !== undefined) throw error;
      setSaveDialog({ lane, as: true });
    }
  });
  const zoomSelection = (frequency: boolean) => {
    if (frequency && tfSelection) setView(fit(tfSelection.t0, tfSelection.t1, width));
    else if (hasTimeSelection) setView(fit(selection[0], selection[1], width));
  };
  const menuButton = (label: string, action: () => void, shortcut?: string, disabled = false) =>
    <button title={shortcut ? `${label} (${shortcut})` : label} disabled={disabled} onClick={action}>{label}</button>;
  const showEditDialog = (lane: Lane, op: EditField) => setEditDialog({ op, submit: params => edit(lane, op, params) });
  const renderMenu = (current: Menu) => {
    const frequency = current.kind === 'frequency';
    const lane = 'lane' in current ? current.lane : activeAudio ?? audioLanes.at(0);
    const selectionMenu = frequency || current.kind === 'time';
    let items: React.ReactNode;
    if (selectionMenu) {
      const commands = frequency ? frequencyCommands : timeCommands(current.lane);
      const silence = frequency ? commands.remove : () => edit(current.lane, 'silence');
      const gain = frequency ? () => setEditDialog({ op: 'gain', submit: params => editSpectrum('spectral_attenuate', params?.gain_db) }) : () => showEditDialog(current.lane, 'gain');
      items = <>{menuButton('Play', commands.play, 'Space')}
        {menuButton('Delete', commands.remove, 'Delete / Backspace')}
        {menuButton('Gain…', gain)}{menuButton('Silence', silence)}
        {menuButton('Extract to new lane', commands.extract)}
        {menuButton('Show in Frequency Analysis', () => dockRef.current?.api.getPanel('frequency-analysis')?.api.setActive())}
        {menuButton('Zoom to selection', () => zoomSelection(frequency), 'Z')}</>;
    } else {
      items = <>{menuButton('Undo', () => step('undo', lane), 'Ctrl/Cmd+Z', !lane)}
        {menuButton('Redo', () => step('redo', lane), 'Ctrl/Cmd+Shift+Z', !lane)}
        {lane && <>
          {current.kind === 'lane' && <>
            {menuButton('Cut', () => edit(lane, 'cut'), 'Ctrl/Cmd+X', !hasTimeSelection)}
            {menuButton('Copy', () => edit(lane, 'copy'), 'Ctrl/Cmd+C')}
          </>}
          {menuButton('Paste', () => edit(lane, 'paste'), 'Ctrl/Cmd+V')}
          {current.kind === 'lane' && <>
            {menuButton('Delete', () => timeCommands(lane).remove(), 'Delete / Backspace', !hasTimeSelection)}
            {menuButton('Trim to selection', () => edit(lane, 'trim'), undefined, !hasTimeSelection)}
            {menuButton('Silence', () => edit(lane, 'silence'))}
            {menuButton('Insert silence…', () => showEditDialog(lane, 'insert_silence'))}
            {menuButton('Gain…', () => showEditDialog(lane, 'gain'))}
            {menuButton('Normalize…', () => showEditDialog(lane, 'normalize'))}
            {menuButton('Fade in…', () => showEditDialog(lane, 'fade_in'))}
            {menuButton('Fade out…', () => showEditDialog(lane, 'fade_out'))}
            {menuButton('Invert polarity', () => edit(lane, 'invert'))}
            {menuButton('Mix down channels to mono', () => edit(lane, 'mixdown_channels'))}
            {menuButton('Extract to new lane', () => timeCommands(lane).extract(), undefined, !hasTimeSelection)}
            {menuButton('Save…', () => startSave(lane), 'Ctrl/Cmd+S')}
            {menuButton('Save As…', () => startSave(lane, true), 'Ctrl/Cmd+Shift+S')}
          </>}
        </>}
        {current.kind === 'empty' && <>
          {menuButton('Show all', () => setView(fit(start, end, width)), '0')}
          {menuButton('Open Dataset', openDataset)}
        </>}
      </>;
    }
    return <EditMenu x={current.x} y={current.y} dismiss={dismissMenu}>{items}
      {menuButton('Mixdown…', openMixdown, undefined, !audioLanes.length || working)}
    </EditMenu>;
  };
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.edit-menu')) setMenu(null);
    };
    window.addEventListener('pointerdown', dismiss, true);
    return () => window.removeEventListener('pointerdown', dismiss, true);
  }, [menu]);
  useLayoutEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissMenu();
      if (tensorIntakes.length || editDialog || saveDialog || mixdownDialog || shortcutHelp || exporting || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        if (key === 'z') { event.preventDefault(); step(event.shiftKey ? 'redo' : 'undo'); }
        if (activeAudio && (key === 'x' || key === 'c' || key === 'v')) {
          event.preventDefault(); edit(activeAudio, key === 'x' ? 'cut' : key === 'c' ? 'copy' : 'paste');
        }
        if (key === 's' && activeAudio) { event.preventDefault(); startSave(activeAudio, event.shiftKey); }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (tfSelection) frequencyCommands.remove();
        else if (activeAudio) timeCommands(activeAudio).remove();
      }
      if (event.key === '?') setShortcutHelp(true);
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.key.toLowerCase() === 'l') setLoop(value => !value);
      if (event.key === '=' || event.key === '+') setView(v => zoom(v, width / 2, 0.5));
      if (event.key === '-') setView(v => zoom(v, width / 2, 2));
      if (event.key === '0') setView(fit(start, end, width));
      if (key === 'z') zoomSelection(tfSelection !== null);
      if (event.key.toLowerCase() === 't') setTool('time');
      if (event.key.toLowerCase() === 'v') setTool('move');
      if (event.key.toLowerCase() === 'e') setTool('frequency');
      if (event.key === 'Home') setPlayhead(0);
      if (event.key === 'End') setPlayhead(end);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  useEffect(() => {
    if (!Object.hasOwn(targets, 'lanes')) return;
    const element = targets.lanes;
    const wheel = (event: WheelEvent) => {
      if (event.altKey) {
        const row = (event.target as HTMLElement).closest<HTMLElement>('.lane');
        const config = views.find(item => item.id === row?.dataset.viewId);
        const lane = lanes.find(item => item.id === config?.laneId);
        const surface = row?.querySelector('.spectral-stack');
        if (!config || !isSpectralView(config) || !lane || !isSpectralLane(lane) || !surface) return;
        event.preventDefault();
        const stack = surface.getBoundingClientRect(); const surfaces = surface.querySelectorAll('.spectral-surface');
        const index = Math.max(0, Math.min(surfaces.length - 1, Math.floor((event.clientY - stack.top) / (stack.height / surfaces.length))));
        const rect = surfaces[index].getBoundingClientRect(); const fraction = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
        if (lane.kind === 'feature') {
          const oldCount = config.f_hi - config.f_lo + 1;
          const count = Math.max(1, Math.min(lane.rows, Math.round(oldCount * Math.exp(event.deltaY * 0.002))));
          const lo = Math.max(0, Math.min(lane.rows - count, Math.round(config.f_lo + fraction * (oldCount - count))));
          updateView(config.id, { f_lo: lo, f_hi: lo + count - 1 });
          return;
        }
        if (config.kind !== 'audio') return;
        const scale = viewScale(config);
        const low = scale === 'log' ? Math.log(config.f_lo) : config.f_lo;
        const high = scale === 'log' ? Math.log(config.f_hi) : config.f_hi;
        const min = scale === 'log' ? Math.log(Math.max(20, lane.sr / config.n_fft)) : 0;
        const max = scale === 'log' ? Math.log(lane.sr / 2) : lane.sr / 2;
        const span = Math.max((max-min) / 1000, Math.min(max-min, (high-low) * Math.exp(event.deltaY * 0.002)));
        const lo = Math.max(min, Math.min(max-span, low + fraction * ((high-low)-span)));
        updateView(config.id, { f_lo: scale === 'log' ? Math.exp(lo) : lo, f_hi: scale === 'log' ? Math.exp(lo+span) : lo+span });
      }
      else if (event.ctrlKey || event.metaKey) { event.preventDefault(); const rect = (element.querySelector('.overview') as HTMLElement).getBoundingClientRect(); setView(v => zoom(v, event.clientX - rect.left, Math.exp(event.deltaY * 0.002))); }
      else if (event.shiftKey || event.deltaX) { event.preventDefault(); setView(v => pan(v, event.deltaX || event.deltaY)); }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [targets, views, lanes, updateView]);
  const tickPrecision = width === 0 ? 3 : Math.max(3, -Math.floor(Math.log10(width * view.secondsPerPx / 5)));

  const changeActive = (patch: ViewPatch) => { if (activeView) updateView(activeView.id, patch); };
  const selectPreset = (name: string) => {
    if (activeView?.kind !== 'audio' || active?.kind !== 'audio') return;
    const replacement = viewFromPreset(active.id, presets[active.sr][name]);
    updateView(activeView.id, { ...replacement, id: activeView.id, cmap: activeView.cmap, mode: activeView.mode, height: activeView.height, split: activeView.split, transform: activeView.transform, mel: activeView.mel });
  };
  const packetsFor = (id: string) => [...frames.current].filter(([key]) => key.startsWith(`${id}:`)).map(([, value]) => value.frame);
  const activePackets = packetsFor(selectedView);
  const activeIsRaw = active?.kind === 'feature' && active.value_scale === 'raw';
  const selectedDisplayView = activeView && isSpectralView(activeView) ? activeView : undefined;
  const naturalRange = spectralRange('auto80', activePackets, activeIsRaw);
  const panels: Record<string, React.ReactNode> = {
    dataset: <Dataset catalog={catalog} progress={datasetProgress} open={file => run(open(file).then(() => dockRef.current?.api.getPanel('lanes')?.api.setActive()))} />,
    'frequency-analysis': <FrequencyAnalysis lanes={audioLanes} views={audioViews} selectedView={selectedView} channels={channels} selection={selection} playhead={playhead} hoverTime={analysisHover} tfSelection={tfSelection}
      analyzerSpectra={analyzerSpectra.filter(item => lanes.some(lane => lane.id === item.lane))} selectedSpectrum={selectedSpectrum} onSelectSpectrum={setSelectedSpectrum} />,
    rir: <Rir lane={activeAudio} channel={activeAudio ? channels[activeAudio.id] ?? 0 : 0} changeChannel={channel => {
      if (activeAudio) setChannels(old => ({ ...old, [activeAudio.id]: channel }));
    }} active={rirVisible} devices={devices} disabled={working || recording} perform={perform}
      selectMeasuredLane={lane => {
        savedTakeLane.current = lane.id;
        setLanes(old => old.some(item => item.id === lane.id) ? old : [...old, lane]);
      }} />,
    analyzers: <Analyzers lane={analyzerLane} catalog={catalog} channel={analyzerChannel} selection={analyzerInterval}
      disabled={working} pending={analyzerPending} feedback={analyzerFeedback}
      refresh={() => perform(refreshAnalyzers)} execute={executeAnalyzer} />,
    record: <RecordingPanel devices={devices} lanes={audioLanes} setup={recordSetup} mapping={mapping}
      disabled={working || recording} changeSetup={changeSetup} changeMapping={next => perform(() => arm(next))} calibrate={calibrate} />,
    display: <Display lane={analyzerLane} range={selectedDisplayView && selectedDisplayView.range !== 'auto80' ? selectedDisplayView.range : naturalRange} naturalRange={naturalRange}
      view={selectedDisplayView} presets={active?.kind === 'audio' ? presets[active.sr] : {}} change={changeActive} applyPreset={selectPreset} applyAll={() => {
      if (!selectedDisplayView || !analyzerLane) return;
      const sourceView = selectedDisplayView;
      for (const target of views.filter(isSpectralView)) {
        const lane = lanes.find(item => item.id === target.laneId) as SessionLane;
        const style = { cmap: sourceView.cmap, filter: sourceView.filter, colorbar: sourceView.colorbar,
          range: displayUnit(lane) === displayUnit(analyzerLane) ? sourceView.range : target.range };
        if (lane.kind !== 'audio' || target.kind !== 'audio' || sourceView.kind !== 'audio' || analyzerLane.kind !== 'audio') {
          updateView(target.id, style);
          continue;
        }
        const replacement = viewFromPreset(target.laneId, presets[lane.sr][sourceView.preset]);
        const source = presets[analyzerLane.sr][sourceView.preset];
        const n_fft = sourceView.n_fft === source.n_fft ? replacement.n_fft : sourceView.n_fft;
        const win_length = sourceView.win_length === source.win_length ? replacement.win_length : sourceView.win_length;
        const minFrequency = viewScale(sourceView) === 'log' ? Math.max(20, lane.sr / n_fft) : 0;
        const nyquist = lane.sr / 2;
        const requestedHigh = sourceView.f_hi === source.f_max_hz ? replacement.f_hi : sourceView.f_hi;
        const f_hi = Math.max(minFrequency + (nyquist - minFrequency) / 1000, Math.min(nyquist, requestedHigh));
        const requestedLow = sourceView.f_lo === source.f_min_hz ? replacement.f_lo : sourceView.f_lo;
        const f_lo = Math.max(minFrequency, Math.min(requestedLow, f_hi - (nyquist - minFrequency) / 1000));
        const fmax = sourceView.mel.fmax === analyzerLane.sr / 2 ? nyquist : Math.min(nyquist, sourceView.mel.fmax);
        const mel = { ...sourceView.mel, fmin: Math.min(sourceView.mel.fmin, fmax * 0.999), fmax };
        updateView(target.id, { ...replacement, ...style, id: target.id, n_fft, win_length: Math.min(win_length, n_fft),
          hop: sourceView.hop === source.hop ? replacement.hop : sourceView.hop,
          window: sourceView.window, window_param: sourceView.window_param,
          yscale: sourceView.yscale, f_lo, f_hi, transform: sourceView.transform, mel,
          mode: sourceView.mode, height: target.height, split: target.split });
      }
    }} />,
    files: <div className="panel files-panel"><form onSubmit={event => { event.preventDefault(); run(browse(path)); }}><button type="button" title="Parent directory" onClick={() => run(browse(`${path}/..`))}>..</button><input aria-label="Directory" title={path} value={path} onChange={event => setPath(event.target.value)} /><button title="Browse">Go</button></form><div className="file-list">{directory?.entries.map(entry => <button key={entry.name} title={entry.name} onDoubleClick={() => { const target = `${directory.path}/${entry.name}`; run(entry.is_dir ? browse(target) : open(target)); }} onKeyDown={event => { if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); event.stopPropagation(); const target = `${directory.path}/${entry.name}`; run(entry.is_dir ? browse(target) : open(target)); } }}>{entry.is_dir ? '▸ ' : '♪ '}{entry.name}</button>)}</div><h4>Recent</h4>{recent.map(item => <button className="file" key={item} title={item} onClick={() => run(open(item))}>{item}</button>)}</div>,
    properties: <div className="panel">{active ? <><h3>{active.name}</h3>
      {active.stale && <p className="analyzer-stale">Stale</p>}
      {isSpectralLane(active) && <><p>Sample rate: {active.sr} Hz</p>
        <p>{active.kind === 'audio' ? `Channels: ${active.channels}` : `Rows: ${active.rows} · ${active.frame_rate.toFixed(2)} frames/s`}</p></>}
      {active.kind === 'curve' && <p>{active.curves} curves · {active.points} points · {active.unit}</p>}
      <p>Duration: {laneDuration(active).toFixed(3)} s</p><p>Source: {active.source}</p>
      {active.kind === 'audio' && active.record_warnings.length > 0 && <>
        <h4>Recording warnings</h4>
        <ul className="record-warnings">{active.record_warnings.map((warning, i) => <li key={i}>{warning.time_s.toFixed(3)} s · {warningLabels[warning.type]}</li>)}</ul>
      </>}</> : 'Select a lane'}</div>,
    settings: <div className="panel">{settings && <><label>Compute device <select aria-label="Compute device" value={settings.compute_device} onChange={event => run(json<Settings>('/settings', body({ compute_device: event.target.value })).then(setSettings))}><option value="auto">auto</option>{settings.available_devices.map(device => <option key={device}>{device}</option>)}</select></label><p>Current: {settings.compute_device}</p><p>Self-check: {settings.self_check ? JSON.stringify(settings.self_check) : 'failed'}</p>{settings.reason && <p role="alert">{settings.reason}</p>}</>}</div>,
    lanes: <div className="lanes" ref={plotHost} style={{ '--scrollbar-width': `${scrollbarWidth}px` } as React.CSSProperties} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); for (const file of event.dataTransfer.files) run(json<OpenResult>(`/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then(result => acceptOpen(result))); }}><div className={`timeline ${width < 350 ? 'compact' : ''}`}>{Array.from({ length: 6 }, (_, i) => <span key={i} style={{ left: `calc(var(--plot-left) + (100% - var(--plot-left) - var(--plot-right) - var(--scrollbar-width)) * ${i / 5})`, transform: i === 0 ? 'none' : i === 5 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{(view.t0 + width * view.secondsPerPx * i / 5).toFixed(tickPrecision)}</span>)}</div><div className="overview" onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const left = (view.t0-start) / extent * rect.width; const right = (view.t0 + width * view.secondsPerPx-start) / extent * rect.width; const mode = Math.abs(x - left) < 6 ? 'start' : Math.abs(x - right) < 6 ? 'end' : 'move'; overviewDrag.current = { x: event.clientX, view, mode }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const drag = overviewDrag.current; if (!drag) return; const delta = (event.clientX - drag.x) / event.currentTarget.clientWidth * extent; const oldEnd = drag.view.t0 + width * drag.view.secondsPerPx; setView(drag.mode === 'move' ? { ...drag.view, t0: drag.view.t0 + delta } : drag.mode === 'start' ? fit(Math.min(oldEnd - 0.001, drag.view.t0 + delta), oldEnd, width) : fit(drag.view.t0, Math.max(drag.view.t0 + 0.001, oldEnd + delta), width)); }} onPointerUp={() => { overviewDrag.current = null; }}>{longest && <OverviewWave lane={longest} start={start} end={end} />}<div className="overview-box" style={{ left: `${(view.t0-start) / extent * 100}%`, width: `${width * view.secondsPerPx / extent * 100}%` }} /></div><canvas className="spectral-canvas" ref={glCanvas} /><div className="lane-list" onContextMenu={event => {
      event.preventDefault(); setMenu({ kind: 'empty', x: event.clientX, y: event.clientY });
    }}>{views.map(config => {
      const lane = lanes.find(item => item.id === config.laneId);
      if (!lane) return null;
      const index = lanes.indexOf(lane);
      const audio = lane.kind === 'audio' ? lane : undefined;
      const spectrum = isSpectralLane(lane) && isSpectralView(config) ? { lane, config } : null;
      const overlays = lanes.filter((item): item is CurveLane => item.kind === 'curve' && item.overlay && item.parent === lane.id);
      const target = mapping.findIndex(item => item.lane === lane.id);
      const preview = target < 0 ? undefined : previews[target];
      const audioConfig = config.kind === 'audio' ? config : undefined;
      const mode = audioConfig?.mode ?? 'S';
      const split = audioConfig?.split ?? 0;
      const selectedChannel = channels[lane.id] ?? 0;
      const channelList = audio && audio.channels <= 2 ? Array.from({ length: audio.channels }, (_, channel) => channel) : [selectedChannel];
      const labelColorbar = lane.kind === 'feature' || audioConfig?.transform === 'mel';
      const selectView = () => { setSelectedView(config.id); setSelected(lane.id); };
      const openLaneMenu = (x: number, y: number) => { if (audio) { selectView(); setMenu({ kind: 'lane', lane: audio, x, y }); } };
      const update = (value: ViewPatch) => updateView(config.id, value);
      const hoverLane = (event: ReactPointerEvent<HTMLDivElement> | null) => {
        if (!event) { setHover(''); if (audio) queueAnalysisHover(null); return; }
        const plot = event.currentTarget.getBoundingClientRect();
        const projectTime = view.t0 + (event.clientX - plot.left) * view.secondsPerPx;
        if (!spectrum) { setHover(`${lane.name} · ${projectTime.toFixed(3)} s`); return; }
        const stack = event.currentTarget.querySelector('.spectral-stack')?.getBoundingClientRect();
        const overSpectrum = stack && event.clientY >= stack.top && event.clientY < stack.bottom
          && event.clientX >= stack.left && event.clientX < stack.right;
        const channelHeight = stack ? stack.height / channelList.length : 0;
        const y = overSpectrum ? event.clientY - stack.top : 0;
        const channel = overSpectrum ? channelList[Math.min(channelList.length - 1, Math.floor(y / channelHeight))] : selectedChannel;
        if (audio) queueAnalysisHover({ time: projectTime, laneId: lane.id, channel });
        const frame = frames.current.get(`${config.id}:${channel}`)?.frame;
        if (!overSpectrum || !frame || !frame.cols || !frame.rows) { setHover(''); return; }
        const column = Math.round((projectTime - frame.col_t0) / frame.col_dt);
        if (column < 0 || column >= frame.cols) { setHover(''); return; }
        const bounds = frequencyViewport(spectrum.config);
        const coordinate = yToFrequency(y % channelHeight, bounds.lo, bounds.hi, bounds.scale, channelHeight);
        const isFeature = lane.kind === 'feature';
        const padding = isFeature ? 0.5 : 0;
        if (coordinate < frame.f_axis.lo - padding || coordinate > frame.f_axis.hi + padding) { setHover(''); return; }
        const row = isFeature ? Math.min(frame.rows - 1, Math.round(coordinate - frame.f_axis.lo)) : nearestRow(coordinate, frame.row_freqs);
        const hz = frame.row_freqs[row];
        const featureRow = rowCoordinate(frame, row, true);
        const frequency = frame.f_axis.scale === 'index' ? `Row ${featureRow}`
          : frame.f_axis.scale === 'mel' ? `Mel channel ${frame.mel ? melChannel(hz, frame.mel) : featureRow} · ${hz.toFixed(0)} Hz`
            : `${(isFeature ? hz : coordinate).toFixed(0)} Hz`;
        const unit = displayUnit(spectrum.lane) === 'value' ? 'value' : 'dB';
        const value = frameValue(frame, row, column);
        const reading = unit === 'value' ? Number(value.toPrecision(9)) : value.toFixed(1);
        setHover(`${lane.name} · ${projectTime.toFixed(3)} s · ${Math.round((projectTime - lane.offset) * spectrum.lane.sr)} samples · ${frequency} · ≈${reading} ${unit}`);
      };
      return <div className={`lane ${config.id === selectedView ? 'selected-view' : ''}`} key={config.id} style={{ height: config.height + (overlays.length ? 27 : 0) }}
        data-view-id={config.id} data-lane-id={lane.id} onPointerDown={selectView} onFocus={selectView}>
        <div className="lane-header" onContextMenu={event => {
          if (!audio) return;
          event.preventDefault(); event.stopPropagation(); openLaneMenu(event.clientX, event.clientY);
        }}>
          <div className="lane-name">{audio?.dirty && <span title="Unsaved changes" aria-label="Unsaved changes">•</span>}<input aria-label="Lane name" defaultValue={lane.name} key={lane.name} onBlur={event => patch(lane.id, { name: event.target.value })} />{lane.stale && <span className="analyzer-stale" title="Re-run the analyzer to refresh this result">Stale</span>}</div>
          <div>{isSpectralLane(lane) ? `${lane.sr} Hz · ${lane.kind === 'audio' ? `${lane.channels} ch` : `${lane.rows} rows`}`
            : lane.kind === 'curve' ? `${lane.curves} curves · ${lane.points} points` : 'Events'} · {laneDuration(lane).toFixed(2)} s</div>
          <div className="lane-actions">
            {audio && <><button title="Mute" className={audio.mute ? 'active' : ''} onClick={() => patch(lane.id, { mute: !audio.mute })}>M</button>
              <button title="Solo" className={audio.solo ? 'active' : ''} onClick={() => patch(lane.id, { solo: !audio.solo })}>S</button>
              <button className="record-arm" title="Arm lane for recording" aria-label={`Arm ${lane.name} for recording`}
                aria-pressed={target >= 0} disabled={working || recording || !input} onClick={() => toggleArm(audio)}>R</button></>}
            <button title="Move up" onClick={() => reorder(index, -1)}>↑</button>
            <button title="Move down" onClick={() => reorder(index, 1)}>↓</button>
            <button title="Add view" onClick={() => {
              const next = { ...config, id: crypto.randomUUID() };
              setViews(old => { const at = old.findIndex(item => item.id === config.id); return [...old.slice(0, at + 1), next, ...old.slice(at + 1)]; });
              setSelectedView(next.id); setSelected(lane.id);
            }}>+</button>
            {audio && <button title="Edit and save lane" aria-label="Edit and save lane" onClick={event => {
              const box = event.currentTarget.getBoundingClientRect(); openLaneMenu(box.left, box.bottom);
            }}><IconDots size={13} /></button>}
            <button title="Close lane" disabled={target >= 0 && (recording || working)} onClick={() => {
              if (views.filter(item => item.laneId === lane.id).length > 1) setViews(old => old.filter(item => item.id !== config.id));
              else if (!audio?.dirty || window.confirm(`Discard unsaved changes to ${lane.name}?`)) {
                const closeLane = () => request(`/lanes/${lane.id}`, { method: 'DELETE' });
                if (target < 0) run(closeLane());
                else perform(async () => { await arm(mapping.filter(item => item.lane !== lane.id)); await closeLane(); });
              }
            }}>×</button>
          </div>
          {audio && <>
            <div className="view-modes">{(['W', 'S', 'W+S'] as const).map(mode => <button key={mode} aria-pressed={config.kind === 'audio' && config.mode === mode} onClick={() => update({ mode })}>{mode}</button>)}</div>
            {audio.channels > 2 && <label>Channel <select aria-label="Channel" value={selectedChannel} onChange={event => setChannels(old => ({ ...old, [lane.id]: Number(event.target.value) }))}>{Array.from({ length: audio.channels }, (_, channel) => <option key={channel} value={channel}>{channel + 1}</option>)}</select></label>}
            <label>Gain <input aria-label="Gain" type="number" defaultValue={audio.gain_db} key={audio.gain_db} onBlur={event => patch(lane.id, { gain_db: Number(event.target.value) })} /></label>
          </>}
          <label>Offset <input aria-label="Offset" type="number" defaultValue={lane.offset} key={lane.offset} onBlur={event => patch(lane.id, { offset: Number(event.target.value) })} /></label>
          {overlays.length > 0 && <div className="overlay-chips" aria-label="Analyzer overlays">{overlays.map(overlay => {
            const visible = !hiddenOverlays.includes(overlay.id);
            return <button key={overlay.id} className={overlay.stale ? 'analyzer-stale' : undefined}
              title={`Toggle overlay ${overlay.labels.join(', ')}${overlay.stale ? ' (stale)' : ''}`}
              aria-pressed={visible} onClick={() => setHiddenOverlays(old => visible ? [...old, overlay.id] : old.filter(id => id !== overlay.id))}>
              {overlay.labels.join(', ')}{overlay.stale ? ' · Stale' : ''}
            </button>;
          })}</div>}
        </div>
        {spectrum ? <FrequencyAxis config={spectrum.config} lane={spectrum.lane} frame={frames.current.get(`${config.id}:${channelList[0]}`)?.frame} change={update} />
          : <div className="frequency-axis analyzer-axis">{lane.kind === 'curve' && lane.unit}</div>}
        <LanePlot lane={lane} view={view} isSelected={config.id === selectedView} working={working}
          commands={audio && timeCommands(audio)} mode={mode} split={split} setSplit={split => update({ split })} onHover={hoverLane}
          onWidth={setWidth} selection={selection} showSelection={!timeGroup.length || timeGroup.includes(lane.id)}
          setSelection={value => { setTfSelection(null); setSelection(value); }}
          onMenu={(x, y) => { if (audio) { selectView(); setMenu({ kind: 'time', lane: audio, x, y }); } }}
          onTimeGroup={(extend, grouped) => {
            if (!audio) { setTimeGroup([]); return; }
            if (grouped) setTimeGroup(old => Array.from(new Set([...old, lane.id])));
            else if (extend && timeGroup.includes(lane.id)) return;
            else setTimeGroup([lane.id]);
          }}
          playhead={playhead} channel={selectedChannel} setPlayhead={setPlayhead} tool={tool} moveLane={offset => patch(lane.id, { offset })}>
          {spectrum && mode !== 'W' && <div className="spectral-stack" style={{ height: mode === 'S' ? '100%' : `${(1 - split) * 100}%` }}>
            {channelList.map(channel => <SpectralLane key={channel} lane={spectrum.lane} config={spectrum.config} view={view} channel={channel} onFrame={onFrame}>
              {audioConfig && (tool === 'frequency' || tfSelection?.viewId === config.id) && <TfSelection active={tool === 'frequency'} laneId={lane.id}
                channel={channel} config={{ ...audioConfig, yscale: viewScale(audioConfig) }} viewport={view} selection={tfSelection}
                setSelection={value => { setSelection(null); setTimeGroup([]); selectView(); setTfSelection(value); }}
                commands={frequencyCommands} disabled={working} onMenu={(x, y) => setMenu({ kind: 'frequency', x, y })}
                menu={menu?.kind === 'frequency' && tfSelection?.viewId === config.id && tfSelection.channel === channel && renderMenu(menu)} />}
            </SpectralLane>)}
            {overlays.filter(overlay => !hiddenOverlays.includes(overlay.id)).map(overlay => <AnalyzerLanePlot key={overlay.id} lane={overlay}
              view={view} overlay={{ ...frequencyViewport(spectrum.config), channels: channelList.length, coordinate: frequency => {
                if (lane.kind !== 'feature') return frequency;
                const axis = lane.freq_axis;
                if (axis.type === 'linear') return frequency / axis.f_max * (lane.rows - 1);
                return axis.type === 'mel' ? melChannel(frequency, axis) : NaN;
              } }} />)}
          </div>}
          {!isSpectralLane(lane) && <AnalyzerLanePlot lane={lane} view={view} />}
          {takeOrigin !== null && preview && <RecordingWave frames={preview} origin={takeOrigin} view={view} label={lane.name} />}
        </LanePlot>
        <div className={`colorbar-gutter${labelColorbar ? ' labeled-colorbar' : ''}`}>{spectrum?.config.colorbar && mode !== 'W' && <>
          <div className="colorbar" style={{ top: mode === 'W+S' ? `${split * 100}%` : 0, background: `linear-gradient(to top, ${Array.from({ length: 16 }, (_, index) => {
            const lut = colorLut(spectrum.config.cmap); const i = Math.round(index * 255 / 15) * 4;
            return `rgb(${lut[i]},${lut[i + 1]},${lut[i + 2]})`;
          }).join(',')})` }} />
          {labelColorbar && <div className="colorbar-unit"><SpectralLabels labels={[{ position: 0.5, value: displayUnit(spectrum.lane) }]} align="center" /></div>}
        </>}</div>
        <div className="row-resizer" onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.dataset.start = String(event.clientY); event.currentTarget.dataset.height = String(config.height);
        }} onPointerMove={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update({ height: Math.max(80, Number(event.currentTarget.dataset.height) + event.clientY - Number(event.currentTarget.dataset.start)) });
        }} />
      </div>;
    })}{takeOrigin !== null && newPreviews.map(([target, frames]) => frames && <div className="lane record-new-preview" key={target}>
      <div className="lane-header"><strong>New lane</strong><div>Input {(mapping[Number(target)]?.channels[0] ?? 0) + 1}</div></div>
      <div className="frequency-axis" />
      <div className="wave"><RecordingWave frames={frames} origin={takeOrigin} view={view} label={`new lane ${Number(target) + 1}`} onWidth={setWidth} /></div>
      <div className="colorbar-gutter" />
    </div>)}</div></div>,
  };
  return <><header><strong>vsr</strong><div className="toolbar-group"><button title="Play / pause" disabled={!audioLanes.length || recording} onClick={togglePlay}>{playing ? <><IconPlayerPause size={14} />Pause</> : <><IconPlayerPlay size={14} />Play</>}</button><button title="Stop" disabled={recording && working} onClick={() => { if (recording) { stopTake(); return; } playback.current?.stop(tfSelection?.t0 ?? (selection ? selection[0] : 0)); setPlayhead(tfSelection?.t0 ?? (selection ? selection[0] : 0)); setPlaying(false); }}><IconPlayerStop size={14} />Stop</button><button title="Loop (L)" className={loop ? "active" : ""} aria-pressed={loop} onClick={() => setLoop(value => !value)}><IconRepeat size={14} />Loop</button><button className="record-transport" aria-pressed={recording} title={recording ? 'Stop recording' : 'Start recording'}
      disabled={working || (!recording && !canRecord)} onClick={toggleRecord}><IconPlayerRecord size={14} />{recording ? 'Stop Rec' : 'Record'}</button></div><div className="toolbar-group"><button title="Export visible area to PDF" aria-label="Export visible area to PDF" aria-pressed={exporting} onClick={() => { if (exporting) finishExport(); else { exportRef.current = true; if (hoverFrame.current !== null) { cancelAnimationFrame(hoverFrame.current); hoverFrame.current = null; } setExporting(true); } }}>PDF</button><button title="Time selection (T)" className={tool === 'time' ? 'active' : ''} aria-pressed={tool === 'time'} onClick={() => setTool('time')}><IconCursorText size={14} />T</button><button title="Time-frequency selection (E)" className={tool === 'frequency' ? 'active' : ''} aria-pressed={tool === 'frequency'} onClick={() => setTool('frequency')}>E</button><button title="Move lane (V)" className={tool === 'move' ? 'active' : ''} aria-pressed={tool === 'move'} onClick={() => setTool('move')}><IconArrowsMove size={14} />V</button><button title="Mixdown" disabled={!audioLanes.length || working} onClick={openMixdown}>Mixdown</button></div><div className={`toolbar-group measurements ${showFrequencyMeasurements ? "tf-measurements" : ""}`}><span>Playhead {formatTime(playhead)}</span>{(['Start', 'End', 'Duration'] as const).map((label, i) => <label key={label}>{label} <TimeInput label={label} value={tfSelection ? (i === 2 ? tfSelection.t1 - tfSelection.t0 : i === 0 ? tfSelection.t0 : tfSelection.t1) : selection ? (i === 2 ? selection[1] - selection[0] : selection[i]) : 0} onChange={n => { if (tfSelection) { const fixed = i === 0 ? tfSelection.t1 : tfSelection.t0; const moving = i === 2 ? fixed + n : n; const t0 = Math.min(fixed, moving); const t1 = Math.max(fixed, moving); setTfSelection({ ...tfSelection, t0, t1 }); return i === 2 ? t1 - t0 : i === 0 ? t0 : t1; } const current = selection ?? [0, 0]; const fixed = i === 0 ? current[1] : current[0]; const moving = i === 2 ? fixed + n : n; const next: [number, number] = [Math.min(fixed, moving), Math.max(fixed, moving)]; setSelection(next); return i === 2 ? next[1] - next[0] : next[i]; }} /></label>)}{showFrequencyMeasurements && (['Low Hz', 'High Hz'] as const).map((label, i) => tfSelection ?
      <label className="frequency-measurement" key={label}>{label} <TimeInput label={label} value={i === 0 ? tfSelection.f_lo : tfSelection.f_hi} onChange={n => { const source = audioLanes.find(lane => lane.id === tfSelection.laneId); const bounded = Math.max(0, Math.min(source ? source.sr / 2 : n, n)); const next = i === 0 ? (bounded < tfSelection.f_hi ? { ...tfSelection, f_lo: bounded } : tfSelection) : (bounded > tfSelection.f_lo ? { ...tfSelection, f_hi: bounded } : tfSelection); setTfSelection(next); return i === 0 ? next.f_lo : next.f_hi; }} /></label>
      : <div className="frequency-measurement" key={label} aria-hidden="true" />)}</div>{takeState !== 'idle' && meter && <InputMeter meter={meter} />}</header><div ref={host} className="dock" />{Object.entries(targets).map(([id, element]) => createPortal(panels[id], element, id))}{currentTensor && <TensorInterpretation key={currentTensor.id} tensor={currentTensor.tensor} close={closeTensor} opened={file => { if (currentTensor.remember) remember(file); closeTensor(); }} />}{exporting && <ExportSelection finish={finishExport} />}
    {menu && menu.kind !== 'frequency' && createPortal(renderMenu(menu), document.body)}
    {editDialog && <Modal opened onClose={() => setEditDialog(null)} title={editFields[editDialog.op].title}>
      <form className="edit-form" onSubmit={event => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('value') as string;
        const op = editDialog.op;
        const params = op === 'gain' ? { gain_db: Number(value) } : op === 'normalize' ? { target_dbfs: Number(value) }
          : op === 'insert_silence' ? { duration_s: Number(value) } : { curve: value as 'linear' | 'equal-power' };
        editDialog.submit(params); setEditDialog(null);
      }}>
        <label>{editFields[editDialog.op].label}
          {editDialog.op === 'fade_in' || editDialog.op === 'fade_out'
            ? <select name="value"><option value="linear">Linear</option><option value="equal-power">Equal power</option></select>
            : <input name="value" type="number" step="any" required defaultValue={editFields[editDialog.op].value}
                min={editDialog.op === 'insert_silence' ? 1e-6 : undefined} max={editDialog.op === 'normalize' ? 0 : undefined} />}
        </label>
        <button title="Apply edit" disabled={working}>Apply</button>
      </form>
    </Modal>}
    {saveDialog && <Modal opened onClose={() => setSaveDialog(null)} title={saveDialog.as ? 'Save As' : 'Overwrite original file'}>
      <form key={`${saveDialog.lane.id}-${saveDialog.as}`} className="edit-form" onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        save(saveDialog.lane, fields.get('subtype') as SaveSubtype, saveDialog.as ? fields.get('path') as string : undefined);
      }}>
        {saveDialog.as ? <label>Destination path<input name="path" placeholder="/path/to/audio.wav" required /></label>
          : <p>Overwrite {saveDialog.lane.source}?</p>}
        <label>Subtype<select name="subtype" defaultValue="PCM_24">
          <option value="PCM_16">PCM_16</option><option value="PCM_24">PCM_24</option><option value="FLOAT">FLOAT</option>
        </select></label>
        <button title={saveDialog.as ? 'Save to destination' : 'Confirm overwrite'} disabled={working}>{saveDialog.as ? 'Save' : 'Overwrite'}</button>
      </form>
    </Modal>}
    {mixdownDialog && <Modal opened onClose={() => setMixdownDialog(null)} title="Mixdown">
      <MixdownForm interval={mixdownDialog.interval} sr={mixdownDialog.sr} disabled={working} submit={writeMix} />
    </Modal>}
    {shortcutHelp && <Modal opened onClose={() => setShortcutHelp(false)} title="Keyboard shortcuts">
      <dl className="shortcut-list">{[
        ['T / E / V', 'Time selection / T-F selection / Move lane'], ['Space / L', 'Play or stop / Toggle loop'],
        ['Delete / Backspace', 'Delete selection'], ['Ctrl/Cmd+X / C / V', 'Cut / Copy / Paste'],
        ['Ctrl/Cmd+Z / Shift+Z', 'Undo / Redo'], ['Ctrl/Cmd+S / Shift+S', 'Save / Save As'],
        ['= / − / 0 / Z', 'Zoom in / Zoom out / Show all / Zoom to selection'], ['Home / End', 'Move playhead to start / end'],
        ['Shift+drag / Ctrl/Cmd+drag', 'Extend time selection / Add lane to selection'],
      ].map(([shortcut, description]) => <div key={shortcut}><dt>{shortcut}</dt><dd>{description}</dd></div>)}</dl>
    </Modal>}
    {busy && <div className="edit-progress" role="status"><Loader size="xs" /> Working…</div>}
    <footer>{hover || `${active?.name ?? ''} ${playhead.toFixed(3)} s`}</footer></>;
}
