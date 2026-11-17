import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/api/client', () => ({ request: vi.fn() }));
import { chunkBounds } from '../src/audio/playback';

describe('playback chunks', () => {
  it('covers a long selection exactly in at most twenty second chunks', () => {
    expect(chunkBounds(125, 45125, 1000)).toEqual([[125, 20125], [20125, 40125], [40125, 45125]]);
  });
});
