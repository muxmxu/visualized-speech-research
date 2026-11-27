import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeFrame } from '../../src/api/frame';
import { test, expect } from './fixtures';

const sr = 48000;
const length = 8192;
const pulses = [[240, 0.5], [480, -0.75], [840, 0.125]] as const;

function impulseResponse() {
  const bytes = Buffer.alloc(44 + 4 * length);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(3, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sr, 24); bytes.writeUInt32LE(4 * sr, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(32, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(4 * length, 40);
  for (const [sample, coefficient] of pulses) bytes.writeFloatLE(coefficient, 44 + 4 * sample);
  return bytes;
}

test('inspects signed impulse response arrivals without changing decay analysis', async ({ page, server }) => {
  await writeFile(join(server.home, 'three-arrivals.wav'), impulseResponse());
  await page.setViewportSize({ width: 1460, height: 1100 });
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.home);
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ three-arrivals.wav' }).dblclick();
  await expect(page.locator('.lane')).toHaveCount(1);

  const sash = page.locator('.dv-sash').filter({ visible: true });
  const boxes = await sash.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON() as DOMRect));
  const horizontal = boxes.find(bounds => bounds.width > bounds.height);
  expect(horizontal).toBeDefined();
  const { x, y, width, height } = horizontal as DOMRect;
  await page.mouse.move(x + width / 2, y + height / 2);
  await page.mouse.down();
  await page.mouse.move(x + width / 2, 280, { steps: 5 });
  await page.mouse.up();

  await page.getByTitle('RIR', { exact: true }).click();
  const analysis = page.waitForResponse(response => response.url().endsWith('/api/rir/analyze')
    && (response.request().postDataJSON() as { use_lundeby: boolean }).use_lundeby === false && response.ok());
  await page.getByLabel('Lundeby').uncheck();
  await analysis;

  const arrivals = page.getByRole('table', { name: 'Arrival markers' });
  const cells = (label: string) => arrivals.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) }).getByRole('cell');
  await expect(cells('Direct')).toHaveText(['240', '5.000', '+0.5', '0.000']);
  const plot = page.getByLabel('Signed coefficient plot');
  const canvas = plot.locator('canvas');
  const metrics = page.getByRole('table', { name: 'RIR metrics' });
  const metricCell = async (label: string) => {
    const headers = (await metrics.getByRole('columnheader').allTextContents()).map(text => text.trim());
    const index = headers.indexOf(label);
    expect(index).toBeGreaterThan(0);
    return metrics.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Broadband', exact: true }) })
      .getByRole('cell').nth(index - 1);
  };
  const c50 = await metricCell('C50 (dB)');
  const t20 = await metricCell('T20 (s)');
  await expect(c50).toHaveText(/—\s*No late energy after 50 ms/);
  await expect(t20).not.toBeEmpty();
  const metricsBefore = [await c50.innerText(), await t20.innerText()];
  const decay = page.getByRole('group', { name: 'Broadband envelope, EDC and fits', exact: true });
  await expect(decay.locator('canvas')).toBeVisible();
  await expect(decay.getByText('EDC', { exact: true })).toBeVisible();
  const edcPixels = () => decay.locator('canvas').evaluate(element => (element as HTMLCanvasElement).toDataURL());
  const edcBefore = await edcPixels();
  const analysisRequests: string[] = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/rir/analyze')) analysisRequests.push(request.url());
  });

  await expect(page.getByText('Min/max overview', { exact: true })).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const box = bounds as NonNullable<typeof bounds>;
  const anchor = Math.round(box.x + box.width * 470 / length);
  const zoomFactor = 1 / 16;
  const visibleStart = (anchor - box.x) / box.width * length * (1 - zoomFactor);
  const visibleLength = length * zoomFactor;
  const rawResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/waveform') && url.searchParams.get('channel') === '0'
      && Number(url.searchParams.get('t1')) - Number(url.searchParams.get('t0')) < 0.03
      && response.ok();
  });
  await plot.dispatchEvent('wheel', {
    ctrlKey: true, deltaY: Math.log(zoomFactor) / 0.002, clientX: anchor, cancelable: true,
  });
  const { header } = decodeFrame(Uint8Array.from(await (await rawResponse).body()).buffer);
  expect(header.first_sample).toBe(Math.round(visibleStart));
  await expect(page.getByText('Raw samples', { exact: true })).toBeVisible();
  async function clickSample(sample: number) {
    await canvas.scrollIntoViewIfNeeded();
    const location = await canvas.boundingBox();
    expect(location).not.toBeNull();
    const { x, y, width, height } = location as NonNullable<typeof location>;
    await page.mouse.click(x + (sample - visibleStart) / visibleLength * width, y + height / 2);
  }
  await clickSample(480);
  await clickSample(840);
  await expect(cells('Arrival 1')).toHaveText(['480', '10.000', '−0.75', '5.000']);
  await expect(cells('Arrival 2')).toHaveText(['840', '17.500', '+0.125', '12.500']);

  await page.getByRole('button', { name: 'Set direct reference' }).click();
  await clickSample(480);
  await expect(cells('Direct')).toHaveText(['480', '10.000', '−0.75', '0.000']);
  await expect(cells('Arrival 1')).toHaveText(['840', '17.500', '+0.125', '7.500']);
  await expect(cells('Arrival 2')).toHaveCount(0);
  expect([await c50.innerText(), await t20.innerText()]).toEqual(metricsBefore);
  expect(await edcPixels()).toBe(edcBefore);
  expect(analysisRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/screens/M7-rir.png' });
});
