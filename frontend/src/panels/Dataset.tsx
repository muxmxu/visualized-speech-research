import { useCallback, useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconPlus, IconX } from '@tabler/icons-react';
import { AllCommunityModule, ModuleRegistry, colorSchemeDark, themeQuartz } from 'ag-grid-community';
import type { ColDef, GridApi } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ApiError, cancelDataset, datasetRows, scanDataset } from '../api/client';
import type { AnalyzerCatalog, AnalyzerParam, AnalyzerValue, DatasetCell, DatasetProgress, DatasetRow, DatasetTable } from '../api/types';
import { DatasetCharts } from './DatasetCharts';

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: '#202328', foregroundColor: '#d7dbe0', headerBackgroundColor: '#272b31',
  borderColor: '#343941', accentColor: '#4aa3ff', rowHeight: 27,
  headerHeight: 30, fontFamily: 'ui-monospace, monospace', fontSize: 12,
});

const generatedColumns = new Set(['source', 'path', 'duration_s', 'sr', 'channels', 'subtype', 'peak_dbfs',
  'rms_dbfs', 'clip_ratio', 'dc_offset', 'lead_silence_s', 'trail_silence_s', 'active_ratio', 'bandwidth_hz', 'error']);

function cellText(value: DatasetCell): string {
  if (value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function downloadCsv(columns: string[], rows: DatasetRow[]) {
  const encode = (value: string) => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const lines = [columns.map(encode).join(','), ...rows.map(row => columns.map(column => encode(cellText(row.cells[column]))).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dataset.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function report(error: unknown) {
  if (!(error instanceof ApiError)) notifications.show({ title: 'Dataset request failed', message: String(error), color: 'red' });
}

function Parameter({ name, param, value, change }: {
  name: string; param: AnalyzerParam; value: AnalyzerValue; change: (value: AnalyzerValue) => void;
}) {
  const label = param.label ?? name;
  const caption = param.unit ? `${label} (${param.unit})` : label;
  if (param.choices) {
    const choices = param.choices;
    return <label>{caption}<select value={choices.indexOf(value)} onChange={event => change(choices[Number(event.currentTarget.value)])}>
      {choices.map((choice, index) => <option value={index} key={index}>{String(choice)}</option>)}
    </select></label>;
  }
  if (param.type === 'bool') return <label className="dataset-checkbox">
    <input type="checkbox" checked={value === true} onChange={event => change(event.currentTarget.checked)} />{caption}
  </label>;
  return <label>{caption}<input type={param.type === 'str' ? 'text' : 'number'} value={String(value)}
    required={param.type !== 'str'} min={param.min ?? undefined} max={param.max ?? undefined}
    step={param.step ?? (param.type === 'int' ? 1 : 'any')} onChange={event => change(event.currentTarget.value)} /></label>;
}

function Results({ id, table, open }: { id: string; table: DatasetTable; open: (file: string) => void }) {
  const { columns, data } = table;
  const rows = useMemo<DatasetRow[]>(() => data.path.map((_, index) => ({
    index, cells: Object.fromEntries(columns.map(column => [column, data[column][index]])),
  })), [columns, data]);
  const numeric = useMemo(() => columns.filter(column => data[column].some(value => typeof value === 'number')), [columns, data]);
  const groups = useMemo(() => columns.filter(column => column === 'source' || !generatedColumns.has(column)), [columns]);
  const [filtered, setFiltered] = useState(rows);
  const columnDefs = useMemo<ColDef<DatasetRow, DatasetCell>[]>(() => columns.map(column => ({
    colId: column,
    headerName: column,
    valueGetter: ({ data: row }) => row ? row.cells[column] : null,
    valueFormatter: ({ value }) => cellText(value ?? null),
    tooltipValueGetter: ({ value }) => cellText(value ?? null),
    cellDataType: false,
    filter: numeric.includes(column) ? 'agNumberColumnFilter' : 'agTextColumnFilter',
    ...(numeric.includes(column) ? { filterParams: { filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'], defaultOption: 'inRange', maxNumConditions: 1 } } : {}),
    floatingFilter: true,
    sortable: true,
    resizable: true,
    width: column === 'path' || column === 'source' || column === 'error' ? 240 : 126,
  })), [columns, numeric]);
  const syncFilter = useCallback(({ api }: { api: GridApi<DatasetRow> }) => {
    const visible: DatasetRow[] = [];
    api.forEachNodeAfterFilterAndSort(node => { if (node.data) visible.push(node.data); });
    setFiltered(visible);
  }, []);
  return <>
    <div className="dataset-result-bar">
      <span role="status">{filtered.length} of {rows.length} rows</span>
      <button type="button" title="Export filtered rows as CSV" onClick={() => downloadCsv(columns, filtered)}>
        <IconDownload size={14} /> Export CSV
      </button>
    </div>
    <div className="dataset-grid" aria-label="Dataset rows" style={{ height: 76 + Math.max(rows.length, 2) * 27 }}>
      <AgGridReact<DatasetRow> theme={gridTheme} rowData={rows} columnDefs={columnDefs} getRowId={({ data: row }) => String(row.index)}
        onFilterChanged={syncFilter} onSortChanged={syncFilter} onFirstDataRendered={syncFilter}
        onRowDoubleClicked={({ data: row }) => { if (row?.cells.error === null) open(row.cells.path as string); }} />
    </div>
    <DatasetCharts id={id} rows={filtered} numeric={numeric} groups={groups} />
  </>;
}

export function Dataset({ catalog, progress, open }: {
  catalog: AnalyzerCatalog | null; progress: Partial<Record<string, DatasetProgress>>; open: (file: string) => void;
}) {
  const [sources, setSources] = useState<string[]>([]);
  const [pathDraft, setPathDraft] = useState('');
  const [threshold, setThreshold] = useState('50');
  const [selected, setSelected] = useState<Record<string, Record<string, AnalyzerValue>>>({});
  const [starting, setStarting] = useState(false);
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [table, setTable] = useState<{ id: string; data: DatasetTable } | null>(null);
  const job = jobId === null ? undefined : progress[jobId];
  const status = job?.status;
  const running = starting || (jobId !== null && (status === undefined || status === 'running'));
  const cancelling = running && cancelFor !== null && cancelFor === jobId;
  const available = catalog?.analyzers.filter(item => item.input === 'audio' && item.output !== 'other') ?? [];

  useEffect(() => {
    if (jobId === null || (status !== 'done' && status !== 'cancelled')) return;
    const abort = new AbortController();
    void datasetRows(jobId, abort.signal).then(data => {
      if (!abort.signal.aborted) setTable({ id: jobId, data });
    }).catch((error: unknown) => { if (!abort.signal.aborted) report(error); });
    return () => abort.abort();
  }, [jobId, status]);

  const addSource = () => {
    const path = pathDraft.trim();
    if (!path) return;
    setSources(old => old.includes(path) ? old : [...old, path]);
    setPathDraft('');
  };
  const begin = () => {
    if (!sources.length || running) return;
    setStarting(true);
    setJobId(null);
    setCancelFor(null);
    setTable(null);
    const analyzers = available.filter(item => Object.hasOwn(selected, item.id)).map(item => ({
      id: item.id,
      params: Object.fromEntries(Object.entries(item.params).map(([name, param]) => {
        const value = selected[item.id][name] ?? param.default;
        return [name, param.type === 'int' || param.type === 'float' ? Number(value) : value];
      })),
    }));
    void scanDataset({ sources, bandwidth_drop_db: Number(threshold), analyzers })
      .then(({ id }) => setJobId(id)).catch(report).finally(() => setStarting(false));
  };
  const cancel = () => {
    if (jobId === null) return;
    setCancelFor(jobId);
    void cancelDataset(jobId).catch((error: unknown) => {
      setCancelFor(null);
      report(error);
    });
  };
  return <section className="panel dataset-panel" aria-label="Dataset panel">
    <form className="dataset-controls" onSubmit={event => { event.preventDefault(); begin(); }}>
      <label className="dataset-source-field">Source path <input value={pathDraft} placeholder="Server directory or CSV, TSV, JSONL manifest"
        onChange={event => setPathDraft(event.currentTarget.value)} onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); addSource(); }
        }} /></label>
      <button className="dataset-add" type="button" title="Add source path" disabled={!pathDraft.trim()} onClick={addSource}><IconPlus size={14} /> Add</button>
      {sources.length > 0 && <ul className="dataset-sources" aria-label="Scan sources">
        {sources.map(path => <li key={path}><span title={path}>{path}</span>
          <button type="button" title="Remove source" aria-label={`Remove ${path}`} onClick={() => setSources(old => old.filter(item => item !== path))}><IconX size={13} /></button>
        </li>)}
      </ul>}
      <div className="dataset-options">
        <label>Bandwidth drop (dB)<input type="number" min={0} step="any" required value={threshold}
          onChange={event => setThreshold(event.currentTarget.value)} /></label>
        <button type="submit" title="Scan dataset sources" disabled={running || !sources.length}>Scan</button>
        {running && <button type="button" title="Cancel the active scan" disabled={jobId === null || cancelling} onClick={cancel}>Cancel</button>}
      </div>
      {available.length > 0 && <details className="dataset-scalars">
        <summary>Scalar analyzers</summary>
        {available.map(item => {
          const checked = Object.hasOwn(selected, item.id);
          return <fieldset key={item.id}>
            <label className="dataset-checkbox"><input type="checkbox" checked={checked} onChange={event => {
              const enabled = event.currentTarget.checked;
              setSelected(old => enabled ? { ...old, [item.id]: {} } : Object.fromEntries(Object.entries(old).filter(([id]) => id !== item.id)));
            }} />{item.label}{item.output === null ? ' (output undeclared)' : ''}</label>
            {checked && Object.entries(item.params).map(([name, param]) => <Parameter key={name} name={name} param={param}
              value={selected[item.id][name] ?? param.default}
              change={value => setSelected(old => ({ ...old, [item.id]: { ...old[item.id], [name]: value } }))} />)}
          </fieldset>;
        })}
      </details>}
    </form>
    {running && <div className="dataset-progress" role="status">
      {job && <progress aria-label="Dataset scan progress" value={job.completed} max={Math.max(1, job.total)} />}
      {cancelling ? 'Cancelling scan…' : job ? `Scanning ${job.completed} of ${job.total} files` : 'Starting scan…'}
    </div>}
    {(status === 'done' || status === 'cancelled') && <p className="dataset-scan-state" role="status">
      {status === 'done' ? 'Scan complete' : 'Scan cancelled'} · {job?.completed} of {job?.total} files
    </p>}
    {job?.status === 'failed' && <p className="dataset-error" role="status">Scan failed. {job.error?.detail}</p>}
    {table && table.id === jobId && <Results key={table.id} id={table.id} table={table.data} open={open} />}
  </section>;
}
