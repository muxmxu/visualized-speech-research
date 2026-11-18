import type { WebSocketRoute } from '@playwright/test';
import { encodeFrame } from '../../src/api/frame';
import type { Lane, RecordArm, RecordStart, RecordState } from '../../src/api/types';
import { test, expect } from './fixtures';

test('arms an audio lane and records a live preview at the playhead', async ({ page, server }) => {
  const opened = await page.request.post(`${server.url}/api/open`, {
    headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] },
  });
  expect(opened.ok()).toBe(true);
  const { lanes: [source] } = await opened.json() as { lanes: Lane[] };
  let lane = { ...source, record_warnings: [] as Lane['record_warnings'] };
  const stream = {} as { socket: WebSocketRoute };
  let armed: RecordArm;
  let started: RecordStart;
  await page.routeWebSocket('**/ws?*', route => { stream.socket = route; });
  await page.route('**/api/session', route => route.fulfill({ json: { lanes: [lane] } }));
  await page.route('**/api/fs/list?*', route => route.fulfill({ json: {
    path: '/recording-session',
    entries: [{ name: lane.name, is_dir: false, size: server.bytes.length, mtime: 0 }],
  } }));
  await page.route('**/api/audio/devices', route => route.fulfill({ json: {
    hostname: 'studio-host',
    default_input: 3,
    default_output: 7,
    reason: null,
    devices: [
      { id: 3, name: 'Studio interface', max_input_channels: 2, max_output_channels: 0, default_samplerate: 48000 },
      { id: 7, name: 'Loopback output', max_input_channels: 0, max_output_channels: 2, default_samplerate: 48000 },
    ],
  } }));
  await page.route('**/api/record/arm', async route => {
    armed = route.request().postDataJSON() as RecordArm;
    const state: RecordState = { type: 'record_state', state: 'armed', mapping: armed.mapping, start_time: null, notice: null };
    stream.socket.send(JSON.stringify(state));
    await route.fulfill({ json: state });
  });
  await page.route('**/api/record/start', async route => {
    started = route.request().postDataJSON() as RecordStart;
    const state: RecordState = { type: 'record_state', state: 'recording', mapping: started.mapping, start_time: started.start_time, notice: null };
    stream.socket.send(JSON.stringify(state));
    await route.fulfill({ json: state });
  });
  await page.route('**/api/record/stop', async route => {
    expect(route.request().postData()).toBeNull();
    lane = { ...lane, offset: started.start_time, record_warnings: [{ time_s: 0.032, type: 'input_overflow' }] };
    stream.socket.send(JSON.stringify({ type: 'lanes_changed' }));
    stream.socket.send(JSON.stringify({ type: 'record_state', state: 'armed', mapping: armed.mapping, start_time: null, notice: null }));
    await route.fulfill({ json: { lanes: [lane] } });
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.locator('.dock').getByText('Record', { exact: true }).click();
  const panel = page.getByRole('region', { name: 'Record panel' });
  await expect(panel.getByText('studio-host')).toBeVisible();
  await expect(panel.getByLabel('Subtype')).toHaveValue('FLOAT');
  await panel.getByLabel('Input device').selectOption('3');
  await panel.getByLabel('Output device').selectOption('7');
  await panel.getByLabel('Sample rate (Hz)').fill('16000');
  await panel.getByLabel('Block size').fill('512');
  await panel.getByLabel('Subtype').selectOption('PCM_24');
  await panel.getByLabel('Play other audible lanes while recording').check();
  await panel.getByLabel('Latency compensation (ms)').fill('12.5');

  const armRequest = page.waitForRequest('**/api/record/arm');
  const arm = page.getByRole('button', { name: `Arm ${lane.name} for recording` });
  await arm.click();
  expect((await armRequest).postDataJSON()).toEqual({ input_device: 3, sr: 16000, blocksize: 512, mapping: [{ lane: lane.id, channels: [0] }] });
  await expect(arm).toHaveAttribute('aria-pressed', 'true');
  const stereoRequest = page.waitForRequest('**/api/record/arm');
  await panel.getByLabel(`Inputs for ${lane.name}`).selectOption('0,1');
  expect((await stereoRequest).postDataJSON()).toMatchObject({ mapping: [{ lane: lane.id, channels: [0, 1] }] });

  stream.socket.send(JSON.stringify({ type: 'record_meter', channels: [
    { peak_dbfs: -6.02, rms_dbfs: -10.2, clip: false }, { peak_dbfs: null, rms_dbfs: null, clip: false },
  ] }));
  await expect(page.getByLabel('Input levels')).toContainText('−∞');
  await page.locator('header strong').click();
  await page.keyboard.press('End');
  await expect(page.getByText('Playhead 0:00:01.000')).toBeVisible();
  const startRequest = page.waitForRequest('**/api/record/start');
  await page.getByTitle('Start recording').click();
  expect((await startRequest).postDataJSON()).toEqual({
    input_device: 3, output_device: 7, sr: 16000, blocksize: 512, subtype: 'PCM_24', mapping: [{ lane: lane.id, channels: [0, 1] }],
    overdub: true, latency_ms: 12.5, start_time: 1,
  });
  await expect(page.getByTitle('Stop recording')).toBeEnabled();

  const samples = Float32Array.from({ length: 64 }, (_, i) => Math.floor(i / 16) % 2 === 0 ? -0.5 : 0.5);
  stream.socket.send(Buffer.from(encodeFrame({ dtype: 'f32', shape: [2, 2, 16], data: samples }, {
    type: 'record_preview', target: 0, sr: 16000, first_sample: 0, samples_per_column: 512, sample_count: 8192,
  })));
  const preview = page.getByLabel(`Recording preview ${lane.name}`);
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((node: HTMLCanvasElement) => {
    const ctx = node.getContext('2d') as CanvasRenderingContext2D;
    const dpr = window.devicePixelRatio;
    const y = Math.floor(node.height / 4);
    const before = ctx.getImageData(Math.floor(50 * dpr), y, 1, 1).data;
    const inTake = ctx.getImageData(Math.floor(110 * dpr), y, 1, 1).data;
    return before[3] === 0 && inTake[0] > inTake[1] && inTake[3] === 255;
  })).toBe(true);
  await page.screenshot({ path: 'test-results/screens/M4-record.png' });

  await page.getByTitle('Stop recording').click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByText('Recording warnings', { exact: true })).toBeVisible();
  await page.getByText('Properties', { exact: true }).click();
  await expect(page.locator('.record-warnings')).toContainText('0.032 s · Input overflow');
});
