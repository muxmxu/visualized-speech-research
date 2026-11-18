import { physicalCrop, type Point, type Rect } from '../state/pdfSelection';
import { rasterPdf } from './pdf';

function box(element: Element): Rect {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function clientBox(element: HTMLElement): Rect {
  const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
  const leftBorder = parseFloat(style.borderLeftWidth); const rightBorder = parseFloat(style.borderRightWidth);
  const topBorder = parseFloat(style.borderTopWidth); const bottomBorder = parseFloat(style.borderBottomWidth);
  const width = parseFloat(style.width) + (style.boxSizing === 'border-box' ? 0 : leftBorder + rightBorder + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight));
  const height = parseFloat(style.height) + (style.boxSizing === 'border-box' ? 0 : topBorder + bottomBorder + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
  const scaleX = rect.width / width; const scaleY = rect.height / height;
  const vertical = Math.max(0, element.offsetWidth - element.clientWidth - Math.round(leftBorder + rightBorder));
  const horizontal = Math.max(0, element.offsetHeight - element.clientHeight - Math.round(topBorder + bottomBorder));
  return { left: rect.left + leftBorder * scaleX, top: rect.top + topBorder * scaleY, right: rect.right - (rightBorder + vertical) * scaleX, bottom: rect.bottom - (bottomBorder + horizontal) * scaleY };
}

function clips(element: Element): Rect[] {
  const result: Rect[] = [{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }];
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) result.push(clientBox(parent));
  }
  return result;
}

export function plotAt(x: number, y: number): { root: HTMLElement; bounds: Rect; lanes: boolean } | null {
  const target = document.elementFromPoint(x, y);
  const frequency = target?.closest<HTMLElement>('.frequency-plot');
  if (frequency) return { root: frequency, bounds: box(frequency), lanes: false };
  const root = target?.closest<HTMLElement>('.lanes');
  const list = root?.querySelector<HTMLElement>('.lane-list');
  const row = target?.closest<HTMLElement>('.lane') ?? list?.querySelector<HTMLElement>('.lane');
  const axis = row?.querySelector<HTMLElement>('.frequency-axis');
  const gutter = row?.querySelector<HTMLElement>('.colorbar-gutter');
  if (!root || !list || !row || !axis || !gutter) return null;
  const axisBox = box(axis); const gutterBox = box(gutter); const listBox = clientBox(list); const rootBox = clientBox(root);
  const bounds = { left: Math.max(axisBox.left, listBox.left, rootBox.left), right: Math.min(gutterBox.right, listBox.right, rootBox.right), top: rootBox.top, bottom: Math.min(listBox.bottom, rootBox.bottom) };
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
  return { root, bounds, lanes: true };
}

function drawScene(ctx: CanvasRenderingContext2D, root: HTMLElement, lanes: boolean) {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  function clipped(element: Element, action: () => void) {
    ctx.save();
    for (let parent: Element | null = element; parent; parent = parent.parentElement) ctx.globalAlpha *= Number(getComputedStyle(parent).opacity);
    for (const rect of clips(element)) { ctx.beginPath(); ctx.rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top); ctx.clip(); }
    action(); ctx.restore();
  }
  function visible(element: HTMLElement) { const style = getComputedStyle(element); return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0; }
  function background(element: HTMLElement) {
    if (!visible(element) || element.closest('.lane-header, .time-toolbar, .tf-toolbar, .tf-menu, .row-resizer, .split-resizer')) return;
    const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    clipped(element, () => {
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') { ctx.fillStyle = style.backgroundColor; ctx.fillRect(rect.left, rect.top, rect.width, rect.height); }
      if (element.classList.contains('lane-list') && style.backgroundImage.startsWith('linear-gradient(90deg')) {
        const period = parseFloat(style.backgroundSize); const color = /rgb\(\d+,\s*\d+,\s*\d+\)/.exec(style.backgroundImage)?.[0];
        if (color && period > 0) for (let x = rect.left; x < rect.right; x += period) {
          const gradient = ctx.createLinearGradient(x, 0, x + period, 0); gradient.addColorStop(0, 'transparent'); gradient.addColorStop(0.998, 'transparent'); gradient.addColorStop(0.998, color); gradient.addColorStop(1, color);
          ctx.fillStyle = gradient; ctx.fillRect(x, rect.top, Math.min(period, rect.right - x), rect.height);
        }
      }
      const stops = [...style.backgroundImage.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g)];
      if (style.backgroundImage.startsWith('linear-gradient') && stops.length >= 2 && element.classList.contains('colorbar')) {
        const gradient = ctx.createLinearGradient(0, rect.bottom, 0, rect.top);
        stops.forEach((match, index) => gradient.addColorStop(index / (stops.length - 1), `rgb(${match[1]},${match[2]},${match[3]})`));
        ctx.fillStyle = gradient; ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
      }
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        const width = parseFloat(style[`border${side}Width`]);
        if (!width || style[`border${side}Style`] === 'none') continue;
        ctx.fillStyle = style[`border${side}Color`];
        const dpr = window.devicePixelRatio; const snap = (value: number) => Math.round(value * dpr) / dpr;
        const left = snap(rect.left); const top = snap(rect.top); const right = snap(rect.right); const bottom = snap(rect.bottom); const thickness = snap(width);
        if (side === 'Top') ctx.fillRect(left, element.classList.contains('overview-box') ? Math.floor(rect.top * dpr) / dpr : top, right - left, element.classList.contains('overview-box') ? width : thickness);
        if (side === 'Bottom') ctx.fillRect(left, bottom - thickness, right - left, thickness);
        if (side === 'Left') ctx.fillRect(left, top, thickness, bottom - top);
        if (side === 'Right') ctx.fillRect(right - thickness, top, thickness, bottom - top);
      }
    });
  }
  function canvas(element: HTMLCanvasElement) {
    if (!visible(element)) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || !element.width || !element.height) return;
    clipped(element, () => ctx.drawImage(element, rect.left, rect.top, rect.width, rect.height));
  }
  for (const element of elements) if (!(element instanceof HTMLCanvasElement) && !element.closest('.overview-box, .selection, .playhead, .tf-box')) background(element);
  for (const element of elements) if (element instanceof HTMLCanvasElement && !element.classList.contains('spectral-canvas')) canvas(element);
  if (lanes) { const gl = root.querySelector<HTMLCanvasElement>('.spectral-canvas'); if (gl) canvas(gl); }
  for (const element of elements) if (element.matches('.overview-box, .selection, .selection-handle, .playhead, .tf-box, .tf-handle')) background(element);
  if (!lanes) for (const element of elements) if (element.closest('.u-legend')) background(element);
  for (const element of elements) {
    if (element.matches('.timeline span') && visible(element)) {
      const pseudo = getComputedStyle(element, '::after'); const rect = element.getBoundingClientRect();
      const left = pseudo.left.endsWith('%') ? rect.left + rect.width * parseFloat(pseudo.left) / 100 : rect.left + parseFloat(pseudo.left);
      const width = parseFloat(pseudo.width); const height = parseFloat(pseudo.height); const top = rect.bottom - parseFloat(pseudo.bottom) - height;
      clipped(element, () => { ctx.fillStyle = pseudo.backgroundColor; ctx.fillRect(left, top, width, height); });
    }
    if (!visible(element) || element.closest('.lane-header, .time-toolbar, .tf-toolbar, .tf-menu')) continue;
    const style = getComputedStyle(element);
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      clipped(element, () => {
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color; ctx.textBaseline = 'top'; ctx.fillText(node.textContent?.trim() ?? '', rect.left, rect.top + (element.closest('.timeline') ? 3 : 1) / window.devicePixelRatio);
      });
    }
  }
}

export async function exportPlot(root: HTMLElement, bounds: Rect, lanes: boolean, start: Point, end: Point) {
  const crop = physicalCrop(start, end, [bounds, ...clips(root)], window.devicePixelRatio);
  if (!crop) return;
  const canvas = document.createElement('canvas'); canvas.width = crop.right - crop.left; canvas.height = crop.bottom - crop.top;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const dpr = window.devicePixelRatio; ctx.setTransform(dpr, 0, 0, dpr, -crop.left, -crop.top);
  let background: Element | null = lanes ? root.querySelector('.lane-list') : root;
  while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
  ctx.fillStyle = background ? getComputedStyle(background).backgroundColor : '#17191c'; ctx.fillRect(crop.left / dpr, crop.top / dpr, canvas.width / dpr, canvas.height / dpr);
  drawScene(ctx, root, lanes);
  const jpeg = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob as Blob), 'image/jpeg', 1));
  const pdf = rasterPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
  const url = URL.createObjectURL(pdf); const link = document.createElement('a'); link.href = url; link.download = 'vsr-selection.pdf'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
