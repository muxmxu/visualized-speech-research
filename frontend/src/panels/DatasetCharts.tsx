import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import uPlot from 'uplot';
import { ApiError, datasetLtas } from '../api/client';
import type { DatasetCell, DatasetRow } from '../api/types';

const colors = ['#4aa3ff', '#3ddc97', '#ffd166', '#ef88c3', '#b4a2ff', '#ff986b'];
const colorFor = (i: number) => colors[i % colors.length];
const axes = (label: string): uPlot.Axis => ({
  label, stroke: '#d7dbe0', grid: { stroke: '#343941', width: 1 },
});
const valueLabel = (cell: DatasetCell) => cell === null ? '(missing)' : typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
type Chart = 'Histogram' | 'Scatter' | 'LTAS';
type SeriesData = { options: Omit<uPlot.Options, 'width' | 'height'>; data: uPlot.AlignedData; names: string[] };

function LineChart({ label, chart }: { label: string; chart: SeriesData }) {
  const surface = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const size = () => ({ width: Math.max(1, element.clientWidth), height: Math.max(100, element.clientHeight) });
    const plot = new uPlot({ ...chart.options, ...size() }, chart.data, element);
    const observer = new ResizeObserver(() => plot.setSize(size()));
    observer.observe(element);
    return () => { observer.disconnect(); plot.destroy(); };
  }, [chart]);
  return <div ref={surface} className="dataset-chart-surface" aria-label={label} />;
}

function histogram(byGroup: Map<string, DatasetRow[]>, column: string): SeriesData | null {
  const groups = [...byGroup].map(([label, rows]) => [label, rows.flatMap(row => {
    const value = row.cells[column];
    return typeof value === 'number' ? [value] : [];
  })] as const).filter(([, values]) => values.length > 0);
  let count = 0;
  let low = Infinity;
  let high = -Infinity;
  for (const [, values] of groups) {
    count += values.length;
    for (const value of values) { low = Math.min(value, low); high = Math.max(value, high); }
  }
  if (!count) return null;
  if (low === high) { low -= 0.5; high += 0.5; }
  const bins = Math.min(30, Math.max(5, Math.ceil(Math.sqrt(count))));
  const step = (high - low) / bins;
  const positions = Array.from({ length: bins }, (_, i) => low + (i + 0.5) * step);
  const histograms = groups.map(([, values]) => {
    const counts = Array<number>(bins).fill(0);
    for (const value of values) counts[Math.min(bins - 1, Math.floor((value - low) / step))]++;
    return counts;
  });
  const bars = uPlot.paths.bars as uPlot.Series.BarsPathBuilderFactory;
  return {
    names: groups.map(([label]) => label),
    data: [positions, ...histograms],
    options: {
      scales: { x: { time: false, range: [low, high] }, y: { auto: true } },
      axes: [axes(column), axes('Files')],
      legend: { show: false },
      series: [{}, ...groups.map(([label], i) => ({ label, stroke: colorFor(i), fill: `${colorFor(i)}58`, paths: bars({ size: [0.9] }), width: 1, points: { show: false } }))],
    },
  };
}

interface Point { x: number; y: number; group: number }
const maxPoints = 20_000;

function scatterPoints(byGroup: Map<string, DatasetRow[]>, xColumn: string, yColumn: string) {
  let eligible = 0;
  const points: Point[] = [];
  [...byGroup.values()].forEach((rows, group) => {
    for (const row of rows) {
      const x = row.cells[xColumn];
      const y = row.cells[yColumn];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      eligible++;
      if (points.length < maxPoints) points.push({ x, y, group });
      else {
        const replacement = Math.floor(Math.random() * eligible);
        if (replacement < maxPoints) points[replacement] = { x, y, group };
      }
    }
  });
  return { points, eligible };
}

function Scatter({ points, xLabel, yLabel }: { points: Point[]; xLabel: string; yLabel: string }) {
  const surface = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const ctx = element.getContext('2d') as CanvasRenderingContext2D;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const { x, y } of points) {
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
    }
    if (xMin === xMax) { xMin -= 0.5; xMax += 0.5; }
    if (yMin === yMax) { yMin -= 0.5; yMax += 0.5; }
    const draw = () => {
      const { width, height } = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);
      const left = 64, top = 10, right = width - 18, bottom = height - 40;
      ctx.font = '11px ui-monospace, monospace';
      for (let step = 0; step <= 4; step++) {
        const fraction = step / 4;
        const x = left + fraction * (right - left);
        const y = bottom - fraction * (bottom - top);
        ctx.fillStyle = '#343941';
        ctx.fillRect(left, y, right - left, 1);
        ctx.fillRect(x, top, 1, bottom - top);
        ctx.fillStyle = '#d7dbe0';
        ctx.textAlign = 'center';
        ctx.fillText(Number((xMin + fraction * (xMax - xMin)).toPrecision(4)).toString(), x, bottom + 16);
        ctx.textAlign = 'right';
        ctx.fillText(Number((yMin + fraction * (yMax - yMin)).toPrecision(4)).toString(), left - 7, y + 4);
      }
      ctx.textAlign = 'center';
      ctx.fillText(xLabel, (left + right) / 2, height - 7);
      ctx.save();
      ctx.translate(12, (top + bottom) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 0.7;
      for (const { x, y, group } of points) {
        const px = left + (x - xMin) * (right - left) / (xMax - xMin);
        const py = bottom - (y - yMin) * (bottom - top) / (yMax - yMin);
        ctx.fillStyle = colorFor(group);
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [points, xLabel, yLabel]);
  return <canvas ref={surface} className="dataset-chart-surface" role="img" aria-label={`${xLabel} versus ${yLabel}`} />;
}

function Ltas({ id, groups }: { id: string; groups: string }) {
  const [ready, setReady] = useState<{ key: string; chart: SeriesData } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const chart = ready?.key === groups ? ready.chart : null;
  useEffect(() => {
    const selection = JSON.parse(groups) as [string, number[]][];
    const abort = new AbortController();
    if (!selection.length) return;
    const load = async () => {
      const names: string[] = [];
      const series: uPlot.Series[] = [{}];
      const bands: uPlot.Band[] = [];
      let freqs = new Float32Array();
      const values: (number | null)[][] = [];
      const present = (value: number) => Number.isFinite(value) ? value : null;
      for (let start = 0; start < selection.length; start += 16) {
        const block = await datasetLtas(id, Object.fromEntries(selection.slice(start, start + 16)), abort.signal);
        freqs = new Float32Array(block.frequencies);
        const length = freqs.length;
        block.groups.forEach((label, i) => {
          const color = colorFor(names.length);
          names.push(label);
          const first = series.length;
          series.push({ label, width: 1.5, stroke: color, spanGaps: false, points: { show: false } },
            { stroke: 'transparent', spanGaps: false, points: { show: false } },
            { stroke: 'transparent', spanGaps: false, points: { show: false } });
          bands.push({ series: [first + 2, first + 1], fill: `${color}35` });
          const offsets = Array.from({ length }, (_, bin) => i * length + bin);
          values.push(offsets.map(index => present(block.mean[index])),
            offsets.map(index => Number.isFinite(block.p90[index]) ? present(block.p10[index]) : null),
            offsets.map(index => Number.isFinite(block.p10[index]) ? present(block.p90[index]) : null));
        });
      }
      if (abort.signal.aborted) return;
      setReady({ key: groups, chart: { names, data: [freqs, ...values], options: {
        scales: { x: { time: false, distr: 3 }, y: { auto: true } },
        axes: [axes('Frequency (Hz)'), axes('dB/Hz')], legend: { show: false }, series, bands,
      } } });
    };
    void load().catch((error: unknown) => {
      if (abort.signal.aborted) return;
      setFailed(groups);
      if (!(error instanceof ApiError)) notifications.show({ title: 'LTAS request failed', message: String(error), color: 'red' });
    });
    return () => abort.abort();
  }, [id, groups]);
  if (groups === '[]') return <p className="dataset-chart-empty">No filtered rows to plot.</p>;
  if (!chart) return <p className="dataset-chart-empty" role="status">{failed === groups ? 'LTAS could not be loaded.' : 'Loading LTAS…'}</p>;
  return <>
    <Legend names={chart.names} label="LTAS groups" />
    <LineChart label="Grouped LTAS plot" chart={chart} />
  </>;
}

function Legend({ names, label }: { names: string[]; label: string }) {
  return <ul className="dataset-chart-legend" aria-label={label}>
    {names.map((name, index) => <li key={name} title={name.includes('/') ? name : undefined}>
      <i style={{ background: colorFor(index) }} />{name}
    </li>)}
  </ul>;
}

export function DatasetCharts({ id, rows, numeric, groups }: {
  id: string; rows: DatasetRow[]; numeric: string[]; groups: string[];
}) {
  const [chart, setChart] = useState<Chart>('LTAS');
  const [groupBy, setGroupBy] = useState('source');
  const [x, setX] = useState(numeric.includes('duration_s') ? 'duration_s' : numeric.at(0) ?? '');
  const [y, setY] = useState(numeric.includes('rms_dbfs') ? 'rms_dbfs' : numeric.at(1) ?? numeric.at(0) ?? '');
  const grouped = useMemo(() => {
    const byGroup = new Map<string, DatasetRow[]>();
    for (const row of rows) {
      const name = valueLabel(row.cells[groupBy]);
      const found = byGroup.get(name);
      if (found) found.push(row); else byGroup.set(name, [row]);
    }
    return byGroup;
  }, [rows, groupBy]);
  const groupSnapshot = useMemo(() => JSON.stringify([...grouped].map(([label, members]) => [label, members.map(item => item.index)])), [grouped]);
  const histogramData = useMemo(() => chart === 'Histogram' ? histogram(grouped, x) : null, [chart, grouped, x]);
  const scatterData = useMemo(() => chart === 'Scatter' ? scatterPoints(grouped, x, y) : null, [chart, grouped, x, y]);
  const columnOptions = numeric.map(column => <option key={column}>{column}</option>);
  return <section className="dataset-charts" aria-label="Dataset charts">
    <div className="dataset-chart-controls">
      <div className="dataset-chart-tabs" aria-label="Chart type">
        {(['Histogram', 'Scatter', 'LTAS'] as const).map(item => <button key={item} type="button" title={item}
          aria-pressed={item === chart} onClick={() => setChart(item)}>{item}</button>)}
      </div>
      <label>Group by<select value={groupBy} onChange={event => setGroupBy(event.currentTarget.value)}>
        {groups.map(column => <option key={column}>{column}</option>)}
      </select></label>
      {chart === 'LTAS' && <span className="dataset-chart-key">Mean and p10–p90</span>}
      {chart !== 'LTAS' && <label>{chart === 'Histogram' ? 'Column' : 'X column'}
        <select value={x} onChange={event => setX(event.currentTarget.value)}>{columnOptions}</select>
      </label>}
      {chart === 'Scatter' && <label>Y column<select value={y} onChange={event => setY(event.currentTarget.value)}>{columnOptions}</select></label>}
    </div>
    {chart === 'LTAS' && <Ltas id={id} groups={groupSnapshot} />}
    {chart === 'Histogram' && (histogramData ?
      <><Legend names={histogramData.names} label="Histogram groups" /><LineChart label="Dataset histogram" chart={histogramData} /></>
      : <p className="dataset-chart-empty">No numeric values to plot.</p>)}
    {chart === 'Scatter' && (scatterData?.points.length ?
      <>
        <Legend names={[...grouped.keys()]} label="Scatter groups" />
        {scatterData.points.length < scatterData.eligible && <p className="dataset-sample-count">Showing {scatterData.points.length.toLocaleString()} of {scatterData.eligible.toLocaleString()} valid points.</p>}
        <Scatter points={scatterData.points} xLabel={x} yLabel={y} />
      </> : <p className="dataset-chart-empty">No numeric pairs to plot.</p>)}
  </section>;
}
