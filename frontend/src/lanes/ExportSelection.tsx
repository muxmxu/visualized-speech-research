import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { exportPlot, plotAt } from '../render/workspaceCapture';
import type { Point } from '../state/pdfSelection';

export function ExportSelection({ finish }: { finish: () => void }) {
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);
  useEffect(() => {
    let source: ReturnType<typeof plotAt> = null; let start: Point | null = null; let pointerId: number | null = null;
    const suppressClick = (release: PointerEvent) => {
      const click = (event: MouseEvent) => {
        if (event instanceof PointerEvent && event.pointerId === release.pointerId) {
          event.preventDefault(); event.stopImmediatePropagation(); window.removeEventListener('click', click, true);
        }
      };
      window.addEventListener('click', click, true);
      window.setTimeout(() => window.removeEventListener('click', click, true), 0);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      source = plotAt(event.clientX, event.clientY);
      if (!source) return;
      event.preventDefault(); event.stopImmediatePropagation();
      (event.target as Element).setPointerCapture(event.pointerId);
      pointerId = event.pointerId; start = { x: event.clientX, y: event.clientY }; setDrag({ start, end: start });
    };
    const move = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (!start) return;
      event.preventDefault(); setDrag({ start, end: { x: event.clientX, y: event.clientY } });
    };
    const up = (event: PointerEvent) => {
      if (!source || !start || event.pointerId !== pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation(); suppressClick(event);
      const end = { x: event.clientX, y: event.clientY };
      void exportPlot(source.root, source.bounds, source.lanes, start, end);
      finish();
    };
    const cancel = (event: Event) => { event.stopImmediatePropagation(); finish(); };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (start && pointerId !== null) {
        const cancelledId = pointerId;
        const cleanup = () => { window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', pointerCancel, true); };
        const release = (released: PointerEvent) => {
          if (released.pointerId !== cancelledId) return;
          released.preventDefault(); released.stopImmediatePropagation(); suppressClick(released); cleanup();
        };
        const pointerCancel = (cancelled: PointerEvent) => { if (cancelled.pointerId === cancelledId) cleanup(); };
        window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', pointerCancel, true);
        start = null; source = null;
      }
      finish();
    };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', cancel, true); window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true); window.removeEventListener('keydown', key, true); };
  }, [finish]);
  if (!drag) return null;
  return createPortal(<div className="export-selection" style={{ left: Math.min(drag.start.x, drag.end.x), top: Math.min(drag.start.y, drag.end.y), width: Math.abs(drag.end.x - drag.start.x), height: Math.abs(drag.end.y - drag.start.y) }} />, document.body);
}
