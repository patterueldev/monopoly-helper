import { describe, expect, it } from 'vitest';
import { createGameStore } from './gameStore';
import { MemoryStorage } from './persistence';
import { Account, DEFAULT_CONFIG } from '../ledger/types';
import { makeEvent } from '../ledger/intents';

const accounts: Account[] = [
  { id: 'bank', kind: 'bank', name: 'Bank', color: 'green', unlimited: true, assets: [] },
  { id: 'a', kind: 'player', name: 'A', color: 'red', unlimited: false, assets: [] },
  { id: 'b', kind: 'player', name: 'B', color: 'blue', unlimited: false, assets: [] },
];
describe('game store persistence boundary', () => {
  it('uses a fresh game id and persists before state publication', () => {
    const storage = new MemoryStorage(); const store = createGameStore(storage); const id = store.getState().createGame(DEFAULT_CONFIG, accounts);
    expect(id).not.toBe('current'); expect(store.getState().gameId).toBe(id);
    const result = store.getState().dispatch(makeEvent('transfer', { from: 'a', to: 'b', amount: 100, reason: { kind: 'other' } }, 'a', 1, 'payment'));
    expect(result.ok).toBe(true); expect(store.getState().state.balances.a).toBe(1400);
  });
  it('returns a structured error when no game is selected', () => { const store = createGameStore(new MemoryStorage()); const result = store.getState().dispatch(makeEvent('transfer', { from: 'a', to: 'b', amount: 1, reason: { kind: 'other' } }, 'a', 0, 'x')); expect(result).toEqual({ ok: false, error: 'No game selected' }); });
});
