import { useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import type { AnalyzerCatalog, AnalyzerDefinition, AnalyzerParam, AnalyzerValue, SessionLane } from '../api/types';

export interface AnalyzerFeedback {
  lane: string;
  analyzer: string;
  message: string;
  scalars?: Record<string, number>;
}

function ParamControl({ name, param, value, change }: {
  name: string; param: AnalyzerParam; value: AnalyzerValue; change: (value: AnalyzerValue) => void;
}) {
  const label = param.label ?? name;
  const caption = param.unit ? `${label} (${param.unit})` : label;
  if (param.choices) {
    const choices = param.choices;
    return <label>{caption}<select value={choices.indexOf(value)} onChange={event => change(choices[Number(event.currentTarget.value)])}>
      {choices.map((choice, index) => <option key={index} value={index}>{String(choice)}</option>)}
    </select></label>;
  }
  if (param.type === 'bool') return <label className="analyzer-check"><input type="checkbox" checked={value === true}
    onChange={event => change(event.currentTarget.checked)} />{caption}</label>;
  if (param.type === 'str') return <label>{caption}<input value={String(value)} onChange={event => change(event.currentTarget.value)} /></label>;
  return <label>{caption}<input type="number" required value={String(value)} min={param.min ?? undefined} max={param.max ?? undefined}
    step={param.step ?? (param.type === 'int' ? 1 : 'any')} onChange={event => change(event.currentTarget.value)} /></label>;
}

function AnalyzerForm({ definition, lane, defaultChannel, disabled, pending, execute }: {
  definition: AnalyzerDefinition; lane: SessionLane; defaultChannel: number | undefined; disabled: boolean; pending: boolean;
  execute: (definition: AnalyzerDefinition, params: Record<string, AnalyzerValue>, channel?: number) => void;
}) {
  const [entries, setEntries] = useState<Record<string, AnalyzerValue>>({});
  const [channel, setChannel] = useState<number | null | undefined>(undefined);
  const selectedChannel = channel === undefined ? defaultChannel : channel ?? undefined;
  return <form className="analyzer-form" onSubmit={event => {
    event.preventDefault();
    const params = Object.fromEntries(Object.entries(definition.params).map(([name, field]) => {
      const value = entries[name] ?? field.default;
      return [name, field.type === 'int' || field.type === 'float' ? Number(value) : value];
    }));
    execute(definition, params, selectedChannel);
  }}>
    <fieldset disabled={disabled}>
      {lane.kind === 'audio' && <label>Input channel<select value={selectedChannel ?? ''} onChange={event => {
        const value = event.currentTarget.value;
        setChannel(value === '' ? null : Number(value));
      }}><option value="">All channels</option>
        {Array.from({ length: lane.channels }, (_, index) => <option key={index} value={index}>Channel {index + 1}</option>)}
      </select></label>}
      {Object.entries(definition.params).map(([name, field]) => <ParamControl key={name} name={name} param={field}
        value={entries[name] ?? field.default} change={value => setEntries(old => ({ ...old, [name]: value }))} />)}
      <button type="submit" title="Run analyzer on the current input">{pending ? 'Running…' : 'Run'}</button>
    </fieldset>
  </form>;
}

export function Analyzers({ lane, catalog, channel, selection, disabled, pending, feedback, refresh, execute }: {
  lane: SessionLane | undefined; catalog: AnalyzerCatalog | null; channel: number | undefined;
  selection: [number, number] | null; disabled: boolean; pending: boolean; feedback: AnalyzerFeedback | null;
  refresh: () => void; execute: (definition: AnalyzerDefinition, params: Record<string, AnalyzerValue>, channel?: number) => void;
}) {
  const [preferred, setPreferred] = useState('');
  const compatible = catalog?.analyzers.filter(item => item.input === lane?.kind) ?? [];
  const definition = compatible.find(item => item.id === preferred) ?? compatible.at(0);
  const output = feedback?.lane === lane?.id && feedback?.analyzer === definition?.id ? feedback : null;
  return <section className="panel analyzer-panel" aria-label="Analyzers panel">
    <div className="analyzer-heading">
      <strong title={lane?.name}>{lane?.name ?? 'Select audio or a feature'}</strong>
      <button title="Refresh analyzer list" aria-label="Refresh analyzer list" disabled={disabled} onClick={refresh}><IconRefresh size={15} /></button>
    </div>
    {lane && <p className="analyzer-scope">{selection ? `${selection[0].toFixed(3)}–${selection[1].toFixed(3)} s selection` : 'Whole lane'}</p>}
    {!catalog && <p role="status">Loading analyzers…</p>}
    {catalog?.errors.map(({ file, error }) => <details className="analyzer-import-error" key={file}>
      <summary>{file}</summary><p>{error}</p>
    </details>)}
    {catalog && lane && !definition && <p>No compatible analyzers.</p>}
    {lane && definition && <>
      <label className="analyzer-choice">Analyzer<select value={definition.id} disabled={disabled} onChange={event => setPreferred(event.currentTarget.value)}>
        {compatible.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <AnalyzerForm key={`${lane.id}:${definition.id}:${definition.version}`} definition={definition} lane={lane}
        defaultChannel={channel} disabled={disabled} pending={pending} execute={execute} />
    </>}
    {output && <div className="analyzer-result">
      {output.scalars ? <table aria-label="Scalar results"><thead><tr><th scope="col">Metric</th><th scope="col">Value</th></tr></thead>
        <tbody>{Object.entries(output.scalars).map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{Number(value.toPrecision(7))}</td></tr>)}</tbody>
      </table> : <p role="status">{output.message}</p>}
    </div>}
  </section>;
}
