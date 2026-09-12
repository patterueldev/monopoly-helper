import { describe, expect, it } from 'vitest';
import { clearLastHostGameId, lastHostGameId, MemoryStorage, loadGame, saveGame, scanEvents, saveDraft, loadDraft, saveLastHostGameId } from './persistence';
import { makeEvent } from '../ledger/intents';
import { Account, DEFAULT_CONFIG } from '../ledger/types';

const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: 'green', unlimited: true, assets: [] };
const player = (id: string, color: string): Account => ({ id, kind: 'player', name: id, color, unlimited: false, assets: [] });
const start = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, player('a', 'red'), player('b', 'blue')] }, 'bank', 0, 'start');

describe('persistence adapter and recovery', () => {
  it('round trips a versioned game and drafts independently', () => {
    const storage = new MemoryStorage(); saveGame(storage, 'g1', [start]);
    expect(loadGame(storage, 'g1').events).toHaveLength(1);
    saveDraft(storage, 'g1', { a: 10 }); expect(loadDraft(storage, 'g1')).toEqual({ a: 10 });
    expect(loadGame(storage, 'missing').unrecoverable).toBe(true);
  });
  it('recovers complete objects from a truncated array with escaped text', () => {
    const renamed = makeEvent('player.renamed', { accountId: 'a', name: 'A {quoted} "name"', color: 'red' }, 'bank', 1, 'rename');
    const raw = `[${JSON.stringify(start)},${JSON.stringify(renamed)},${JSON.stringify(start).slice(0, 20)}`;
    const result = scanEvents(raw); expect(result.events).toHaveLength(2); expect(result.corrupt).toBe(true);
  });
  it('remembers and clears the last locally hosted game', () => {
    const storage = new MemoryStorage();
    saveLastHostGameId(storage, 'g1');
    expect(lastHostGameId(storage)).toBe('g1');
    clearLastHostGameId(storage);
    expect(lastHostGameId(storage)).toBe('');
  });
});
