import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test, expect } from './fixtures';

test.beforeAll(() => { execFileSync('npx', ['vite', 'build', '--mode', 'test'], { stdio: 'inherit' }); });

test('real graph maintains aligned loops, mute, solo, and selection transport', async ({ page, server }) => {
  test.setTimeout(60000);
  const negative = Buffer.from(server.bytes);
  for (let i = 44; i < negative.length; i += 2) negative.writeInt16LE(-negative.readInt16LE(i), i);
  const path = join(dirname(server.audio), 'negative.wav'); await writeFile(path, negative);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio, path] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(2);
  await page.keyboard.press('l');
  await page.getByTitle('Solo').first().click();
  await expect(page.getByTitle('Solo').first()).toHaveClass(/active/);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__vsr_test') as typeof window.__vsr_test | undefined)?.playing())).toBe(true);
  await page.waitForTimeout(2500);
  const baseline = await page.evaluate(() => window.__vsr_test.rms());
  expect(baseline).toBeGreaterThan(0.05);
  await page.getByTitle('Mute').first().click();
  await expect(page.getByTitle('Mute').first()).toHaveClass(/active/);
  await page.waitForTimeout(200);
  const muted = await page.evaluate(() => window.__vsr_test.rms());
  expect(muted).toBeLessThanOrEqual(baseline * 10 ** (-40 / 20));
  await page.getByTitle('Mute').first().click();
  await page.getByTitle('Solo').first().click();
  await expect(page.getByTitle('Solo').first()).not.toHaveClass(/active/);
  await page.waitForTimeout(2200);
  const cancelled = await page.evaluate(() => window.__vsr_test.rms());
  expect(cancelled).toBeLessThan(baseline * 10 ** (-60 / 20));
  await page.getByTitle('Solo').last().click();
  await expect(page.getByTitle('Solo').last()).toHaveClass(/active/);
  await page.waitForTimeout(200);
  const solo = await page.evaluate(() => window.__vsr_test.rms());
  expect(solo).toBeGreaterThan(baseline * 0.9); expect(solo).toBeLessThan(baseline * 1.1);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  await page.keyboard.press('l');
  await page.getByLabel('End', { exact: true }).fill('0.5');
  await page.getByLabel('Start', { exact: true }).fill('0.1');
  await page.locator('header strong').click();
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  expect(await page.evaluate(() => window.__vsr_test.playhead())).toBeCloseTo(0.5, 5);
  await page.getByLabel('Directory').fill(dirname(server.audio));
  await page.getByTitle('Browse').click();
  await expect(page.getByText('♪ negative.wav')).toBeVisible();
  await mkdir('test-results/screens', { recursive: true });
  await page.screenshot({ path: 'test-results/screens/M0-playback.png' });
});

test('a failed initial PCM request leaves transport ready for the next play', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.route('**/api/lanes/*/pcm?*', route => route.fulfill({ status: 500, json: { error: 'Injected PCM failure', detail: 'Temporary request failure', traceback: null } }), { times: 1 });
  const play = page.getByTitle('Play / pause');
  await play.click();
  await expect(page.getByText('Injected PCM failure')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  await expect(play).toHaveText('Play');
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(0.001);
  await play.click();
  await expect(play).toHaveText('Pause');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
});

test('a failed queued PCM request stops playback and permits single-click recovery', async ({ page, server }) => {
  const samples = 21.25 * 8000; const bytes = Buffer.alloc(44 + samples * 2);
  server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(server.bytes.readInt16LE(44 + (i % 8000) * 2), 44 + i * 2);
  const path = join(dirname(server.audio), 'queued-failure.wav'); await writeFile(path, bytes);
  expect(bytes.readUInt32LE(40) / bytes.readUInt16LE(32) / bytes.readUInt32LE(24)).toBeGreaterThan(20);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [path] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  let requests = 0; let releaseFailure = () => {};
  const failure = new Promise<void>(resolve => { releaseFailure = resolve; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/lanes/*/pcm?*', async route => {
    requests++;
    if (requests === 2) {
      await failure;
      await route.fulfill({ status: 500, json: { error: 'Queued PCM failure', detail: 'Temporary request failure', traceback: null } });
    } else await route.continue();
  });
  const play = page.getByTitle('Play / pause');
  await play.click();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
  releaseFailure();
  await expect(page.getByText('Queued PCM failure')).toHaveCount(1);
  await expect(page.getByText('Queued PCM failure')).toBeVisible();
  // Non-retrying count after the request has settled; a retrying count would pass once a duplicate notification auto-closes.
  await page.waitForTimeout(500);
  expect(await page.locator('.mantine-Notification-root').allInnerTexts()).toHaveLength(1);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  await expect(play).toHaveText('Play');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(0.001);
  expect(errors).toEqual([]);
  await play.click();
  await expect(play).toHaveText('Pause');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
});

test('a network-rejected queued PCM request shows failure and permits single-click recovery', async ({ page, server }) => {
  const samples = 21.25 * 8000; const bytes = Buffer.alloc(44 + samples * 2);
  server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(server.bytes.readInt16LE(44 + (i % 8000) * 2), 44 + i * 2);
  const path = join(dirname(server.audio), 'queued-network-failure.wav'); await writeFile(path, bytes);
  expect(bytes.readUInt32LE(40) / bytes.readUInt16LE(32) / bytes.readUInt32LE(24)).toBeGreaterThan(20);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [path] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  let requests = 0; let releaseFailure = () => {};
  const failure = new Promise<void>(resolve => { releaseFailure = resolve; });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/lanes/*/pcm?*', async route => {
    requests++;
    if (requests === 2) {
      await failure;
      await route.abort('failed');
    } else await route.continue();
  });
  const play = page.getByTitle('Play / pause');
  await play.click();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
  releaseFailure();
  await expect(page.getByText('Request failed')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  await expect(play).toHaveText('Play');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(0.001);
  expect(errors).toEqual([]);
  await page.unroute('**/api/lanes/*/pcm?*');
  await play.click();
  await expect(play).toHaveText('Pause');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
});

test('loop can be enabled and disabled during playback', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await page.keyboard.press('l');
  await page.waitForTimeout(2300);
  expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
  await page.keyboard.press('l');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing()), { timeout: 2000 }).toBe(false);
  expect(await page.evaluate(() => window.__vsr_test.playhead())).toBeCloseTo(1, 5);
});


test('enabling loop after the audio boundary during a busy UI keeps output audible', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  const beforeToggle = await page.evaluate(() => {
    const until = performance.now() + 1300;
    while (performance.now() < until) { /* Simulate a busy UI while audio renders. */ }
    const state = { playing: window.__vsr_test.playing(), rms: window.__vsr_test.rms() };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
    return state;
  });
  expect(beforeToggle.playing).toBe(true);
  expect(beforeToggle.rms).toBeLessThan(0.001);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
});


test('offset lanes cancel across long chunk boundaries and two loops', async ({ page, server }) => {
  test.setTimeout(80000);
  const sr = 8000; const offset = 2000; const samples = 21.25 * sr;
  const positive = Buffer.alloc(44 + samples * 2);
  server.bytes.copy(positive, 0, 0, 44);
  positive.writeUInt32LE(positive.length - 8, 4); positive.writeUInt32LE(samples * 2, 40);
  const negative = Buffer.alloc(44 + (samples - offset) * 2);
  server.bytes.copy(negative, 0, 0, 44);
  negative.writeUInt32LE(negative.length - 8, 4); negative.writeUInt32LE((samples - offset) * 2, 40);
  for (let i = 0; i < samples - offset; i++) {
    const value = Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / sr));
    positive.writeInt16LE(value, 44 + (i + offset) * 2);
    negative.writeInt16LE(-value, 44 + i * 2);
  }
  const dir = dirname(server.audio); const a = join(dir, 'delayed.wav'); const b = join(dir, 'offset-negative.wav');
  await writeFile(a, positive); await writeFile(b, negative);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [a, b] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(2);
  await page.getByLabel('Offset', { exact: true }).last().fill('0.25');
  await page.getByLabel('Offset', { exact: true }).last().blur();
  await expect.poll(async () => {
    const response = await page.request.get(`${server.url}/api/session`, { headers: { Authorization: `Bearer ${server.token}` } });
    const session = await response.json() as { lanes: { offset: number }[] };
    return session.lanes[1].offset;
  }).toBe(0.25);
  await page.getByTitle('Solo').first().click();
  await expect(page.getByTitle('Solo').first()).toHaveClass(/active/);
  await page.keyboard.press('l'); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await page.waitForTimeout(700);
  const baseline = await page.evaluate(() => window.__vsr_test.rms());
  expect(baseline).toBeGreaterThan(0.05);
  await page.keyboard.press('l');
  await page.keyboard.press('l');
  await page.getByTitle('Solo').first().click();
  await expect(page.getByTitle('Solo').first()).not.toHaveClass(/active/);
  const started = Date.now();
  for (const elapsed of [1000, 19500, 20100, 21000, 21600, 41500, 42900]) {
    await page.waitForTimeout(Math.max(0, started + elapsed - Date.now()));
    expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
    expect(await page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  }
  await page.getByTitle('Solo').first().click();
  await expect(page.getByTitle('Solo').first()).toHaveClass(/active/);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(baseline * 0.9);
});

test('closing playing lanes removes their audio and stops the last transport', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio, server.audio] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(2);
  await page.keyboard.press('l'); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await page.waitForTimeout(300);
  const baseline = await page.evaluate(() => window.__vsr_test.rms());
  expect(baseline).toBeGreaterThan(0.1);
  await page.getByTitle('Close lane').first().click();
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.waitForTimeout(300);
  const remaining = await page.evaluate(() => window.__vsr_test.rms());
  expect(remaining).toBeGreaterThan(baseline * 0.45);
  expect(remaining).toBeLessThan(baseline * 0.55);
  await page.getByTitle('Close lane').first().click();
  await expect(page.locator('.lane')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  await expect(page.getByTitle('Play / pause')).toHaveText('Play');
});

test('changing displayed multichannel audio updates the playing graph', async ({ page, server }) => {
  const samples = 8000; const bytes = Buffer.alloc(44 + samples * 6);
  server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt16LE(3, 22);
  bytes.writeUInt32LE(48000, 28); bytes.writeUInt16LE(6, 32); bytes.writeUInt32LE(samples * 6, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(server.bytes.readInt16LE(44 + i * 2), 44 + i * 6);
  const path = join(dirname(server.audio), 'channels.wav'); await writeFile(path, bytes);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [path] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.keyboard.press('l'); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await page.waitForTimeout(300);
  const baseline = await page.evaluate(() => window.__vsr_test.rms());
  expect(baseline).toBeGreaterThan(0.05);
  await page.getByLabel('Channel', { exact: true }).selectOption({ value: '1' });
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await page.getByLabel('Channel', { exact: true }).selectOption({ value: '0' });
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(baseline * 0.9);
  expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
});

test('a failed playback restart clears the previous graph and transport', async ({ page, server }) => {
  const samples = 8000; const bytes = Buffer.alloc(44 + samples * 6);
  server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt16LE(3, 22);
  bytes.writeUInt32LE(48000, 28); bytes.writeUInt16LE(6, 32); bytes.writeUInt32LE(samples * 6, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(server.bytes.readInt16LE(44 + i * 2), 44 + i * 6);
  const path = join(dirname(server.audio), 'restart-channels.wav'); await writeFile(path, bytes);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [path] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.getByTitle('Loop (L)').click();
  const play = page.getByTitle('Play / pause');
  await play.click();
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
  await page.route('**/api/lanes/*/pcm?*', route => route.fulfill({ status: 500, json: { error: 'Restart PCM failure', detail: 'Temporary request failure', traceback: null } }), { times: 1 });
  await page.getByLabel('Channel', { exact: true }).selectOption({ value: '1' });
  await expect(page.getByText('Restart PCM failure')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(false);
  await expect(play).toHaveText('Play');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(0.001);
  await page.getByLabel('Channel', { exact: true }).selectOption({ value: '0' });
  await play.click();
  await expect(play).toHaveText('Pause');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(0.05);
});

test('channel changes invalidate queued long-loop chunks', async ({ page, server }) => {
  test.setTimeout(50000);
  const samples = 21.25 * 8000; const bytes = Buffer.alloc(44 + samples * 6);
  server.bytes.copy(bytes, 0, 0, 44);
  bytes.writeUInt32LE(bytes.length - 8, 4); bytes.writeUInt16LE(3, 22);
  bytes.writeUInt32LE(48000, 28); bytes.writeUInt16LE(6, 32); bytes.writeUInt32LE(samples * 6, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(server.bytes.readInt16LE(44 + (i % 8000) * 2), 44 + i * 6);
  const path = join(dirname(server.audio), 'long-channels.wav'); await writeFile(path, bytes);
  const file = await readFile(path);
  expect(file.readUInt32LE(40) / file.readUInt16LE(32) / file.readUInt32LE(24)).toBeGreaterThan(20);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [path] } });
  expect(opened.ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await page.keyboard.press('l'); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  await page.waitForTimeout(300);
  const baseline = await page.evaluate(() => window.__vsr_test.rms());
  expect(baseline).toBeGreaterThan(0.05);
  await page.getByLabel('Channel', { exact: true }).selectOption({ value: '1' });
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playhead()), { timeout: 25000 }).toBeGreaterThan(19.5);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playhead())).toBeGreaterThan(20.1);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  await expect.poll(() => page.evaluate(() => window.__vsr_test.playhead())).toBeLessThan(2);
  expect(await page.evaluate(() => window.__vsr_test.playing())).toBe(true);
  expect(await page.evaluate(() => window.__vsr_test.rms())).toBeLessThan(baseline * 10 ** (-60 / 20));
  await page.getByLabel('Channel', { exact: true }).selectOption({ value: '0' });
  await expect.poll(() => page.evaluate(() => window.__vsr_test.rms())).toBeGreaterThan(baseline * 0.9);
});
