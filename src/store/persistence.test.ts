import { describe, expect, it } from 'vitest';
import { clearLastHostGameId, lastHostGameId, MemoryStorage, inspectGame, loadGame, saveGame, scanEvents, saveDraft, loadDraft, saveLastHostGameId } from './persistence';
import { makeEvent } from '../ledger/intents';
import { fold } from '../ledger/reducer';
import { Account, DEFAULT_CONFIG, GameEvent } from '../ledger/types';

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
  it('folds a valid log in one pass and returns the same state as fold()', () => {
    const storage = new MemoryStorage();
    const events = [
      start,
      makeEvent('transfer', { from: 'a', to: 'b', amount: 10, reason: { kind: 'rent' } }, 'a', 1, 't1'),
      makeEvent('turn.advanced', { toAccountId: 'b' }, 'a', 2, 'turn1'),
    ];
    saveGame(storage, 'g2', events);
    const result = inspectGame(storage, 'g2');
    expect(result.recovered).toBe(3);
    expect(result.corrupt).toBe(false);
    expect(result.unrecoverable).toBe(false);
    expect(result.state).toEqual(fold(events));
  });
  it('stops at the first invalid event and keeps the folded prefix state', () => {
    const storage = new MemoryStorage();
    const valid = makeEvent('transfer', { from: 'a', to: 'b', amount: 25, reason: { kind: 'rent' } }, 'a', 1, 't1');
    const seqGap = makeEvent('transfer', { from: 'a', to: 'b', amount: 5, reason: { kind: 'rent' } }, 'a', 3, 't2');
    saveGame(storage, 'g3', [start, valid, seqGap]);
    const result = inspectGame(storage, 'g3');
    expect(result.recovered).toBe(2);
    expect(result.corrupt).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.state.balances.b).toBe(DEFAULT_CONFIG.startingCash + 25);
  });
  it('recovers a long log without re-folding the full prefix per event', () => {
    const storage = new MemoryStorage();
    const events: GameEvent[] = [start];
    for (let seq = 1; seq <= 400; seq += 1) {
      events.push(makeEvent('turn.advanced', { toAccountId: seq % 2 === 0 ? 'a' : 'b' }, 'a', seq, `turn-${seq}`));
    }
    saveGame(storage, 'g4', events);
    const result = inspectGame(storage, 'g4');
    expect(result.recovered).toBe(events.length);
    expect(result.corrupt).toBe(false);
    expect(result.state.currentTurnAccountId).toBe('a');
    expect(result.state).toEqual(fold(events));
  });
});
