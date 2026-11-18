import type { MelSettings } from '../api/types';
import type { ViewStyle } from '../state/spectralViews';
import type { Viewport } from '../state/viewport';

export function halfToNumber(word: number): number {
  const sign = word & 0x8000 ? -1 : 1;
  const exponent = (word >>> 10) & 0x1f;
  const fraction = word & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * fraction / 1024;
  if (exponent === 31) return fraction === 0 ? sign * Infinity : NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

export function spectralRequestBounds(view: Viewport, width: number, height: number) {
  return {
    t0: view.t0 - width * view.secondsPerPx * 0.25,
    t1: view.t0 + width * view.secondsPerPx * 1.25,
    width: Math.round(width * 1.5),
    height: Math.round(height),
  };
}

export function autoRange(laneMax: number): [number, number] {
  const ceiling = 10 * Math.ceil(laneMax / 10);
  return [ceiling - 80, ceiling];
}

export function columnTime(column: number, colT0: number, colDt: number): number {
  return colT0 + column * colDt;
}

export function nearestRow(frequency: number, rowFreqs: number[]): number {
  let lo = 0; let hi = rowFreqs.length - 1;
  while (lo < hi) {
    const middle = Math.floor((lo + hi) / 2);
    if (rowFreqs[middle] < frequency) lo = middle + 1;
    else hi = middle;
  }
  return lo > 0 && frequency - rowFreqs[lo - 1] < rowFreqs[lo] - frequency ? lo - 1 : lo;
}

export interface SpectralGrid {
  rows: number;
  cols: number;
  row_freqs: number[];
  col_t0: number;
  col_dt: number;
  f_axis: { scale: 'linear' | 'log' | 'mel' | 'index'; lo: number; hi: number };
  view_db_max: number | null;
  lane_db_max: number;
  mel?: MelSettings;
}

export type SpectralFrame = SpectralGrid & (
  { dtype: 'f16'; data: Uint16Array } |
  { dtype: 'f32'; data: Float32Array; extent: [number, number] }
);

export function rawExtent(data: Float32Array): [number, number] {
  let lo = Infinity; let hi = -Infinity;
  for (const value of data) { lo = Math.min(lo, value); hi = Math.max(hi, value); }
  return data.length ? [lo, hi] : [0, 1];
}

export function spectralRange(setting: ViewStyle['range'], frames: SpectralFrame[], raw: boolean): [number, number] {
  if (setting !== 'auto80') return setting;
  if (!raw) return autoRange(frames.length ? Math.max(...frames.map(frame => frame.lane_db_max)) : 0);
  const frame = frames.at(0);
  if (frame?.dtype !== 'f32') return [0, 1];
  const [lo, hi] = frame.extent;
  if (lo !== hi) return frame.extent;
  const delta = Math.max(1, Math.abs(lo)) * 2 ** -23;
  return [lo - delta, hi + delta];
}

export function frameValue(frame: SpectralFrame, row: number, column: number): number {
  const value = frame.data[row * frame.cols + column];
  return frame.dtype === 'f32' ? value : halfToNumber(value);
}

export function rowCoordinate(frame: SpectralFrame, row: number, isFeature: boolean): number {
  return isFeature ? frame.f_axis.lo + row : frame.row_freqs[row];
}

export function melChannel(frequency: number, { n_mels, fmin, fmax, htk }: MelSettings): number {
  const mel = (hz: number) => htk ? Math.log1p(hz / 700) :
    hz < 1000 ? hz * 3 / 200 : 15 + Math.log(hz / 1000) * 27 / Math.log(6.4);
  return Math.round((mel(frequency) - mel(fmin)) / (mel(fmax) - mel(fmin)) * (n_mels + 1)) - 1;
}

function rawUniforms(range: [number, number], extent: [number, number]) {
  const magnitude = Math.max(Math.abs(range[0]), Math.abs(range[1]), Math.abs(extent[0]), Math.abs(extent[1]));
  const scale = magnitude > 2 ** 126 ? 0.25 : magnitude > 0 && magnitude < 2 ** -100 ? 2 ** Math.min(126, -Math.floor(Math.log2(magnitude))) : 1;
  const floor = range[0] * scale;
  const origin = Math.fround(floor);
  return { scale, origin, correction: floor - origin, span: (range[1] - range[0]) * scale };
}

export function createSpectrogramRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgl2', { alpha: true, preserveDrawingBuffer: true });
  if (!context) throw new Error('WebGL2 is unavailable');
  const gl: WebGL2RenderingContext = context;
  function shader(type: number, source: string) {
    const value = gl.createShader(type) as WebGLShader;
    gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) ?? 'Shader compilation failed');
    return value;
  }
  const vertex = shader(gl.VERTEX_SHADER, `#version 300 es
    in vec2 position; in vec2 coordinate; out vec2 uv;
    void main() { gl_Position = vec4(position, 0., 1.); uv = coordinate; }`);
  const fragment = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    precision highp sampler2D;
    uniform sampler2D matrix; uniform sampler2D palette;
    uniform vec2 range; uniform vec4 rawRange; uniform int rawFilter;
    in vec2 uv; out vec4 color;
    float shifted(ivec2 pixel, ivec2 size) {
      return texelFetch(matrix, clamp(pixel, ivec2(0), size - 1), 0).r * rawRange.x - rawRange.y;
    }
    float rawValue() {
      ivec2 size = textureSize(matrix, 0);
      vec2 pixel = uv * vec2(size);
      if (rawFilter == 1) return shifted(ivec2(floor(pixel)), size);
      vec2 center = pixel - .5;
      ivec2 base = ivec2(floor(center));
      vec2 weight = fract(center);
      float lower = mix(shifted(base, size), shifted(base + ivec2(1, 0), size), weight.x);
      float upper = mix(shifted(base + ivec2(0, 1), size), shifted(base + ivec2(1, 1), size), weight.x);
      return mix(lower, upper, weight.y);
    }
    void main() {
      float v = rawFilter == 0 ? (texture(matrix, uv).r - range.x) / (range.y - range.x)
        : (rawValue() - rawRange.z) / rawRange.w;
      color = texture(palette, vec2(clamp(v, 0., 1.), .5));
    }`);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader linking failed');
  const vertices = gl.createBuffer();
  type Tile = { texture: WebGLTexture; firstRow: number; afterRow: number; dataStart: number; dataRows: number };
  const matrices = new Map<SpectralFrame, Tile[]>();
  const maxHeight = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const palette = gl.createTexture();
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, 'matrix'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'palette'), 1);
  const rangeLocation = gl.getUniformLocation(program, 'range');
  const rawRangeLocation = gl.getUniformLocation(program, 'rawRange');
  const rawFilterLocation = gl.getUniformLocation(program, 'rawFilter');
  return {
    clear(width: number, height: number) {
      const dpr = window.devicePixelRatio;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    },
    draw(frame: SpectralFrame, view: Viewport, bounds: DOMRect, clip: DOMRect, origin: DOMRect, frequency: { lo: number; hi: number; scale: 'linear' | 'log' }, range: [number, number], colors: Uint8Array, filter: 'LINEAR' | 'NEAREST', isFeature: boolean) {
      if (!frame.cols || !frame.rows || bounds.width <= 0 || bounds.height <= 0 || clip.width <= 0 || clip.height <= 0) return;
      const dpr = window.devicePixelRatio;
      gl.enable(gl.SCISSOR_TEST);
      gl.viewport(Math.round((bounds.left - origin.left) * dpr), Math.round((origin.bottom - bounds.bottom) * dpr), Math.round(bounds.width * dpr), Math.round(bounds.height * dpr));
      const scissorLeft = Math.ceil((clip.left - origin.left) * dpr); const scissorRight = Math.floor((clip.right - origin.left) * dpr);
      const scissorBottom = Math.ceil((origin.bottom - clip.bottom) * dpr); const scissorTop = Math.floor((origin.bottom - clip.top) * dpr);
      gl.scissor(scissorLeft, scissorBottom, scissorRight - scissorLeft, scissorTop - scissorBottom);
      gl.activeTexture(gl.TEXTURE0);
      let tiles = matrices.get(frame);
      if (!tiles) {
        tiles = [];
        matrices.set(frame, tiles);
        // Each interior tile keeps its adjacent rows so linear filtering crosses tile boundaries.
        const usableRows = frame.rows > maxHeight ? maxHeight - 2 : maxHeight;
        for (let firstRow = 0; firstRow < frame.rows; firstRow += usableRows) {
          const afterRow = Math.min(frame.rows, firstRow + usableRows);
          const dataStart = Math.max(0, firstRow - 1);
          const dataEnd = Math.min(frame.rows, afterRow + 1);
          const dataRows = dataEnd - dataStart;
          const texture = gl.createTexture();
          tiles.push({ texture, firstRow, afterRow, dataStart, dataRows });
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          const format = frame.dtype === 'f32' ? gl.R32F : gl.R16F;
          const type = frame.dtype === 'f32' ? gl.FLOAT : gl.HALF_FLOAT;
          gl.texImage2D(gl.TEXTURE_2D, 0, format, frame.cols, dataRows, 0, gl.RED, type,
            frame.data.subarray(dataStart * frame.cols, dataEnd * frame.cols));
        }
      }
      // R32F linear filtering is optional in WebGL2. Interpolate raw texels in the shader.
      const textureFilter = frame.dtype === 'f32' ? gl.NEAREST : gl[filter];
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, palette);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colors);
      if (frame.dtype === 'f32') {
        const { scale, origin, correction, span } = rawUniforms(range, frame.extent);
        gl.uniform4f(rawRangeLocation, scale, origin, correction, span);
        gl.uniform1i(rawFilterLocation, filter === 'NEAREST' ? 1 : 2);
      } else {
        gl.uniform2f(rangeLocation, range[0], range[1]);
        gl.uniform1i(rawFilterLocation, 0);
      }
      const x0 = (frame.col_t0 - frame.col_dt / 2 - view.t0) / view.secondsPerPx / bounds.width * 2 - 1;
      const x1 = (frame.col_t0 + (frame.cols - 0.5) * frame.col_dt - view.t0) / view.secondsPerPx / bounds.width * 2 - 1;
      const toY = (f: number) => (frequency.scale === 'log' ? Math.log(f / frequency.lo) / Math.log(frequency.hi / frequency.lo) : (f - frequency.lo) / (frequency.hi - frequency.lo)) * 2 - 1;
      const padding = isFeature ? 0.5 : 0;
      const firstEdge = toY(frame.f_axis.lo - padding);
      const lastEdge = toY(frame.f_axis.hi + padding);
      const center = (row: number) => toY(rowCoordinate(frame, row, isFeature));
      const edge = (row: number) => (center(row - 1) + center(row)) / 2;
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      const pos = gl.getAttribLocation(program, 'position'); const uv = gl.getAttribLocation(program, 'coordinate');
      gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
      gl.activeTexture(gl.TEXTURE0);
      for (const { texture, firstRow, afterRow, dataStart, dataRows } of tiles) {
        const coordinates: number[] = [];
        const push = (y0: number, y1: number, a: number, b: number) => {
          coordinates.push(x0, y0, 0, a, x1, y0, 1, a, x0, y1, 0, b, x0, y1, 0, b, x1, y0, 1, a, x1, y1, 1, b);
        };
        let y0 = firstRow === 0 ? firstEdge : edge(firstRow);
        let uv0 = (firstRow - dataStart) / dataRows;
        if (!isFeature) {
          for (let row = firstRow; row < afterRow; row++) {
            const y1 = center(row);
            const uv1 = (row - dataStart + 0.5) / dataRows;
            push(y0, y1, uv0, uv1);
            y0 = y1;
            uv0 = uv1;
          }
        }
        const y1 = afterRow === frame.rows ? lastEdge : edge(afterRow);
        push(y0, y1, uv0, (afterRow - dataStart) / dataRows);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, textureFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, textureFilter);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordinates), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, coordinates.length / 4);
      }
    },
    release(frame: SpectralFrame) {
      const tiles = matrices.get(frame);
      if (tiles) {
        for (const { texture } of tiles) gl.deleteTexture(texture);
        matrices.delete(frame);
      }
    },
    dispose() {
      for (const tiles of matrices.values()) for (const { texture } of tiles) gl.deleteTexture(texture);
      matrices.clear();
      gl.deleteTexture(palette);
      gl.deleteBuffer(vertices);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
