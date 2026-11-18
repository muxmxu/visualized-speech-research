import { execFile } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { decodeFrame } from '../../src/api/frame';
import type { FrameArray } from '../../src/api/frame';
import type { DatasetTable } from '../../src/api/types';
import { expect, test } from './fixtures';

const execute = promisify(execFile);

function tone(template: Buffer, frequency: number, amplitude: number) {
  const audio = Buffer.from(template);
  for (let i = 0; i < (audio.length - 44) / 2; i++) {
    audio.writeInt16LE(Math.round(amplitude * Math.sin(2 * Math.PI * frequency * i / 8000)), 44 + i * 2);
  }
  return audio;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(cell); cell = '';
    } else if (!quoted && char === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else if (quoted || char !== '\r') cell += char;
  }
  if (row.length || cell.length) rows.push([...row, cell]);
  return rows;
}

test('scans real dataset sources, filters grouped curves and exports CLI-equivalent CSV', async ({ page, server }, info) => {
  test.setTimeout(90_000);
  const home = await realpath(server.home);
  const training = join(home, 'training-audio');
  const validation = join(home, 'holdout-audio');
  const manifests = join(home, 'manifests');
  await Promise.all([mkdir(training), mkdir(validation), mkdir(manifests)]);
  const manifest = join(manifests, 'validation.csv');
  await Promise.all([
    writeFile(join(training, 'a.wav'), tone(server.bytes, 440, 14000)),
    writeFile(join(training, 'b.wav'), tone(server.bytes, 440, 9000)),
    writeFile(join(validation, 'c.wav'), tone(server.bytes, 660, 14000)),
    writeFile(join(validation, 'd.wav'), tone(server.bytes, 900, 9000)),
    writeFile(manifest,
      'path,split,notes\r\n../holdout-audio/c.wav,validation,"quiet, ""left"""\r\n../holdout-audio/d.wav,validation,\r\n'),
  ]);

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.getByLabel('Directory', { exact: true }).fill(home);
  await page.getByTitle('Browse').click();
  await expect(page.getByRole('button', { name: '♪ tone.wav' })).toBeVisible();
  await page.locator('.dock').getByText('Dataset', { exact: true }).click();
  const panel = page.getByRole('region', { name: 'Dataset panel' });
  for (const path of [training, manifest]) {
    await panel.getByLabel('Source path').fill(path);
    await panel.getByRole('button', { name: 'Add', exact: true }).click();
  }
  const rowsResponse = page.waitForResponse(response => /\/api\/datasets\/[^/]+\/rows$/.test(new URL(response.url()).pathname));
  const fullLtas = page.waitForResponse(response => /\/api\/datasets\/[^/]+\/ltas$/.test(new URL(response.url()).pathname));
  await panel.getByRole('button', { name: 'Scan', exact: true }).click();
  const tableReply = await rowsResponse;
  expect(tableReply.ok()).toBe(true);
  const table = await tableReply.json() as DatasetTable;
  expect(table.data.source).toEqual([training, training, manifest, manifest]);
  await expect(panel.getByText('4 of 4 rows', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Group by')).toHaveValue('source');
  const sourceGroups = panel.getByRole('list', { name: 'LTAS groups' });
  await expect(sourceGroups.getByRole('listitem')).toHaveCount(2);
  await expect(sourceGroups).toContainText(training);
  await expect(sourceGroups).toContainText(manifest);
  await expect(panel.getByLabel('Grouped LTAS plot').locator('canvas')).toBeVisible();
  const ltasReply = await fullLtas;
  expect(ltasReply.ok()).toBe(true);
  expect(ltasReply.request().postDataJSON()).toEqual({ groups: { [training]: [0, 1], [manifest]: [2, 3] } });
  const { header, arrays } = decodeFrame(Uint8Array.from(await ltasReply.body()).buffer);
  const ltas = arrays as Record<string, FrameArray>;
  expect(header.unit).toBe('db_per_hz');
  expect([...(header.groups as string[])].sort()).toEqual([training, manifest].sort());
  const [points] = ltas.freqs.shape;
  for (const name of ['mean', 'p10', 'p90']) expect(ltas[name].shape).toEqual([2, points]);
  await page.screenshot({ path: 'test-results/screens/M6-datasets.png' });

  async function exportRows(name: string) {
    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export CSV' }).click();
    const destination = info.outputPath(name);
    await (await download).saveAs(destination);
    return parseCsv(await readFile(destination, 'utf8'));
  }

  const fullCsv = await exportRows('all-dataset-rows.csv');
  const cliOutput = join(home, 'cli-metrics.csv');
  await execute('uv', ['run', '--no-sync', 'vsr', 'scan', training, manifest, '-o', cliOutput], {
    cwd: resolve('..'), env: { ...process.env, VSR_HOME: home, PYTHONPATH: resolve('../src') },
  });
  const cliCsv = parseCsv(await readFile(cliOutput, 'utf8'));
  expect(fullCsv[0]).toEqual(table.columns);
  expect(cliCsv[0]).toEqual(table.columns);
  const numeric = new Set(table.columns.filter(column => table.data[column].some(cell => typeof cell === 'number')));
  const typed = (rows: string[][]) => rows.slice(1).map(row => row.map((value, index) =>
    value && numeric.has(table.columns[index]) ? Number(value) : value));
  expect(typed(fullCsv)).toEqual(typed(cliCsv));
  expect(fullCsv[3][table.columns.indexOf('notes')]).toBe('quiet, "left"');
  expect(fullCsv[4][table.columns.indexOf('notes')]).toBe('');

  const filteredLtas = page.waitForResponse(response => /\/api\/datasets\/[^/]+\/ltas$/.test(new URL(response.url()).pathname));
  await panel.getByLabel('source Filter Input', { exact: true }).fill('training-audio');
  await expect(panel.getByText('2 of 4 rows', { exact: true })).toBeVisible();
  await expect(sourceGroups.getByRole('listitem')).toHaveCount(1);
  await expect(sourceGroups).toContainText(training);
  expect((await filteredLtas).request().postDataJSON()).toEqual({ groups: { [training]: [0, 1] } });
  expect(await exportRows('filtered-dataset-rows.csv')).toEqual(fullCsv.slice(0, 3));
  await panel.getByRole('gridcell', { name: join(training, 'a.wav'), exact: true }).dblclick();
  await expect(page.getByLabel('Waveform a.wav', { exact: true })).toBeVisible();
});
