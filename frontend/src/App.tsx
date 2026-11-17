import { DockviewComponent, themeDark } from 'dockview';
import type { SerializedDockview } from 'dockview';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { notifications } from '@mantine/notifications';
import { body, json, request, token } from './api/client';
import { decodeFrame } from './api/frame';
import type { FrameArray } from './api/frame';
import type { Directory, Lane, Settings } from './api/types';
import { drawWaveform, waveformUpdates } from './render/waveform';
import { fit, pan, zoom } from './state/viewport';
import type { Viewport } from './state/viewport';
import { Playback } from './audio/playback';
import { exposePlayback } from './audio/testHook';

function report(error: unknown) { notifications.show({ title: 'Request failed', message: String(error), color: 'red' }); }
function run(action: Promise<unknown>) { void action.catch(report); }

function Wave({ lane, view, onWidth, selection, setSelection, setPlayhead, setSelected, tool, moveLane, playhead, channel }: { lane: Lane; view: Viewport; onWidth: (width: number) => void; selection: [number, number] | null; setSelection: (value: [number, number] | null) => void; setPlayhead: (value: number) => void; setSelected: (id: string) => void; tool: 'time' | 'move'; moveLane: (offset: number) => void; playhead: number; channel: number }) {
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
  return <div className="wave" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = time(event); setPlayhead(drag.current); if (!event.shiftKey && tool === 'time') setSelection(null); setSelected(lane.id); }} onPointerMove={event => { if (handle.current !== null && selection) { const fixed = selection[1 - handle.current]; const moving = time(event); handle.current = moving < fixed ? 0 : 1; setSelection([Math.min(fixed, moving), Math.max(fixed, moving)]); } else if (drag.current !== null && tool === 'time') { const start = event.shiftKey && selection ? selection[0] : drag.current; setSelection([Math.min(start, time(event)), Math.max(start, time(event))]); } }} onPointerUp={event => { if (tool === 'move' && drag.current !== null) moveLane(lane.offset + time(event) - drag.current); drag.current = null; handle.current = null; }} onDoubleClick={() => setSelection([lane.offset, lane.offset + lane.samples / lane.sr])}>
    <canvas ref={ref} aria-label={`Waveform ${lane.name}`} />
    <div style={{ position: 'absolute', left: (playhead - view.t0) / view.secondsPerPx, top: 0, bottom: 0, width: 1, background: 'white', pointerEvents: 'none' }} />
    {selection && <div className="selection" style={{ left: (selection[0] - view.t0) / view.secondsPerPx, width: (selection[1] - selection[0]) / view.secondsPerPx }}>{([0, 1] as const).map(index => <div key={index} className={`selection-handle handle-${index}`} onPointerDown={event => { event.stopPropagation(); event.currentTarget.parentElement?.parentElement?.setPointerCapture(event.pointerId); handle.current = index; }} />)}</div>}
  </div>;
}

function OverviewWave({ lane, end }: { lane: Lane; end: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const controller = new AbortController();
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.round(entry.contentRect.width));
      void request(`/lanes/${lane.id}/waveform?${new URLSearchParams({ t0: '0', t1: String(end), width: String(width) })}`, { signal: controller.signal }).then(r => r.arrayBuffer()).then(buffer => {
        const { arrays, header } = decodeFrame(buffer); const dpr = window.devicePixelRatio;
        canvas.width = width * dpr; canvas.height = 30 * dpr;
        const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(dpr, dpr);
        drawWaveform(ctx, arrays as FrameArray, header, fit(0, end, width), width, 30, lane.sr, lane.offset);
      }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) report(error); });
    });
    observer.observe(canvas); return () => { controller.abort(); observer.disconnect(); };
  }, [lane, end]);
  return <canvas aria-label="Overview waveform" ref={ref} />;
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const overviewDrag = useRef<{ x: number; view: Viewport; mode: 'move' | 'start' | 'end' } | null>(null);
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({});
  const [lanes, setLanes] = useState<Lane[]>([]); const [selected, setSelected] = useState('');
  const [view, setView] = useState<Viewport>({ t0: 0, secondsPerPx: 0.01 }); const [width, setWidth] = useState(600);
  const widthRef = useRef(width); widthRef.current = width;
  const [tool, setTool] = useState<'time' | 'move'>('time');
  const [selection, setSelection] = useState<[number, number] | null>(null); const [playhead, setPlayhead] = useState(0);
  const [directory, setDirectory] = useState<Directory | null>(null); const [path, setPath] = useState('~');
  const [recent, setRecent] = useState<string[]>(() => JSON.parse(localStorage.getItem('vsr-recent') ?? '[]') as string[]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const playback = useRef<Playback | null>(null);
  const [playing, setPlaying] = useState(false); const [loop, setLoop] = useState(false);
  const [channels, setChannels] = useState<Record<string, number>>({});
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
    if (saved) dock.fromJSON(JSON.parse(saved) as SerializedDockview);
    else {
      dock.addPanel({ id: 'lanes', component: 'lanes', title: 'Lanes' });
      dock.addPanel({ id: 'files', component: 'files', title: 'Files', position: { referencePanel: 'lanes', direction: 'left' }, initialWidth: 240 });
      dock.addPanel({ id: 'properties', component: 'properties', title: 'Properties', position: { referencePanel: 'lanes', direction: 'right' }, initialWidth: 240 });
      dock.addPanel({ id: 'settings', component: 'settings', title: 'Settings', position: { referencePanel: 'properties', direction: 'within' } });
    }
    const listener = dock.onDidLayoutChange(() => localStorage.setItem('vsr-layout', JSON.stringify(dock.toJSON())));
    const resize = new ResizeObserver(() => dock.layout(element.clientWidth, element.clientHeight)); resize.observe(element);
    return () => { resize.disconnect(); listener.dispose(); dock.dispose(); };
  }, []);
  const end = Math.max(0.001, ...lanes.map(lane => lane.offset + lane.samples / lane.sr));
  const active = lanes.find(lane => lane.id === selected);
  const longest = lanes.reduce<Lane | undefined>((best, lane) => !best || lane.samples / lane.sr > best.samples / best.sr ? lane : best, undefined);
  const patch = (id: string, values: object) => run(request(`/lanes/${id}`, { ...body(values), method: 'PATCH' }));
  const open = async (file: string) => { await json('/open', body({ paths: [file] })); const next = [file, ...recent.filter(item => item !== file)].slice(0, 10); setRecent(next); localStorage.setItem('vsr-recent', JSON.stringify(next)); };
  const reorder = (index: number, direction: number) => { const ids = lanes.map(lane => lane.id); const other = index + direction; if (other < 0 || other >= ids.length) return; [ids[index], ids[other]] = [ids[other], ids[index]]; run(json('/lanes/reorder', body({ ids }))); };
  const togglePlay = () => {
    if (playback.current?.playing) { const position = playback.current.position; playback.current.stop(); setPlayhead(position); setPlaying(false); return; }
    const player = playback.current ?? new Playback(); playback.current = player;
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') exposePlayback(player);
    const start = selection ? selection[0] : playhead; const finish = selection ? selection[1] : end;
    run(player.play(lanes, start, finish, loop, channels, (position, active) => { setPlayhead(position); setPlaying(active); setView(old => { const span = widthRef.current * old.secondsPerPx; return span > 0 && (position < old.t0 || position > old.t0 + span) ? { ...old, t0: Math.floor(position / span) * span } : old; }); }));
  };
  useLayoutEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.key.toLowerCase() === 'l') setLoop(value => !value);
      if (event.key === '=' || event.key === '+') setView(v => zoom(v, width / 2, 0.5));
      if (event.key === '-') setView(v => zoom(v, width / 2, 2));
      if (event.key === '0') setView(fit(0, end, width));
      if (event.key.toLowerCase() === 'z' && selection) setView(fit(selection[0], selection[1], width));
      if (event.key.toLowerCase() === 't') setTool('time');
      if (event.key.toLowerCase() === 'v') setTool('move');
      if (event.key === 'Home') setPlayhead(0);
      if (event.key === 'End') setPlayhead(end);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  });
  useEffect(() => {
    if (!Object.hasOwn(targets, 'lanes')) return;
    const element = targets.lanes;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) { event.preventDefault(); const rect = element.getBoundingClientRect(); setView(v => zoom(v, event.clientX - rect.left - 180, Math.exp(event.deltaY * 0.002))); }
      else if (event.shiftKey || event.deltaX) { event.preventDefault(); setView(v => pan(v, event.deltaX || event.deltaY)); }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [targets]);
  const tickPrecision = width === 0 ? 3 : Math.max(3, -Math.floor(Math.log10(width * view.secondsPerPx / 5)));

  const panels: Record<string, React.ReactNode> = {
    files: <div className="panel"><form onSubmit={event => { event.preventDefault(); run(browse(path)); }}><input aria-label="Directory" value={path} onChange={event => setPath(event.target.value)} /><button title="Browse">Go</button></form><button title="Parent directory" onClick={() => run(browse(`${path}/..`))}>..</button><div className="file-list">{directory?.entries.map(entry => <button key={entry.name} onDoubleClick={() => { const target = `${directory.path}/${entry.name}`; run(entry.is_dir ? browse(target) : open(target)); }}>{entry.is_dir ? '▸ ' : '♪ '}{entry.name}</button>)}</div><h4>Recent</h4>{recent.map(item => <button className="file" key={item} onClick={() => run(open(item))}>{item}</button>)}</div>,
    properties: <div className="panel">{active ? <><h3>{active.name}</h3><p>Sample rate: {active.sr} Hz</p><p>Channels: {active.channels}</p><p>Duration: {(active.samples / active.sr).toFixed(3)} s</p><p>Source: {active.source}</p></> : 'Select a lane'}</div>,
    settings: <div className="panel">{settings && <><label>Compute device <select aria-label="Compute device" value={settings.compute_device} onChange={event => run(json<Settings>('/settings', body({ compute_device: event.target.value })).then(setSettings))}><option value="auto">auto</option>{settings.available_devices.map(device => <option key={device}>{device}</option>)}</select></label><p>Current: {settings.compute_device}</p><p>Self-check: {settings.self_check ? JSON.stringify(settings.self_check) : 'failed'}</p>{settings.reason && <p role="alert">{settings.reason}</p>}</>}</div>,
    lanes: <div className="lanes" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); for (const file of event.dataTransfer.files) run(request(`/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file })); }}><div className="timeline" style={{ paddingLeft: 180 }}>{Array.from({ length: 6 }, (_, i) => <span key={i}>{(view.t0 + width * view.secondsPerPx * i / 5).toFixed(tickPrecision)}</span>)}</div><div className="overview" style={{ marginLeft: 180 }} onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const left = view.t0 / end * rect.width; const right = (view.t0 + width * view.secondsPerPx) / end * rect.width; const mode = Math.abs(x - left) < 6 ? 'start' : Math.abs(x - right) < 6 ? 'end' : 'move'; overviewDrag.current = { x: event.clientX, view, mode }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const drag = overviewDrag.current; if (!drag) return; const delta = (event.clientX - drag.x) / event.currentTarget.clientWidth * end; const oldEnd = drag.view.t0 + width * drag.view.secondsPerPx; setView(drag.mode === 'move' ? { ...drag.view, t0: drag.view.t0 + delta } : drag.mode === 'start' ? fit(Math.min(oldEnd - 0.001, drag.view.t0 + delta), oldEnd, width) : fit(drag.view.t0, Math.max(drag.view.t0 + 0.001, oldEnd + delta), width)); }} onPointerUp={() => { overviewDrag.current = null; }}>{longest && <OverviewWave lane={longest} end={end} />}<div className="overview-box" style={{ left: `${view.t0 / end * 100}%`, width: `${width * view.secondsPerPx / end * 100}%` }} /></div><div className="lane-list">{lanes.map((lane, index) => <div className="lane" key={lane.id}><div className="lane-header"><input aria-label="Lane name" defaultValue={lane.name} key={lane.name} onBlur={event => patch(lane.id, { name: event.target.value })} /><div>{lane.sr} Hz · {lane.channels} ch · {(lane.samples / lane.sr).toFixed(2)} s</div><div><button title="Mute" className={lane.mute ? 'active' : ''} onClick={() => patch(lane.id, { mute: !lane.mute })}>M</button><button title="Solo" className={lane.solo ? 'active' : ''} onClick={() => patch(lane.id, { solo: !lane.solo })}>S</button><button title="Move up" onClick={() => reorder(index, -1)}>↑</button><button title="Move down" onClick={() => reorder(index, 1)}>↓</button><button title="Close lane" onClick={() => run(request(`/lanes/${lane.id}`, { method: 'DELETE' }))}>×</button></div>{lane.channels > 2 && <label>Channel <select aria-label="Channel" value={channels[lane.id] ?? 0} onChange={event => setChannels(old => ({ ...old, [lane.id]: Number(event.target.value) }))}>{Array.from({ length: lane.channels }, (_, channel) => <option key={channel} value={channel}>{channel + 1}</option>)}</select></label>}<label>Gain <input aria-label="Gain" type="number" defaultValue={lane.gain_db} key={lane.gain_db} onBlur={event => patch(lane.id, { gain_db: Number(event.target.value) })} /></label><label>Offset <input aria-label="Offset" type="number" defaultValue={lane.offset} key={lane.offset} onBlur={event => patch(lane.id, { offset: Number(event.target.value) })} /></label></div><Wave lane={lane} view={view} onWidth={setWidth} selection={selection} setSelection={setSelection} playhead={playhead} channel={channels[lane.id] ?? 0} setPlayhead={setPlayhead} setSelected={setSelected} tool={tool} moveLane={offset => patch(lane.id, { offset })} /></div>)}</div></div>,
  };
  return <><header><strong>vsr</strong><button title="Play / pause" onClick={togglePlay}>{playing ? "Pause" : "Play"}</button><button title="Stop" onClick={() => { playback.current?.stop(selection ? selection[0] : 0); setPlayhead(selection ? selection[0] : 0); setPlaying(false); }}>Stop</button><button title="Loop (L)" className={loop ? "active" : ""} onClick={() => setLoop(value => !value)}>Loop</button><button title="Time selection (T)" className={tool === 'time' ? 'active' : ''} onClick={() => setTool('time')}>T</button><button title="Move lane (V)" className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}>V</button><span>Playhead {playhead.toFixed(3)} s</span>{(['Start', 'End', 'Duration'] as const).map((label, i) => <label key={label}>{label} <input aria-label={label} type="number" step="0.001" value={selection ? (i === 2 ? selection[1] - selection[0] : selection[i]) : 0} onChange={event => { const n = Number(event.target.value); const current = selection ?? [0, 0]; const fixed = i === 0 ? current[1] : current[0]; const moving = i === 2 ? fixed + n : n; setSelection([Math.min(fixed, moving), Math.max(fixed, moving)]); }} /></label>)}</header><div ref={host} className="dock" />{Object.entries(targets).map(([id, element]) => createPortal(panels[id], element, id))}<footer>{active?.name} {playhead.toFixed(3)} s</footer></>;
}
