import { describe, it, expect } from 'vitest';
import { detectCues } from './cues';
import { makeEvent } from '../ledger/intents';

const accounts = {
  bank: { kind: 'bank' },
  a: { kind: 'player' },
  b: { kind: 'player' },
} as Record<string, { kind: string }>;

describe('audio cues', () => {
  it('rings when the turn advances to me, silent for others', () => {
    const mine = makeEvent('turn.advanced', { toAccountId: 'a' }, 'b', 1, 't1');
    const theirs = makeEvent('turn.advanced', { toAccountId: 'b' }, 'b', 1, 't2');
    expect(detectCues(mine, accounts, { myAccountId: 'a' })).toEqual(['your_turn']);
    expect(detectCues(theirs, accounts, { myAccountId: 'a' })).toEqual([]);
  });

  it('sounds when I am jailed, silent for others', () => {
    const mine = makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'j1');
    const theirs = makeEvent('player.jailed', { accountId: 'b' }, 'a', 1, 'j2');
    expect(detectCues(mine, accounts, { myAccountId: 'a' })).toEqual(['jailed']);
    expect(detectCues(theirs, accounts, { myAccountId: 'a' })).toEqual([]);
  });

  it('sounds when I collect from the Bank (Pass GO, payouts)', () => {
    const payout = makeEvent('transfer', { from: 'bank', to: 'a', amount: 200, reason: { kind: 'go' } }, 'a', 1, 'p1');
    const toOther = makeEvent('transfer', { from: 'bank', to: 'b', amount: 200, reason: { kind: 'go' } }, 'a', 1, 'p2');
    const playerPay = makeEvent('transfer', { from: 'b', to: 'a', amount: 100, reason: { kind: 'rent' } }, 'b', 1, 'p3');
    expect(detectCues(payout, accounts, { myAccountId: 'a' })).toEqual(['bank_received']);
    expect(detectCues(toOther, accounts, { myAccountId: 'a' })).toEqual([]);
    expect(detectCues(playerPay, accounts, { myAccountId: 'a' })).toEqual([]);
  });

  it('stays silent with no local account', () => {
    const turn = makeEvent('turn.advanced', { toAccountId: 'a' }, 'b', 1, 't1');
    expect(detectCues(turn, accounts, { myAccountId: undefined })).toEqual([]);
  });
});
