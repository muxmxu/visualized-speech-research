import { useEffect, useLayoutEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { ApiError, request } from '../api/client';
import { decodeFrame } from '../api/frame';
import type { FrameArray } from '../api/frame';
import type { SessionLane } from '../api/types';
import { waveformUpdates } from '../render/waveform';
import { rawExtent, spectralRequestBounds } from '../render/spectrogram';
import type { SpectralFrame, SpectralGrid } from '../render/spectrogram';
import { viewScale } from '../state/spectralViews';
import type { ViewConfig } from '../state/spectralViews';
import type { Viewport } from '../state/viewport';

export function SpectralLane({ lane, config, view, channel, onFrame, children }: {
  lane: SessionLane; config: ViewConfig; view: Viewport; channel: number; children?: React.ReactNode;
  onFrame: (id: string, channel: number, frame: SpectralFrame | null, element: HTMLElement | null) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const current = useRef({ lane, config, view, channel });
  current.current = { lane, config, view, channel };
  const schedule = useRef<ReturnType<typeof waveformUpdates> | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const transformParams = config.kind === 'audio' ? new URLSearchParams(Object.entries({
    yscale: viewScale(config), channel, mode: config.transform, n_fft: config.n_fft,
    win_length: config.win_length, hop: config.hop, window: config.window, window_param: config.window_param,
    ...(config.transform === 'mel' ? config.mel : {}),
  }).map(([key, value]) => [key, String(value)])).toString() : '';
  const transform = useRef(transformParams);
  transform.current = transformParams;
  useEffect(() => {
    const target = element.current; if (!target) return;
    const updates = waveformUpdates(() => undefined, viewport => {
      const { lane: source, config: settings, channel: selected } = current.current;
      const { width, height } = target.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const bounds = spectralRequestBounds(viewport, width, height);
      const query = new URLSearchParams(transform.current);
      for (const [key, value] of Object.entries({ ...bounds, f_lo: settings.f_lo, f_hi: settings.f_hi })) query.set(key, String(value));
      const mel = settings.kind === 'audio' && settings.transform === 'mel' ? settings.mel : undefined;
      requestController.current?.abort(); const active = new AbortController(); requestController.current = active;
      void request(`/lanes/${source.id}/spectrogram?${query}`, { signal: active.signal }).then(response => response.arrayBuffer()).then(buffer => {
        if (active.signal.aborted) return;
        const decoded = decodeFrame(buffer);
        const packet = decoded.arrays as FrameArray;
        const grid = decoded.header as unknown as SpectralGrid;
        if (packet.dtype === 'f32') {
          const data = packet.data as Float32Array;
          onFrame(settings.id, selected, { ...grid, dtype: 'f32', data, extent: rawExtent(data) }, target);
        } else onFrame(settings.id, selected, { ...grid, mel, dtype: 'f16', data: packet.data as Uint16Array }, target);
      }).catch((error: unknown) => {
        // request() has already shown the notification for an ApiError.
        if (!(error instanceof DOMException && error.name === 'AbortError') && !(error instanceof ApiError)) notifications.show({ title: 'Request failed', message: String(error), color: 'red' });
      });
    });
    schedule.current = updates;
    const observer = new ResizeObserver(() => updates.change(current.current.view)); observer.observe(target);
    updates.change(current.current.view);
    return () => { observer.disconnect(); updates.dispose(); requestController.current?.abort(); schedule.current = null; onFrame(config.id, channel, null, null); };
  }, [lane.id, lane.version, lane.offset, config.id, channel, onFrame]);
  useLayoutEffect(() => { requestController.current?.abort(); schedule.current?.change(view); }, [view, transformParams, config.f_lo, config.f_hi]);
  return <div className="spectral-surface" ref={element} aria-label={`${lane.kind === 'feature' ? 'Feature' : 'Spectrogram'} ${lane.name}`}>{children}</div>;
}

type Label = { position: number; value: string };

// Draw labels in the same rendered layer the workspace PDF already composites.
export function SpectralLabels({ labels, align }: { labels: Label[]; align: 'right' | 'center' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(labels);
  const redraw = useRef<() => void>(() => undefined);
  current.current = labels;
  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d') as CanvasRenderingContext2D;
    const draw = () => {
      const { width, height } = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      const style = getComputedStyle(element);
      context.scale(dpr, dpr);
      context.fillStyle = style.color;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.textAlign = align;
      context.textBaseline = 'middle';
      const inset = align === 'center' ? height / 2 : 7;
      const x = align === 'center' ? width / 2 : width;
      for (const { position, value } of current.current) {
        const y = Math.max(inset, Math.min(height - inset, position * height));
        context.fillText(value, x, y);
      }
    };
    redraw.current = draw;
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [align]);
  useLayoutEffect(() => redraw.current(), [labels]);
  return <canvas ref={canvas} role="img" aria-label={labels.map(label => label.value).join(', ')} />;
}
