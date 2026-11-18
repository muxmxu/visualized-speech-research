import { test, expect } from './fixtures';
import { readFile, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });

function verifyPdf(pdf: Buffer, width: number, height: number): Buffer {
  const text = pdf.toString('latin1'); expect(text.startsWith('%PDF-1.4')).toBe(true);
  const start = /startxref\n(\d+)\n%%EOF/.exec(text); if (!start) throw new Error('Missing startxref');
  const xref = Number(start[1]); const lines = text.slice(xref).split('\n'); expect(lines[0]).toBe('xref');
  const section = /^0 (\d+)$/.exec(lines[1]); if (!section) throw new Error('Missing xref section');
  const count = Number(section[1]); expect(count).toBeGreaterThan(1);
  const offsets = lines.slice(2, 2 + count).map(line => Number(line.slice(0, 10)));
  for (let id = 1; id < count; id++) expect(text.slice(offsets[id]).startsWith(`${id} 0 obj\n`)).toBe(true);
  const object = (id: number) => text.slice(offsets[id], id + 1 < count ? offsets[id + 1] : xref);
  const reference = (source: string, pattern: RegExp) => { const match = pattern.exec(source); if (!match) throw new Error(`Missing PDF reference ${pattern}`); return Number(match[1]); };
  const root = reference(text.slice(xref), /\/Root (\d+) 0 R/); const catalog = object(root); expect(catalog).toContain('/Type /Catalog');
  const pagesId = reference(catalog, /\/Pages (\d+) 0 R/); const pages = object(pagesId); expect(pages).toContain('/Type /Pages'); expect(pages).toContain('/Count 1');
  const pageId = reference(pages, /\/Kids \[(\d+) 0 R\]/); const page = object(pageId); expect(page).toMatch(/\/Type \/Page\b/); expect(page).toContain(`/Parent ${pagesId} 0 R`);
  expect(page).toContain(`/MediaBox [0 0 ${width} ${height}]`);
  const imageRef = /\/XObject << \/(\w+) (\d+) 0 R >>/.exec(page); if (!imageRef) throw new Error('Missing image resource');
  const imageId = Number(imageRef[2]); const image = object(imageId); expect(image).toContain('/Subtype /Image'); expect(image).toContain('/Filter /DCTDecode'); expect(image).toContain(`/Width ${width} /Height ${height}`);
  const stream = (id: number) => {
    const source = object(id); const marker = source.indexOf('stream\n'); expect(marker).toBeGreaterThan(0);
    const length = /\/Length (\d+)/.exec(source.slice(0, marker)); if (!length) throw new Error('Missing stream length');
    const begin = offsets[id] + marker + 'stream\n'.length; const end = begin + Number(length[1]);
    expect(text.slice(end)).toMatch(/^\n?endstream\nendobj/); return pdf.subarray(begin, end);
  };
  const jpeg = stream(imageId); expect([...jpeg.subarray(0, 2)]).toEqual([255, 216]); expect([...jpeg.subarray(-2)]).toEqual([255, 217]);
  const contentId = reference(page, /\/Contents (\d+) 0 R/); const content = stream(contentId).toString('latin1');
  expect(content).toBe(`q\n${width} 0 0 ${height} 0 0 cm\n/${imageRef[1]} Do\nQ\n`);
  const images = Array.from({ length: count - 1 }, (_, i) => object(i + 1)).filter(value => /\/Filter \/DCTDecode/.test(value)); expect(images).toHaveLength(1);
  return jpeg;
}

test('exports a visible lane and analysis plot as independent one-page PDFs', async ({ page, server }, info) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click(); await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.locator('.spectral-surface')).toBeVisible();
  await expect(page.getByLabel('Frequency analysis plot').locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const events: number[][] = []; Object.assign(window, { __pdfPointerEvents: events });
    window.addEventListener('pointerdown', event => events.push([event.clientX, event.clientY]), { capture: true });
    window.addEventListener('pointerup', event => events.push([event.clientX, event.clientY]), { capture: true });
  });
  for (const selector of ['.wave', '.frequency-plot']) {
    const surface = page.locator(selector).first(); const rect = await surface.boundingBox();
    expect(rect).not.toBeNull(); if (!rect) throw new Error('Plot missing');
    const reference = await page.screenshot({ path: info.outputPath(selector === '.wave' ? 'lanes.png' : 'frequency.png') });
    const requests: string[] = []; const record = (request: import('@playwright/test').Request) => { if (/\/(waveform|spectrogram|spectrum|pcm)([/?]|$)/.test(request.url())) requests.push(request.url()); };
    page.on('request', record);
    await page.getByLabel('Export visible area to PDF').click();
    await page.evaluate(() => { (window as unknown as { __pdfPointerEvents: number[][] }).__pdfPointerEvents.length = 0; });
    const download = page.waitForEvent('download');
    await page.mouse.move(rect.x + 10.2, rect.y + 8.2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width - 10.2, rect.y + rect.height - 8.2); const gesture = await page.screenshot(); await page.mouse.up();
    const file = await download; await page.waitForTimeout(300); page.off('request', record); expect(requests).toEqual([]); const path = info.outputPath(selector === '.wave' ? 'lanes.pdf' : 'frequency.pdf'); await file.saveAs(path);
    const bytes = await readFile(path); const text = bytes.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBeTruthy(); expect(text).toContain('/Count 1'); expect(text.match(/\/DCTDecode/g)).toHaveLength(1);
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]); expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = text.slice(xref).split('\n').slice(3, 8);
    entries.forEach((entry, index) => expect(text.slice(Number(entry.slice(0, 10))).startsWith(`${index + 1} 0 obj`)).toBe(true));
    const object = (number: number) => text.slice(Number(entries[number - 1].slice(0, 10)), number === 5 ? xref : Number(entries[number].slice(0, 10)));
    expect(object(1)).toContain('/Type /Catalog /Pages 2 0 R'); expect(object(2)).toContain('/Type /Pages /Kids [3 0 R] /Count 1');
    expect(object(3)).toContain('/Type /Page /Parent 2 0 R'); expect(object(3)).toContain('/XObject << /Im0 4 0 R >>'); expect(object(3)).toContain('/Contents 5 0 R');
    const match = /\/Width (\d+) \/Height (\d+).*?\/Length (\d+) >>\nstream\n/s.exec(text);
    expect(match).not.toBeNull(); if (!match) throw new Error('Image missing');
    const jpegStart = match.index + match[0].length; const jpeg = bytes.subarray(jpegStart, jpegStart + Number(match[3]));
    const observed = await page.evaluate(() => (window as unknown as { __pdfPointerEvents: number[][] }).__pdfPointerEvents);
    expect(observed).toHaveLength(2);
    const left = Math.ceil(Math.min(observed[0][0], observed[1][0]) * 1.5); const top = Math.ceil(Math.min(observed[0][1], observed[1][1]) * 1.5);
    const right = Math.floor(Math.max(observed[0][0], observed[1][0]) * 1.5); const bottom = Math.floor(Math.max(observed[0][1], observed[1][1]) * 1.5);
    expect([Number(match[1]), Number(match[2])]).toEqual([right - left, bottom - top]);
    expect(verifyPdf(bytes, right - left, bottom - top).equals(jpeg)).toBe(true);
    expect(text).toContain(`/MediaBox [0 0 ${right - left} ${bottom - top}]`);
    expect(text.slice(jpegStart + Number(match[3]), jpegStart + Number(match[3]) + 10)).toBe('\nendstream');
    expect([...jpeg.subarray(0, 2)]).toEqual([255, 216]); expect([...jpeg.subarray(-2)]).toEqual([255, 217]);
    const content = `q\n${right - left} 0 0 ${bottom - top} 0 0 cm\n/Im0 Do\nQ\n`;
    expect(object(5)).toContain(`/Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
    const differences = await page.evaluate(async ({ png, jpg, gesturePng, x, y }) => {
      const decode = async (data: string, type: string) => createImageBitmap(new Blob([Uint8Array.from(atob(data), char => char.charCodeAt(0))], { type }));
      const original = await decode(png, 'image/png'); const gestureImage = await decode(gesturePng, 'image/png'); const exported = await decode(jpg, 'image/jpeg');
      const canvas = document.createElement('canvas'); canvas.width = original.width; canvas.height = original.height;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D; ctx.drawImage(original, 0, 0);
      const a = ctx.getImageData(x, y, exported.width, exported.height).data;
      ctx.drawImage(gestureImage, 0, 0); const gesturePixels = ctx.getImageData(x, y, exported.width, exported.height).data;
      canvas.width = exported.width; canvas.height = exported.height; ctx.drawImage(exported, 0, 0);
      const b = ctx.getImageData(0, 0, exported.width, exported.height).data;
      let count = 0; let sum = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])); sum += d; if (d > 20) count++; }
      const samples: Record<string, { x: number; y: number; diff: number }[]> = { blue: [], legend: [], labels: [] };
      const classify = (i: number, yy: number, xx: number) => {
        if (yy > 30 && a[i+2] > 130 && a[i+2] > a[i] * 1.4 && a[i+1] > 90) return 'blue';
        if (a[i] > 160 && a[i+1] > 160 && a[i+2] > 160 && yy < 30 && xx > exported.width / 2) return 'legend';
        if (a[i] > 160 && a[i+1] > 160 && a[i+2] > 160 && yy > exported.height * 0.65) return 'labels';
        return '';
      };
      for (let yy = 2; yy < exported.height - 2; yy++) for (let xx = 2; xx < exported.width - 2; xx++) {
        const i = (yy * exported.width + xx) * 4; const category = classify(i, yy, xx); if (!category || samples[category].length >= 5) continue;
        if (samples[category].some(item => Math.abs(item.x - xx) < 12 && Math.abs(item.y - yy) < 8)) continue;
        const neighbours = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];
        if (!neighbours.every(([dx,dy]) => classify(((yy+dy)*exported.width+xx+dx)*4, yy+dy, xx+dx) === category)) continue;
        const diff = Math.max(...neighbours.flatMap(([dx,dy]) => { const j = ((yy+dy)*exported.width+xx+dx)*4; return [Math.abs(a[j]-b[j]), Math.abs(a[j+1]-b[j+1]), Math.abs(a[j+2]-b[j+2])]; }));
        samples[category].push({ x: xx, y: yy, diff });
      }
      const gestureSamples: { x: number; y: number; referenceDiff: number; gestureDiff: number }[] = [];
      for (let yy = 3; yy < exported.height - 3 && gestureSamples.length < 5; yy += 3) for (let xx = 3; xx < exported.width - 3 && gestureSamples.length < 5; xx += 3) {
        if (gestureSamples.some(item => Math.abs(item.x - xx) < 20 && Math.abs(item.y - yy) < 12)) continue;
        const neighbours = [[0,0],[-1,0],[1,0],[0,-1],[0,1]]; const center = (yy * exported.width + xx) * 4;
        if (!neighbours.every(([dx,dy]) => { const i = ((yy+dy)*exported.width+xx+dx)*4; return Math.max(Math.abs(a[center]-a[i]), Math.abs(a[center+1]-a[i+1]), Math.abs(a[center+2]-a[i+2])) <= 5 && Math.max(Math.abs(a[i]-gesturePixels[i]), Math.abs(a[i+1]-gesturePixels[i+1]), Math.abs(a[i+2]-gesturePixels[i+2])) > 25; })) continue;
        const referenceDiff = Math.max(...neighbours.flatMap(([dx,dy]) => { const i = ((yy+dy)*exported.width+xx+dx)*4; return [Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])]; }));
        const gestureDiff = Math.min(...neighbours.map(([dx,dy]) => { const i = ((yy+dy)*exported.width+xx+dx)*4; return Math.max(Math.abs(gesturePixels[i]-b[i]), Math.abs(gesturePixels[i+1]-b[i+1]), Math.abs(gesturePixels[i+2]-b[i+2])); }));
        gestureSamples.push({ x: xx, y: yy, referenceDiff, gestureDiff });
      }
      return { mean: sum / (a.length / 4), fraction: count / (a.length / 4), samples, gestureSamples };
    }, { png: reference.toString('base64'), jpg: jpeg.toString('base64'), gesturePng: gesture.toString('base64'), x: left, y: top });
    if (selector === '.frequency-plot') { for (const key of ['blue', 'legend', 'labels']) { expect(differences.samples[key].length).toBeGreaterThanOrEqual(2); for (const point of differences.samples[key]) expect(point.diff, `${key} ${JSON.stringify(point)}`).toBeLessThanOrEqual(20); } }
    expect(differences.gestureSamples.length).toBeGreaterThanOrEqual(2); for (const point of differences.gestureSamples) { expect(point.referenceDiff).toBeLessThanOrEqual(20); expect(point.gestureDiff).toBeGreaterThan(20); }
    expect(differences.fraction).toBeLessThan(0.03);
    await writeFile(info.outputPath(selector === '.wave' ? 'lanes-observations.json' : 'frequency-observations.json'), JSON.stringify({ observed, left, top, right, bottom, differences }, null, 2));
  }
});


test('cancels without altering the time-frequency selection or fetching data', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true); await expect(page.locator('.lane')).toHaveCount(1);
  await page.getByTitle('Time-frequency selection (E)').click();
  const surface = page.getByLabel('Time frequency selection surface').first(); const rect = await surface.boundingBox();
  if (!rect) throw new Error('Spectrogram missing');
  await page.mouse.move(rect.x + 20, rect.y + 15); await page.mouse.down(); await page.mouse.move(rect.x + 70, rect.y + 50); await page.mouse.up();
  const rectangle = page.getByLabel('Time frequency selection', { exact: true }); await expect(rectangle).toBeVisible();
  const before = await Promise.all(['Start', 'End', 'Low Hz', 'High Hz'].map(name => page.getByLabel(name, { exact: true }).inputValue()));
  await page.getByLabel('Analysis method').selectOption('welch'); await expect(page.getByLabel('Frequency analysis plot')).toHaveAttribute('data-curve-ids', /:mean$/);
  await page.waitForTimeout(300);
  const requests: string[] = []; page.on('request', request => { if (/\/(waveform|spectrogram|spectrum|pcm)([/?]|$)/.test(request.url())) requests.push(request.url()); });
  let downloads = 0; page.on('download', () => downloads++);
  await page.getByLabel('Export visible area to PDF').click();
  await page.mouse.move(rect.x + 30, rect.y + 20); await page.mouse.down(); await page.mouse.move(rect.x + 70, rect.y + 50); await page.keyboard.press('Escape'); await page.mouse.up();
  await page.waitForTimeout(300);
  await page.getByLabel('Export visible area to PDF').click(); await page.mouse.click(rect.x + 40, rect.y + 30); await page.waitForTimeout(300);
  expect(downloads).toBe(0); expect(requests).toEqual([]);
  expect(await Promise.all(['Start', 'End', 'Low Hz', 'High Hz'].map(name => page.getByLabel(name, { exact: true }).inputValue()))).toEqual(before);
  await expect(rectangle).toBeVisible();
});

test('exports scrolled lanes clipped to the visible plot with unchanged selection', async ({ page, server }, info) => {
  const fixture = Buffer.from(server.bytes); for (let i = 0; i < 8000; i++) fixture.writeInt16LE(Math.round((i < 4000 ? 1 : 0.1) * (9000 * Math.sin(2 * Math.PI * 440 * i / 8000) + (i % 2 ? 10000 : -10000))), 44 + i * 2);
  await writeFile(server.audio, fixture);
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio, server.audio, server.audio] } });
  expect(opened.ok()).toBe(true); await expect(page.locator('.lane')).toHaveCount(3);
  await page.getByLabel('Analysis method').selectOption('welch');
  await page.getByLabel('Frequency high').fill('1200'); await page.getByLabel('Frequency high').blur();
  await page.getByTitle('Time-frequency selection (E)').click();
  const surface = page.getByLabel('Time frequency selection surface').nth(1); const first = await surface.boundingBox();
  if (!first) throw new Error('Spectrogram missing');
  await page.mouse.move(first.x + 20, first.y + 15); await page.mouse.down(); await page.mouse.move(first.x + 70, first.y + 50); await page.mouse.up();
  const rectangle = page.getByLabel('Time frequency selection', { exact: true }); await expect(rectangle).toBeVisible();
  const before = await Promise.all(['Start', 'End', 'Low Hz', 'High Hz'].map(name => page.getByLabel(name, { exact: true }).inputValue()));
  const sourceView = await page.locator('.lane.selected-view').getAttribute('data-view-id'); const playhead = await page.locator('.measurements > span').textContent();
  await expect(page.getByTitle('Play / pause')).toContainText('Play');
  await page.locator('.lane-list').evaluate(element => { element.scrollTop = 90; }); await page.waitForTimeout(500);
  const geometry = await page.evaluate(() => {
    const list = document.querySelector('.lane-list') as HTMLElement; const row = document.querySelector('.lane') as HTMLElement;
    const b = list.getBoundingClientRect(); const axis = (row.querySelector('.frequency-axis') as Element).getBoundingClientRect();
    const gutter = (row.querySelector('.colorbar-gutter') as Element).getBoundingClientRect(); const root = (list.closest('.lanes') as Element).getBoundingClientRect();
    return { left: axis.left, gutterLeft: gutter.left, right: Math.min(gutter.right, b.right, root.right, innerWidth), top: Math.max(b.top, root.top, 0), bottom: Math.min(b.bottom, root.bottom, innerHeight) };
  });
  await page.evaluate(() => {
    const observed: number[][] = []; Object.assign(window, { __pdfPointerEvents: observed });
    window.addEventListener('pointerdown', event => observed.push([event.clientX, event.clientY]), { capture: true });
    window.addEventListener('pointerup', event => observed.push([event.clientX, event.clientY]), { capture: true });
  });
  await page.evaluate(({ x, y }) => {
    const marker = document.createElement('div'); marker.id = 'pdf-test-marker'; Object.assign(marker.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: '8px', height: '8px', background: 'rgb(0,255,0)', zIndex: '9999', pointerEvents: 'none' }); document.body.append(marker);
  }, { x: geometry.right + 5, y: geometry.top + 10 });
  const handle = await rectangle.locator('[data-handle="e"]').boundingBox(); if (!handle) throw new Error('Visible selection handle missing');
  const reference = await page.screenshot({ path: info.outputPath('scroll-reference.png') });
  const requests: string[] = []; page.on('request', request => { if (/\/(waveform|spectrogram|spectrum|pcm)([/?]|$)/.test(request.url())) requests.push(request.url()); });
  await page.getByLabel('Export visible area to PDF').click(); const download = page.waitForEvent('download');
  await page.mouse.move(geometry.left + 2.2, geometry.top + 3.2); await page.mouse.down();
  await page.mouse.move(geometry.right + 25.2, geometry.bottom + 20.2); await page.screenshot({ path: 'test-results/screens/M1-pdf-crop.png' }); await page.mouse.up();
  const file = await download; await page.waitForTimeout(300); expect(requests).toEqual([]);
  expect(await Promise.all(['Start', 'End', 'Low Hz', 'High Hz'].map(name => page.getByLabel(name, { exact: true }).inputValue()))).toEqual(before);
  await expect(rectangle).toHaveCount(1); expect(await page.locator('.lane.selected-view').getAttribute('data-view-id')).toBe(sourceView); expect(await page.locator('.measurements > span').textContent()).toBe(playhead); await expect(page.getByTitle('Play / pause')).toContainText('Play');
  const observed = await page.evaluate(() => (window as unknown as { __pdfPointerEvents: number[][] }).__pdfPointerEvents.slice(-2));
  const left = Math.ceil(Math.max(Math.min(observed[0][0], observed[1][0]), geometry.left) * 1.5); const top = Math.ceil(Math.max(Math.min(observed[0][1], observed[1][1]), geometry.top) * 1.5);
  const right = Math.floor(Math.min(Math.max(observed[0][0], observed[1][0]), geometry.right) * 1.5); const bottom = Math.floor(Math.min(Math.max(observed[0][1], observed[1][1]), geometry.bottom) * 1.5);
  const path = info.outputPath('scroll-lanes.pdf'); await file.saveAs(path); const bytes = await readFile(path); const text = bytes.toString('latin1');
  const match = /\/Width (\d+) \/Height (\d+).*?\/Length (\d+) >>\nstream\n/s.exec(text);
  if (!match) throw new Error('PDF image missing'); expect([Number(match[1]), Number(match[2])]).toEqual([right - left, bottom - top]);
  const jpeg = bytes.subarray(match.index + match[0].length, match.index + match[0].length + Number(match[3]));
  expect(verifyPdf(bytes, right - left, bottom - top).equals(jpeg)).toBe(true);
  const difference = await page.evaluate(async ({ png, jpg, x, y, waveStart, gutterStart, handleX, handleY, markerX, markerY }) => {
    const decode = async (data: string, type: string) => createImageBitmap(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type }));
    const original = await decode(png, 'image/png'); const exported = await decode(jpg, 'image/jpeg');
    const canvas = document.createElement('canvas'); canvas.width = original.width; canvas.height = original.height; const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(original, 0, 0); const markerReference = Array.from(ctx.getImageData(markerX, markerY, 1, 1).data); const a = ctx.getImageData(x, y, exported.width, exported.height).data;
    canvas.width = exported.width; canvas.height = exported.height; ctx.drawImage(exported, 0, 0); const b = ctx.getImageData(0, 0, exported.width, exported.height).data;
    let mismatch = 0; let bright = 0; let green = 0; let markerPixels = 0; for (let i = 0; i < a.length; i += 4) { if (Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])) > 20) mismatch++; if (a[i] > 180 && a[i+1] > 120 && a[i+2] < 130) bright++; if (a[i+1] > 150 && a[i] < 180 && a[i+2] > 100) green++; if (b[i] < 20 && b[i+1] > 240 && b[i+2] < 20) markerPixels++; }
    const samples: Record<string, { x: number; y: number; diff: number }[]> = { bright: [], green: [] };
    const kind = (i: number) => a[i] > 180 && a[i+1] > 120 && a[i+2] < 130 ? 'bright' : a[i+1] > 150 && a[i] < 180 && a[i+2] > 100 ? 'green' : '';
    for (let yy = 2; yy < exported.height - 2; yy++) for (let xx = 2; xx < exported.width - 2; xx++) {
      if (xx < waveStart + 12) continue;
      const index = (yy * exported.width + xx) * 4; const category = kind(index); if (!category || samples[category].length >= 5 || (category === 'bright' && xx >= gutterStart - 4)) continue;
      if (samples[category].some(item => Math.abs(item.x - xx) < 15 && Math.abs(item.y - yy) < 8)) continue;
      const neighbours = category === 'green' ? [[0,0],[0,-1],[0,1]] : [[0,0],[-1,0],[1,0]];
      if (category === 'bright' && (!kind(((yy-1)*exported.width+xx)*4) || !kind(((yy+1)*exported.width+xx)*4))) continue;
      if (!neighbours.every(([dx,dy]) => { const j = ((yy+dy)*exported.width+xx+dx)*4; return kind(j) === category && Math.max(Math.abs(a[index]-a[j]), Math.abs(a[index+1]-a[j+1]), Math.abs(a[index+2]-a[j+2])) <= 8; })) continue;
      const diff = Math.max(...neighbours.flatMap(([dx,dy]) => { const i = ((yy+dy)*exported.width+xx+dx)*4; return [Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])]; }));
      samples[category].push({ x: xx, y: yy, diff });
    }
    const handlePixels: number[] = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((handleY + dy) * exported.width + handleX + dx) * 4; handlePixels.push(Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2]))); }
    return { fraction: mismatch / (a.length / 4), bright, green, markerPixels, markerReference, samples, handlePixels };
  }, { png: reference.toString('base64'), jpg: jpeg.toString('base64'), x: left, y: top, waveStart: Math.ceil(first.x * 1.5) - left, gutterStart: Math.floor(geometry.gutterLeft * 1.5) - left, handleX: Math.floor((handle.x + handle.width / 2) * 1.5) - left, handleY: Math.floor((handle.y + handle.height / 2) * 1.5) - top, markerX: Math.floor((geometry.right + 8) * 1.5), markerY: Math.floor((geometry.top + 13) * 1.5) });
  for (const key of ['bright', 'green']) { expect(difference.samples[key].length, key).toBeGreaterThanOrEqual(2); for (const point of difference.samples[key]) expect(point.diff, `${key} ${JSON.stringify(point)}`).toBeLessThanOrEqual(20); }
  expect(Math.max(...difference.handlePixels)).toBeLessThanOrEqual(20);
  expect(difference.markerReference).toEqual([0, 255, 0, 255]); expect(difference.markerPixels).toBe(0); expect(difference.bright).toBeGreaterThan(10); expect(difference.green).toBeGreaterThan(10); expect(difference.fraction).toBeLessThan(0.03);
  await writeFile(info.outputPath('scroll-observations.json'), JSON.stringify({ observed, left, top, right, bottom, before, requests, difference }, null, 2));
});

test('uses delivered fractional pointer coordinates for the physical right edge', async ({ page, server }, info) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true); await expect(page.locator('.lane')).toHaveCount(1);
  await page.locator('.dock').evaluate(element => { (element as HTMLElement).style.transform = 'translateX(-400px)'; });
  await page.waitForTimeout(300);
  const surface = page.locator('.spectral-surface').first(); const rect = await surface.boundingBox();
  if (!rect) throw new Error('Spectrogram missing'); expect(rect.x).toBeLessThan(50);
  await page.evaluate(() => {
    const points: number[] = []; Object.assign(window, { __pdfDeliveredX: points });
    window.addEventListener('pointerup', event => points.push(event.clientX), { capture: true });
  });
  await page.getByLabel('Export visible area to PDF').click(); const download = page.waitForEvent('download');
  await page.mouse.move(30.2, rect.y + 10.2); await page.mouse.down(); await page.mouse.move(100 / 1.5, rect.y + 55.2); await page.mouse.up();
  const file = await download; const path = info.outputPath('fractional.pdf'); await file.saveAs(path);
  const delivered = await page.evaluate(() => (window as unknown as { __pdfDeliveredX: number[] }).__pdfDeliveredX.at(-1) as number);
  expect(delivered).toBe(66.66666412353516); expect(Math.floor(delivered * 1.5)).toBe(99);
  const text = (await readFile(path)).toString('latin1'); const image = /\/Width (\d+) \/Height (\d+)/.exec(text);
  expect(Number(image?.[1])).toBe(99 - Math.ceil(30.2 * 1.5));
});

test('clips the frequency plot to its visible ancestors without fetching data', async ({ page, server }, info) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true); await expect(page.locator('.lane')).toHaveCount(1);
  const wave = await page.locator('.waveform-part').first().boundingBox(); if (!wave) throw new Error('Waveform missing');
  await page.mouse.move(wave.x + 20, wave.y + 10); await page.mouse.down(); await page.mouse.move(wave.x + 70, wave.y + 10); await page.mouse.up();
  expect(Number(await page.getByLabel('Duration', { exact: true }).inputValue())).toBeGreaterThan(0);
  await page.getByLabel('Analysis method').selectOption('welch'); const plot = page.getByLabel('Frequency analysis plot');
  await expect(plot).toHaveAttribute('data-curve-ids', /:mean$/);
  await plot.evaluate(element => { (element as HTMLElement).style.transform = 'translate(20px, 60px)'; const parent = element.parentElement as HTMLElement; parent.style.overflow = 'hidden'; parent.style.border = '8px solid rgb(240, 0, 240)'; parent.style.width = 'calc(100% - 0.6px)'; }); await page.waitForTimeout(300);
  const geometry = await plot.evaluate(element => {
    const b = element.getBoundingClientRect(); let bottom = innerHeight; let right = innerWidth;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent); if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) { const rect = parent.getBoundingClientRect(); const vertical = parent.offsetWidth - parent.clientWidth - Math.round(parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)); const horizontal = parent.offsetHeight - parent.clientHeight - Math.round(parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)); bottom = Math.min(bottom, rect.bottom - parseFloat(style.borderBottomWidth) - horizontal); right = Math.min(right, rect.right - parseFloat(style.borderRightWidth) - vertical); }
    }
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, visibleBottom: bottom, visibleRight: right };
  });
  expect(geometry.visibleBottom).toBeLessThan(geometry.bottom); expect(geometry.visibleRight).toBeLessThan(geometry.right); expect(geometry.visibleBottom - geometry.top).toBeGreaterThan(20);
  await page.evaluate(() => {
    const points: number[][] = []; Object.assign(window, { __pdfClippedPoints: points });
    window.addEventListener('pointerdown', event => points.push([event.clientX, event.clientY]), { capture: true });
    window.addEventListener('pointerup', event => points.push([event.clientX, event.clientY]), { capture: true });
  });
  const active = await page.locator('.lane.selected-view').getAttribute('data-view-id'); const playhead = await page.locator('.measurements > span').textContent();
  const before = await Promise.all(['Start', 'End', 'Duration'].map(name => page.getByLabel(name, { exact: true }).inputValue()));
  await page.evaluate(({ x, y }) => { const marker = document.createElement('div'); Object.assign(marker.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: '8px', height: '8px', background: 'rgb(0,255,0)', zIndex: '9999', pointerEvents: 'none' }); document.body.append(marker); }, { x: geometry.left + 30, y: geometry.visibleBottom + 3 });
  const reference = await page.screenshot({ path: info.outputPath('frequency-clipped-reference.png') });
  const requests: string[] = []; page.on('request', request => { if (/\/(waveform|spectrogram|spectrum|pcm)([/?]|$)/.test(request.url())) requests.push(request.url()); });
  await page.getByLabel('Export visible area to PDF').click();
  await page.evaluate(() => { (window as unknown as { __pdfClippedPoints: number[][] }).__pdfClippedPoints.length = 0; });
  const download = page.waitForEvent('download');
  await page.mouse.move(geometry.left + 5.2, geometry.top + 3.2); await page.mouse.down();
  await page.mouse.move(geometry.visibleRight + 15.2, geometry.visibleBottom + 15.2); await page.mouse.up(); const file = await download; await page.waitForTimeout(300);
  expect(requests).toEqual([]); expect(await page.locator('.lane.selected-view').getAttribute('data-view-id')).toBe(active); expect(await page.locator('.measurements > span').textContent()).toBe(playhead);
  expect(await Promise.all(['Start', 'End', 'Duration'].map(name => page.getByLabel(name, { exact: true }).inputValue()))).toEqual(before);
  await expect(page.getByTitle('Play / pause')).toContainText('Play');
  const points = await page.evaluate(() => (window as unknown as { __pdfClippedPoints: number[][] }).__pdfClippedPoints);
  expect(points).toHaveLength(2);
  const left = Math.ceil(points[0][0] * 1.5); const top = Math.ceil(points[0][1] * 1.5);
  const right = Math.floor(geometry.visibleRight * 1.5); const bottom = Math.floor(geometry.visibleBottom * 1.5);
  const path = info.outputPath('frequency-clipped.pdf'); await file.saveAs(path); const bytes = await readFile(path); const text = bytes.toString('latin1');
  const match = /\/Width (\d+) \/Height (\d+).*?\/Length (\d+) >>\nstream\n/s.exec(text); if (!match) throw new Error('Image missing');
  expect([Number(match[1]), Number(match[2])]).toEqual([right - left, bottom - top]);
  const jpeg = bytes.subarray(match.index + match[0].length, match.index + match[0].length + Number(match[3]));
  expect(verifyPdf(bytes, right - left, bottom - top).equals(jpeg)).toBe(true);
  const difference = await page.evaluate(async ({ png, jpg, x, y, markerX, markerY }) => {
    const decode = async (data: string, type: string) => createImageBitmap(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type }));
    const original = await decode(png, 'image/png'); const exported = await decode(jpg, 'image/jpeg');
    const canvas = document.createElement('canvas'); canvas.width = original.width; canvas.height = original.height; const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(original, 0, 0); const marker = Array.from(ctx.getImageData(markerX, markerY, 1, 1).data); const a = ctx.getImageData(x, y, exported.width, exported.height).data;
    canvas.width = exported.width; canvas.height = exported.height; ctx.drawImage(exported, 0, 0); const b = ctx.getImageData(0, 0, exported.width, exported.height).data;
    let mismatch = 0; let markerPixels = 0; for (let i = 0; i < a.length; i += 4) { if (Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])) > 20) mismatch++; if (b[i] < 20 && b[i+1] > 240 && b[i+2] < 20) markerPixels++; }
    return { fraction: mismatch / (a.length / 4), marker, markerPixels };
  }, { png: reference.toString('base64'), jpg: jpeg.toString('base64'), x: left, y: top, markerX: Math.floor((geometry.left + 33) * 1.5), markerY: Math.floor((geometry.visibleBottom + 6) * 1.5) });
  expect(difference.marker).toEqual([0, 255, 0, 255]); expect(difference.markerPixels).toBe(0); expect(difference.fraction).toBeLessThan(0.03);
  await writeFile(info.outputPath('frequency-clipped-observations.json'), JSON.stringify({ points, left, top, right, bottom, before, requests, difference }, null, 2));
});

test('includes the visible time ruler and overview in a lanes crop', async ({ page, server }, info) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } }); expect(opened.ok()).toBe(true);
  await expect(page.locator('.wave')).toHaveCount(1); await page.getByLabel('Analysis method').selectOption('welch'); await page.waitForTimeout(500);
  const timeline = await page.locator('.timeline').boundingBox(); const wave = await page.locator('.wave').first().boundingBox();
  if (!timeline || !wave) throw new Error('Ruler or waveform missing');
  const png = await page.screenshot({ path: info.outputPath('ruler-reference.png') });
  await page.evaluate(() => { const points: number[][] = []; Object.assign(window, { __rulerPoints: points }); window.addEventListener('pointerdown', event => points.push([event.clientX, event.clientY]), true); window.addEventListener('pointerup', event => points.push([event.clientX, event.clientY]), true); });
  await page.getByLabel('Export visible area to PDF').click(); await page.evaluate(() => { (window as unknown as { __rulerPoints: number[][] }).__rulerPoints.length = 0; });
  const download = page.waitForEvent('download'); await page.mouse.move(wave.x + 3.2, timeline.y + 2.2); await page.mouse.down(); await page.mouse.move(wave.x + 250.2, wave.y + 35.2); await page.mouse.up();
  const file = await download; const path = info.outputPath('ruler.pdf'); await file.saveAs(path);
  const points = await page.evaluate(() => (window as unknown as { __rulerPoints: number[][] }).__rulerPoints); expect(points).toHaveLength(2);
  const left = Math.ceil(points[0][0] * 1.5); const top = Math.ceil(points[0][1] * 1.5); const right = Math.floor(points[1][0] * 1.5); const bottom = Math.floor(points[1][1] * 1.5);
  const pdf = await readFile(path); const text = pdf.toString('latin1'); const match = /\/Width (\d+) \/Height (\d+).*?\/Length (\d+) >>\nstream\n/s.exec(text);
  if (!match) throw new Error('Image missing'); expect([Number(match[1]), Number(match[2])]).toEqual([right - left, bottom - top]);
  const jpeg = pdf.subarray(match.index + match[0].length, match.index + match[0].length + Number(match[3]));
  const diff = await page.evaluate(async ({ original, raster, x, y }) => {
    const decode = async (value: string, type: string) => createImageBitmap(new Blob([Uint8Array.from(atob(value), c => c.charCodeAt(0))], { type }));
    const source = await decode(original, 'image/png'); const result = await decode(raster, 'image/jpeg'); const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D; ctx.drawImage(source, 0, 0); const a = ctx.getImageData(x, y, result.width, result.height).data;
    canvas.width = result.width; canvas.height = result.height; ctx.drawImage(result, 0, 0); const b = ctx.getImageData(0, 0, result.width, result.height).data;
    let errors = 0; const rows = Array.from({ length: result.height }, () => 0); for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i+1] - b[i+1]), Math.abs(a[i+2] - b[i+2])) > 20) { errors++; rows[Math.floor(i / 4 / result.width)]++; }
    return { fraction: errors / (a.length / 4), rows: rows.map((count, y) => [y, count]).filter(row => row[1] > result.width * 0.1) };
  }, { original: png.toString('base64'), raster: jpeg.toString('base64'), x: left, y: top });
  expect(diff.fraction).toBeLessThan(0.03);
});

test('retains chart content at standard and high device pixel ratios', async ({ browser, server }, info) => {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr, acceptDownloads: true });
    const page = await context.newPage(); await page.goto(`${server.url}/?token=${server.token}`);
    const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } }); expect(opened.ok()).toBe(true);
    const plot = page.getByLabel('Frequency analysis plot'); await expect(plot.locator('canvas')).toBeVisible(); await expect(plot).toHaveAttribute('data-curve-ids', /:frame$/);
    await page.waitForTimeout(300); const rect = await plot.boundingBox(); if (!rect) throw new Error('Plot missing');
    const png = await page.screenshot(); await page.getByLabel('Export visible area to PDF').click(); const download = page.waitForEvent('download');
    await page.mouse.move(rect.x + 3, rect.y + 3); await page.mouse.down(); await page.mouse.move(rect.x + rect.width - 3, rect.y + rect.height - 3); await page.mouse.up();
    const file = await download; const path = info.outputPath(`dpr-${dpr}.pdf`); await file.saveAs(path); const pdf = await readFile(path); const text = pdf.toString('latin1');
    const match = /\/Width (\d+) \/Height (\d+).*?\/Length (\d+) >>\nstream\n/s.exec(text); if (!match) throw new Error('Image missing');
    const jpeg = pdf.subarray(match.index + match[0].length, match.index + match[0].length + Number(match[3]));
    const result = await page.evaluate(async ({ original, raster, x, y }) => {
      const decode = async (value: string, type: string) => createImageBitmap(new Blob([Uint8Array.from(atob(value), c => c.charCodeAt(0))], { type }));
      const source = await decode(original, 'image/png'); const output = await decode(raster, 'image/jpeg'); const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D; ctx.drawImage(source, 0, 0); const a = ctx.getImageData(x, y, output.width, output.height).data;
      canvas.width = output.width; canvas.height = output.height; ctx.drawImage(output, 0, 0); const b = ctx.getImageData(0, 0, output.width, output.height).data;
      let errors = 0; let legend = 0; let matched = 0; for (let i = 0; i < a.length; i += 4) { const error = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2])); if (error > 20) errors++; const p = i / 4; if (Math.floor(p / output.width) < 30 && p % output.width > output.width / 2 && a[i] > 160 && a[i+1] > 160 && a[i+2] > 160) { legend++; if (error <= 20) matched++; } }
      return { fraction: errors / (a.length / 4), legend, matched };
    }, { original: png.toString('base64'), raster: jpeg.toString('base64'), x: Math.ceil((rect.x + 3) * dpr), y: Math.ceil((rect.y + 3) * dpr) });
    expect(result.fraction, `DPR ${dpr}`).toBeLessThan(0.03); expect(result.legend).toBeGreaterThan(20); expect(result.matched / result.legend, `DPR ${dpr} legend`).toBeGreaterThan(0.85);
    await context.close();
  }
});

test('export gestures starting on floating Play do not start playback, including cancellation', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  const opened = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true); await expect(page.locator('.lane')).toHaveCount(1);
  const waveform = await page.locator('.waveform-part').first().boundingBox(); if (!waveform) throw new Error('Waveform missing');
  await page.mouse.move(waveform.x + 20, waveform.y + 10); await page.mouse.down(); await page.mouse.move(waveform.x + 70, waveform.y + 10); await page.mouse.up();
  const play = page.getByTitle('Play time selection (Space)'); await expect(play).toBeVisible();
  await page.getByLabel('Analysis method').selectOption('welch'); await expect(page.getByLabel('Frequency analysis plot')).toHaveAttribute('data-curve-ids', /:mean$/);
  const selection = await Promise.all(['Start', 'End', 'Duration'].map(name => page.getByLabel(name, { exact: true }).inputValue()));
  const pcm: string[] = []; page.on('request', request => { if (request.url().includes('/pcm?')) pcm.push(request.url()); });
  const position = async () => { const box = await play.boundingBox(); if (!box) throw new Error('Floating Play missing'); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  await page.getByLabel('Export visible area to PDF').click(); let start = await position();
  const download = page.waitForEvent('download'); await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 55, start.y + 40); await page.mouse.up(); await download;
  await page.waitForTimeout(300); expect(pcm).toEqual([]); await expect(page.getByTitle('Play / pause')).toContainText('Play');
  expect(await Promise.all(['Start', 'End', 'Duration'].map(name => page.getByLabel(name, { exact: true }).inputValue()))).toEqual(selection);
  await page.getByLabel('Export visible area to PDF').click(); start = await position(); await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 30, start.y + 20); await page.keyboard.press('Escape'); await page.mouse.up();
  await page.waitForTimeout(300); expect(pcm).toEqual([]); await expect(page.getByTitle('Play / pause')).toContainText('Play');
  await page.getByLabel('Export visible area to PDF').click(); start = await position(); await page.mouse.click(start.x, start.y); await page.waitForTimeout(300); expect(pcm).toEqual([]);
  await play.click(); await expect.poll(() => pcm.length).toBeGreaterThan(0); await expect(page.getByTitle('Play / pause')).toContainText('Pause');
});

test('exports mel and raw feature heatmaps with their visible axes and colorbars', async ({ page, server }, info) => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { dirname } = await import('node:path');
  await page.goto(`${server.url}/?token=${server.token}`);
  const open = () => page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect((await open()).ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(1);
  await promisify(execFile)('uv', ['run', '--no-sync', 'python', '-c',
    'import numpy as np, vsr; a = np.repeat(np.array([0.25, 1, 0.5, 0.75], dtype=np.float32)[:,None], 100, axis=1); vsr.show(a, kind="feature", sr=8000, hop=80, freq_axis=dict(type="linear", f_max=3000), value_scale="raw", name="model values")'],
    { cwd: '..', env: { ...process.env, VSR_HOME: dirname(server.audio) } });
  await expect(page.locator('.lane')).toHaveCount(2);
  expect((await open()).ok()).toBe(true);
  await expect(page.locator('.lane')).toHaveCount(3);
  const audio = page.locator('.lane').first();
  const feature = page.locator('.lane').nth(1);
  await audio.locator('.view-modes').getByRole('button', { name: 'S', exact: true }).click();
  await page.keyboard.press('0');
  await page.getByText('Display', { exact: true }).first().click();
  const mel = page.waitForResponse(response => response.url().includes('/spectrogram?') && new URL(response.url()).searchParams.get('mode') === 'mel' && response.ok());
  await page.getByLabel('Spectrogram mode').selectOption('mel'); await mel;
  await page.getByLabel('Palette').selectOption('gray');
  await expect(audio.locator('.packet-axis canvas')).toHaveAttribute('aria-label', /.+,.+,.+/);
  const raw = feature.locator('.spectral-surface');
  await expect(raw).toBeVisible();
  await raw.click({ position: { x: 40, y: 50 } });
  await page.getByLabel('Palette').selectOption('gray');
  await page.getByLabel('Filter').selectOption('NEAREST');
  await expect(feature.locator('.packet-axis canvas')).toHaveAttribute('aria-label', '0, 1k, 3k');
  await expect(feature.locator('.colorbar-unit canvas')).toHaveAttribute('aria-label', 'value');
  await expect(audio.locator('.colorbar-unit canvas')).toHaveAttribute('aria-label', 'dBFS');
  await page.locator('.lane-list').evaluate(element => {
    (element as HTMLElement).style.transform = 'translate(0.35px, 0.3px)';
    element.scrollTop = 23;
  });
  const selected = await raw.boundingBox(); if (!selected) throw new Error('Feature surface missing');
  await page.mouse.move(selected.x + 80, selected.y + 65); await page.mouse.down();
  await page.mouse.move(selected.x + 195, selected.y + 65); await page.mouse.up();
  await page.mouse.move(5, 12);
  await page.waitForTimeout(500);
  const before = await Promise.all(['Start', 'End', 'Duration'].map(name => page.getByLabel(name, { exact: true }).inputValue()));
  const playhead = await page.locator('.measurements > span').textContent();
  const geometry = await page.locator('.lane-list').evaluate(element => {
    const rect = (target: Element) => {
      const { left, top, right, bottom } = target.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    const rows = Array.from(element.querySelectorAll('.lane')).slice(0, 2).map(row => ({
      surface: rect(row.querySelector('.spectral-surface') as Element),
      axis: rect(row.querySelector('.frequency-axis') as Element),
      bar: rect(row.querySelector('.colorbar') as Element),
    }));
    const list = rect(element);
    const root = element.closest('.lanes') as HTMLElement;
    const drawing = rect(root);
    let bottom = Math.min(innerHeight, list.bottom, drawing.bottom);
    for (let parent = root.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) bottom = Math.min(bottom, rect(parent).bottom - parseFloat(style.borderBottomWidth));
    }
    return { rows, list, bottom, left: Math.max(rows[0].axis.left, list.left, drawing.left), right: Math.min(rows[0].bar.right + 3, list.right, drawing.right) };
  });
  const reference = await page.screenshot({ path: info.outputPath('mel-feature-reference.png') });
  const requests: string[] = [];
  page.on('request', request => { if (/\/(waveform|spectrogram|spectrum|pcm)([/?]|$)/.test(request.url())) requests.push(request.url()); });
  await page.evaluate(() => {
    const points: number[][] = []; Object.assign(window, { __tensorPdfPoints: points });
    window.addEventListener('pointerdown', event => points.push([event.clientX, event.clientY]), true);
    window.addEventListener('pointerup', event => points.push([event.clientX, event.clientY]), true);
  });
  await page.getByLabel('Export visible area to PDF').click();
  await page.evaluate(() => { (window as unknown as { __tensorPdfPoints: number[][] }).__tensorPdfPoints.length = 0; });
  const downloaded = page.waitForEvent('download');
  await page.mouse.move(geometry.left + 0.95, geometry.list.top + 0.9); await page.mouse.down();
  await page.mouse.move(geometry.right + 12.25, geometry.bottom + 10.25); await page.mouse.up();
  const file = await downloaded;
  const path = info.outputPath('mel-feature.pdf'); await file.saveAs(path);
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  expect(await Promise.all(['Start', 'End', 'Duration'].map(name => page.getByLabel(name, { exact: true }).inputValue()))).toEqual(before);
  await expect(page.locator('.measurements > span')).toHaveText(playhead as string);
  const points = await page.evaluate(() => (window as unknown as { __tensorPdfPoints: number[][] }).__tensorPdfPoints);
  expect(points).toHaveLength(2);
  expect(points[1][0]).toBeGreaterThan(geometry.right);
  expect(points[1][1]).toBeGreaterThan(geometry.bottom);
  const dpr = 1.5;
  const left = Math.ceil(points[0][0] * dpr);
  const top = Math.ceil(points[0][1] * dpr);
  const right = Math.floor(geometry.right * dpr);
  const bottom = Math.floor(geometry.bottom * dpr);
  const jpeg = verifyPdf(await readFile(path), right - left, bottom - top);
  const compared = await page.evaluate(async ({ png, jpg, rows, left, top, dpr }) => {
    const decode = async (source: string, type: string) => createImageBitmap(new Blob([Uint8Array.from(atob(source), char => char.charCodeAt(0))], { type }));
    const original = await decode(png, 'image/png');
    const output = await decode(jpg, 'image/jpeg');
    const canvas = document.createElement('canvas'); canvas.width = original.width; canvas.height = original.height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(original, 0, 0); const a = ctx.getImageData(left, top, output.width, output.height).data;
    canvas.width = output.width; canvas.height = output.height;
    ctx.drawImage(output, 0, 0); const b = ctx.getImageData(0, 0, output.width, output.height).data;
    type Area = { left: number; top: number; right: number; bottom: number };
    function samples(area: Area, accepts: (r: number, g: number, b: number) => boolean) {
      const values: { x: number; y: number; diff: number }[] = [];
      for (let y = Math.max(2, Math.ceil(area.top * dpr - top) + 2); y < Math.min(output.height - 2, Math.floor(area.bottom * dpr - top) - 2); y++) {
        for (let x = Math.max(2, Math.ceil(area.left * dpr - left) + 2); x < Math.min(output.width - 2, Math.floor(area.right * dpr - left) - 2); x++) {
          if (values.some(point => Math.abs(point.x - x) < 6 && Math.abs(point.y - y) < 5)) continue;
          const pixels = [0, 1].map(shift => (y * output.width + x + shift) * 4);
          if (!pixels.every(i => accepts(a[i], a[i + 1], a[i + 2]))) continue;
          const diff = Math.max(...pixels.flatMap(i => [0, 1, 2].map(channel => Math.abs(a[i + channel] - b[i + channel]))));
          values.push({ x, y, diff });
          if (values.length === 8) return values;
        }
      }
      return values;
    }
    return rows.map(({ surface, axis, bar }) => ({
      heatmap: samples({ ...surface, left: surface.left + 220, right: surface.left + 500 }, (r, g, b) => r > 160 && Math.max(r, g, b) - Math.min(r, g, b) < 5),
      labels: samples(axis, (r, g, b) => r >= 110 && g >= 115 && b >= 120 && b >= r + 6),
      colorbar: samples(bar, (r, g, b) => r > 45 && r < 220 && Math.max(r, g, b) - Math.min(r, g, b) < 5),
    }));
  }, { png: reference.toString('base64'), jpg: jpeg.toString('base64'), rows: geometry.rows, left, top, dpr });
  await writeFile(info.outputPath('mel-feature-observations.json'), JSON.stringify({ geometry, points, left, top, right, bottom, compared }, null, 2));
  for (const [row, regions] of compared.entries()) for (const [region, values] of Object.entries(regions)) {
    expect(values.length, `row ${row} ${region}`).toBeGreaterThanOrEqual(2);
    for (const value of values) expect(value.diff, `row ${row} ${region} ${JSON.stringify(value)}`).toBeLessThanOrEqual(20);
  }
});
