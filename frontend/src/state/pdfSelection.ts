export interface Rect { left: number; top: number; right: number; bottom: number }
export interface Point { x: number; y: number }

export function physicalCrop(start: Point, end: Point, clips: Rect[], dpr: number): Rect | null {
  const left = Math.ceil(Math.max(Math.min(start.x, end.x), ...clips.map(item => item.left)) * dpr);
  const top = Math.ceil(Math.max(Math.min(start.y, end.y), ...clips.map(item => item.top)) * dpr);
  const right = Math.floor(Math.min(Math.max(start.x, end.x), ...clips.map(item => item.right)) * dpr);
  const bottom = Math.floor(Math.min(Math.max(start.y, end.y), ...clips.map(item => item.bottom)) * dpr);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}
