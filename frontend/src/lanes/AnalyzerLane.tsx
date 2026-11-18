import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { ApiError, analyzerCurveData, analyzerEvents } from '../api/client';
import type { AnalyzerCurveData, AnnotationLane, EventInterval } from '../api/types';
import { frequencyToY, timeToX } from '../state/viewport';
import type { Viewport } from '../state/viewport';

const palette = ['#4aa3ff', '#3ddc97', '#ffd166', '#ef88c3', '#b4a2ff', '#ff986b'];
export interface OverlayAxis {
  lo: number; hi: number; scale: 'linear' | 'log';
  channels: number; coordinate: (frequency: number) => number;
}
type PlotData = { kind: 'curve'; data: AnalyzerCurveData } | { kind: 'events'; data: EventInterval[] };

function curveRange(values: Float32Array, scale: 'linear' | 'log'): [number, number] {
  let low = Infinity; let high = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value) || (scale === 'log' && value <= 0)) continue;
    low = Math.min(low, value); high = Math.max(high, value);
  }
  if (low !== high) return [low, high];
  const padding = Math.max(1, Math.abs(low) * 0.05);
  return scale === 'log' ? [low / 1.1, high * 1.1] : [low - padding, high + padding];
}

function drawCurves(ctx: CanvasRenderingContext2D, { times, values }: AnalyzerCurveData, curves: number,
  xAt: (time: number) => number, yAt: (value: number) => number) {
  for (let row = 0; row < curves; row++) {
    ctx.strokeStyle = palette[row % palette.length];
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let open = false;
    for (let col = 0; col < times.length; col++) {
      const x = xAt(times[col]);
      const y = yAt(values[row * times.length + col]);
      if (!Number.isFinite(y)) { open = false; continue; }
      if (open) ctx.lineTo(x, y);
      else { ctx.moveTo(x, y); ctx.fillRect(x - 1, y - 1, 2, 2); }
      open = true;
    }
    ctx.stroke();
  }
}

export function AnalyzerLanePlot({ lane, view, overlay }: { lane: AnnotationLane; view: Viewport; overlay?: OverlayAxis }) {
  const [packet, setPacket] = useState<{ key: string; data: PlotData } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { id, kind, version, stale } = lane;
  const packetKey = `${id}:${kind}:${version}`;
  const data = packet?.key === packetKey ? packet.data : null;
  useEffect(() => {
    const controller = new AbortController();
    const load: Promise<PlotData> = kind === 'curve' ? analyzerCurveData(id, controller.signal).then(data => ({ kind, data }))
      : analyzerEvents(id, controller.signal).then(result => ({ kind, data: result.items }));
    void load.then(value => { if (!controller.signal.aborted) setPacket({ key: packetKey, data: value }); }).catch((error: unknown) => {
      if (!controller.signal.aborted && !(error instanceof ApiError)) notifications.show({ title: 'Analyzer data could not be loaded', message: String(error), color: 'red' });
    });
    return () => controller.abort();
  }, [id, kind, packetKey]);
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element || !data) return;
    const ctx = element.getContext('2d') as CanvasRenderingContext2D;
    const draw = () => {
      const { width, height } = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);
      ctx.globalAlpha = stale ? 0.55 : 1;
      const xAt = (t: number) => timeToX(t + lane.offset, view);
      if (data.kind === 'events') {
        ctx.font = '11px ui-monospace, monospace';
        ctx.textBaseline = 'middle';
        for (const [start, end, label] of data.data) {
          const left = Math.max(0, xAt(start));
          const right = Math.min(width, xAt(end));
          if (right <= left) continue;
          ctx.fillStyle = '#234358';
          ctx.fillRect(left, 15, right - left, height - 30);
          ctx.fillStyle = '#4aa3ff';
          ctx.fillRect(left, 15, 1, height - 30);
          ctx.fillStyle = '#d7dbe0';
          if (right - left > 8) ctx.fillText(label, left + 4, height / 2, right - left - 8);
        }
      } else if (lane.kind === 'curve') {
        if (overlay) {
          const channelHeight = height / overlay.channels;
          for (let channel = 0; channel < overlay.channels; channel++) {
            ctx.save();
            ctx.translate(0, channel * channelHeight);
            ctx.beginPath(); ctx.rect(0, 0, width, channelHeight); ctx.clip();
            const yAt = (value: number) => frequencyToY(overlay.coordinate(value), overlay.lo, overlay.hi, overlay.scale, channelHeight);
            drawCurves(ctx, data.data, lane.curves, xAt, yAt);
            ctx.restore();
          }
        } else {
          const [lo, hi] = curveRange(data.data.values, lane.y_scale);
          if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
          const yAt = (value: number) => 10 + frequencyToY(value, lo, hi, lane.y_scale, height - 20);
          drawCurves(ctx, data.data, lane.curves, xAt, yAt);
        }
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, lane, view, overlay, stale]);
  const eventNames = data?.kind === 'events' ? data.data.map(item => item[2]) : [];
  const eventCount = data?.kind === 'events' ? data.data.length : undefined;
  return <>
    <canvas className={overlay ? 'analyzer-overlay' : 'analyzer-plot'} ref={canvas} key={packetKey} role="img"
      aria-label={lane.kind === 'curve' ? `Curves ${lane.name}` : `Events ${lane.name}${eventNames.length ? `: ${eventNames.join(', ')}` : ''}`}
      title={eventNames.join(', ')} data-curve-count={lane.kind === 'curve' && data ? lane.curves : undefined}
      data-point-count={data?.kind === 'curve' ? data.data.times.length : undefined} data-event-count={eventCount} />
    {lane.kind === 'curve' && !overlay && data && <div className="curve-legend" aria-label="Curve series">
      {lane.labels.map((label, index) => <span key={index} style={{ borderColor: palette[index % palette.length] }}>{label}</span>)}
    </div>}
  </>;
}
