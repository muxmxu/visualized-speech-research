import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test, expect } from './fixtures';

async function open(page: import('@playwright/test').Page, server: { url: string; token: string; audio: string }) {
  await page.goto(`${server.url}/?token=${server.token}`);
  const response = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio, server.audio] } });
  expect(response.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(2);
}
async function draw(page: import('@playwright/test').Page) {
  await page.getByTitle('Time-frequency selection (E)').click();
  const surface = page.getByLabel('Time frequency selection surface').first();
  const box = await surface.boundingBox(); expect(box).not.toBeNull();
  const b = box as NonNullable<typeof box>;
  await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.25);
  await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.65, b.y + b.height * 0.75, { steps: 5 }); await page.mouse.up();
  await expect(page.getByLabel('Time frequency selection', { exact: true })).toBeVisible();
}

test('selects a view, auditions its band, and limits frequency analysis', async ({ page, server }) => {
  await open(page, server); await page.locator('.lane-header').first().click(); await page.getByLabel('FFT').selectOption('512'); await draw(page);
  await page.locator('.lane-header').last().click();
  const firstLane = await page.locator('.lane').first().getAttribute('data-lane-id');
  await page.getByLabel('Start', { exact: true }).fill('0.100');
  await page.getByLabel('End', { exact: true }).fill('0.800');
  await page.getByLabel('Low Hz').fill('200'); await page.getByLabel('High Hz').fill('1000');
  await page.getByLabel('Analysis method').selectOption('welch');
  const spectrum = await page.waitForResponse(response => response.url().endsWith('/spectrum') && (response.request().postDataJSON() as { method: string }).method === 'welch' && response.ok());
  const data = spectrum.request().postDataJSON() as { t0: number; t1: number };
  expect(data.t0).toBeCloseTo(0.1); expect(data.t1).toBeCloseTo(0.8);
  const pcm: URL[] = []; page.on('request', req => { if (req.url().includes('/pcm?')) pcm.push(new URL(req.url())); });
  await page.locator('header strong').click(); await page.keyboard.press('Space');
  await expect.poll(() => pcm.length).toBeGreaterThan(0);
  expect(pcm.every(url => url.pathname.includes(firstLane as string))).toBe(true);
  const query = pcm[0].searchParams;
  expect(Number(query.get('selection_t0'))).toBeCloseTo(0.1); expect(Number(query.get('selection_t1'))).toBeCloseTo(0.8);
  expect(Number(query.get('f_lo'))).toBeCloseTo(200); expect(Number(query.get('f_hi'))).toBeCloseTo(1000);
  expect(query.get('n_fft')).toBe('512'); expect(query.get('win_length')).toBe('256'); expect(query.get('window')).toBe('hann');
  await page.screenshot({ path: 'test-results/screens/M1-audition.png' });
  await page.setViewportSize({ width: 800, height: 600 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
  await expect(page.getByLabel('High Hz')).toBeInViewport();
});

test('long masked audition preserves complete rectangle in consecutive chunks', async ({ page, server }) => {
  const samples = 21 * 8000; const bytes = Buffer.alloc(44 + samples * 2); server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(server.bytes.readInt16LE(44 + (i % 8000) * 2), 44 + i * 2);
  const path = join(dirname(server.audio), 'long-audition.wav'); await writeFile(path, bytes);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [path] } }); expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1); await draw(page);
  await page.getByLabel('Start', { exact: true }).fill('0'); await page.getByLabel('End', { exact: true }).fill('21');
  await page.getByLabel('Low Hz').fill('200'); await page.getByLabel('High Hz').fill('1000');
  const requests: URL[] = []; page.on('request', req => { if (req.url().includes('/pcm?')) requests.push(new URL(req.url())); });
  await page.locator('header strong').click(); await page.keyboard.press('Space');
  await expect.poll(() => requests.length, { timeout: 60000 }).toBeGreaterThanOrEqual(2);
  const [first, second] = requests.map(url => url.searchParams);
  expect(Number(first.get('t1'))).toBeCloseTo(Number(second.get('t0')), 5);
  for (const q of [first, second]) { expect(Number(q.get('selection_t0'))).toBe(0); expect(Number(q.get('selection_t1'))).toBe(21); expect(Number(q.get('f_lo'))).toBe(200); expect(Number(q.get('f_hi'))).toBe(1000); expect(q.get('n_fft')).toBe('256'); expect(q.get('win_length')).toBe('256'); expect(q.get('window')).toBe('hann'); expect(q.get('window_param')).toBe('0'); }
});

test('moves and resizes a rectangle and keeps it visible when changing tools', async ({ page, server }) => {
  await open(page, server); await draw(page);
  const rectangle = page.getByLabel('Time frequency selection', { exact: true });
  const start = Number(await page.getByLabel('Start', { exact: true }).inputValue());
  const end = Number(await page.getByLabel('End', { exact: true }).inputValue());
  const bounds = await rectangle.boundingBox(); expect(bounds).not.toBeNull();
  const b = bounds as NonNullable<typeof bounds>;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2, { steps: 3 }); await page.mouse.up();
  const movedStart = Number(await page.getByLabel('Start', { exact: true }).inputValue());
  const movedEnd = Number(await page.getByLabel('End', { exact: true }).inputValue());
  expect(movedStart).toBeGreaterThan(start); expect(movedEnd - movedStart).toBeCloseTo(end - start, 2);
  const handle = rectangle.locator('[data-handle="e"]'); const edge = await handle.boundingBox(); expect(edge).not.toBeNull();
  const e = edge as NonNullable<typeof edge>; await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2); await page.mouse.down(); await page.mouse.move(e.x + e.width / 2 + 20, e.y + e.height / 2); await page.mouse.up();
  expect(Number(await page.getByLabel('End', { exact: true }).inputValue())).toBeGreaterThan(movedEnd);
  await page.getByTitle('Time selection (T)').click(); await expect(rectangle).toBeVisible();
  await rectangle.click({ button: 'right' });
  await expect(rectangle.getByRole('button', { name: 'Zoom to selection' })).toBeVisible();
  await rectangle.getByRole('button', { name: 'Zoom to selection' }).click();
  await page.locator('.waveform-part').first().click({ position: { x: 10, y: 10 } }); await expect(rectangle).toHaveCount(0);
});

test('closing the selected source lane clears its rectangle and restores ordinary playback', async ({ page, server }) => {
  await open(page, server); await draw(page);
  const survivor = await page.locator('.lane').last().getAttribute('data-lane-id');
  await page.getByTitle('Close lane').first().click();
  await expect(page.locator('.lane')).toHaveCount(1);
  await expect(page.getByLabel('Low Hz')).toHaveCount(0);
  const requests: URL[] = [];
  page.on('request', req => { if (req.url().includes('/pcm?')) requests.push(new URL(req.url())); });
  await page.locator('header strong').click(); await page.keyboard.press('Space');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].pathname).toContain(survivor as string);
  expect(requests[0].searchParams.has('f_lo')).toBe(false);
});

test('closing the selected view clears its rectangle and retains the lane', async ({ page, server }) => {
  await open(page, server);
  await page.getByTitle('Add view').first().click(); await expect(page.locator('.lane')).toHaveCount(3);
  await draw(page); await page.getByTitle('Close lane').first().click();
  await expect(page.locator('.lane')).toHaveCount(2);
  await expect(page.getByLabel('Low Hz')).toHaveCount(0);
  const requests: URL[] = [];
  page.on('request', req => { if (req.url().includes('/pcm?')) requests.push(new URL(req.url())); });
  await page.locator('header strong').click(); await page.keyboard.press('Space');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].searchParams.has('f_lo')).toBe(false);
});

test('E tool keeps spectrogram frequency and level hover readout', async ({ page, server }) => {
  await open(page, server);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBeGreaterThan(0);
  const surface = page.locator('.spectral-surface').first();
  await surface.hover({ position: { x: 30, y: 30 } });
  await expect(page.locator('footer')).toContainText('Hz'); await expect(page.locator('footer')).toContainText('dB');
  await page.getByTitle('Time-frequency selection (E)').click();
  await page.getByLabel('Time frequency selection surface').first().hover({ position: { x: 30, y: 30 } });
  await expect(page.locator('footer')).toContainText('Hz'); await expect(page.locator('footer')).toContainText('dB');
});

test('ordinary time selection exposes floating playback for its interval', async ({ page, server }) => {
  await open(page, server);
  const wave = page.locator('.waveform-part').first(); const bounds = await wave.boundingBox(); expect(bounds).not.toBeNull();
  const b = bounds as NonNullable<typeof bounds>;
  await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 70, b.y + 10); await page.mouse.up();
  const start = Number(await page.getByLabel('Start', { exact: true }).inputValue());
  const end = Number(await page.getByLabel('End', { exact: true }).inputValue()); expect(end).toBeGreaterThan(start);
  const requests: URL[] = []; page.on('request', req => { if (req.url().includes('/pcm?')) requests.push(new URL(req.url())); });
  await page.getByTitle('Play time selection (Space)').first().click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].searchParams.has('f_lo')).toBe(false);
  expect(Number(requests[0].searchParams.get('t0'))).toBeCloseTo(start, 2);
  expect(Number(requests[0].searchParams.get('t1'))).toBeCloseTo(end, 2);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.01);
});
