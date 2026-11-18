import { useEffect, useLayoutEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { request } from '../api/client';
import { decodeFrame } from '../api/frame';
import type { FrameArray } from '../api/frame';
import type { Lane } from '../api/types';
import { waveformUpdates } from '../render/waveform';
import { spectralRequestBounds } from '../render/spectrogram';
import type { SpectralFrame } from '../render/spectrogram';
import type { SpectralView } from '../state/spectralViews';
import type { Viewport } from '../state/viewport';

export function SpectralLane({ lane, config, view, channel, onFrame, children }: {
  lane: Lane; config: SpectralView; view: Viewport; channel: number; children?: React.ReactNode;
  onFrame: (id: string, channel: number, frame: SpectralFrame | null, element: HTMLElement | null) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const current = useRef({ lane, config, view, channel });
  current.current = { lane, config, view, channel };
  const schedule = useRef<ReturnType<typeof waveformUpdates> | null>(null);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => {
    const target = element.current; if (!target) return;
    const updates = waveformUpdates(() => undefined, viewport => {
      const { lane: source, config: settings, channel: selected } = current.current;
      const { width, height } = target.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const bounds = spectralRequestBounds(viewport, width, height);
      const query = new URLSearchParams(Object.entries({ ...bounds, f_lo: settings.f_lo, f_hi: settings.f_hi,
        yscale: settings.yscale, channel: selected, mode: 'stft', n_fft: settings.n_fft,
        win_length: settings.win_length, hop: settings.hop, window: settings.window, window_param: settings.window_param }).map(([key, value]) => [key, String(value)]));
      requestController.current?.abort(); const active = new AbortController(); requestController.current = active;
      void request(`/lanes/${source.id}/spectrogram?${query}`, { signal: active.signal }).then(response => response.arrayBuffer()).then(buffer => {
        if (active.signal.aborted) return;
        const decoded = decodeFrame(buffer);
        onFrame(settings.id, selected, { ...decoded.header, data: (decoded.arrays as FrameArray).data as Uint16Array } as SpectralFrame, target);
      }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) notifications.show({ title: 'Request failed', message: String(error), color: 'red' }); });
    });
    schedule.current = updates;
    const observer = new ResizeObserver(() => updates.change(current.current.view)); observer.observe(target);
    updates.change(current.current.view);
    return () => { observer.disconnect(); updates.dispose(); requestController.current?.abort(); schedule.current = null; onFrame(config.id, channel, null, null); };
  }, [lane.id, lane.version, lane.offset, config.id, channel, onFrame]);
  useLayoutEffect(() => { requestController.current?.abort(); schedule.current?.change(view); }, [view, config.n_fft, config.win_length, config.hop, config.window, config.window_param, config.yscale, config.f_lo, config.f_hi]);
  return <div className="spectral-surface" ref={element} aria-label={`Spectrogram ${lane.name}`}>{children}</div>;
}
