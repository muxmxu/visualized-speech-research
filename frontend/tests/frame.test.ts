import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { decodeFrame, encodeFrame, type FrameArray } from '../src/api/frame';

function bridge(mode: string, input?: ArrayBuffer): ArrayBuffer {
  const result = execFileSync('uv', ['run', 'python', 'tests/frame_interop.py', mode], {
    cwd: '..', input: input && Buffer.from(input),
  });
  return Uint8Array.from(result).buffer;
}

const arrays: Record<string, FrameArray> = {
  short: { dtype: 'i16', shape: [3], data: new Int16Array([1, -2, 32767]) },
  float: { dtype: 'f32', shape: [1, 3], data: new Float32Array([0, 1, -2]) },
  half: { dtype: 'f16', shape: [1, 2], data: new Uint16Array([0x3e00, 0xc000]) },
  byte: { dtype: 'u8', shape: [3], data: new Uint8Array([0, 255, 7]) },
};
const meta = { label: '声音', nested: { ok: true } };

function verify(buffer: ArrayBuffer) {
  const { arrays: actual, header } = decodeFrame(buffer);
  expect(actual).toEqual(arrays);
  expect(header.label).toEqual(meta.label);
  expect(header.nested).toEqual(meta.nested);
  expect(header.arrays?.map(item => [item.name, item.offset])).toEqual([
    ['short', 0], ['float', 8], ['half', 24], ['byte', 32],
  ]);
  const length = new DataView(buffer).getUint32(0, true);
  const start = Math.ceil((4 + length) / 8) * 8;
  expect(Array.from(new Uint8Array(buffer, 4 + length, start - 4 - length))).toEqual(new Array(start - 4 - length).fill(0));
  expect(Array.from(new Uint8Array(buffer, start, 8))).toEqual([1, 0, 254, 255, 255, 127, 0, 0]);
  expect(Array.from(new Uint8Array(buffer, start + 8, 12))).toEqual([0, 0, 0, 0, 0, 0, 128, 63, 0, 0, 0, 192]);
}

describe('cross-language frames', () => {
  const words = [0x7f800001, 0xff800001];
  const bytes = [1, 0, 128, 127, 1, 0, 128, 255];
  const signal: FrameArray = { dtype: 'f32', shape: [2], data: new Float32Array(new Uint32Array(words).buffer) };

  function payload(buffer: ArrayBuffer): Uint8Array {
    const start = Math.ceil((4 + new DataView(buffer).getUint32(0, true)) / 8) * 8;
    return new Uint8Array(buffer, start);
  }

  function rawWords(buffer: ArrayBuffer): number[] {
    const data = (decodeFrame(buffer).arrays as FrameArray).data;
    return Array.from(new Uint32Array(data.buffer, data.byteOffset, data.length));
  }

  function wireFrame(): ArrayBuffer {
    const frame = encodeFrame({ dtype: 'f32', shape: [2], data: new Float32Array(2) });
    payload(frame).set(bytes);
    return frame;
  }

  it('encodes signaling NaN storage bits as little-endian payload bytes', () => {
    expect(Array.from(payload(encodeFrame(signal)))).toEqual(bytes);
  });
  it('decodes signaling NaN payload bytes into unchanged storage bits', () => {
    expect(rawWords(wireFrame())).toEqual(words);
  });
  it('preserves signaling NaN bits through Python to TypeScript to Python', () => {
    const python = bridge('echo', wireFrame());
    expect(Array.from(payload(python))).toEqual(bytes);
    expect(rawWords(python)).toEqual(words);
    const result = bridge('echo', encodeFrame(decodeFrame(python).arrays));
    expect(Array.from(payload(result))).toEqual(bytes);
  });
  it('preserves signaling NaN bits through TypeScript to Python to TypeScript', () => {
    const encoded = encodeFrame(signal);
    expect(Array.from(payload(encoded))).toEqual(bytes);
    const python = bridge('echo', encoded);
    expect(Array.from(payload(python))).toEqual(bytes);
    expect(rawWords(python)).toEqual(words);
  });
  it('decodes Python output and survives a TypeScript to Python roundtrip', () => {
    const python = bridge('produce');
    verify(python);
    verify(bridge('echo', encodeFrame(decodeFrame(python).arrays, meta)));
  });
  it('decodes TypeScript output in Python and preserves it on return', () => {
    verify(bridge('echo', encodeFrame(arrays, meta)));
  });
  it.each(Object.values(arrays))('roundtrips a single $dtype array through Python', array => {
    const result = decodeFrame(bridge('echo', encodeFrame(array, meta)));
    expect(result.arrays).toEqual(array);
    expect(result.header.label).toEqual(meta.label);
    expect(result.header.nested).toEqual(meta.nested);
  });
});
