import { test, expect } from './fixtures';
import { chromium, type LaunchOptions } from '@playwright/test';

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected browser value was unavailable');
  return value;
}

test('workspace starts with a spectral display and separate view control', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.getByText('Display', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Add view')).toBeVisible();
});

test('playhead uses the specified amber color', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.locator('.wave .playhead')).toHaveCSS('background-color', 'rgb(255, 209, 102)');
});

test('receives real spectral data for independent views', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  const response = page.waitForResponse(response => response.url().includes('/spectrogram?') && response.status() === 200);
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  const first = await response;
  expect(new URL(first.url()).searchParams.get('n_fft')).toBe('256');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(1);
  const frame = await page.evaluate(() => Object.values(window.__vsr_test.spectra())[0]);
  expect(frame.cols).toBeGreaterThan(0);
  expect(frame.rows).toBeGreaterThan(0);
  await page.getByTitle('Add view').click();
  await expect(page.locator('.lane')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(2);
  await page.getByLabel('FFT').selectOption('512');
  await expect(page.getByLabel('FFT')).toHaveValue('512');
  await page.locator('.lane').first().locator('.wave').click({ position: { x: 10, y: 80 } });
  await expect(page.getByLabel('FFT')).toHaveValue('256');
});

for (const viewport of [{ width: 1280, height: 720, name: 'desktop' }, { width: 800, height: 600, name: 'narrow' }]) {
  test(`captures two-tone workspace at ${viewport.name} size`, async ({ page, server }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto(`${server.url}/?token=${server.token}`);
    await expect(page.getByLabel('Directory')).not.toHaveValue('~');
    await page.getByText('Settings', { exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
    await page.getByText('Display', { exact: true }).click();
    await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
    await page.getByTitle('Browse').click();
    const samples = 16384; const bytes = Buffer.alloc(44 + samples * 2);
    bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) {
      const frequency = i >= 2000 && i < 6000 ? 1000 : i >= 10000 && i < 14000 ? 3000 : 0;
      bytes.writeInt16LE(Math.round(16384 * Math.sin(2 * Math.PI * frequency * i / 16000)), 44 + i * 2);
    }
    await page.locator('.lanes').dispatchEvent('drop', { dataTransfer: await page.evaluateHandle(data => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(data)], 'bands.wav', { type: 'audio/wav' })); return transfer; }, [...bytes]) });
    await expect(page.getByLabel('Waveform bands.wav')).toBeVisible();
    await page.keyboard.press('0');
    await page.getByLabel('Frequency low').fill('750'); await page.getByLabel('Frequency high').fill('1250');
    await page.getByTitle('Add view').click();
    await page.getByLabel('FFT').selectOption('1024');
    await page.getByLabel('Frequency high').fill('3500'); await page.getByLabel('Frequency low').fill('2500');
    await page.locator('.wave').last().click({ position: { x: 1, y: 10 } });
    await page.keyboard.press('0');
    await expect.poll(async () => Number(await page.locator('.timeline span').last().textContent())).toBeCloseTo(1.024, 3);
    const plot = required((await page.locator('.wave').first().boundingBox()));
    await page.mouse.move(plot.x + plot.width * 0.2 / 1.024, plot.y + 80);
    await page.mouse.down(); await page.mouse.move(plot.x + plot.width * 0.8 / 1.024, plot.y + 80); await page.mouse.up();
    await expect.poll(async () => Number(await page.getByLabel('Start', { exact: true }).inputValue())).toBeCloseTo(0.2, 2);
    await expect.poll(async () => Number(await page.getByLabel('End', { exact: true }).inputValue())).toBeCloseTo(0.8, 2);
    await page.getByLabel('Start', { exact: true }).fill('0.2');
    await page.getByLabel('End', { exact: true }).fill('0.8');
    await page.getByLabel('End', { exact: true }).blur();
    await expect(page.getByLabel('Duration')).toHaveValue('0.600');
    await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(2);
    const ids = await page.locator('.lane').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-view-id') as string));
    await expect.poll(() => page.evaluate(ids => ids.map(id => window.__vsr_test.spectra()[`${id}:0`].cols), ids)).toEqual([129, 129]);
    const metadata = await page.evaluate(ids => ids.map(id => window.__vsr_test.spectra()[`${id}:0`]), ids);
    expect(metadata[0].col_t0).toBe(0); expect(metadata[1].col_t0).toBe(0);
    expect(metadata[0].col_dt).toBeCloseTo(0.008); expect(metadata[1].col_dt).toBeCloseTo(0.008);
    expect(metadata[0].row_freqs.some(hz => hz === 1000)).toBe(true);
    expect(metadata[1].row_freqs.some(hz => hz === 3000)).toBe(true);
    await page.waitForTimeout(250);
    const surfaces = page.locator('.spectral-surface');
    const geometry = () => surfaces.evaluateAll(nodes => nodes.map(node => {
      const plot = node.getBoundingClientRect();
      const list = node.closest<HTMLElement>('.lane-list') as HTMLElement;
      const port = list.getBoundingClientRect();
      return {
        plot: { x: plot.x, y: plot.y, width: plot.width, height: plot.height },
        clip: {
          left: Math.max(0, plot.left, port.left + list.clientLeft),
          top: Math.max(0, plot.top, port.top + list.clientTop),
          right: Math.min(innerWidth, plot.right, port.left + list.clientLeft + list.clientWidth),
          bottom: Math.min(innerHeight, plot.bottom, port.top + list.clientTop + list.clientHeight),
        },
      };
    }));
    const firstGeometry = await geometry();
    const shot = await page.screenshot({ path: `test-results/screens/M1-workspace-${viewport.name}.png` });
    await page.screenshot({ path: `test-results/screens/M1-ui-${viewport.name}.png` });
    await expect(page.getByRole('heading', { name: 'Spectrum', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequency', exact: true })).toBeVisible();
    expect(await page.locator('.display-panel label span').evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize) >= 12))).toBe(true);
    await expect(page.locator('.lane.selected-view .view-modes button[aria-pressed="true"]')).toHaveCount(1);
    expect(await page.locator('.lane.selected-view .lane-header').evaluate(node => getComputedStyle(node).borderLeftColor)).toBe('rgb(74, 163, 255)');
    const groups = await page.locator('header .toolbar-group').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i]; const b = groups[j];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
    await page.getByRole('button', { name: 'Copy spec' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Copy spec' })).toBeInViewport();
    if (viewport.name === 'narrow') {
      for (const target of [page.getByLabel('Directory'), page.locator('.lane.selected-view').getByLabel('Lane name'), page.locator('.lane.selected-view').getByRole('spinbutton', { name: 'Gain', exact: true }), page.locator('.lane.selected-view').getByLabel('Offset'), page.getByRole('button', { name: 'Copy spec' }), page.getByLabel('Start', { exact: true })]) {
        await target.focus();
        await expect(target).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(target).not.toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(target).toBeFocused();
      }
    }

    let secondGeometry = firstGeometry[1];
    let secondShot = shot;
    if (viewport.name === 'narrow') {
      await surfaces.nth(1).evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.evaluate(() => new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      secondGeometry = (await geometry())[1];
      secondShot = await page.screenshot({ path: 'test-results/screens/M1-workspace-narrow-second.png' });
    }
    const measure = async (png: Buffer, { plot, clip }: (typeof firstGeometry)[number]) => {
      const patches = [0.25, 0.5, 0.75].map(t => ({
        x: Math.round(plot.x + plot.width * t / 1.024) - 1,
        y: Math.round(plot.y + plot.height / 2) - 1,
      }));
      for (const patch of patches) {
        expect(patch.x).toBeGreaterThanOrEqual(clip.left);
        expect(patch.y).toBeGreaterThanOrEqual(clip.top);
        expect(patch.x + 3).toBeLessThanOrEqual(clip.right);
        expect(patch.y + 3).toBeLessThanOrEqual(clip.bottom);
      }
      const pixels = await page.evaluate(async ({ png, patches }) => {
        const image = await createImageBitmap(new Blob([Uint8Array.from(atob(png), ch => ch.charCodeAt(0))], { type: 'image/png' }));
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D; ctx.drawImage(image, 0, 0);
        return patches.map(({ x, y }) => {
          const data = ctx.getImageData(x, y, 3, 3).data; let sum = 0;
          for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i+1] + data[i+2];
          return sum / 9;
        });
      }, { png: png.toString('base64'), patches });
      return { plot, clip, patches, pixels };
    };
    const samplesByPlot = [await measure(shot, firstGeometry[0]), await measure(secondShot, secondGeometry)];
    await testInfo.attach('spectrogram-samples', {
      body: JSON.stringify(samplesByPlot, null, 2), contentType: 'application/json',
    });
    const pixels = samplesByPlot.map(sample => sample.pixels);
    expect(pixels[0][0]).toBeGreaterThan(pixels[0][1] + 100);
    expect(pixels[0][0]).toBeGreaterThan(pixels[0][2] + 100);
    expect(pixels[1][2]).toBeGreaterThan(pixels[1][0] + 100);
    expect(pixels[1][2]).toBeGreaterThan(pixels[1][1] + 100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const selectionRect = required((await page.locator('.selection').first().boundingBox()));
    const waveRect = required((await page.locator('.wave').first().boundingBox()));
    expect(selectionRect.x).toBeCloseTo(waveRect.x + waveRect.width * 0.2 / 1.024, 0);
    expect(selectionRect.width).toBeCloseTo(waveRect.width * 0.6 / 1.024, 0);
    const overview = required((await page.locator('.overview').boundingBox()));
    const overviewBox = required((await page.locator('.overview-box').boundingBox()));
    expect(overviewBox.x).toBeCloseTo(overview.x, 0);
    expect(overviewBox.width).toBeCloseTo(overview.width, 0);
    const fields = await page.locator('header input').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    for (let i = 1; i < fields.length; i++) expect(fields[i].left >= fields[i-1].right || fields[i].top >= fields[i-1].bottom).toBe(true);
    for (const rect of await page.locator('.wave').all()) {
      const bounds = required((await rect.boundingBox()));
      expect(bounds.width).toBeGreaterThanOrEqual(300);
    }
    for (const row of await page.locator('.lane').all()) expect(required((await row.boundingBox())).height).toBe(160);
    const controls = await page.locator('header button, header input').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i]; const b = controls[j];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
    await page.getByTitle('Play / pause').click();
    await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
    await page.getByTitle('Stop', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  });
}

test('display-only changes redraw locally and one FFT change makes one request', async ({ page, server, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, 'drawArrays')?.value as WebGL2RenderingContext['drawArrays'];
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      document.body.dataset.drawCalls = String(Number(document.body.dataset.drawCalls ?? 0) + 1);
      return original.apply(this, args);
    };
  });
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(1);
  await page.waitForTimeout(250);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/spectrogram?')) requests.push(request.url()); });
  const canvas = page.locator('.spectral-canvas');
  const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await page.getByLabel('dB range').fill('-20');
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(before);
  await page.getByLabel('Palette').selectOption('viridis');
  await page.getByLabel('Filter').selectOption('NEAREST');
  await page.waitForTimeout(250);
  expect(requests).toHaveLength(0);
  let release: () => void = () => undefined; let held = false; let done = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/spectrogram?*', async route => { held = true; await gate; await route.continue(); done = true; });
  try {
    await page.getByLabel('FFT').selectOption('512');
    await expect.poll(() => held).toBe(true);
    await expect.poll(() => requests.length).toBe(1);
    await page.evaluate(() => { document.body.dataset.drawCalls = '0'; });
  } finally { release(); await expect.poll(() => done).toBe(true); await page.unrouteAll(); }
  await expect.poll(async () => Number(await page.locator('body').getAttribute('data-draw-calls'))).toBeGreaterThan(0);
  await page.waitForTimeout(150);
  expect(Number(await page.locator('body').getAttribute('data-draw-calls'))).toBe(1);
  expect(requests).toHaveLength(1);
  expect(new URL(requests[0]).searchParams.get('n_fft')).toBe('512');
  await page.getByLabel('Preset').selectOption('wideband');
  await expect(page.getByLabel('Palette')).toHaveValue('viridis');
  await page.getByRole('button', { name: 'Copy spec' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('preset=wideband | sr=8000');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('cmap=viridis');
  await page.waitForTimeout(250);
  const previous = requests.length;
  await page.getByLabel('Frequency high').fill('3000');
  await expect.poll(() => requests.length).toBeGreaterThan(previous);
  expect(new URL(requests[requests.length - 1]).searchParams.get('f_hi')).toBe('3000');
});

test('applies an independent setting across source lanes', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.getByLabel('FFT')).toHaveValue('256');
  await page.getByLabel('FFT').selectOption('512');
  await page.locator('.lanes').dispatchEvent('drop', { dataTransfer: await page.evaluateHandle(bytes => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], 'second.wav', { type: 'audio/wav' })); return transfer; }, [...server.bytes]) });
  await expect(page.locator('.lane')).toHaveCount(2);
  await page.locator('.lane').first().locator('.wave').click({ position: { x: 10, y: 10 } });
  await expect(page.getByLabel('FFT')).toHaveValue('512');
  await page.getByRole('button', { name: 'Apply to all lanes' }).click();
  await page.locator('.lane').last().locator('.wave').click({ position: { x: 10, y: 10 } });
  await expect(page.getByLabel('FFT')).toHaveValue('512');
});

test('migrates a resized M0 layout without changing its active inspector', async ({ page, server }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.getByText('Settings', { exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
  const files = required((await page.getByLabel('Directory').boundingBox()));
  const sashes = await page.locator('.dv-sash').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
  const sash = sashes.filter(r => r.height > r.width && r.x > files.x).sort((a, b) => a.x - b.x)[0];
  expect(sash).toBeDefined();
  await page.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2);
  await page.mouse.down(); await page.mouse.move(sash.x + sash.width / 2 + 30, sash.y + sash.height / 2); await page.mouse.up();
  const before = required((await page.getByLabel('Directory').boundingBox()));
  expect(before.width).toBeGreaterThan(files.width + 10);
  await page.evaluate(() => {
    type Node = { type: string; data: Node[] | { views: string[]; activeView?: string } };
    const layout = JSON.parse(localStorage.getItem('vsr-layout') as string) as { grid: { root: Node }; panels: Record<string, unknown> };
    function visit(node: Node) {
      if (node.type === 'branch') (node.data as Node[]).forEach(visit);
      else {
        const group = node.data as { views: string[]; activeView?: string };
        if (group.views.includes('display')) { group.views = group.views.filter(id => id !== 'display'); group.activeView = 'settings'; }
      }
    }
    visit(layout.grid.root); delete layout.panels.display;
    localStorage.setItem('vsr-layout', JSON.stringify(layout));
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
  await expect(page.getByText('Display', { exact: true })).toHaveCount(1);
  const after = required((await page.getByLabel('Directory').boundingBox()));
  expect(after.width).toBeCloseTo(before.width, 0);
  await page.getByText('Display', { exact: true }).click();
  await page.reload();
  await expect(page.getByText('Display', { exact: true })).toHaveCount(1);
});

test.describe('nonunit device pixel ratio', () => {
  test.use({ deviceScaleFactor: 1.5 });
  test('requests CSS dimensions rather than raster dimensions', async ({ page, server }) => {
    await page.goto(`${server.url}/?token=${server.token}`);
    await expect(page.getByLabel('Directory')).not.toHaveValue('~');
    await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
    await page.getByTitle('Browse').click();
    const requests: string[] = [];
    page.on('request', request => { if (request.url().includes('/spectrogram?')) requests.push(request.url()); });
    await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(1);
    await page.waitForTimeout(200);
    const rect = required((await page.getByLabel('Spectrogram tone.wav').boundingBox()));
    const query = new URL(requests[requests.length - 1]).searchParams;
    expect(Number(query.get('width'))).toBe(Math.round(rect.width * 1.5));
    expect(Number(query.get('height'))).toBe(Math.round(rect.height));
  });
});

test('reprojects cached spectrum while replacing and cancelling requests', async ({ page, server }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if ((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/spectrogram?')) init?.signal?.addEventListener('abort', () => { document.body.dataset.spectralAborts = String(Number(document.body.dataset.spectralAborts ?? 0) + 1); });
      return original(input, init);
    };
  });
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
  await expect.poll(() => page.getByLabel('Waveform tone.wav').evaluate((canvas: HTMLCanvasElement) => canvas.width === Math.round(canvas.clientWidth * devicePixelRatio))).toBe(true);
  await page.keyboard.press('0');
  await expect.poll(async () => Number(await page.locator('.timeline span').last().textContent())).toBeCloseTo(1, 2);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(1);
  await page.waitForTimeout(250);
  const rect = required((await page.getByLabel('Spectrogram tone.wav').boundingBox()));
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = 0; let done = 0; let firstAborted = false;
  await page.evaluate(() => { delete document.body.dataset.spectralAborts; });
  await page.route('**/spectrogram?*', async route => {
    const index = ++held;
    await gate;
    if (index !== 1 || !firstAborted) await route.continue();
    done++;
  });
  try {
  await page.locator('.lanes').evaluate((element, delta) => element.dispatchEvent(new WheelEvent('wheel', { deltaX: delta, bubbles: true, cancelable: true })), rect.width * 0.75);
  await expect.poll(() => held).toBe(1);
  await expect.poll(async () => Number(await page.locator('.timeline span').first().textContent())).toBeCloseTo(0.75, 2);
  const png = await page.screenshot();
  const pixel = await page.evaluate(async ({ png, rect }) => {
    const image = await createImageBitmap(new Blob([Uint8Array.from(atob(png), ch => ch.charCodeAt(0))], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D; ctx.drawImage(image, 0, 0);
    const at = (x: number) => [...ctx.getImageData(Math.round(rect.x + rect.width*x), Math.round(rect.y + rect.height*0.89), 1, 1).data].slice(0,3);
    return { covered: at(0.15), uncovered: at(0.7) };
  }, { png: png.toString('base64'), rect });
  expect(pixel.covered.reduce((a, b) => a + b)).toBeGreaterThan(pixel.uncovered.reduce((a, b) => a + b) + 100);
  expect(pixel.uncovered).toEqual([23, 29, 27]);
  await page.locator('.lanes').evaluate((element, delta) => element.dispatchEvent(new WheelEvent('wheel', { deltaX: delta, bubbles: true, cancelable: true })), rect.width * 0.1);
  await expect.poll(() => page.locator('body').getAttribute('data-spectral-aborts')).not.toBeNull();
  firstAborted = true;
  await expect.poll(() => held).toBe(2);
  } finally { release(); await expect.poll(() => done).toBe(held); await page.unrouteAll(); }
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra())[0]?.col_t0)).toBeGreaterThan(0);
});

test('keyboard selection focus and geometry survive a live resize', async ({ page, server }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect.poll(() => page.getByLabel('Waveform tone.wav').evaluate((canvas: HTMLCanvasElement) => canvas.width === Math.round(canvas.clientWidth * devicePixelRatio))).toBe(true);
  await page.keyboard.press('0');
  const bounds = required((await page.locator('.wave').boundingBox()));
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 80); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + 80); await page.mouse.up();
  for (let i = 0; i < 100 && !await page.getByLabel('Start', { exact: true }).evaluate(element => element === document.activeElement); i++) await page.keyboard.press('Shift+Tab');
  await expect(page.getByLabel('Start', { exact: true })).toBeFocused();
  await page.getByLabel('Start', { exact: true }).fill('0.2');
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(page.getByLabel('Start', { exact: true })).toBeFocused();
  expect(Number(await page.getByLabel('Start', { exact: true }).inputValue())).toBeCloseTo(0.2, 3);
  expect(Number(await page.getByLabel('End', { exact: true }).inputValue())).toBeCloseTo(0.8, 2);
  const wave = required((await page.locator('.wave').boundingBox()));
  const selection = required((await page.locator('.selection').boundingBox()));
  const ticks = (await page.locator('.timeline span').allTextContents()).map(Number);
  const secondsPerPixel = (ticks[ticks.length-1] - ticks[0]) / wave.width;
  expect(selection.x).toBeCloseTo(wave.x + (0.2-ticks[0]) / secondsPerPixel, 0);
});

test('hover reads displayed spectrum and scrolling respects the plot clip', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  const wave = page.getByLabel('Waveform tone.wav');
  await expect.poll(() => wave.evaluate((canvas: HTMLCanvasElement) => canvas.width === Math.round(canvas.clientWidth * devicePixelRatio))).toBe(true);
  await page.keyboard.press('0');
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(1);
  await page.waitForTimeout(250);
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/spectrogram?')) requests.push(request.url()); });
  const rect = required((await page.getByLabel('Spectrogram tone.wav').boundingBox()));
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * (1 - 440 / 4000));
  await expect(page.locator('footer')).toContainText('samples');
  const text = await page.locator('footer').textContent();
  const match = required(required(text).match(/([\d.]+) s · (\d+) samples · ([\d.]+) Hz · ≈(-?[\d.]+) dB/));
  expect(Number(match[1])).toBeCloseTo(0.5, 2);
  expect(Number(match[2])).toBeCloseTo(4000, -2);
  expect(Number(match[3])).toBeGreaterThan(420); expect(Number(match[3])).toBeLessThan(460);
  expect(Number(match[4])).toBeGreaterThan(-15); expect(Number(match[4])).toBeLessThan(-5);
  await page.waitForTimeout(150); expect(requests).toHaveLength(0);
  for (let i = 0; i < 4; i++) await page.getByTitle('Add view').last().click();
  await expect(page.locator('.lane')).toHaveCount(5);
  const list = page.locator('.lane-list');
  await list.evaluate(element => { element.scrollTop = 0; });
  await page.waitForTimeout(250);
  const overview = required((await page.locator('.overview').boundingBox()));
  const sample = async () => {
    const png = await page.screenshot();
    return page.evaluate(async ({ png, x, y }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(png), ch => ch.charCodeAt(0))], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D; ctx.drawImage(bitmap, 0, 0);
      return [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    }, { png: png.toString('base64'), x: overview.x + overview.width * 0.6, y: overview.y + 4 });
  };
  const before = await sample();
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  expect(await sample()).toEqual(before);
});

test('keeps source lane order when preset requests finish in reverse order', async ({ page, server }) => {
  let release: () => void = () => undefined; let seen = 0; let done = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/presets?*', async route => { const index = ++seen; if (index === 1) await gate; await route.continue(); done++; });
  try {
    await page.goto(`${server.url}/?token=${server.token}`);
    const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio, server.audio] } });
    expect(opened.ok()).toBe(true);
    await expect.poll(() => seen).toBe(2);
    await expect(page.locator('.lane')).toHaveCount(1);
    release();
    await expect(page.locator('.lane')).toHaveCount(2);
    const response = await page.request.get(`${server.url}/api/session`, { headers: { Authorization: `Bearer ${server.token}` } });
    const session = await response.json() as { lanes: { id: string }[] };
    expect(await page.locator('.lane').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-lane-id')))).toEqual(session.lanes.map(lane => lane.id));
  } finally { release(); await expect.poll(() => done).toBe(seen); await page.unrouteAll(); }
});

async function openStereo(page: import('@playwright/test').Page, server: { url: string; token: string; bytes: Buffer }) {
  await page.goto(`${server.url}/?token=${server.token}`);
  const samples = 8000; const bytes = Buffer.alloc(44 + samples * 4);
  server.bytes.copy(bytes, 0, 0, 44); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt32LE(samples * 4, 40);
  for (let i = 0; i < samples; i++) { const value = server.bytes.readInt16LE(44 + i * 2); bytes.writeInt16LE(value, 44 + i * 4); bytes.writeInt16LE(value, 46 + i * 4); }
  await page.locator('.lanes').dispatchEvent('drop', { dataTransfer: await page.evaluateHandle(data => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(data)], 'stereo.wav', { type: 'audio/wav' })); return transfer; }, [...bytes]) });
  await expect(page.getByLabel('Spectrogram stereo.wav')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(2);
  await page.waitForTimeout(250);
}

test('sustained stereo frequency gestures retain cached frames and meet request deadline', async ({ page, server }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if ((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/spectrogram?')) document.body.dataset.frequencyRequests = `${document.body.dataset.frequencyRequests ?? ''},${performance.now()}`;
      return original(input, init);
    };
  });
  await openStereo(page, server);
  const result = await page.getByLabel('Spectrogram stereo.wav').first().evaluate(async target => {
    document.body.dataset.frequencyRequests = '';
    const rect = target.getBoundingClientRect(); const start = performance.now(); let minFrames = 2;
    for (let i = 0; i < 10; i++) {
      target.dispatchEvent(new WheelEvent('wheel', { altKey: true, deltaY: -18, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 25));
      minFrames = Math.min(minFrames, Object.keys(window.__vsr_test.spectra()).length);
    }
    return { start, minFrames, requests: document.body.dataset.frequencyRequests.split(',').filter(Boolean).map(Number) };
  });
  expect(result.minFrames).toBe(2);
  expect(result.requests.length).toBeGreaterThan(0);
  expect(result.requests[0] - result.start).toBeLessThanOrEqual(150);
});

test('stereo frequency zoom anchors the pointed channel midpoint', async ({ page, server }) => {
  await openStereo(page, server);
  const requests: string[] = []; page.on('request', request => { if (request.url().includes('/spectrogram?')) requests.push(request.url()); });
  const rect = required(await page.getByLabel('Spectrogram stereo.wav').first().boundingBox());
  await page.evaluate(() => { document.addEventListener('wheel', event => { document.body.dataset.wheelY = String(event.clientY); }, { capture: true, once: true }); });
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.keyboard.down('Alt'); await page.mouse.wheel(0, -100); await page.keyboard.up('Alt');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const query = new URL(requests[requests.length - 1]).searchParams;
  const fraction = 1 - (Number(await page.locator('body').getAttribute('data-wheel-y')) - rect.y) / rect.height;
  const lo = Number(query.get('f_lo')); const hi = Number(query.get('f_hi'));
  expect(lo + fraction * (hi - lo)).toBeCloseTo(4000 * fraction, 3);
});

test('palette changes do not upload spectral matrices', async ({ page, server }) => {
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, 'texImage2D')?.value as WebGL2RenderingContext['texImage2D'];
    WebGL2RenderingContext.prototype.texImage2D = new Proxy(original, { apply(target, receiver, args) {
      if (args[2] === 33325) document.body.dataset.matrixUploads = String(Number(document.body.dataset.matrixUploads ?? 0) + 1);
      return Reflect.apply(target, receiver, args) as void;
    } });
  });
  await openStereo(page, server);
  const before = Number(await page.locator('body').getAttribute('data-matrix-uploads'));
  await page.getByLabel('Palette').selectOption('viridis');
  await page.waitForTimeout(150);
  expect(Number(await page.locator('body').getAttribute('data-matrix-uploads'))).toBe(before);
});

test('hover marks approximation and clears outside returned coverage and waveform', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } }); expect(opened.ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__vsr_test.spectra()).length)).toBe(1);
  await page.keyboard.press('0');
  await page.getByLabel('Frequency low').fill('410'); await page.getByLabel('Frequency high').fill('465');
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra())[0]?.rows)).toBe(1);
  const rect = required(await page.getByLabel('Spectrogram tone.wav').boundingBox());
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await expect(page.locator('footer')).toContainText('≈');
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height * (1 - (413 - 410) / 55));
  await expect(page.locator('footer')).not.toContainText('Hz');
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await expect(page.locator('footer')).toContainText('Hz');
  await page.mouse.move(rect.x + rect.width / 2, rect.y - 10);
  await expect(page.locator('footer')).not.toContainText('Hz');
});

test('keeps ruler and overview aligned with classic browser scrollbars', async ({ server }, testInfo) => {
  const browser = await chromium.launch({ ...(testInfo.project.use.launchOptions as LaunchOptions), ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${server.url}/?token=${server.token}`);
    const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } }); expect(opened.ok()).toBe(true);
    await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
    for (let i = 0; i < 4; i++) await page.getByTitle('Add view').last().click();
    const list = page.locator('.lane-list');
    await expect.poll(() => list.evaluate(element => (element as HTMLElement).offsetWidth - element.clientWidth)).toBeGreaterThan(0);
    const wave = required(await page.locator('.wave').first().boundingBox());
    const overview = required(await page.locator('.overview').boundingBox());
    const tickRight = await page.locator('.timeline span').last().evaluate(element => element.getBoundingClientRect().right);
    expect(overview.x).toBeCloseTo(wave.x, 0);
    expect(overview.width).toBeCloseTo(wave.width, 0);
    expect(tickRight).toBeCloseTo(wave.x + wave.width, 0);
  } finally { await browser.close(); }
});

test('migrates a saved M0 inspector containing Settings but no Properties', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.getByText('Settings', { exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
  await page.evaluate(() => {
    type Node = { type: string; data: Node[] | { views: string[]; activeView?: string } };
    const layout = JSON.parse(localStorage.getItem('vsr-layout') as string) as { grid: { root: Node }; panels: Record<string, unknown> };
    function visit(node: Node) {
      if (node.type === 'branch') (node.data as Node[]).forEach(visit);
      else { const group = node.data as { views: string[]; activeView?: string }; if (group.views.includes('settings')) { group.views = group.views.filter(id => id !== 'properties' && id !== 'display'); group.activeView = 'settings'; } }
    }
    visit(layout.grid.root); delete layout.panels.properties; delete layout.panels.display;
    localStorage.setItem('vsr-layout', JSON.stringify(layout));
  });
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'forced self-check failure' })).toBeVisible();
  await expect(page.getByText('Display', { exact: true })).toHaveCount(1);
  await page.getByText('Display', { exact: true }).click();
  await expect(page.getByText('Select a view')).toBeVisible();
});

test('apply to all bounds the destination frequency at Nyquist', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } }); expect(opened.ok()).toBe(true);
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
  const samples = 48000; const bytes = Buffer.alloc(44 + samples * 2); server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(96000, 28); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / 48000)), 44 + i * 2);
  await page.locator('.lanes').dispatchEvent('drop', { dataTransfer: await page.evaluateHandle(data => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(data)], 'high-rate.wav', { type: 'audio/wav' })); return transfer; }, [...bytes]) });
  await expect(page.getByLabel('Waveform high-rate.wav')).toBeVisible();
  await page.locator('.lane').last().locator('.wave').click({ position: { x: 10, y: 10 } });
  await page.getByLabel('Frequency high').fill('10000');
  await page.getByRole('button', { name: 'Apply to all lanes' }).click();
  await page.locator('.lane').first().locator('.wave').click({ position: { x: 10, y: 10 } });
  await expect(page.getByLabel('Frequency high')).toHaveValue('4000');
  const id = required(await page.locator('.lane').first().getAttribute('data-view-id'));
  await expect.poll(() => page.evaluate(id => { const entry = Object.entries(window.__vsr_test.spectra()).find(([key]) => key === `${id}:0`); return entry ? entry[1].rows : 0; }, id)).toBeGreaterThan(0);
});

test('log frequency zoom anchors the lower stereo channel', async ({ page, server }) => {
  await openStereo(page, server);
  await page.getByLabel('Frequency scale').selectOption('log');
  await expect.poll(() => page.evaluate(() => Object.values(window.__vsr_test.spectra()).every(frame => frame.f_axis.scale === 'log'))).toBe(true);
  await page.waitForTimeout(150);
  const beforeLo = Number(await page.getByLabel('Frequency low').inputValue());
  const beforeHi = Number(await page.getByLabel('Frequency high').inputValue());
  const rect = required(await page.getByLabel('Spectrogram stereo.wav').last().boundingBox());
  const requests: string[] = []; page.on('request', request => { if (request.url().includes('/spectrogram?')) requests.push(request.url()); });
  await page.evaluate(() => { document.addEventListener('wheel', event => { document.body.dataset.wheelY = String(event.clientY); }, { capture: true, once: true }); });
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height * 0.65);
  await page.keyboard.down('Alt'); await page.mouse.wheel(0, -100); await page.keyboard.up('Alt');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const query = new URL(requests[requests.length - 1]).searchParams;
  const fraction = 1 - (Number(await page.locator('body').getAttribute('data-wheel-y')) - rect.y) / rect.height;
  const lo = Number(query.get('f_lo')); const hi = Number(query.get('f_hi'));
  expect(lo * (hi / lo) ** fraction).toBeCloseTo(beforeLo * (beforeHi / beforeLo) ** fraction, 3);
});

test('inspector tabs remain identifiable with a saved narrow dock', async ({ page, server }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(`${server.url}/?token=${server.token}`);
  const labels = page.locator('.dv-tab .dv-default-tab-content').filter({ hasText: /^(Properties|Settings|Display)$/ });
  await expect(labels).toHaveCount(3);
  async function checkLabels() {
    const values = await labels.evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, width: node.getBoundingClientRect().width, title: node.getAttribute('title') })));
    for (const value of values) { expect(value.width).toBeGreaterThanOrEqual(20); expect(value.title).toBe(value.text); }
    const active = page.locator('.dv-tab.dv-active-tab').filter({ hasText: 'Display' });
    await expect(active).toHaveCSS('color', 'rgb(215, 219, 224)');
    await expect(active).toHaveCSS('background-color', 'rgb(39, 43, 49)');
  }
  await checkLabels();
  const sashes = await page.locator('.dv-sash').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
  const sash = required(sashes.filter(r => r.height > r.width).sort((a, b) => b.x - a.x)[0]);
  await page.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2);
  await page.mouse.down(); await page.mouse.move(680, sash.y + sash.height / 2); await page.mouse.up();
  await page.reload();
  await expect(labels).toHaveCount(3);
  await checkLabels();
});

test('time fields stay within a 480 pixel viewport', async ({ page, server }) => {
  await page.setViewportSize({ width: 480, height: 600 });
  await page.goto(`${server.url}/?token=${server.token}`);
  const duration = page.getByLabel('Duration');
  await expect(duration).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(480);
  const bounds = required(await duration.boundingBox());
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(480);
});
