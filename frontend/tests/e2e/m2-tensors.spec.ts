import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const python = promisify(execFile);
test.use({ viewport: { width: 1280, height: 760 } });

function npy(rows: number, cols: number, sample: (row: number, col: number) => number) {
  const dictionary = `{'descr': '<f4', 'fortran_order': False, 'shape': (${rows}, ${cols}), }`;
  const header = Buffer.from(dictionary + ' '.repeat((64 - (dictionary.length + 11) % 64) % 64) + '\n');
  const bytes = Buffer.alloc(10 + header.length + rows * cols * 4);
  bytes.set([147, 78, 85, 77, 80, 89, 1, 0]);
  bytes.writeUInt16LE(header.length, 8);
  header.copy(bytes, 10);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) bytes.writeFloatLE(sample(row, col), 10 + header.length + (row * cols + col) * 4);
  return bytes;
}

async function drop(page: Page, name: string, bytes: Buffer) {
  const dataTransfer = await page.evaluateHandle(({ fileName, data }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(data), char => char.charCodeAt(0))], fileName));
    return transfer;
  }, { fileName: name, data: bytes.toString('base64') });
  await page.locator('.lanes').dispatchEvent('drop', { dataTransfer });
  await dataTransfer.dispose();
}

async function display(page: Page) {
  await page.getByText('Display', { exact: true }).first().click();
}

async function pixels(page: Page, points: [number, number][]) {
  const png = await page.screenshot();
  return page.evaluate(async ({ base64, points }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(bitmap, 0, 0);
    return points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3)));
  }, { base64: png.toString('base64'), points });
}

test('opens Files with a keyboard, confirms an opaque tensor leaf and remembers the sample rate', async ({ page, server }) => {
  const root = dirname(server.audio);
  const file = join(root, 'nested.pt');
  await python('uv', ['run', '--no-sync', 'python', '-c',
    'import sys, torch; torch.save({"wav": torch.ones(400), (b"a", 2**61): torch.full((40, 80), 0.25)}, sys.argv[1])', file], { cwd: '..' });
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(root);
  await page.getByTitle('Browse').click();
  const entry = page.getByTitle('nested.pt', { exact: true });
  await entry.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Interpret tensor' });
  await expect(dialog.getByRole('group', { name: 'Tensor leaves' })).toBeVisible();
  await expect(dialog.getByLabel('Layout')).toHaveValue('[N]');
  await expect(page.locator('.lane')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.lane')).toHaveCount(0);
  await entry.dblclick();
  const chosen = dialog.getByRole('button', { name: /2305843009213693952/ });
  await chosen.click();
  await expect(dialog.getByLabel('Kind')).toHaveValue('feature');
  await expect(dialog.getByLabel('Axes')).toHaveValue('[T,F]');
  await dialog.getByLabel('Sample rate (Hz)').fill('16000');
  await dialog.getByLabel('Hop (samples)').fill('1600');
  await dialog.getByLabel('Frequency axis').selectOption('linear');
  await dialog.getByLabel('Maximum frequency (Hz)').fill('6000');
  const confirmation = page.waitForRequest(request => new URL(request.url()).pathname === '/api/open_tensor');
  await dialog.getByLabel('Maximum frequency (Hz)').press('Enter');
  expect((await confirmation).postDataJSON()).toEqual({ path: file,
    key_path: [[{ bytes: '61' }, { int: '2305843009213693952' }]],
    interpretation: { kind: 'feature', axes: '[T,F]', sr: 16000, hop: 1600, freq_axis: { type: 'linear', f_max: 6000 }, value_scale: 'db' },
  });
  await expect(dialog).toBeHidden();
  await expect(page.locator('.lane')).toHaveCount(1);
  const feature = page.getByLabel('Feature nested.pt', { exact: true });
  await expect(feature).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra()).map(frame => [frame.dtype, frame.rows, frame.row_freqs.at(-1)]))).toEqual([['f16', 80, 6000]]);
  const rect = await feature.boundingBox(); if (!rect) throw new Error('Missing feature plot');
  await page.mouse.move(rect.x + 35, rect.y + rect.height / 160);
  await expect(page.locator('footer')).toContainText('6000 Hz · ≈0.3 dB');
  await entry.dblclick();
  await expect(dialog.getByLabel('Sample rate (Hz)')).toHaveValue('16000');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('renders dropped raw f32 features with both filters and no audio or display-only requests', async ({ page, server, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
  const audioRequests: string[] = [];
  page.on('request', request => { if (/\/(waveform|spectrum|pcm|presets)([/?]|$)/.test(request.url())) audioRequests.push(request.url()); });
  const maximum = Math.fround(3e38);
  const base = Math.fround(2 ** 100);
  const next = base + 2 ** 77;
  await page.goto(`${server.url}/?token=${server.token}`);
  await drop(page, 'levels.npy', npy(2, 40, (row, col) => col < 20 ? (row ? maximum : -maximum) : (row ? next : base)));
  const dialog = page.getByRole('dialog', { name: 'Interpret tensor' });
  await expect(dialog.getByRole('group', { name: 'Tensor leaves' })).toHaveCount(0);
  await dialog.getByLabel('Kind').selectOption('feature');
  await dialog.getByLabel('Sample rate (Hz)').fill('8000');
  await dialog.getByLabel('Hop (samples)').fill('800');
  await dialog.getByLabel('Value scale').selectOption('raw');
  await dialog.getByRole('button', { name: 'Open tensor' }).click();
  const feature = page.getByLabel('Feature levels.npy');
  await expect(feature).toBeVisible();
  await expect(page.getByTitle('Play / pause')).toBeDisabled();
  await expect(page.locator('canvas.spectral-canvas')).toHaveCount(1);
  await expect(page.getByLabel(/Waveform/)).toHaveCount(0);
  await page.locator('footer').click();
  await page.keyboard.press('Space');
  await page.keyboard.press('0');
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra()).map(frame => [frame.dtype, frame.rows, frame.cols]))).toEqual([['f32', 2, 40]]);
  await display(page);
  await expect(page.getByLabel('value floor')).toHaveValue(String(-maximum));
  await expect(page.getByLabel('value ceiling')).toHaveValue(String(maximum));
  await expect(page.locator('.colorbar-unit canvas')).toHaveAttribute('aria-label', 'value');
  await expect(page.getByLabel('dB floor')).toHaveCount(0);
  await page.waitForTimeout(300);
  const displayOnly: string[] = [];
  const record = (request: import('@playwright/test').Request) => { if (request.url().includes('/api/')) displayOnly.push(request.url()); };
  page.on('request', record);
  await page.getByLabel('Palette').selectOption('gray');
  const rect = await feature.boundingBox(); if (!rect) throw new Error('Missing feature plot');
  const sample = (fraction: number, y: number): [number, number] => [Math.round(rect.x + fraction * rect.width), Math.round(rect.y + y * rect.height)];
  const points = [sample(0.26, 0.20), sample(0.26, 0.49), sample(0.26, 0.80)];
  const linear = await pixels(page, points);
  expect(linear[0]).toEqual([255, 255, 255]);
  expect(linear[1].every(channel => channel >= 128 && channel <= 140)).toBe(true);
  expect(linear[2]).toEqual([0, 0, 0]);
  await page.getByLabel('Filter').selectOption('NEAREST');
  expect(await pixels(page, points)).toEqual([[255, 255, 255], [255, 255, 255], [0, 0, 0]]);
  await page.getByLabel('value floor').fill(String(base));
  await page.getByLabel('value ceiling').fill(String(next));
  await page.getByLabel('Filter').selectOption('LINEAR');
  const narrow = await pixels(page, [sample(0.73, 0.20), sample(0.73, 0.49), sample(0.73, 0.80)]);
  expect(narrow[0]).toEqual([255, 255, 255]);
  expect(narrow[1].every(channel => channel >= 128 && channel <= 140)).toBe(true);
  expect(narrow[2]).toEqual([0, 0, 0]);
  await page.getByRole('button', { name: 'Copy spec' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(`y=index rows=0-1 | value_scale=raw | value=[${base},${next}] value | cmap=gray`);
  await page.waitForTimeout(250);
  expect(displayOnly).toEqual([]);
  page.off('request', record);
  await page.mouse.move(...sample(0.73, 0.20));
  await expect(page.locator('footer')).toContainText(`Row 1 · ≈${Number(next.toPrecision(9))} value`);
  const first = sample(0.25, 0.75);
  const last = sample(0.5, 0.75);
  await page.mouse.move(...first);
  await page.mouse.down(); await page.mouse.move(...last); await page.mouse.up();
  await expect(page.getByLabel('Duration', { exact: true })).toHaveValue(((last[0] - first[0]) * 4 / rect.width).toFixed(3));
  await expect(page.getByTitle('Play time selection (Space)')).toHaveCount(0);
  const slice = page.waitForRequest(request => request.url().includes('/spectrogram?') && new URL(request.url()).searchParams.get('f_lo') === '1');
  await page.getByLabel('First row').fill('1'); await slice;
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra())[0].row_freqs)).toEqual([1]);
  expect(audioRequests).toEqual([]);
  await mkdir('test-results/screens', { recursive: true });
  await page.screenshot({ path: 'test-results/screens/M2-feature.png' });
});

test('refreshes a Python show feature over WebSocket and keeps audio mel, frequency analysis and playback working', async ({ page, server, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
  const socket = page.waitForEvent('websocket');
  await page.goto(`${server.url}/?token=${server.token}`);
  const ws = await socket;
  const changed = ws.waitForEvent('framereceived', payload => (JSON.parse(String(payload.payload)) as { type: string }).type === 'lanes_changed');
  const refreshed = page.waitForResponse(response => response.url() === `${server.url}/api/session` && response.ok());
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true);
  await changed; await refreshed;
  const audio = page.getByLabel('Spectrogram tone.wav', { exact: true });
  await expect(audio).toBeVisible();
  await page.keyboard.press('0');
  const pushed = ws.waitForEvent('framereceived', payload => (JSON.parse(String(payload.payload)) as { type: string }).type === 'lanes_changed');
  const session = page.waitForResponse(response => response.url() === `${server.url}/api/session` && response.ok());
  await python('uv', ['run', '--no-sync', 'python', '-c',
    'import numpy as np, vsr; vsr.show(np.arange(400, dtype=np.float32).reshape(4,100) / 300, kind="feature", sr=16000, hop=160, freq_axis=dict(type="mel", n_mels=4, fmin=0, fmax=6000, htk=True), value_scale="ln_magnitude", name="model output")'],
    { cwd: '..', env: { ...process.env, VSR_HOME: dirname(server.audio) } });
  await pushed; await session;
  const feature = page.getByLabel('Feature model output', { exact: true });
  await expect(feature).toBeVisible();
  await expect(page.locator('canvas.spectral-canvas')).toHaveCount(1);
  await expect(page.getByLabel('Frequency analysis plot').locator('canvas')).toBeVisible();
  await display(page);
  const melResponse = page.waitForResponse(response => response.url().includes('/spectrogram?') && new URL(response.url()).searchParams.get('mode') === 'mel' && response.ok());
  await page.getByLabel('Spectrogram mode').selectOption('mel'); await melResponse;
  const changedMel = page.waitForResponse(response => response.url().includes('/spectrogram?') && new URL(response.url()).searchParams.get('n_mels') === '24' && response.ok());
  await page.getByLabel('Mel channels').fill('24'); await changedMel;
  await expect(page.getByLabel('Mel maximum (Hz)')).toHaveValue('4000');
  const enabledHtk = page.waitForResponse(response => response.url().includes('/spectrogram?') && new URL(response.url()).searchParams.get('htk') === 'true' && response.ok());
  await page.getByLabel('HTK', { exact: true }).check(); await enabledHtk;
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra()).find(frame => frame.mel)?.rows)).toBe(24);
  const rect = await audio.boundingBox(); if (!rect) throw new Error('Missing mel plot');
  const center = await page.evaluate(() => Object.values(window.__vsr_test.spectra()).find(frame => frame.mel)?.row_freqs[13]);
  if (center === undefined) throw new Error('Missing mel channel');
  await page.mouse.move(rect.x + 60, rect.y + rect.height * (1 - center / 4000));
  await expect(page.locator('footer')).toContainText(`Mel channel 13 · ${center.toFixed(0)} Hz`);
  await page.getByRole('button', { name: 'Copy spec' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('y=mel(24, 0-4000Hz, htk) 0-4000Hz');
  await page.mouse.move(5, 12);
  await page.waitForTimeout(250);
  const melDisplayOnly: string[] = [];
  const record = (request: import('@playwright/test').Request) => { if (request.url().includes('/api/')) melDisplayOnly.push(request.url()); };
  page.on('request', record);
  await page.getByLabel('Palette').selectOption('magma');
  await page.getByLabel('dB floor').fill('-90');
  await page.getByLabel('Filter').selectOption('NEAREST');
  await page.waitForTimeout(250);
  expect(melDisplayOnly).toEqual([]);
  page.off('request', record);
  await mkdir('test-results/screens', { recursive: true });
  await page.screenshot({ path: 'test-results/screens/M2-mel.png' });
  const featureRect = await feature.boundingBox(); if (!featureRect) throw new Error('Missing feature plot');
  await page.mouse.click(featureRect.x + 35, featureRect.y + featureRect.height * 0.3);
  const featureCenter = await page.evaluate(() => Object.values(window.__vsr_test.spectra()).find(frame => !frame.mel && frame.f_axis.scale === 'mel')?.row_freqs[2]);
  if (featureCenter === undefined) throw new Error('Missing feature mel channel');
  await page.mouse.move(featureRect.x + 36, featureRect.y + featureRect.height * 0.32);
  await expect(page.locator('footer')).toContainText(`Mel channel 2 · ${featureCenter.toFixed(0)} Hz`);
  const featureId = await feature.locator('xpath=ancestor::div[@data-lane-id]').getAttribute('data-lane-id');
  const calls: string[] = [];
  page.on('request', request => { if (/\/(waveform|spectrum|pcm)([/?]|$)/.test(request.url())) calls.push(request.url()); });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => calls.filter(url => url.includes('/pcm?')).length).toBeGreaterThan(0);
  expect(calls.every(url => !url.includes(`/lanes/${featureId}/`))).toBe(true);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await audio.click({ position: { x: 25, y: 25 } });
  await expect(page.getByLabel('Spectrogram mode')).toHaveValue('mel');
  await expect(page.getByLabel('Mel channels')).toHaveValue('24');
});

test('draws feature rows spanning the WebGL texture height limit', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const maxHeight = await page.locator('.spectral-canvas').evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2') as WebGL2RenderingContext;
    return gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  });
  const rows = 2 * maxHeight + 3;
  await drop(page, 'wide-feature.npy', npy(rows, 4, row => row < maxHeight ? 0 : 1));
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kind').selectOption('feature');
  await dialog.getByLabel('Sample rate (Hz)').fill('8000');
  await dialog.getByLabel('Hop (samples)').fill('800');
  await dialog.getByLabel('Value scale').selectOption('raw');
  await dialog.getByRole('button', { name: 'Open tensor' }).click();
  const plot = page.getByLabel('Feature wide-feature.npy', { exact: true });
  await expect(plot).toBeVisible();
  await page.keyboard.press('0');
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra()).map(frame => frame.rows))).toEqual([rows]);
  await display(page);
  await page.getByLabel('Palette').selectOption('gray');
  const rect = await plot.boundingBox(); if (!rect) throw new Error('Missing feature plot');
  const x = Math.round(rect.x + rect.width / 2);
  const points: [number, number][] = [[x, Math.round(rect.y + rect.height / 4)], [x, Math.round(rect.y + rect.height * 3 / 4)]];
  expect(await pixels(page, points)).toEqual([[255, 255, 255], [0, 0, 0]]);
});

test('switches a low mel band back to a valid log STFT viewport', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, {
    headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] },
  });
  expect(opened.ok()).toBe(true);
  await expect(page.getByLabel('Spectrogram tone.wav', { exact: true })).toBeVisible();
  await display(page);
  const mode = page.getByLabel('Spectrogram mode');
  const logViewport = () => page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/spectrogram') && url.searchParams.get('mode') === 'stft' && url.searchParams.get('yscale') === 'log';
  });
  const original = logViewport();
  await page.getByLabel('Frequency scale').selectOption('log');
  expect((await original).ok()).toBe(true);
  await mode.selectOption('mel');
  const lowMel = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/spectrogram') && url.searchParams.get('mode') === 'mel'
      && url.searchParams.get('f_lo') === '0' && url.searchParams.get('f_hi') === '10';
  });
  await page.getByLabel('Frequency low').fill('0');
  await page.getByLabel('Frequency high').fill('10');
  expect((await lowMel).ok()).toBe(true);
  const returning = logViewport();
  await mode.selectOption('stft');
  const restored = await returning;
  expect(restored.status(), restored.statusText()).toBe(200);
  const params = new URL(restored.url()).searchParams;
  expect(Number(params.get('f_lo'))).toBe(Math.max(20, 8000 / Number(params.get('n_fft'))));
  expect(Number(params.get('f_hi'))).toBe(4000);
});
