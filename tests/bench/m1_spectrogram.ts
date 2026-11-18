import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createInterface } from 'node:readline';
import config from '../../frontend/playwright.config.ts';
import { decodeFrame, type FrameArray } from '../../frontend/src/api/frame.ts';
import type { Browser, Page } from '../../frontend/node_modules/playwright/index.js';

const { chromium } = createRequire(resolve('frontend/package.json'))('@playwright/test') as typeof import('../../frontend/node_modules/@playwright/test/index.js');
const [root, device] = process.argv.slice(2);
const screens = 'frontend/test-results/screens';
const timeout = 180_000;

type Stamp = { ms: number; frame: number };
type BodyTime = { url: string; start: number; end: number; buffer: ArrayBuffer };
type Draw = Stamp & { palette: number };
type Upload = { stamp: Stamp; data: Uint16Array };
type DrawnResponse = {
  channel: number; path: string; params: Record<string, string>; start: number;
  bodyMs: number; drawMs: number; bytes: number;
};
type Probe = {
  mark: Stamp; tick: number; draws: Draw[]; uploads: Upload[];
  requests: { url: string; start: number }[]; bodies: BodyTime[];
};
type Runtime = { port: number; token: string };
declare global {
  interface Window { spectralBenchmark: Probe }
}

function installProbe() {
  const probe: Probe = { mark: { ms: 0, frame: 0 }, tick: 0, draws: [], uploads: [], requests: [], bodies: [] };
  window.spectralBenchmark = probe;
  function tick() {
    probe.tick += 1;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const fetchResponse = window.fetch.bind(window);
  const starts = new WeakMap<Response, number>();
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const start = performance.now();
    probe.requests.push({ url, start });
    const response = await fetchResponse(input, init);
    starts.set(response, start);
    return response;
  };
  const readBody = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function () {
    const buffer = await readBody.call(this);
    const start = starts.get(this);
    if (start !== undefined && this.ok && this.url.includes('/spectrogram?')) {
      probe.bodies.push({ url: this.url, start, end: performance.now(), buffer });
    }
    return buffer;
  };

  const prototype = WebGL2RenderingContext.prototype;
  const upload = prototype.texImage2D;
  const draw = prototype.drawArrays;
  const pending = new WeakMap<WebGL2RenderingContext, Uint16Array>();
  let palette = 0;
  prototype.texImage2D = function (...args: unknown[]) {
    Reflect.apply(upload, this, args);
    if (!(this.canvas instanceof HTMLCanvasElement) || !this.canvas.matches('.spectral-canvas')) return;
    const pixels = args[8];
    if (args[2] === this.R16F && pixels instanceof Uint16Array) pending.set(this, pixels);
    if (args[3] === 256 && args[4] === 1 && pixels instanceof Uint8Array) {
      // The midpoint RGB distinguishes the heat and viridis lookup tables.
      palette = (pixels[512] << 16) + (pixels[513] << 8) + pixels[514];
    }
  };
  prototype.drawArrays = function (mode, first, count) {
    draw.call(this, mode, first, count);
    if (this.canvas instanceof HTMLCanvasElement && this.canvas.matches('.spectral-canvas')) {
      const stamp = { ms: performance.now(), frame: probe.tick };
      probe.draws.push({ ...stamp, palette });
      const data = pending.get(this);
      if (data) {
        probe.uploads.push({ stamp, data });
        pending.delete(this);
      }
    }
  };
}

async function withServer<T>(name: string, action: (runtime: Runtime) => Promise<T>): Promise<T> {
  const home = join(root, name);
  await mkdir(home);
  const server = spawn('uv', ['run', '--no-sync', 'vsr', 'serve', '--port', '0', '--no-browser', '--device', device], {
    env: { ...process.env, VSR_HOME: home },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const exited = once(server, 'exit');
  try {
    let ready = false;
    for await (const line of createInterface({ input: server.stderr })) {
      if (line.includes('Application startup complete.')) { ready = true; break; }
    }
    server.stderr.resume();
    assert(ready, 'VSR server did not finish startup');
    const runtime = JSON.parse(await readFile(join(home, 'runtime.json'), 'utf8')) as Runtime;
    const settings = await api(runtime, '/settings').then(response => response.json());
    assert.equal(settings.compute_device, device, settings.reason);
    return await action(runtime);
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
    await exited;
  }
}

async function api(runtime: Runtime, path: string, body?: object) {
  const response = await fetch(`http://127.0.0.1:${runtime.port}/api${path}`, {
    headers: { Authorization: `Bearer ${runtime.token}`, 'Content-Type': 'application/json' },
    method: body ? 'POST' : 'GET',
    ...(body && { body: JSON.stringify(body) }),
  });
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}

async function openAudio(page: Page, runtime: Runtime, audio: string) {
  await page.addInitScript(installProbe);
  await page.goto(`http://127.0.0.1:${runtime.port}/?token=${runtime.token}`);
  await page.waitForFunction(() => {
    const directory = document.querySelector<HTMLInputElement>('[aria-label="Directory"]');
    return directory && directory.value !== '~';
  });
  await page.getByLabel('Directory').fill(dirname(audio));
  await page.getByTitle('Browse').click();
  const file = page.getByRole('button', { name: `♪ ${basename(audio)}`, exact: true });
  await file.evaluate(node => node.addEventListener('dblclick', () => {
    window.spectralBenchmark.mark = { ms: performance.now(), frame: window.spectralBenchmark.tick };
  }, { capture: true, once: true }));
  await file.dblclick();
}

async function armChange(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).evaluate(node => node.addEventListener('change', () => {
    window.spectralBenchmark.mark = { ms: performance.now(), frame: window.spectralBenchmark.tick };
  }, { capture: true, once: true }));
}

// Match the framed f16 body to the actual uploaded matrix after the timed draw.
async function drawnResponses(page: Page, fft: number, channels: number) {
  const result = await page.waitForFunction(({ fft, channels }) => {
    const { mark, bodies, uploads } = window.spectralBenchmark;
    const draws: DrawnResponse[] = [];
    for (const body of bodies) {
      const url = new URL(body.url);
      if (body.start < mark.ms || url.searchParams.get('n_fft') !== String(fft)) continue;
      const channel = Number(url.searchParams.get('channel'));
      if (draws.some(item => item.channel === channel)) continue;
      const header = new DataView(body.buffer).getUint32(0, true);
      const values = new Uint16Array(body.buffer, Math.ceil((4 + header) / 8) * 8);
      const draw = uploads.find(item => item.stamp.ms >= body.end && item.data.length === values.length
        && item.data.every((value, index) => value === values[index]));
      if (draw) draws.push({
        channel, path: url.pathname, params: Object.fromEntries(url.searchParams), start: body.start,
        bodyMs: body.end - body.start, drawMs: draw.stamp.ms - mark.ms, bytes: body.buffer.byteLength,
      });
    }
    return draws.length === channels ? draws.sort((a, b) => a.channel - b.channel) : false;
  }, { fft, channels }, { timeout });
  const responses = await result.jsonValue();
  assert(responses);
  await result.dispose();
  return responses;
}

async function wheel(page: Page, count: number) {
  return page.locator('.spectral-surface').first().evaluate(async (target, count) => {
    const probe = window.spectralBenchmark;
    const rect = target.getBoundingClientRect();
    const events: Stamp[] = [];
    for (let i = 0; i < count; i++) {
      await new Promise(requestAnimationFrame);
      const stamp = { ms: performance.now(), frame: probe.tick };
      events.push(stamp);
      if (i === 0) probe.mark = stamp;
      target.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, shiftKey: i % 2 === 0, ctrlKey: i % 2 === 1,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
        deltaY: i % 2 === 0 ? 2 : -5,
      }));
    }
    await new Promise(requestAnimationFrame);
    const end = performance.now();
    return { events, end, draws: probe.draws.filter(draw => draw.ms >= events[0].ms && draw.ms < end) };
  }, count);
}

async function stereo(browser: Browser, runtime: Runtime, iteration: number) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await openAudio(page, runtime, join(root, 'stereo.wav'));
    const cold = await drawnResponses(page, 2048, 2);
    assert(cold.every(item => item.params.hop === '512' && item.params.win_length === '2048'));
    await page.screenshot({ path: `${screens}/M1-bench-stereo-${iteration}.png` });
    await page.mouse.move(0, 0);

    await wheel(page, 1);
    const warm = await drawnResponses(page, 2048, 2);
    for (const [index, response] of warm.entries()) {
      const previous = cold[index];
      assert.equal(response.path, previous.path);
      for (const key of ['channel', 'mode', 'n_fft', 'win_length', 'hop', 'window', 'window_param']) {
        assert.equal(response.params[key], previous.params[key]);
      }
      assert.notEqual(response.params.t0, previous.params.t0);
    }

    // Sample the rendered pixels outside the timing interval to verify the draw changed them.
    const canvas = page.locator('.spectral-canvas');
    const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
    const previousPalette = await page.evaluate(() => window.spectralBenchmark.draws.at(-1)?.palette);
    assert(previousPalette !== undefined);
    await armChange(page, 'Palette');
    await page.getByLabel('Palette').selectOption('viridis');
    const colorHandle = await page.waitForFunction(previous => {
      const probe = window.spectralBenchmark;
      const draw = probe.draws.find(item => item.ms >= probe.mark.ms && item.palette !== previous);
      return draw && { ms: draw.ms - probe.mark.ms, frames: draw.frame - probe.mark.frame, palette: draw.palette };
    }, previousPalette);
    const color = await colorHandle.jsonValue();
    await colorHandle.dispose();
    assert(color);
    assert.notEqual(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()), before);
    // Cover the application's 150 ms maximum request debounce.
    await page.evaluate(async () => new Promise(resolve => setTimeout(resolve, 175)));
    const colorRequests = await page.evaluate(() => window.spectralBenchmark.requests.filter(
      request => request.start >= window.spectralBenchmark.mark.ms,
    ).map(request => request.url));
    await page.screenshot({ path: `${screens}/M1-bench-palette-${iteration}.png` });

    const gesture = await wheel(page, 60);
    const drawnFrames = new Set(gesture.draws.map(draw => draw.frame)).size;
    assert(drawnFrames > 0, 'No spectral redraws during the wheel sequence');
    return {
      cold, warm, color, colorRequests, gesture, drawnFrames,
      row2_ms: Math.min(...cold.map(item => item.drawMs)),
      row3_ms: warm[0].bodyMs,
      row4_ms: color.ms,
      row4_frames: color.frames,
      row4_requests: colorRequests.length,
      row6_fps: 1000 * drawnFrames / (gesture.end - gesture.events[0].ms),
    };
  } finally {
    await page.close();
  }
}

async function mono(browser: Browser, runtime: Runtime, iteration: number) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await openAudio(page, runtime, join(root, 'mono.wav'));
    await drawnResponses(page, 2048, 1);
    await armChange(page, 'FFT');
    await page.getByLabel('FFT').selectOption('4096');
    const [replacement] = await drawnResponses(page, 4096, 1);
    await page.screenshot({ path: `${screens}/M1-bench-fft-${iteration}.png` });
    return replacement;
  } finally {
    await page.close();
  }
}

async function cachedFullLane(runtime: Runtime) {
  const opened = await api(runtime, '/open', { paths: [join(root, 'wideband.wav')] }).then(response => response.json());
  const preset = await api(runtime, '/presets?sr=48000').then(response => response.json());
  const { n_fft, win_length, hop, window } = preset.wideband;
  assert.deepEqual([n_fft, win_length, hop, window], [1024, 240, 48, 'hann']);
  const query = new URLSearchParams({
    t0: '0', t1: '600', width: '1024', height: '256', f_lo: '0', f_hi: '8000',
    yscale: 'linear', channel: '0', mode: 'stft', n_fft, win_length, hop, window, window_param: '0',
  });
  const path = `/lanes/${opened.lanes[0].id}/spectrogram?${query}`;
  async function request() {
    const start = performance.now();
    const body = await api(runtime, path).then(response => response.arrayBuffer());
    const ms = performance.now() - start;
    const { arrays, header } = decodeFrame(body);
    const frame = arrays as FrameArray;
    assert.deepEqual(frame.shape, [171, 586]);
    assert.equal(frame.dtype, 'f16');
    assert.equal(header.col_t0, 0.5115);
    assert.equal(header.col_dt, 1.024);
    const rows = header.row_freqs as number[];
    assert.equal(rows[0], 0);
    assert.equal(rows.at(-1), 7968.75);
    return { ms, bytes: body.byteLength, shape: frame.shape, query: Object.fromEntries(query) };
  }
  const prime = await request();
  const warm = [];
  for (let i = 0; i < 3; i++) warm.push(await request());
  return { prime, warm };
}

await mkdir(screens, { recursive: true });
const fullLane = await withServer('wideband', cachedFullLane);
const browser = await chromium.launch(config.use?.launchOptions);
try {
  for (let i = 1; i <= 3; i++) {
    const { row2_ms, row3_ms, row4_ms, row4_frames, row4_requests, row6_fps, ...details } =
      await withServer(`stereo-${i}`, runtime => stereo(browser, runtime, i));
    const replacement = await withServer(`mono-${i}`, runtime => mono(browser, runtime, i));
    console.log(JSON.stringify({
      run: i, device, browser: browser.version(), details, replacement,
      fullLane: fullLane.warm[i - 1], ...(i === 1 && { fullLanePrime: fullLane.prime }),
      metrics: {
        row2_ms, row3_ms, row4_ms, row4_frames, row4_requests,
        row5_ms: replacement.drawMs, row6_fps, full_lane_ms: fullLane.warm[i - 1].ms,
      },
    }));
  }
} finally {
  await browser.close();
}
