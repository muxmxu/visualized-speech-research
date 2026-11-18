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

export interface SpectralFrame {
  data: Uint16Array;
  rows: number;
  cols: number;
  row_freqs: number[];
  col_t0: number;
  col_dt: number;
  f_axis: { scale: 'linear' | 'log'; lo: number; hi: number };
  view_db_max: number | null;
  lane_db_max: number;
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
    precision highp float; uniform sampler2D matrix; uniform sampler2D palette;
    uniform vec2 range; in vec2 uv; out vec4 color;
    void main() { float db = texture(matrix, uv).r; color = texture(palette, vec2(clamp((db-range.x)/(range.y-range.x),0.,1.), .5)); }`);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader linking failed');
  const vertices = gl.createBuffer();
  const matrices = new Map<SpectralFrame, WebGLTexture>(); const palette = gl.createTexture();
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, 'matrix'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'palette'), 1);
  return {
    clear(width: number, height: number) {
      const dpr = window.devicePixelRatio;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    },
    draw(frame: SpectralFrame, view: Viewport, bounds: DOMRect, clip: DOMRect, origin: DOMRect, frequency: { lo: number; hi: number; scale: 'linear' | 'log' }, range: [number, number], colors: Uint8Array, filter: 'LINEAR' | 'NEAREST') {
      if (!frame.cols || !frame.rows || bounds.width <= 0 || bounds.height <= 0 || clip.width <= 0 || clip.height <= 0) return;
      const dpr = window.devicePixelRatio;
      gl.enable(gl.SCISSOR_TEST);
      gl.viewport(Math.round((bounds.left - origin.left) * dpr), Math.round((origin.bottom - bounds.bottom) * dpr), Math.round(bounds.width * dpr), Math.round(bounds.height * dpr));
      const scissorLeft = Math.ceil((clip.left - origin.left) * dpr); const scissorRight = Math.floor((clip.right - origin.left) * dpr);
      const scissorBottom = Math.ceil((origin.bottom - clip.bottom) * dpr); const scissorTop = Math.floor((origin.bottom - clip.top) * dpr);
      gl.scissor(scissorLeft, scissorBottom, scissorRight - scissorLeft, scissorTop - scissorBottom);
      gl.activeTexture(gl.TEXTURE0);
      let matrix = matrices.get(frame);
      if (!matrix) {
        matrix = gl.createTexture(); matrices.set(frame, matrix);
        gl.bindTexture(gl.TEXTURE_2D, matrix); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, frame.cols, frame.rows, 0, gl.RED, gl.HALF_FLOAT, frame.data);
      } else gl.bindTexture(gl.TEXTURE_2D, matrix);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[filter]); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[filter]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, palette);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colors);
      gl.uniform2f(gl.getUniformLocation(program, 'range'), range[0], range[1]);
      const x0 = (frame.col_t0 - frame.col_dt / 2 - view.t0) / view.secondsPerPx / bounds.width * 2 - 1;
      const x1 = (frame.col_t0 + (frame.cols - 0.5) * frame.col_dt - view.t0) / view.secondsPerPx / bounds.width * 2 - 1;
      const toY = (f: number) => (frequency.scale === 'log' ? Math.log(f / frequency.lo) / Math.log(frequency.hi / frequency.lo) : (f - frequency.lo) / (frequency.hi - frequency.lo)) * 2 - 1;
      const rows = [frame.f_axis.lo, ...frame.row_freqs, frame.f_axis.hi];
      const coords = [0, ...frame.row_freqs.map((_, i) => (i + 0.5) / frame.rows), 1];
      const data: number[] = [];
      for (let i = 0; i < rows.length - 1; i++) {
        const y0 = toY(rows[i]); const y1 = toY(rows[i + 1]); const a = coords[i]; const b = coords[i + 1];
        data.push(x0,y0,0,a, x1,y0,1,a, x0,y1,0,b, x0,y1,0,b, x1,y0,1,a, x1,y1,1,b);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STREAM_DRAW);
      const pos = gl.getAttribLocation(program, 'position'); const uv = gl.getAttribLocation(program, 'coordinate');
      gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 4);
    },
    release(frame: SpectralFrame) { const matrix = matrices.get(frame); if (matrix) { gl.deleteTexture(matrix); matrices.delete(frame); } },
    dispose() { for (const matrix of matrices.values()) gl.deleteTexture(matrix); matrices.clear(); gl.deleteTexture(palette); gl.deleteBuffer(vertices); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); },
  };
}
