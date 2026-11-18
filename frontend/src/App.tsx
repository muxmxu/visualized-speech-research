import { DockviewComponent, themeDark } from 'dockview';
import type { SerializedDockview } from 'dockview';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { notifications } from '@mantine/notifications';
import { IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconRepeat, IconCursorText, IconArrowsMove } from '@tabler/icons-react';
import { body, json, request, token } from './api/client';
import { decodeFrame } from './api/frame';
import type { FrameArray } from './api/frame';
import type { Directory, Lane, Settings } from './api/types';
import { drawWaveform, waveformUpdates } from './render/waveform';
import { fit, pan, zoom, formatTime, yToFrequency } from './state/viewport';
import { SpectralLane } from './lanes/SpectralLane';
import { ExportSelection } from './lanes/ExportSelection';
import { TfSelection } from './lanes/TfSelection';
import type { TfSelection as TfSelectionState } from './state/tfSelection';
import { Display } from './panels/Display';
import { FrequencyAnalysis } from './panels/FrequencyAnalysis';
import { viewFromPreset } from './state/spectralViews';
import type { Preset, SpectralView } from './state/spectralViews';
import { autoRange, createSpectrogramRenderer, halfToNumber, nearestRow } from './render/spectrogram';
import type { SpectralFrame } from './render/spectrogram';
import { colorLut } from './render/colormap';
import type { Viewport } from './state/viewport';
import { Playback } from './audio/playback';
import { exposePlayback, exposeSpectra } from './audio/testHook';

function report(error: unknown) { notifications.show({ title: 'Request failed', message: String(error), color: 'red' }); }
function run(action: Promise<unknown>) { void action.catch(report); }

function Wave({ lane, view, onWidth, selection, setSelection, setPlayhead, setSelected, tool, moveLane, playhead, channel, children, mode, split, setSplit, onHover, onPlaySelection, isSelected }: { lane: Lane; view: Viewport; onWidth: (width: number) => void; selection: [number, number] | null; setSelection: (value: [number, number] | null) => void; setPlayhead: (value: number) => void; setSelected: (id: string) => void; tool: 'time' | 'move' | 'frequency'; moveLane: (offset: number) => void; playhead: number; channel: number; children: React.ReactNode; mode: SpectralView['mode']; split: number; setSplit: (value: number) => void; onHover: (event: ReactPointerEvent<HTMLDivElement> | null) => void; onPlaySelection: () => void; isSelected: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1, height: 160 });
  const drag = useRef<number | null>(null);
  const handle = useRef<0 | 1 | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => { setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); onWidth(entry.contentRect.width); });
    observer.observe(canvas); return () => observer.disconnect();
  }, [onWidth]);
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
  function time(event: ReactPointerEvent<HTMLDivElement>) { return view.t0 + (event.clientX - event.currentTarget.getBoundingClientRect().left) * view.secondsPerPx; }
  return <div className="wave" onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = time(event); setPlayhead(drag.current); if (!event.shiftKey && tool === 'time') setSelection(null); setSelected(lane.id); }} onPointerMove={event => { onHover(event); if (handle.current !== null && selection) { const fixed = selection[1 - handle.current]; const moving = time(event); handle.current = moving < fixed ? 0 : 1; setSelection([Math.min(fixed, moving), Math.max(fixed, moving)]); } else if (drag.current !== null && tool === 'time') { const start = event.shiftKey && selection ? selection[0] : drag.current; setSelection([Math.min(start, time(event)), Math.max(start, time(event))]); } }} onPointerLeave={() => onHover(null)} onPointerUp={event => { if (tool === 'move' && drag.current !== null) moveLane(lane.offset + time(event) - drag.current); drag.current = null; handle.current = null; }} onDoubleClick={() => setSelection([lane.offset, lane.offset + lane.samples / lane.sr])}>
    <div className="waveform-part" style={{ height: mode === 'W' ? '100%' : mode === 'S' ? 0 : `${split * 100}%` }}><canvas ref={ref} aria-label={`Waveform ${lane.name}`} /></div>{children}
    {mode === 'W+S' && <div className="split-resizer" style={{ top: `${split * 100}%` }} onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) { const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setSplit(Math.max(0.1, Math.min(0.9, (event.clientY - rect.top) / rect.height))); } }} onPointerUp={event => event.stopPropagation()} />}
    <div className="playhead" style={{ position: 'absolute', left: (playhead - view.t0) / view.secondsPerPx, top: 0, bottom: 0, width: 1, background: '#ffd166', pointerEvents: 'none' }} />
    {selection && <div className="selection" style={{ left: (selection[0] - view.t0) / view.secondsPerPx, width: (selection[1] - selection[0]) / view.secondsPerPx }}>{isSelected && selection[1] > selection[0] && <div className="time-toolbar" onPointerDown={event => event.stopPropagation()}><button title="Play time selection (Space)" onClick={onPlaySelection}>▶</button></div>}{([0, 1] as const).map(index => <div key={index} className={`selection-handle handle-${index}`} onPointerDown={event => { event.stopPropagation(); event.currentTarget.parentElement?.parentElement?.setPointerCapture(event.pointerId); handle.current = index; }} />)}</div>}
  </div>;
}

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => number }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value.toFixed(3));
  useEffect(() => { if (!editing) setDraft(value.toFixed(3)); }, [editing, value]);
  return <input aria-label={label} type="number" step="0.001" value={editing ? draft : value.toFixed(3)}
    onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
    onChange={event => { const text = event.target.value; const number = Number(text); const result = onChange(number); setDraft(result === number ? text : String(result)); }} />;
}

function FrequencyAxis({ config, sr, change }: { config: SpectralView; sr: number; change: (patch: Partial<SpectralView>) => void }) {
  const drag = useRef<{ y: number; lo: number; hi: number } | null>(null);
  const label = (frequency: number) => frequency >= 1000 ? `${(frequency / 1000).toFixed(frequency % 1000 ? 1 : 0)}k` : String(Math.round(frequency));
  return <div className="frequency-axis" onPointerDown={event => { drag.current = { y: event.clientY, lo: config.f_lo, hi: config.f_hi }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => { if (!drag.current) return; const delta = (event.clientY - drag.current.y) / event.currentTarget.clientHeight;
      if (config.yscale === 'linear') { const shift = delta * (drag.current.hi - drag.current.lo); const lo = Math.max(0, Math.min(sr / 2 - (drag.current.hi - drag.current.lo), drag.current.lo + shift)); change({ f_lo: lo, f_hi: lo + drag.current.hi - drag.current.lo }); }
      else { const ratio = drag.current.hi / drag.current.lo; const lo = Math.max(Math.max(20, sr / config.n_fft), Math.min(sr / 2 / ratio, drag.current.lo * ratio ** delta)); change({ f_lo: lo, f_hi: lo * ratio }); }
    }} onPointerUp={() => { drag.current = null; }}>
    <div className="axis-labels" style={{ top: config.mode === 'W+S' ? `${config.split * 100}%` : 0 }}><span>{label(config.f_hi)}</span><span>{label(config.yscale === 'log' ? Math.sqrt(config.f_lo * config.f_hi) : (config.f_lo + config.f_hi) / 2)}</span><span>{label(config.f_lo)}</span></div>
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
  const overviewDrag = useRef<{ x: number; view: Viewport; mode: 'move' | 'start' | 'end' } | null>(null);
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({});
  const [lanes, setLanes] = useState<Lane[]>([]); const [selected, setSelected] = useState('');
  const [view, setView] = useState<Viewport>({ t0: 0, secondsPerPx: 0.01 }); const [width, setWidth] = useState(600);
  const widthRef = useRef(width); widthRef.current = width;
  const [tool, setTool] = useState<'time' | 'move' | 'frequency'>('time');
  const [tfSelection, setTfSelection] = useState<TfSelectionState | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null); const [playhead, setPlayhead] = useState(0);
  const [directory, setDirectory] = useState<Directory | null>(null); const [path, setPath] = useState('~');
  const [recent, setRecent] = useState<string[]>(() => JSON.parse(localStorage.getItem('vsr-recent') ?? '[]') as string[]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const playback = useRef<Playback | null>(null);
  const [playing, setPlaying] = useState(false); const [loop, setLoop] = useState(false);
  const [channels, setChannels] = useState<Record<string, number>>({});
  const [views, setViews] = useState<SpectralView[]>([]);
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
    const ids = new Set(lanes.map(lane => lane.id));
    setViews(old => {
      const next = old.filter(item => ids.has(item.laneId)).sort((a, b) => lanes.findIndex(lane => lane.id === a.laneId) - lanes.findIndex(lane => lane.id === b.laneId));
      return next.length === old.length && next.every((item, index) => item === old[index]) ? old : next;
    });
    for (const lane of lanes) {
      if (views.some(item => item.laneId === lane.id) || loading.current.has(lane.id)) continue;
      loading.current.add(lane.id);
      run(json<Record<string, Preset>>(`/presets?sr=${lane.sr}`).then(data => {
        setPresets(old => ({ ...old, [lane.sr]: data }));
        const next = viewFromPreset(lane.id, data.analysis);
        setViews(old => old.some(item => item.laneId === lane.id) ? old : [...old, next].sort((a, b) => laneOrder.current.findIndex(item => item.id === a.laneId) - laneOrder.current.findIndex(item => item.id === b.laneId)));
        setSelectedView(old => old || next.id); setSelected(old => old || lane.id);
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
  const updateView = useCallback((id: string, patch: Partial<SpectralView>) => setViews(old => old.map(item => item.id === id ? { ...item, ...patch } : item)), []);
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
        if (!config || !item.element.isConnected) continue;
        const rect = item.element.getBoundingClientRect();
        const left = Math.max(rect.left, list.left, origin.left); const top = Math.max(rect.top, list.top, origin.top);
        const right = Math.min(rect.right, list.right, origin.right); const bottom = Math.min(rect.bottom, list.bottom, origin.bottom);
        if (right <= left || bottom <= top) continue;
        const laneMax = Math.max(...[...frames.current].filter(([key]) => key.startsWith(`${config.id}:`)).map(([, value]) => value.frame.lane_db_max));
        render.draw(item.frame, view, rect, new DOMRect(left, top, right-left, bottom-top), origin,
          { lo: config.f_lo, hi: config.f_hi, scale: config.yscale }, config.range === 'auto80' ? autoRange(laneMax) : config.range, colorLut(config.cmap), config.filter);
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
  useEffect(() => { if (playback.current) run(playback.current.update(lanes, channels)); }, [lanes, channels]);
  useEffect(() => { playback.current?.setLoop(loop); }, [loop]);
  useEffect(() => () => { playback.current?.stop(); void playback.current?.context.close(); }, []);
  const refresh = useCallback(async () => { const result = await json<{ lanes: Lane[] }>('/session'); setLanes(result.lanes); }, []);
  const browse = useCallback(async (value: string) => { const result = await json<Directory>(`/fs/list?path=${encodeURIComponent(value)}`); setDirectory(result); setPath(result.path); }, []);
  useEffect(() => {
    run(refresh()); run(browse('~')); run(json<Settings>('/settings').then(setSettings));
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?token=${encodeURIComponent(token)}`);
    socket.onmessage = event => { if ((JSON.parse(String(event.data)) as { type: string }).type === 'lanes_changed') run(refresh()); };
    return () => socket.close();
  }, [refresh, browse]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const dock = new DockviewComponent(element, { theme: themeDark, createComponent: options => { const panel = document.createElement('div'); panel.style.height = '100%'; return { element: panel, init: () => { setTargets(old => ({ ...old, [options.name]: panel })); } }; } });
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
    if (!dock.api.getPanel('frequency-analysis')) {
      dock.addPanel({ id: 'frequency-analysis', component: 'frequency-analysis', title: 'Frequency Analysis', position: { referencePanel: 'lanes', direction: 'below' }, initialHeight: 220 });
      localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON()));
    }
    const nameTabs = () => element.querySelectorAll<HTMLElement>('.dv-default-tab-content').forEach(tab => { tab.title = tab.innerText; });
    nameTabs();
    const listener = dock.onDidLayoutChange(() => { nameTabs(); localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON())); });
    const resize = new ResizeObserver(() => dock.layout(element.clientWidth, element.clientHeight)); resize.observe(element);
    return () => { resize.disconnect(); listener.dispose(); dock.dispose(); };
  }, []);
  const start = Math.min(0, ...lanes.map(lane => lane.offset));
  const end = Math.max(0.001, ...lanes.map(lane => lane.offset + lane.samples / lane.sr));
  const extent = end - start;
  const active = lanes.find(lane => lane.id === selected);
  const longest = lanes.reduce<Lane | undefined>((best, lane) => !best || lane.samples / lane.sr > best.samples / best.sr ? lane : best, undefined);
  const patch = (id: string, values: object) => run(request(`/lanes/${id}`, { ...body(values), method: 'PATCH' }));
  const open = async (file: string) => { await json('/open', body({ paths: [file] })); const next = [file, ...recent.filter(item => item !== file)].slice(0, 10); setRecent(next); localStorage.setItem('vsr-recent', JSON.stringify(next)); };
  const reorder = (index: number, direction: number) => { const ids = lanes.map(lane => lane.id); const other = index + direction; if (other < 0 || other >= ids.length) return; [ids[index], ids[other]] = [ids[other], ids[index]]; run(json('/lanes/reorder', body({ ids }))); };
  const togglePlay = () => {
    if (playback.current?.playing) { const position = playback.current.position; playback.current.stop(); setPlayhead(position); setPlaying(false); return; }
    const player = playback.current ?? new Playback(); playback.current = player;
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') exposePlayback(player);
    const start = tfSelection?.t0 ?? (selection ? selection[0] : playhead); const finish = tfSelection?.t1 ?? (selection ? selection[1] : end);
    const selectedLane = tfSelection ? lanes.find(lane => lane.id === tfSelection.laneId) : undefined;
    const selectedConfig = tfSelection ? views.find(item => item.id === tfSelection.viewId) : undefined;
    if (tfSelection && (!selectedLane || !selectedConfig)) return;
    const audible = selectedLane ? [selectedLane] : lanes;
    const mask = tfSelection && selectedConfig ? { selection: tfSelection, view: selectedConfig } : undefined;
    run(player.play(audible, start, finish, loop, channels, (position, active) => { setPlayhead(position); setPlaying(active); setView(old => { const span = widthRef.current * old.secondsPerPx; return span > 0 && (position < old.t0 || position > old.t0 + span) ? { ...old, t0: Math.floor(position / span) * span } : old; }); }, undefined, undefined, mask));
  };
  useLayoutEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.key.toLowerCase() === 'l') setLoop(value => !value);
      if (event.key === '=' || event.key === '+') setView(v => zoom(v, width / 2, 0.5));
      if (event.key === '-') setView(v => zoom(v, width / 2, 2));
      if (event.key === '0') setView(fit(start, end, width));
      if (event.key.toLowerCase() === 'z' && (tfSelection || selection)) { const interval = tfSelection ? [tfSelection.t0, tfSelection.t1] : selection as [number, number]; setView(fit(interval[0], interval[1], width)); }
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
        if (!config || !lane || !surface) return;
        event.preventDefault();
        const stack = surface.getBoundingClientRect(); const surfaces = surface.querySelectorAll('.spectral-surface');
        const index = Math.max(0, Math.min(surfaces.length - 1, Math.floor((event.clientY - stack.top) / (stack.height / surfaces.length))));
        const rect = surfaces[index].getBoundingClientRect(); const fraction = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
        const low = config.yscale === 'log' ? Math.log(config.f_lo) : config.f_lo;
        const high = config.yscale === 'log' ? Math.log(config.f_hi) : config.f_hi;
        const min = config.yscale === 'log' ? Math.log(Math.max(20, lane.sr / config.n_fft)) : 0;
        const max = config.yscale === 'log' ? Math.log(lane.sr / 2) : lane.sr / 2;
        const span = Math.max((max-min) / 1000, Math.min(max-min, (high-low) * Math.exp(event.deltaY * 0.002)));
        const lo = Math.max(min, Math.min(max-span, low + fraction * ((high-low)-span)));
        updateView(config.id, { f_lo: config.yscale === 'log' ? Math.exp(lo) : lo, f_hi: config.yscale === 'log' ? Math.exp(lo+span) : lo+span });
      }
      else if (event.ctrlKey || event.metaKey) { event.preventDefault(); const rect = (element.querySelector('.overview') as HTMLElement).getBoundingClientRect(); setView(v => zoom(v, event.clientX - rect.left, Math.exp(event.deltaY * 0.002))); }
      else if (event.shiftKey || event.deltaX) { event.preventDefault(); setView(v => pan(v, event.deltaX || event.deltaY)); }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [targets, views, lanes, updateView]);
  const tickPrecision = width === 0 ? 3 : Math.max(3, -Math.floor(Math.log10(width * view.secondsPerPx / 5)));

  const changeActive = (patch: Partial<SpectralView>) => { if (activeView) updateView(activeView.id, patch); };
  const selectPreset = (name: string) => {
    if (!activeView || !active) return;
    const replacement = viewFromPreset(active.id, presets[active.sr][name]);
    updateView(activeView.id, { ...replacement, id: activeView.id, cmap: activeView.cmap, mode: activeView.mode, height: activeView.height, split: activeView.split });
  };
  const panels: Record<string, React.ReactNode> = {
    'frequency-analysis': <FrequencyAnalysis lanes={lanes} views={views} selectedView={selectedView} channels={channels} selection={selection} playhead={playhead} hoverTime={analysisHover} tfSelection={tfSelection} />,
    display: <Display sr={active?.sr ?? 1} laneMax={(() => { const values = [...frames.current].filter(([key]) => key.startsWith(`${selectedView}:`)).map(([, value]) => value.frame.lane_db_max); return values.length ? Math.max(...values) : 0; })()} view={activeView} presets={active ? presets[active.sr] ?? {} : {}} change={changeActive} applyPreset={selectPreset} applyAll={() => {
      if (!activeView || !active) return;
      for (const target of views) {
        const lane = lanes.find(item => item.id === target.laneId) as Lane;
        const replacement = viewFromPreset(target.laneId, presets[lane.sr][activeView.preset]);
        const source = presets[active.sr][activeView.preset];
        const n_fft = activeView.n_fft === source.n_fft ? replacement.n_fft : activeView.n_fft;
        const win_length = activeView.win_length === source.win_length ? replacement.win_length : activeView.win_length;
        const minFrequency = activeView.yscale === 'log' ? Math.max(20, lane.sr / n_fft) : 0;
        const nyquist = lane.sr / 2;
        const requestedHigh = activeView.f_hi === source.f_max_hz ? replacement.f_hi : activeView.f_hi;
        const f_hi = Math.max(minFrequency + (nyquist - minFrequency) / 1000, Math.min(nyquist, requestedHigh));
        const requestedLow = activeView.f_lo === source.f_min_hz ? replacement.f_lo : activeView.f_lo;
        const f_lo = Math.max(minFrequency, Math.min(requestedLow, f_hi - (nyquist - minFrequency) / 1000));
        updateView(target.id, { ...replacement, id: target.id, cmap: activeView.cmap, filter: activeView.filter,
          n_fft, win_length: Math.min(win_length, n_fft),
          hop: activeView.hop === source.hop ? replacement.hop : activeView.hop,
          window: activeView.window, window_param: activeView.window_param,
          yscale: activeView.yscale, f_lo, f_hi,
          range: activeView.range, colorbar: activeView.colorbar, mode: activeView.mode, height: target.height, split: target.split });
      }
    }} />,
    files: <div className="panel files-panel"><form onSubmit={event => { event.preventDefault(); run(browse(path)); }}><button type="button" title="Parent directory" onClick={() => run(browse(`${path}/..`))}>..</button><input aria-label="Directory" title={path} value={path} onChange={event => setPath(event.target.value)} /><button title="Browse">Go</button></form><div className="file-list">{directory?.entries.map(entry => <button key={entry.name} title={entry.name} onDoubleClick={() => { const target = `${directory.path}/${entry.name}`; run(entry.is_dir ? browse(target) : open(target)); }}>{entry.is_dir ? '▸ ' : '♪ '}{entry.name}</button>)}</div><h4>Recent</h4>{recent.map(item => <button className="file" key={item} title={item} onClick={() => run(open(item))}>{item}</button>)}</div>,
    properties: <div className="panel">{active ? <><h3>{active.name}</h3><p>Sample rate: {active.sr} Hz</p><p>Channels: {active.channels}</p><p>Duration: {(active.samples / active.sr).toFixed(3)} s</p><p>Source: {active.source}</p></> : 'Select a lane'}</div>,
    settings: <div className="panel">{settings && <><label>Compute device <select aria-label="Compute device" value={settings.compute_device} onChange={event => run(json<Settings>('/settings', body({ compute_device: event.target.value })).then(setSettings))}><option value="auto">auto</option>{settings.available_devices.map(device => <option key={device}>{device}</option>)}</select></label><p>Current: {settings.compute_device}</p><p>Self-check: {settings.self_check ? JSON.stringify(settings.self_check) : 'failed'}</p>{settings.reason && <p role="alert">{settings.reason}</p>}</>}</div>,
    lanes: <div className="lanes" ref={plotHost} style={{ '--scrollbar-width': `${scrollbarWidth}px` } as React.CSSProperties} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); for (const file of event.dataTransfer.files) run(request(`/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file })); }}><div className={`timeline ${width < 350 ? 'compact' : ''}`}>{Array.from({ length: 6 }, (_, i) => <span key={i} style={{ left: `calc(var(--plot-left) + (100% - var(--plot-left) - var(--plot-right) - var(--scrollbar-width)) * ${i / 5})`, transform: i === 0 ? 'none' : i === 5 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{(view.t0 + width * view.secondsPerPx * i / 5).toFixed(tickPrecision)}</span>)}</div><div className="overview" onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const left = (view.t0-start) / extent * rect.width; const right = (view.t0 + width * view.secondsPerPx-start) / extent * rect.width; const mode = Math.abs(x - left) < 6 ? 'start' : Math.abs(x - right) < 6 ? 'end' : 'move'; overviewDrag.current = { x: event.clientX, view, mode }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const drag = overviewDrag.current; if (!drag) return; const delta = (event.clientX - drag.x) / event.currentTarget.clientWidth * extent; const oldEnd = drag.view.t0 + width * drag.view.secondsPerPx; setView(drag.mode === 'move' ? { ...drag.view, t0: drag.view.t0 + delta } : drag.mode === 'start' ? fit(Math.min(oldEnd - 0.001, drag.view.t0 + delta), oldEnd, width) : fit(drag.view.t0, Math.max(drag.view.t0 + 0.001, oldEnd + delta), width)); }} onPointerUp={() => { overviewDrag.current = null; }}>{longest && <OverviewWave lane={longest} start={start} end={end} />}<div className="overview-box" style={{ left: `${(view.t0-start) / extent * 100}%`, width: `${width * view.secondsPerPx / extent * 100}%` }} /></div><canvas className="spectral-canvas" ref={glCanvas} /><div className="lane-list">{views.map(config => { const lane = lanes.find(item => item.id === config.laneId); if (!lane) return null; const index = lanes.indexOf(lane); return <div className={`lane ${config.id === selectedView ? 'selected-view' : ''}`} key={config.id} style={{ height: config.height }} data-view-id={config.id} data-lane-id={lane.id} onPointerDown={() => { setSelectedView(config.id); setSelected(lane.id); }}><div className="lane-header"><input aria-label="Lane name" defaultValue={lane.name} key={lane.name} onBlur={event => patch(lane.id, { name: event.target.value })} /><div>{lane.sr} Hz · {lane.channels} ch · {(lane.samples / lane.sr).toFixed(2)} s</div><div className="lane-actions"><button title="Mute" className={lane.mute ? 'active' : ''} onClick={() => patch(lane.id, { mute: !lane.mute })}>M</button><button title="Solo" className={lane.solo ? 'active' : ''} onClick={() => patch(lane.id, { solo: !lane.solo })}>S</button><button title="Move up" onClick={() => reorder(index, -1)}>↑</button><button title="Move down" onClick={() => reorder(index, 1)}>↓</button><button title="Add view" onClick={() => { const next = { ...config, id: crypto.randomUUID() }; setViews(old => { const index = old.findIndex(item => item.id === config.id); return [...old.slice(0, index + 1), next, ...old.slice(index + 1)]; }); setSelectedView(next.id); setSelected(lane.id); }}>+</button><button title="Close lane" onClick={() => { if (views.filter(item => item.laneId === lane.id).length > 1) setViews(old => old.filter(item => item.id !== config.id)); else run(request(`/lanes/${lane.id}`, { method: 'DELETE' })); }}>×</button></div><div className="view-modes">{(['W', 'S', 'W+S'] as const).map(mode => <button key={mode} aria-pressed={config.mode === mode} onClick={() => updateView(config.id, { mode })}>{mode}</button>)}</div>{lane.channels > 2 && <label>Channel <select aria-label="Channel" value={channels[lane.id] ?? 0} onChange={event => setChannels(old => ({ ...old, [lane.id]: Number(event.target.value) }))}>{Array.from({ length: lane.channels }, (_, channel) => <option key={channel} value={channel}>{channel + 1}</option>)}</select></label>}<label>Gain <input aria-label="Gain" type="number" defaultValue={lane.gain_db} key={lane.gain_db} onBlur={event => patch(lane.id, { gain_db: Number(event.target.value) })} /></label><label>Offset <input aria-label="Offset" type="number" defaultValue={lane.offset} key={lane.offset} onBlur={event => patch(lane.id, { offset: Number(event.target.value) })} /></label></div><FrequencyAxis config={config} sr={lane.sr} change={patch => updateView(config.id, patch)} /><Wave lane={lane} view={view} isSelected={config.id === selectedView} onPlaySelection={togglePlay} mode={config.mode} split={config.split} setSplit={split => updateView(config.id, { split })} onHover={event => {
      if (!event) { setHover(''); queueAnalysisHover(null); return; }
      const waveRect = event.currentTarget.getBoundingClientRect();
      const stack = event.currentTarget.querySelector('.spectral-stack');
      const stackRect = stack?.getBoundingClientRect();
      const hoverChannel = stackRect && lane.channels <= 2 && event.clientY >= stackRect.top && event.clientY < stackRect.bottom ? Math.min(lane.channels - 1, Math.floor((event.clientY - stackRect.top) / stackRect.height * lane.channels)) : channels[lane.id] ?? 0;
      queueAnalysisHover({ time: view.t0 + (event.clientX - waveRect.left) * view.secondsPerPx, laneId: lane.id, channel: hoverChannel }); if (!stack) { setHover(''); return; }
      const rect = stack.getBoundingClientRect(); if (event.clientY < rect.top || event.clientY >= rect.bottom || event.clientX < rect.left || event.clientX >= rect.right) { setHover(''); return; }
      const count = lane.channels <= 2 ? lane.channels : 1; const channel = lane.channels <= 2 ? Math.min(count-1, Math.floor((event.clientY-rect.top) / rect.height * count)) : channels[lane.id] ?? 0;
      const frame = frames.current.get(`${config.id}:${channel}`)?.frame; if (!frame || !frame.cols || !frame.rows) { setHover(''); return; }
      const projectTime = view.t0 + (event.clientX - rect.left) * view.secondsPerPx;
      const column = Math.round((projectTime - frame.col_t0) / frame.col_dt); if (column < 0 || column >= frame.cols) { setHover(''); return; }
      const y = (event.clientY - rect.top) % (rect.height / count);
      const hz = yToFrequency(y, config.f_lo, config.f_hi, config.yscale, rect.height / count);
      if (hz < frame.f_axis.lo || hz > frame.f_axis.hi) { setHover(''); return; }
      const row = nearestRow(hz, frame.row_freqs); const db = halfToNumber(frame.data[row * frame.cols + column]);
      setHover(`${lane.name} · ${projectTime.toFixed(3)} s · ${Math.round((projectTime-lane.offset)*lane.sr)} samples · ${hz.toFixed(0)} Hz · ≈${db.toFixed(1)} dB`);
    }} onWidth={setWidth} selection={selection} setSelection={value => { setTfSelection(null); setSelection(value); }} playhead={playhead} channel={channels[lane.id] ?? 0} setPlayhead={setPlayhead} setSelected={() => { setSelected(lane.id); setSelectedView(config.id); }} tool={tool} moveLane={offset => patch(lane.id, { offset })}>{config.mode !== 'W' && <div className="spectral-stack" style={{ height: config.mode === 'S' ? '100%' : `${(1-config.split)*100}%` }}>{Array.from({ length: lane.channels <= 2 ? lane.channels : 1 }, (_, i) => <SpectralLane key={i} lane={lane} config={config} view={view} channel={lane.channels <= 2 ? i : channels[lane.id] ?? 0} onFrame={onFrame}>{(tool === 'frequency' || tfSelection?.viewId === config.id) && <TfSelection active={tool === 'frequency'} laneId={lane.id} channel={lane.channels <= 2 ? i : channels[lane.id] ?? 0} config={config} viewport={view} selection={tfSelection} setSelection={value => { setSelection(null); setSelected(lane.id); setSelectedView(config.id); setTfSelection(value); }} play={togglePlay} zoom={() => { if (tfSelection) setView(fit(tfSelection.t0, tfSelection.t1, width)); }} />}</SpectralLane>)}</div>}</Wave><div className="colorbar-gutter">{config.colorbar && config.mode !== 'W' && <div className="colorbar" style={{ top: config.mode === 'W+S' ? `${config.split * 100}%` : 0, background: `linear-gradient(to top, ${Array.from({ length: 16 }, (_, index) => { const lut = colorLut(config.cmap); const i = Math.round(index * 255 / 15) * 4; return `rgb(${lut[i]},${lut[i+1]},${lut[i+2]})`; }).join(',')})` }} />}</div><div className="row-resizer" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.start = String(event.clientY); event.currentTarget.dataset.height = String(config.height); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateView(config.id, { height: Math.max(80, Number(event.currentTarget.dataset.height) + event.clientY - Number(event.currentTarget.dataset.start)) }); }} /></div>; })}</div></div>,
  };
  return <><header><strong>vsr</strong><div className="toolbar-group"><button title="Play / pause" onClick={togglePlay}>{playing ? <><IconPlayerPause size={14} />Pause</> : <><IconPlayerPlay size={14} />Play</>}</button><button title="Stop" onClick={() => { playback.current?.stop(tfSelection?.t0 ?? (selection ? selection[0] : 0)); setPlayhead(tfSelection?.t0 ?? (selection ? selection[0] : 0)); setPlaying(false); }}><IconPlayerStop size={14} />Stop</button><button title="Loop (L)" className={loop ? "active" : ""} aria-pressed={loop} onClick={() => setLoop(value => !value)}><IconRepeat size={14} />Loop</button></div><div className="toolbar-group"><button title="Export visible area to PDF" aria-label="Export visible area to PDF" aria-pressed={exporting} onClick={() => { if (exporting) finishExport(); else { exportRef.current = true; if (hoverFrame.current !== null) { cancelAnimationFrame(hoverFrame.current); hoverFrame.current = null; } setExporting(true); } }}>PDF</button><button title="Time selection (T)" className={tool === 'time' ? 'active' : ''} aria-pressed={tool === 'time'} onClick={() => setTool('time')}><IconCursorText size={14} />T</button><button title="Time-frequency selection (E)" className={tool === 'frequency' ? 'active' : ''} aria-pressed={tool === 'frequency'} onClick={() => setTool('frequency')}>E</button><button title="Move lane (V)" className={tool === 'move' ? 'active' : ''} aria-pressed={tool === 'move'} onClick={() => setTool('move')}><IconArrowsMove size={14} />V</button></div><div className={`toolbar-group measurements ${tfSelection ? "tf-measurements" : ""}`}><span>Playhead {formatTime(playhead)}</span>{(['Start', 'End', 'Duration'] as const).map((label, i) => <label key={label}>{label} <TimeInput label={label} value={tfSelection ? (i === 2 ? tfSelection.t1 - tfSelection.t0 : i === 0 ? tfSelection.t0 : tfSelection.t1) : selection ? (i === 2 ? selection[1] - selection[0] : selection[i]) : 0} onChange={n => { if (tfSelection) { const fixed = i === 0 ? tfSelection.t1 : tfSelection.t0; const moving = i === 2 ? fixed + n : n; const t0 = Math.min(fixed, moving); const t1 = Math.max(fixed, moving); setTfSelection({ ...tfSelection, t0, t1 }); return i === 2 ? t1 - t0 : i === 0 ? t0 : t1; } const current = selection ?? [0, 0]; const fixed = i === 0 ? current[1] : current[0]; const moving = i === 2 ? fixed + n : n; const next: [number, number] = [Math.min(fixed, moving), Math.max(fixed, moving)]; setSelection(next); return i === 2 ? next[1] - next[0] : next[i]; }} /></label>)}{tfSelection && (['Low Hz', 'High Hz'] as const).map((label, i) => <label key={label}>{label} <TimeInput label={label} value={i === 0 ? tfSelection.f_lo : tfSelection.f_hi} onChange={n => { const source = lanes.find(lane => lane.id === tfSelection.laneId); const bounded = Math.max(0, Math.min(source ? source.sr / 2 : n, n)); const next = i === 0 ? (bounded < tfSelection.f_hi ? { ...tfSelection, f_lo: bounded } : tfSelection) : (bounded > tfSelection.f_lo ? { ...tfSelection, f_hi: bounded } : tfSelection); setTfSelection(next); return i === 0 ? next.f_lo : next.f_hi; }} /></label>)}</div></header><div ref={host} className="dock" />{Object.entries(targets).map(([id, element]) => createPortal(panels[id], element, id))}{exporting && <ExportSelection finish={finishExport} />}<footer>{hover || `${active?.name ?? ''} ${playhead.toFixed(3)} s`}</footer></>;
}
