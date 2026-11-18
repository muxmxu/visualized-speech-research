import { useState } from 'react';
import { IconPlayerPlay, IconScissors, IconTrash } from '@tabler/icons-react';

export interface SelectionCommands {
  play: () => void;
  remove: () => void;
  gain: (db: number) => void;
  extract: () => void;
}

export function SelectionActions({ commands, time, disabled }: {
  commands: SelectionCommands; time?: boolean; disabled: boolean;
}) {
  const [gain, setGain] = useState(0);
  const applyGain = (value: number) => {
    if (value !== 0) commands.gain(value);
    setGain(0);
  };
  const playLabel = time ? 'Play time selection (Space)' : 'Play selection (Space)';
  return <div className={time ? 'time-toolbar' : 'tf-toolbar'} onPointerDown={event => event.stopPropagation()}>
    <button title={playLabel} aria-label={playLabel} onClick={commands.play}><IconPlayerPlay size={13} /></button>
    <button title="Delete selection (Delete / Backspace)" aria-label="Delete selection" disabled={disabled} onClick={commands.remove}><IconTrash size={13} /></button>
    <input type="range" min={-24} max={24} value={gain} title={`Selection gain (${gain > 0 ? '+' : ''}${gain} dB)`}
      aria-label="Selection gain" aria-valuetext={`${gain} dB`} disabled={disabled}
      onChange={event => setGain(Number(event.target.value))} onPointerUp={event => applyGain(Number(event.currentTarget.value))}
      onPointerCancel={() => setGain(0)} onKeyUp={event => { if (event.key.startsWith('Arrow')) applyGain(gain); }} />
    <button title="Extract selection to new lane" aria-label="Extract selection to new lane" disabled={disabled} onClick={commands.extract}><IconScissors size={13} /></button>
  </div>;
}

export function EditMenu({ x, y, dismiss, children }: { x: number; y: number; dismiss: () => void; children: React.ReactNode }) {
  return <div className="edit-menu" aria-label="Edit actions" style={{
    left: x, top: y, transform: `translate(${x > window.innerWidth - 235 ? '-100%' : '0'}, ${y > window.innerHeight / 2 ? '-100%' : '0'})`,
  }} onPointerDown={event => event.stopPropagation()} onClick={dismiss} onContextMenu={event => event.preventDefault()}>{children}</div>;
}
