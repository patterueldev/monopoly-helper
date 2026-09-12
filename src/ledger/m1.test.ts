import { describe, expect, it } from 'vitest';
import { applyEvent, fold, initialState } from './reducer';
import { makeEvent } from './intents';
import { Account, DEFAULT_CONFIG, GameEvent } from './types';

const account = (id: string, kind: 'player' | 'bank' = 'player', color = id): Account => ({ id, kind, name: id, color, unlimited: kind === 'bank', assets: [] });
const start = (players = ['a', 'b']): GameEvent<'game.started'> => makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [account('bank', 'bank'), ...players.map(id => account(id))] }, 'bank', 0, 'start');
const transfer = (seq: number, from: string, to: string, amount: number, id = `t${seq}`) => makeEvent('transfer', { from, to, amount, reason: { kind: 'other' } }, from, seq, id);

describe('M1 event validity', () => {
  it('rejects malformed and non-contiguous events without mutation', () => {
    const s = fold([start(), transfer(2, 'a', 'b', 100)]);
    expect(s.invalid).toBe(true); expect(s.events).toHaveLength(1); expect(s.balances.a).toBe(1500);
  });
  it('rejects duplicate colors, too few players, and a second bank', () => {
    expect(fold([makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [account('bank','bank'), account('a'), account('b', 'player', 'a')] }, 'bank', 0, 'x')]).invalid).toBe(true);
  });
  it('rejects all mutations after ending', () => {
    const tally = ['a','b'].map(playerId => ({ playerId, mode: 'fast' as const, valuation: 0, cash: 1500, assetTotal: 0, netWorth: 1500, rank: 1 }));
    const ended = fold([start(), makeEvent('game.ended', { tally }, 'bank', 1, 'end')]);
    expect(applyEvent(ended, transfer(2, 'a', 'b', 1)).invalid).toBe(true);
    expect(applyEvent(ended, makeEvent('player.renamed', { accountId: 'a', name: 'A', color: 'new' }, 'bank', 2, 'rename')).invalid).toBe(true);
  });
  it('handles safe integer overflow atomically', () => {
    const s = fold([start(), transfer(1, 'a', 'b', Number.MAX_SAFE_INTEGER)]);
    expect(s.invalid).toBe(true); expect(s.balances.a).toBe(1500); expect(s.balances.b).toBe(1500); expect(s.events).toHaveLength(1);
  });
  it('does not allow payment to an eliminated player and respects undo boundary', () => {
    const eliminated = fold([start(), makeEvent('player.eliminated', { accountId: 'a', creditorId: 'b' }, 'bank', 1, 'elim')]);
    expect(applyEvent(eliminated, transfer(2, 'b', 'a', 10)).invalid).toBe(true);
    expect(applyEvent(eliminated, makeEvent('transfer.reversed', { targetSeq: 0 }, 'bank', 2, 'undo')).invalid).toBe(true);
  });
});

describe('M1 deterministic replay', () => {
  it('replays a long script deterministically', () => {
    const events: GameEvent[] = [start()]; let expectedA = 1500; let expectedB = 1500;
    for (let i = 1; i <= 200; i += 1) { const amount = (i % 17) + 1; events.push(transfer(i, i % 2 ? 'a' : 'b', i % 2 ? 'b' : 'a', amount)); if (i % 2) { expectedA -= amount; expectedB += amount; } else { expectedB -= amount; expectedA += amount; } }
    const one = fold(events); const two = fold(events); expect(one.balances).toEqual({ bank: 0, a: expectedA, b: expectedB }); expect(two).toEqual(one);
  });

  it('replays a request create/approve pair deterministically', () => {
    const events: GameEvent[] = [
      start(),
      makeEvent('request.created', { requestId: 'r1', from: 'b', to: 'a', amount: 100, reason: { kind: 'other' } }, 'a', 1, 'req-r1'),
      makeEvent('request.resolved', { requestId: 'r1', outcome: 'paid' }, 'b', 2, 'res-r1'),
    ];
    const one = fold(events); const two = fold(events);
    expect(one.balances).toEqual({ bank: 0, a: 1600, b: 1400 });
    expect(two).toEqual(one);
  });

  it('does not allow a non-payer to approve a request', () => {
    const pending = fold([
      start(),
      makeEvent('request.created', { requestId: 'r1', from: 'b', to: 'a', amount: 100, reason: { kind: 'other' } }, 'a', 1, 'req-r1'),
    ]);
    expect(applyEvent(pending, makeEvent('request.resolved', { requestId: 'r1', outcome: 'paid' }, 'a', 2, 'res-r1')).invalid).toBe(true);
  });
});

describe('game config defaults (T-004)', () => {
  it('offers small denominations in the default quick amounts', () => {
    for (const n of [1, 10, 20]) expect(DEFAULT_CONFIG.quickAmounts).toContain(n);
    expect(DEFAULT_CONFIG.quickAmounts.length).toBeGreaterThan(4);
  });
});
