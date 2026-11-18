import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { tfDrag, tfPoint, tfRect, type TfHandle, type TfSelection as Selection } from '../state/tfSelection';
import type { SpectralView } from '../state/spectralViews';
import type { Viewport } from '../state/viewport';

export function TfSelection({ laneId, channel, config, viewport, selection, setSelection, play, zoom, active }: { laneId: string; channel: number; config: SpectralView; viewport: Viewport; selection: Selection | null; setSelection: (selection: Selection | null) => void; play: () => void; zoom: () => void; active: boolean }) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ initial: Selection; handle: TfHandle; origin: [number, number] } | null>(null);
  const [menu, setMenu] = useState(false);
  const chosen = selection?.viewId === config.id && selection.channel === channel ? selection : null;
  const bounds = surface.current?.getBoundingClientRect();
  const rectangle = chosen && bounds ? tfRect(chosen, viewport, config, bounds.height) : null;
  const point = (event: PointerEvent<HTMLDivElement>): [number, number] => { const box = event.currentTarget.getBoundingClientRect(); return tfPoint(event.clientX - box.left, event.clientY - box.top, box.width, box.height, viewport, config); };
  return <div className={`tf-surface ${active ? "" : "tf-inactive"}`} ref={surface} aria-label="Time frequency selection surface" onPointerDown={event => {
    if (event.button !== 0 || !active) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const origin = point(event); const target = event.target as HTMLElement;
    const handle = (target.dataset.handle ?? (target.closest('.tf-box') ? 'move' : 'new')) as TfHandle;
    const initial = handle === 'new' || !chosen ? { laneId, viewId: config.id, channel, t0: origin[0], t1: origin[0], f_lo: origin[1], f_hi: origin[1] } : chosen;
    drag.current = { initial, handle, origin }; setMenu(false);
  }} onPointerMove={event => { if (drag.current) { event.stopPropagation(); const value = tfDrag(drag.current.initial, drag.current.handle, drag.current.origin, point(event), config.f_lo, config.f_hi, config.yscale); if (value.t1 > value.t0 && value.f_hi > value.f_lo) setSelection(value); } }}
  onPointerUp={event => { event.stopPropagation(); if (drag.current) { const value = tfDrag(drag.current.initial, drag.current.handle, drag.current.origin, point(event), config.f_lo, config.f_hi, config.yscale); setSelection(value.t1 > value.t0 && value.f_hi > value.f_lo ? value : null); } drag.current = null; }}
  onContextMenu={event => { event.preventDefault(); event.stopPropagation(); if (chosen) setMenu(true); }}>
    {rectangle && <div className="tf-box" aria-label="Time frequency selection" style={{ left: rectangle.left, top: rectangle.top, width: rectangle.right - rectangle.left, height: rectangle.bottom - rectangle.top }}>
      {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const).map(handle => <span key={handle} className={`tf-handle tf-${handle}`} data-handle={handle} />)}
      <div className="tf-toolbar" onPointerDown={event => event.stopPropagation()}><button title="Play selection (Space)" onClick={play}>▶</button></div>
      {menu && <div className="tf-menu" onPointerDown={event => event.stopPropagation()}><button onClick={() => { setMenu(false); play(); }}>Play</button><button onClick={() => { setMenu(false); zoom(); }}>Zoom to selection</button></div>}
    </div>}
  </div>;
}
