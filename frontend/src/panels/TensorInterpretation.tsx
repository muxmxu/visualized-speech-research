import { useState } from 'react';
import { Modal } from '@mantine/core';
import { ApiError, NetworkError, body, json } from '../api/client';
import { notifications } from '@mantine/notifications';
import type { AudioLayout, FeatureAxes, FrequencyAxis, Interpretation, TensorIntake, TensorLeaf, ValueScale } from '../api/types';

const audioLayouts: AudioLayout[] = ['[N]', '[C,N]', '[N,C]', '[B,N]', '[B,C,N]'];
const featureAxes: FeatureAxes[] = ['[F,T]', '[T,F]', '[B,F,T]', '[B,T,F]'];
const scales: ValueScale[] = ['magnitude', 'power', 'db', 'ln_magnitude', 'log10_magnitude', 'raw'];
const featureSizes = new Set([80, 100, 128, 257, 513, 1025]);
const rateKey = 'vsr-tensor-sr';

function prefill(leaf: TensorLeaf) {
  const { shape } = leaf;
  const complex = /^[<>|=]?c(omplex|\d)/.test(leaf.dtype);
  const channelFirst = shape[0] <= 8;
  const channelLast = shape[1] <= 8;
  const audio = !complex && (shape.length === 1 || (shape.length === 2 && (channelFirst || channelLast)));
  const layout: AudioLayout = shape.length === 1 ? '[N]' : shape.length === 3 ? '[B,C,N]' : channelFirst || !channelLast ? '[C,N]' : '[N,C]';
  const transposed = !featureSizes.has(shape[shape.length - 2]) && featureSizes.has(shape[shape.length - 1]);
  const axes: FeatureAxes = shape.length === 3 ? (transposed ? '[B,T,F]' : '[B,F,T]') : (transposed ? '[T,F]' : '[F,T]');
  return { kind: audio ? 'audio' as const : 'feature' as const, layout, axes, complex };
}

function InterpretationForm({ tensor, leaf, close, opened, pending, setPending }: {
  tensor: TensorIntake; leaf: TensorLeaf; close: () => void; opened: (path: string) => void;
  pending: boolean; setPending: (value: boolean) => void;
}) {
  const initial = prefill(leaf);
  const [kind, setKind] = useState<'audio' | 'feature'>(initial.kind);
  const [layout, setLayout] = useState<AudioLayout>(initial.layout);
  const [axes, setAxes] = useState(initial.axes);
  const [axis, setAxis] = useState<FrequencyAxis['type']>('index');
  const [sr, setSr] = useState(localStorage.getItem(rateKey) ?? '24000');
  const [error, setError] = useState('');
  const rows = leaf.shape[axes === '[T,F]' || axes === '[B,T,F]' ? leaf.shape.length - 1 : leaf.shape.length - 2];
  const layouts = audioLayouts.filter(candidate => candidate.split(',').length === leaf.shape.length);
  const featureLayouts = featureAxes.filter(candidate => candidate.split(',').length === leaf.shape.length);
  const supported = kind === 'audio' ? layouts.length > 0 && !initial.complex : featureLayouts.length > 0;
  const batch = (kind === 'audio' ? layout : axes).startsWith('[B,') && leaf.shape[0] > 32;
  return <form className="tensor-form" onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const number = (key: string) => Number(fields.get(key));
    const freq_axis: FrequencyAxis = axis === 'linear' ? { type: axis, f_max: number('f_max') } : axis === 'mel'
      ? { type: axis, n_mels: number('n_mels'), fmin: number('fmin'), fmax: number('fmax'), htk: fields.has('htk') } : { type: axis };
    const interpretation: Interpretation = kind === 'audio' ? { kind, layout, sr: Number(sr) } :
      { kind, axes, sr: Number(sr), hop: number('hop'), freq_axis, value_scale: fields.get('value_scale') as ValueScale };
    setPending(true); setError('');
    void json('/open_tensor', body({ path: tensor.path, key_path: leaf.key_path, interpretation })).then(() => {
      localStorage.setItem(rateKey, sr);
      opened(tensor.path);
    }).catch((error: unknown) => {
      setPending(false);
      if (error instanceof ApiError) setError(error.message);
      else if (error instanceof NetworkError) notifications.show({ title: 'Request failed', message: error.message, color: 'red' });
      else throw error;
    });
  }}>
    <p className="tensor-shape">{leaf.dtype} · [{leaf.shape.join(', ')}]</p>
    <label>Kind <select value={kind} onChange={event => setKind(event.target.value as 'audio' | 'feature')}><option value="audio" disabled={initial.complex || !layouts.length}>Audio</option><option value="feature" disabled={!featureLayouts.length}>Feature</option></select></label>
    {kind === 'audio' ? <label>Layout <select value={layout} onChange={event => setLayout(event.target.value as AudioLayout)}>{layouts.map(option => <option key={option}>{option}</option>)}</select></label>
      : <label>Axes <select value={axes} onChange={event => setAxes(event.target.value as FeatureAxes)}>{featureLayouts.map(option => <option key={option}>{option}</option>)}</select></label>}
    <label>Sample rate (Hz) <input data-autofocus type="number" required min="1" step="1" value={sr} onChange={event => setSr(event.target.value)} /></label>
    {kind === 'feature' && <>
      <label>Hop (samples) <input name="hop" type="number" required min="1" step="1" defaultValue="256" /></label>
      <label>Frequency axis <select value={axis} onChange={event => setAxis(event.target.value as FrequencyAxis['type'])}><option value="index">Row index</option><option value="linear">Linear Hz</option><option value="mel">Mel channels</option></select></label>
      {axis === 'linear' && <label>Maximum frequency (Hz) <input name="f_max" type="number" required min="0" step="any" defaultValue={Number(sr) / 2} /></label>}
      {axis === 'mel' && <>
        <label>Mel channels <input key={rows} name="n_mels" type="number" required min="1" step="1" defaultValue={rows} /></label>
        <label>Mel minimum (Hz) <input name="fmin" type="number" required min="0" step="any" defaultValue="0" /></label>
        <label>Mel maximum (Hz) <input name="fmax" type="number" required min="0" step="any" defaultValue={Number(sr) / 2} /></label>
        <label>HTK <input name="htk" type="checkbox" /></label>
      </>}
      <label>Value scale <select name="value_scale" defaultValue={initial.complex ? 'magnitude' : 'db'}>{(initial.complex ? scales.slice(0, 1) : scales).map(option => <option key={option}>{option}</option>)}</select></label>
    </>}
    {!supported && <p role="alert">This tensor has no supported layout.</p>}
    {batch && <p role="alert">A batch can create at most 32 lanes.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="tensor-actions"><button type="button" onClick={close} disabled={pending}>Cancel</button><button type="submit" disabled={!supported || batch || pending}>{pending ? 'Opening…' : 'Open tensor'}</button></div>
  </form>;
}

export function TensorInterpretation({ tensor, close, opened }: {
  tensor: TensorIntake; close: () => void; opened: (path: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const leaf = tensor.tree[index];
  return <Modal opened onClose={() => { if (!pending) close(); }} closeOnEscape={!pending} closeOnClickOutside={!pending} withCloseButton={!pending} title="Interpret tensor" size={tensor.tree.length > 1 ? 'lg' : 'md'} centered>
    <div className={`tensor-dialog ${tensor.tree.length > 1 ? 'tensor-multiple' : ''}`}>
      {tensor.tree.length > 1 && <div className="tensor-leaves" role="group" aria-label="Tensor leaves">
        {tensor.tree.map((item, i) => <button key={i} type="button" disabled={pending} aria-pressed={i === index} onClick={() => setIndex(i)}>
          <span>{item.key_path.map(component => `[${JSON.stringify(component)}]`).join('') || '(root)'}</span><small>{item.dtype} · [{item.shape.join(', ')}]</small>
        </button>)}
      </div>}
      <InterpretationForm key={index} tensor={tensor} leaf={leaf} close={close} opened={opened} pending={pending} setPending={setPending} />
    </div>
  </Modal>;
}
