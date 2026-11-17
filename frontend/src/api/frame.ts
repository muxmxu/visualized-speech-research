export type FrameDtype = 'f32' | 'f16' | 'i16' | 'u8';
export type FrameValues = Float32Array | Uint16Array | Int16Array | Uint8Array;
export interface FrameArray { dtype: FrameDtype; shape: number[]; data: FrameValues }
type Descriptor = { name: string; dtype: FrameDtype; shape: number[]; offset: number };
export type FrameHeader = Record<string, unknown> & { dtype?: FrameDtype; shape?: number[]; arrays?: Descriptor[] };
const sizes: Record<FrameDtype, number> = { f32: 4, f16: 2, i16: 2, u8: 1 };
const align = (n: number) => Math.ceil(n / 8) * 8;

export function encodeFrame(input: FrameArray | Record<string, FrameArray>, meta: Record<string, unknown> = {}): ArrayBuffer {
  const header: FrameHeader = { ...meta };
  const parts: { array: FrameArray; offset: number }[] = [];
  let length = 0;
  function append(array: FrameArray): number {
    length = align(length);
    const offset = length;
    parts.push({ array, offset });
    length += array.data.length * sizes[array.dtype];
    return offset;
  }
  if ('dtype' in input && 'shape' in input && 'data' in input && typeof input.dtype === 'string') {
    const array = input as FrameArray;
    append(array);
    header.dtype = array.dtype;
    header.shape = array.shape;
  } else {
    header.arrays = Object.entries(input as Record<string, FrameArray>).map(([name, array]) => ({
      name, dtype: array.dtype, shape: array.shape, offset: append(array),
    }));
  }
  const encoded = new TextEncoder().encode(JSON.stringify(header));
  const start = align(4 + encoded.length);
  const buffer = new ArrayBuffer(start + length);
  const view = new DataView(buffer);
  view.setUint32(0, encoded.length, true);
  new Uint8Array(buffer, 4, encoded.length).set(encoded);
  for (const { array, offset } of parts) {
    if (array.dtype === 'f32') {
      const words = new Uint32Array(array.data.buffer, array.data.byteOffset, array.data.length);
      words.forEach((word, i) => view.setUint32(start + offset + i * 4, word, true));
      continue;
    }
    array.data.forEach((value, i) => {
      const position = start + offset + i * sizes[array.dtype];
      if (array.dtype === 'i16') view.setInt16(position, value, true);
      else if (array.dtype === 'f16') view.setUint16(position, value, true);
      else view.setUint8(position, value);
    });
  }
  return buffer;
}

export function decodeFrame(buffer: ArrayBuffer): { arrays: FrameArray | Record<string, FrameArray>; header: FrameHeader } {
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength))) as FrameHeader;
  const start = align(4 + headerLength);
  function read(dtype: FrameDtype, shape: number[], offset: number): FrameArray {
    const count = shape.reduce((a, b) => a * b, 1);
    const data: FrameValues = dtype === 'f32' ? new Float32Array(count) : dtype === 'f16' ? new Uint16Array(count) : dtype === 'i16' ? new Int16Array(count) : new Uint8Array(count);
    if (dtype === 'f32') {
      const words = new Uint32Array(data.buffer);
      for (let i = 0; i < count; i++) words[i] = view.getUint32(start + offset + i * 4, true);
      return { dtype, shape, data };
    }
    for (let i = 0; i < count; i++) {
      const position = start + offset + i * sizes[dtype];
      data[i] = dtype === 'i16' ? view.getInt16(position, true) : dtype === 'f16' ? view.getUint16(position, true) : view.getUint8(position);
    }
    return { dtype, shape, data };
  }
  if (header.arrays) {
    return { arrays: Object.fromEntries(header.arrays.map(item => [item.name, read(item.dtype, item.shape, item.offset)])), header };
  }
  return { arrays: read(header.dtype as FrameDtype, header.shape as number[], 0), header };
}
