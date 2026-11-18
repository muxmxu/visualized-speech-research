import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Response } from '@playwright/test';
import { decodeFrame, type FrameArray } from '../../src/api/frame';
import { frameValue, type SpectralGrid } from '../../src/render/spectrogram';
import { test, expect } from './fixtures';

type Rectangle = { t0: number; t1: number; params: { f_lo: number; f_hi: number } };

async function meanInRectangle(response: Response, { t0, t1, params }: Rectangle) {
  const buffer = await response.body();
  const { arrays, header } = decodeFrame(Uint8Array.from(buffer).buffer);
  const packet = arrays as FrameArray;
  expect(packet.dtype).toBe('f16');
  const frame = { ...(header as unknown as SpectralGrid), dtype: 'f16' as const, data: packet.data as Uint16Array };
  let sum = 0;
  let count = 0;
  for (let row = 0; row < frame.rows; row++) {
    if (frame.row_freqs[row] < params.f_lo || frame.row_freqs[row] > params.f_hi) continue;
    for (let col = 0; col < frame.cols; col++) {
      const time = frame.col_t0 + col * frame.col_dt;
      if (time < t0 || time > t1) continue;
      sum += frameValue(frame, row, col);
      count++;
    }
  }
  expect(count).toBeGreaterThan(0);
  return sum / count;
}

test('deletes the selected spectral band, undoes it, and saves an edited copy', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const initial = page.waitForResponse(response => response.url().includes('/spectrogram?') && response.ok());
  const opened = await page.request.post(`${server.url}/api/open`, {
    headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] },
  });
  expect(opened.ok()).toBe(true);
  await initial;
  const band = page.waitForResponse(response => new URL(response.url()).searchParams.get('f_hi') === '1000' && response.ok());
  await page.getByText('Display', { exact: true }).click();
  await page.getByLabel('Frequency high', { exact: true }).fill('1000');
  const bandURL = (await band).url();
  const before = page.waitForResponse(response => response.url().includes('/spectrogram?') &&
    new URL(response.url()).searchParams.get('f_hi') === '1000' && response.url() !== bandURL && response.ok());
  await page.locator('header strong').click();
  await page.keyboard.press('0');
  const original = await before;
  await page.getByTitle('Time-frequency selection (E)').click();
  const surface = page.getByLabel('Time frequency selection surface');
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box as NonNullable<typeof box>;
  await page.mouse.move(x + width * 0.12, y + height * 0.49);
  await page.mouse.down();
  await page.mouse.move(x + width * 0.88, y + height * 0.64, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel('Time frequency selection', { exact: true })).toBeVisible();

  const edit = page.waitForResponse(response => response.url().endsWith('/edit') && response.ok());
  const deleted = page.waitForResponse(response => response.url() === original.url() && response.ok());
  await page.keyboard.press('Delete');
  const rectangle = (await edit).request().postDataJSON() as Rectangle;
  const initialMean = await meanInRectangle(original, rectangle);
  const deletedMean = await meanInRectangle(await deleted, rectangle);
  expect(initialMean - deletedMean).toBeGreaterThanOrEqual(30);
  await expect(page.getByLabel('Unsaved changes')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/M3-edit.png' });

  const restored = page.waitForResponse(response => response.url() === original.url() && response.ok());
  await page.keyboard.press('ControlOrMeta+z');
  expect(Math.abs(await meanInRectangle(await restored, rectangle) - initialMean)).toBeLessThanOrEqual(0.5);

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.getByLabel('Unsaved changes')).toBeVisible();
  await page.getByTitle('Edit and save lane').click();
  await page.getByRole('button', { name: 'Save As…', exact: true }).click();
  const destination = join(dirname(server.audio), 'edited.wav');
  await page.getByLabel('Destination path').fill(destination);
  await page.getByLabel('Subtype').selectOption('FLOAT');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
  expect((await readFile(destination)).toString('ascii', 8, 12)).toBe('WAVE');
  expect(await readFile(server.audio)).toEqual(server.bytes);
});
