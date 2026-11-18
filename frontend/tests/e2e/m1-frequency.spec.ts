import { test, expect } from './fixtures';
import { decodeFrame, type FrameArray } from '../../src/api/frame';

async function openAudio(page: import('@playwright/test').Page, audio: string) {
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(audio.slice(0, audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.locator('.lane')).toHaveCount(1);
}

test('plots frame, Welch and full spectra with units, log axis and multiple lanes', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await openAudio(page, server.audio);
  const plot = page.getByLabel('Frequency analysis plot');
  await expect(plot.locator('canvas')).toBeVisible();
  await expect(plot.locator('.u-series')).toHaveCount(2);
  const initialIds = await plot.getAttribute('data-curve-ids');
  expect(initialIds).toMatch(/:frame$/);
  const welchResponse = page.waitForResponse(response => response.url().endsWith('/spectrum') && (response.request().postDataJSON() as { method: string }).method === 'welch' && response.ok());
  await page.getByLabel('Analysis method').selectOption('welch');
  const welchFrame = decodeFrame(Uint8Array.from(await (await welchResponse).body()).buffer);
  const welchArrays = welchFrame.arrays as Record<string, FrameArray>;
  const freqs = Array.from(welchArrays.freqs.data); const power = Array.from(welchArrays.values.data);
  const peak = power.indexOf(Math.max(...power));
  expect(freqs[peak]).toBeGreaterThan(420); expect(freqs[peak]).toBeLessThan(460);
  expect(welchFrame.header.unit).toBe('dbfs');
  await expect(plot).toHaveAttribute('data-curve-ids', /:mean$/);
  await page.getByText('p90', { exact: true }).click();
  await expect(plot.locator('.u-series')).toHaveCount(3);
  await expect(plot).toHaveAttribute('data-curve-ids', /:mean,.*:p90$/);
  await page.getByLabel('Analysis unit').selectOption('db_per_hz');
  await expect(plot).toHaveAttribute('data-unit', 'dB/Hz');
  await page.getByLabel('Frequency axis').selectOption('log');
  await expect(plot.locator('canvas')).toBeVisible();
  await page.getByLabel('Analysis method').selectOption('full');
  await expect(plot).toHaveAttribute('data-curve-ids', /:full$/);
  await expect(plot).toHaveAttribute('data-unit', 'dB');
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.locator('.lane')).toHaveCount(2);
  await expect(plot.locator('.u-series')).toHaveCount(3);
  const ids = (await plot.getAttribute('data-curve-ids'))?.split(',');
  expect(ids).toHaveLength(2); expect(ids?.[0]).not.toBe(ids?.[1]);
  await page.screenshot({ path: 'test-results/screens/M1-frequency.png' });
});

test('frame follows hover while Welch does not issue hover requests', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await openAudio(page, server.audio);
  const requests: { method: string; t0: number }[] = [];
  page.on('request', request => { if (request.url().endsWith('/spectrum')) { const data = request.postDataJSON() as { method: string; t0: number }; requests.push(data); } });
  const wave = page.locator('.wave').first();
  await wave.hover({ position: { x: 20, y: 10 } });
  await expect.poll(() => requests.some(item => item.method === 'frame')).toBe(true);
  const afterHover = requests.filter(item => item.method === 'frame').at(-1)?.t0;
  expect(afterHover).toBeGreaterThan(0);
  await page.getByLabel('Analysis method').selectOption('welch');
  await expect.poll(() => requests.some(item => item.method === 'welch')).toBe(true);
  await expect(page.getByLabel('Frequency analysis plot')).toHaveAttribute('data-curve-ids', /:mean$/);
  const count = requests.length;
  await wave.hover({ position: { x: 30, y: 10 } });
  await page.waitForTimeout(200);
  expect(requests.length).toBe(count);
});

test('restores an original workspace and adds one persistent frequency panel', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.getByText('Settings', { exact: true }).click();
  await page.evaluate(() => {
    type Node = { type: string; size: number; data: Node[] | { views: string[]; activeView?: string } };
    const layout = JSON.parse(localStorage.getItem('vsr-layout') as string) as { grid: { root: Node }; panels: Record<string, unknown> };
    function strip(node: Node): Node | null {
      if (node.type !== 'branch') {
        const group = node.data as { views: string[]; activeView?: string };
        group.views = group.views.filter(id => id !== 'display' && id !== 'frequency-analysis');
        if (!group.views.length) return null;
        if (group.views.includes('settings')) group.activeView = 'settings';
        return node;
      }
      const children = (node.data as Node[]).map(strip).filter((child): child is Node => child !== null);
      if (children.length === 1) { children[0].size = node.size; return children[0]; }
      node.data = children; return node;
    }
    layout.grid.root = strip(layout.grid.root) as Node;
    delete layout.panels.display; delete layout.panels['frequency-analysis'];
    localStorage.setItem('vsr-layout', JSON.stringify(layout));
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
  await expect(page.getByText('Frequency Analysis', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Display', { exact: true })).toHaveCount(1);
  await openAudio(page, server.audio);
  await expect(page.getByLabel('Frequency analysis plot').locator('canvas')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Frequency Analysis', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Display', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Frequency analysis plot').locator('canvas')).toBeVisible();
});

test('uses each lane view configuration and aborts superseded frame requests', async ({ page, server }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    const state = window as typeof window & { spectrumAborts: number };
    state.spectrumAborts = 0;
    window.fetch = (input, init) => {
      if ((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/spectrum')) init?.signal?.addEventListener('abort', () => { state.spectrumAborts += 1; });
      return original(input, init);
    };
  });
  await page.goto(`${server.url}/?token=${server.token}`);
  await openAudio(page, server.audio);
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.locator('.lane')).toHaveCount(2);
  await page.locator('.lane').last().locator('.wave').click({ position: { x: 10, y: 10 } });
  await page.getByLabel('FFT').selectOption('512');
  const requestBodies: { n_fft: number; t0: number }[] = [];
  await page.route('**/spectrum', async route => {
    requestBodies.push(route.request().postDataJSON() as { n_fft: number; t0: number });
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.continue();
  });
  const wave = page.locator('.lane').last().locator('.wave');
  await wave.hover({ position: { x: 20, y: 10 } });
  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(2);
  await wave.hover({ position: { x: 30, y: 10 } });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { spectrumAborts: number }).spectrumAborts)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => requestBodies.filter(body => body.n_fft === 256).length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => requestBodies.filter(body => body.n_fft === 512).length).toBeGreaterThanOrEqual(2);
  const latest = requestBodies.slice(-2);
  expect(latest[0].t0).toBeCloseTo(latest[1].t0, 5);
  expect(latest[0].t0).toBeGreaterThan(0);
});

test('analyzes the channel under the pointer in a stereo spectrogram', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const samples = 8000; const bytes = Buffer.alloc(44 + samples * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 4, 40);
  for (let i = 0; i < samples; i++) {
    bytes.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + i * 4);
    bytes.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 880 * i / 8000)), 46 + i * 4);
  }
  await page.locator('.lanes').dispatchEvent('drop', { dataTransfer: await page.evaluateHandle(data => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(data)], 'stereo.wav', { type: 'audio/wav' })); return transfer; }, [...bytes]) });
  await expect(page.locator('.spectral-surface')).toHaveCount(2);
  const secondChannel = page.locator('.spectral-surface').last();
  const result = page.waitForResponse(response => response.url().endsWith('/spectrum') && (response.request().postDataJSON() as { channel: number }).channel === 1 && response.ok());
  await secondChannel.hover({ position: { x: 30, y: 10 } });
  const decoded = decodeFrame(Uint8Array.from(await (await result).body()).buffer).arrays as Record<string, FrameArray>;
  const frequencies = Array.from(decoded.freqs.data); const values = Array.from(decoded.values.data);
  const peak = frequencies[values.indexOf(Math.max(...values))];
  expect(peak).toBeGreaterThan(850); expect(peak).toBeLessThan(910);
});

test('reports HTTP errors and propagates malformed spectrum frames', async ({ page, server }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { spectrumFailure: string };
    state.spectrumFailure = '';
    window.addEventListener('unhandledrejection', event => { state.spectrumFailure = String(event.reason); event.preventDefault(); });
  });
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.route('**/spectrum', route => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid spectrum', detail: 'analysis failed', traceback: null }) }));
  await openAudio(page, server.audio);
  await expect(page.getByText('analysis failed', { exact: true })).toBeVisible();
  await page.unroute('**/spectrum');
  await page.route('**/spectrum', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'bad' }));
  await page.locator('.wave').first().hover({ position: { x: 30, y: 10 } });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { spectrumFailure: string }).spectrumFailure)).toContain('RangeError');
});

test('display-only color changes do not request spectral data', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await openAudio(page, server.audio);
  await expect(page.getByLabel('Frequency analysis plot').locator('canvas')).toBeVisible();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  const requests: string[] = [];
  page.on('request', req => { if (req.url().includes('/spectrogram?') || req.url().endsWith('/spectrum')) requests.push(req.url()); });
  await page.getByLabel('dB floor').fill('-100');
  await page.getByLabel('Palette').selectOption('magma');
  await page.getByLabel('Filter').selectOption('NEAREST');
  await page.waitForTimeout(350);
  expect(requests).toEqual([]);
  await page.getByLabel('FFT').selectOption('512');
  await expect.poll(() => requests.filter(url => url.endsWith('/spectrum')).length).toBe(1);
  await expect.poll(() => requests.filter(url => url.includes('/spectrogram?')).length).toBe(1);
});

test('pending method changes keep visible curves and units paired', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await openAudio(page, server.audio);
  const plot = page.getByLabel('Frequency analysis plot');
  await expect(plot).toHaveAttribute('data-curve-ids', /:frame$/);
  await expect(plot.locator('canvas')).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let entered = false;
  await page.route('**/spectrum', async route => {
    if ((route.request().postDataJSON() as { method: string }).method === 'full') { entered = true; await held; }
    await route.continue();
  });
  try {
    await page.getByLabel('Analysis method').selectOption('full');
    await expect.poll(() => entered).toBe(true);
    await expect(plot.locator('canvas')).toBeVisible();
    await expect(plot).toHaveAttribute('data-curve-ids', /:frame$/);
    await expect(plot).toHaveAttribute('data-unit', 'dBFS');
  } finally { release(); }
  await expect(plot).toHaveAttribute('data-curve-ids', /:full$/);
  await expect(plot).toHaveAttribute('data-unit', 'dB');
});

test('Welch accepts intervals based on rounded lane-relative endpoints', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await openAudio(page, server.audio);
  await page.getByLabel('Analysis method').selectOption('welch');
  await expect(page.getByLabel('Frequency analysis plot')).toHaveAttribute('data-curve-ids', /:mean$/);
  await page.getByLabel('End', { exact: true }).fill('0.031956');
  const response = page.waitForResponse(res => { const body = res.request().postDataJSON() as { t0: number; t1: number }; return res.url().endsWith('/spectrum') && res.ok() && Math.abs(body.t0 - 0.000055) < 1e-9 && Math.abs(body.t1 - 0.031956) < 1e-9; }, { timeout: 5000 });
  await page.getByLabel('Start', { exact: true }).fill('0.000055');
  const result = await response;
  expect((await result.body()).length).toBeGreaterThan(100);
  await expect(page.getByLabel('Frequency analysis plot')).toHaveAttribute('data-curve-ids', /:mean$/);
});
