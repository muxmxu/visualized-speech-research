import { execFileSync } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function openTone(page: Page, server: { url: string; token: string; audio: string }) {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  const wave = page.getByLabel('Waveform tone.wav');
  await expect(wave).toBeVisible();
  await expect.poll(() => wave.evaluate((canvas: HTMLCanvasElement) => canvas.width === Math.round(canvas.clientWidth * devicePixelRatio))).toBe(true);
}

test('selection handles cross while retaining the visible ordered interval', async ({ page, server }) => {
  await openTone(page, server);
  await page.keyboard.press('0');
  const wave = page.getByLabel('Waveform tone.wav');
  const bounds = await wave.boundingBox();
  if (!bounds) throw new Error('waveform is not visible');
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 80);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + 80); await page.mouse.up();
  const handle = await page.locator('.handle-1').boundingBox();
  if (!handle) throw new Error('handle is not visible');
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 80);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + 80); await page.mouse.move(bounds.x + bounds.width * 0.05, bounds.y + 80); await page.mouse.up();
  expect(Number(await page.getByLabel('Start', { exact: true }).inputValue())).toBeCloseTo(0.05, 2);
  expect(Number(await page.getByLabel('End', { exact: true }).inputValue())).toBeCloseTo(0.2, 2);
  const selection = await page.locator('.selection').boundingBox();
  if (!selection) throw new Error('selection is not visible');
  expect(selection.x).toBeCloseTo(bounds.x + bounds.width * 0.05, 0);
  expect(selection.width).toBeCloseTo(bounds.width * 0.15, 0);
});

test('numeric selection entry keeps the visible interval ordered', async ({ page, server }) => {
  await openTone(page, server);
  await page.keyboard.press('0');
  await page.getByLabel('End', { exact: true }).fill('0.6');
  await page.getByLabel('Start', { exact: true }).fill('0.8');
  expect(Number(await page.getByLabel('Start', { exact: true }).inputValue())).toBeCloseTo(0.6);
  expect(Number(await page.getByLabel('End', { exact: true }).inputValue())).toBeCloseTo(0.8);
  expect(Number(await page.getByLabel('Duration').inputValue())).toBeCloseTo(0.2);
  const bounds = await page.getByLabel('Waveform tone.wav').boundingBox();
  const selection = await page.locator('.selection').boundingBox();
  if (!bounds || !selection) throw new Error('selection is not visible');
  expect(selection.x).toBeCloseTo(bounds.x + bounds.width * 0.6, 0);
  expect(selection.width).toBeCloseTo(bounds.width * 0.2, 0);
});

test('sample zoom displays distinct increasing ruler labels', async ({ page, server }) => {
  await openTone(page, server);
  await page.keyboard.press('0');
  for (let i = 0; i < 10; i++) await page.keyboard.press('=');
  const labels = (await page.locator('.timeline span').allTextContents()).map(Number);
  expect(labels.length).toBeGreaterThan(1);
  for (let i = 1; i < labels.length; i++) expect(labels[i]).toBeGreaterThan(labels[i - 1]);
});

test('workspace survives zero waveform width and recovers when widened', async ({ page, server }) => {
  await openTone(page, server);
  const wave = page.getByLabel('Waveform tone.wav');
  await page.setViewportSize({ width: 400, height: 720 });
  await expect.poll(() => wave.evaluate(canvas => canvas.clientWidth)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 300, height: 720 });
  await expect.poll(() => wave.evaluate(canvas => canvas.clientWidth)).toBe(0);
  await expect(page.locator('#root .dock')).toBeAttached();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(wave).toBeVisible();
  await expect.poll(() => wave.evaluate(canvas => canvas.clientWidth)).toBeGreaterThan(0);
  await expect(page.locator('.timeline span')).toHaveCount(6);
});

test('playback at zero waveform width recovers when widened', async ({ page, server }) => {
  await openTone(page, server);
  const wave = page.getByLabel('Waveform tone.wav');
  await page.setViewportSize({ width: 300, height: 720 });
  await expect.poll(() => wave.evaluate(canvas => canvas.clientWidth)).toBe(0);
  await page.getByTitle('Loop (L)').click();
  await page.getByTitle('Play / pause').click();
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(wave).toBeVisible();
  await expect.poll(() => wave.evaluate(canvas => canvas.clientWidth)).toBeGreaterThan(0);
  await expect(page.locator('.timeline span')).toHaveCount(6);
  const labels = (await page.locator('.timeline span').allTextContents()).map(Number);
  expect(labels.every(Number.isFinite)).toBe(true);
  for (let i = 1; i < labels.length; i++) expect(labels[i]).toBeGreaterThan(labels[i - 1]);
  await expect.poll(() => wave.evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
  })).toBe(true);
  expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
});

test('control wheel zoom cancels the browser default', async ({ page, server }) => {
  await openTone(page, server);
  await page.keyboard.press('0');
  await page.evaluate(() => { document.addEventListener('wheel', event => { document.body.dataset.wheelCancelled = String(event.defaultPrevented); }); });
  const bounds = await page.getByLabel('Waveform tone.wav').boundingBox();
  if (!bounds) throw new Error('waveform is not visible');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
  await expect(page.locator('body')).toHaveAttribute('data-wheel-cancelled', 'true');
});

test('opens and uploads audio, changes lanes and device, and keeps the token private', async ({ page, server }) => {
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'arc')?.value as CanvasRenderingContext2D['arc'];
    CanvasRenderingContext2D.prototype.arc = function (...args) { this.canvas.dataset.samplePoints = String(Number(this.canvas.dataset.samplePoints || 0) + 1); return original.apply(this, args); };
  });
  const unauthorized = await page.request.get(`${server.url}/api/session`);
  expect(unauthorized.status()).toBe(401);
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page).not.toHaveURL(/token=/);
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
  await page.getByTitle('Mute').click();
  await expect(page.getByTitle('Mute')).toHaveClass(/active/);
  await page.getByLabel('Lane name').fill('Renamed');
  await page.getByLabel('Lane name').blur();
  await expect(page.getByLabel('Waveform Renamed')).toBeVisible();
  await page.getByText('Settings', { exact: true }).click();
  await expect(page.getByText('Current: cpu')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
  await page.getByLabel('Compute device').selectOption('cpu');
  await expect(page.getByText('Self-check:')).toBeVisible();
  await page.locator('.lanes').dispatchEvent('drop', { dataTransfer: await page.evaluateHandle(bytes => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], 'upload.wav', { type: 'audio/wav' })); return transfer; }, [...server.bytes]) });
  await expect(page.getByLabel('Waveform upload.wav')).toBeVisible();
  await page.keyboard.press('0'); await page.keyboard.press('=');
  const cachedWave = page.getByLabel('Waveform Renamed');
  await expect.poll(() => cachedWave.evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, index) => index % 4 === 3 && value > 0);
  })).toBe(true);
  let releaseRequest: () => void = () => undefined;
  const pending = new Promise<void>(resolve => { releaseRequest = resolve; });
  await page.route('**/waveform?*', async route => { await pending; await route.continue(); });
  const redraw = await cachedWave.evaluate(async (canvas: HTMLCanvasElement) => {
    const before = canvas.toDataURL();
    canvas.closest('.lanes')?.dispatchEvent(new WheelEvent('wheel', { deltaX: 30, bubbles: true, cancelable: true }));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return before !== canvas.toDataURL();
  });
  expect(redraw).toBe(true);
  releaseRequest();
  await page.unrouteAll({ behavior: 'wait' });
  await page.keyboard.press('0'); await page.keyboard.press('=');
  const overview = page.locator('.overview');
  const rect = await overview.boundingBox();
  if (!rect) throw new Error('rect is not visible');
  const tick = page.locator('.timeline span').first();
  const beforeMove = Number(await tick.textContent());
  await page.mouse.move(rect.x + rect.width * 0.25, rect.y + 15);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width * 0.35, rect.y + 15); await page.mouse.up();
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThan(beforeMove + 0.05);
  const beforeResize = Number(await page.locator('.timeline span').last().textContent()) - Number(await tick.textContent());
  const box = await page.locator('.overview-box').boundingBox();
  if (!box) throw new Error('box is not visible');
  await page.mouse.move(box.x + box.width - 1, box.y + 12);
  await page.mouse.down(); await page.mouse.move(box.x + box.width - rect.width * 0.1, box.y + 12); await page.mouse.up();
  await expect.poll(async () => Number(await page.locator('.timeline span').last().textContent()) - Number(await tick.textContent())).toBeLessThan(beforeResize - 0.05);
  const wave = page.getByLabel('Waveform Renamed');
  const bounds = await wave.boundingBox();
  if (!bounds) throw new Error('bounds is not visible');
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 80);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + 80); await page.mouse.up();
  const start = Number(await page.getByLabel('Start', { exact: true }).inputValue());
  const end = Number(await page.getByLabel('End', { exact: true }).inputValue());
  expect(end).toBeGreaterThan(start + 0.1);
  const handle = await page.locator('.lane').first().locator('.handle-1').boundingBox();
  if (!handle) throw new Error('handle is not visible');
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 80);
  await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + bounds.width * 0.1, handle.y + 80); await page.mouse.up();
  await expect.poll(async () => Number(await page.getByLabel('End', { exact: true }).inputValue())).toBeGreaterThan(end + 0.02);
  await page.keyboard.press('0');
  for (let i = 0; i < 10; i++) await page.keyboard.press('=');
  await expect.poll(async () => Number(await wave.getAttribute('data-sample-points'))).toBeGreaterThan(0);
  await mkdir('test-results/screens', { recursive: true });
  await page.screenshot({ path: 'test-results/screens/M0-workspace.png' });
});


test.describe('server fixture cleanup', () => {
  let home: string;
  test.afterAll(async () => {
    await expect(access(home)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('removes its temporary directory after the server exits by signal', async ({ server }) => {
    test.setTimeout(15000);
    home = dirname(server.audio);
    const exited = new Promise<NodeJS.Signals | null>(resolve => server.process.once('exit', (_code, signal) => resolve(signal)));
    const childPid = Number(execFileSync('pgrep', ['-P', String(server.process.pid)], { encoding: 'utf8' }).trim());
    process.kill(childPid, 'SIGTERM');
    expect(server.process.kill('SIGKILL')).toBe(true);
    expect(await exited).toBe('SIGKILL');
  });
});
