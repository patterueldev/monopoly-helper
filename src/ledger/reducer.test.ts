import { describe, it, expect } from 'vitest';
import { applyEvent, fold, initialState } from './reducer';
import { makeEvent } from './intents';
import { circulation, isJailed, currentTurnPlayer, nextTurnPlayer } from './selectors';
import { Account, DEFAULT_CONFIG, Settlement } from './types';
import { buildTallyFromSettlements } from '../viewmodels/settlementCalculations';

const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: '#000', unlimited: true, assets: [] };
const p = (id: string, color = '#fff'): Account => ({ id, kind: 'player', name: id, color, unlimited: false, assets: [] });
const started = () => makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('a', '#fff'), p('b', '#f00')] }, 'bank', 0, 'start');

describe('ledger', () => {
  it('replays payments and bank circulation', () => {
    const s = fold([started(), makeEvent('transfer', { from: 'a', to: 'b', amount: 1700, reason: { kind: 'other' } }, 'a', 1, 'x')]);
    expect(s.balances.a).toBe(-200);
    expect(s.balances.b).toBe(3200);
    expect(circulation(s)).toBe(3000);
  });

  it('deduplicates intent ids', () => {
    const x = makeEvent('transfer', { from: 'a', to: 'b', amount: 100, reason: { kind: 'other' } }, 'a', 1, 'same');
    const s = fold([started(), x, x]);
    expect(s.balances.a).toBe(1400);
  });

  it('undoes only latest transfer', () => {
    const es = [
      started(),
      makeEvent('transfer', { from: 'a', to: 'b', amount: 200, reason: { kind: 'other' } }, 'a', 1, '1'),
      makeEvent('transfer', { from: 'a', to: 'b', amount: 100, reason: { kind: 'other' } }, 'a', 2, '2'),
      makeEvent('transfer.reversed', { targetSeq: 2 }, 'bank', 3, '3'),
    ];
    const s = fold(es);
    expect(s.balances.a).toBe(1300);
    expect(s.balances.b).toBe(1700);
  });

  it('elimination clears negative balance against bank', () => {
    const es = [
      started(),
      makeEvent('transfer', { from: 'a', to: 'b', amount: 1700, reason: { kind: 'other' } }, 'a', 1, 'x'),
      makeEvent('player.eliminated', { accountId: 'a', creditorId: 'b' }, 'bank', 2, 'e'),
    ];
    const s = fold(es);
    expect(s.balances.a).toBe(0);
    expect(s.balances.b).toBe(3200);
    expect(s.eliminated.has('a')).toBe(true);
  });
});

describe('turn tracking (advisory only)', () => {
  it('sets the first player as current turn on game.started', () => {
    const s = fold([started()]);
    expect(s.currentTurnAccountId).toBe('a');
    expect(currentTurnPlayer(s)?.id).toBe('a');
    expect(nextTurnPlayer(s)?.id).toBe('b');
  });

  it('advances turn to another player', () => {
    const s = fold([
      started(),
      makeEvent('turn.advanced', { toAccountId: 'b' }, 'a', 1, 'turn-1'),
    ]);
    expect(s.currentTurnAccountId).toBe('b');
    expect(currentTurnPlayer(s)?.id).toBe('b');
    expect(nextTurnPlayer(s)?.id).toBe('a');
  });

  it('rejects turn advance to non-existent or eliminated player', () => {
    const s1 = fold([
      started(),
      makeEvent('turn.advanced', { toAccountId: 'nonexistent' }, 'a', 1, 'turn-bad'),
    ]);
    expect(s1.invalid).toBe(true);

    const s2 = fold([
      started(),
      makeEvent('player.eliminated', { accountId: 'b', creditorId: null }, 'bank', 1, 'elim-b'),
      makeEvent('turn.advanced', { toAccountId: 'b' }, 'a', 2, 'turn-b'),
    ]);
    expect(s2.invalid).toBe(true);
  });

  it('automatically advances turn when current-turn player is eliminated', () => {
    const s = fold([
      started(), // current turn is 'a'
      makeEvent('player.eliminated', { accountId: 'a', creditorId: null }, 'bank', 1, 'elim-a'),
    ]);
    expect(s.eliminated.has('a')).toBe(true);
    expect(s.currentTurnAccountId).toBe('b');
  });
});

describe('jail status (advisory only)', () => {
  it('tracks jailed and released status', () => {
    const s0 = fold([started()]);
    expect(isJailed(s0, 'a')).toBe(false);

    const s1 = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'bank', 1, 'jail-a'),
    ]);
    expect(isJailed(s1, 'a')).toBe(true);
    expect(isJailed(s1, 'b')).toBe(false);

    const s2 = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'bank', 1, 'jail-a'),
      makeEvent('player.released', { accountId: 'a' }, 'bank', 2, 'release-a'),
    ]);
    expect(isJailed(s2, 'a')).toBe(false);
  });

  it('allows jailed players to transact normally (advisory only)', () => {
    const s = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'bank', 1, 'jail-a'),
      makeEvent('transfer', { from: 'a', to: 'b', amount: 200, reason: { kind: 'rent' } }, 'b', 2, 'rent-pay'),
    ]);
    expect(s.invalid).toBe(false);
    expect(s.balances.a).toBe(1300);
    expect(s.balances.b).toBe(1700);
  });

  it('cleans up jailed status on player elimination', () => {
    const s = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'bank', 1, 'jail-a'),
      makeEvent('player.eliminated', { accountId: 'a', creditorId: 'b' }, 'bank', 2, 'elim-a'),
    ]);
    expect(isJailed(s, 'a')).toBe(false);
  });
});

describe('multiplayer lobby & dynamic player joining', () => {
  it('allows starting a game with 1 player (Host) + Bank', () => {
    const hostOnly = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db')] }, 'bank', 0, 'host-start');
    const s = fold([hostOnly]);
    expect(s.invalid).toBe(false);
    expect(s.started).toBe(true);
    expect(Object.keys(s.accounts)).toEqual(['bank', 'host']);
    expect(s.balances.host).toBe(1500);
    expect(s.currentTurnAccountId).toBe('host');
  });

  it('allows additional players to join mid-lobby via player.joined', () => {
    const hostOnly = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db')] }, 'bank', 0, 'host-start');
    const player2Join = makeEvent('player.joined', { account: p('player2', '#e74c3c') }, 'bank', 1, 'join-p2');
    const s = fold([hostOnly, player2Join]);
    expect(s.invalid).toBe(false);
    expect(s.accounts.player2).toBeDefined();
    expect(s.balances.player2).toBe(1500);
    expect(circulation(s)).toBe(3000);
  });

  it('rejects player.joined with conflicting/duplicate color', () => {
    const hostOnly = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db')] }, 'bank', 0, 'host-start');
    const duplicateColorJoin = makeEvent('player.joined', { account: p('player2', '#3498db') }, 'bank', 1, 'join-p2-conflict');
    const s = fold([hostOnly, duplicateColorJoin]);
    expect(s.invalid).toBe(true);
  });

  it('rejects player.renamed with duplicate color of another player', () => {
    const s0 = fold([started()]); // p('a', '#fff'), p('b', '#f00')
    const renameConflict = makeEvent('player.renamed', { accountId: 'b', name: 'b', color: '#fff' }, 'bank', 1, 'rename-b');
    const s1 = fold([started(), renameConflict]);
    expect(s1.invalid).toBe(true);
  });

  it('allows player.renamed to update color to an available color', () => {
    const s0 = fold([started()]); // p('a', '#fff'), p('b', '#f00')
    const renameOk = makeEvent('player.renamed', { accountId: 'b', name: 'b', color: '#00f' }, 'bank', 1, 'rename-b-ok');
    const s1 = fold([started(), renameOk]);
    expect(s1.invalid).toBe(false);
    expect(s1.accounts.b.color).toBe('#00f');
  });
});

describe('multiplayer settlement lifecycle', () => {
  const settlement = (playerId: string, value: number): Settlement => ({
    playerId,
    mode: 'itemized',
    rows: [{ kind: 'mortgage', name: 'Boardwalk', value }],
    valuation: value,
    cash: 1500,
    assetTotal: value,
    netWorth: 1500 + value,
  });

  it('starts settlement, accepts named mortgage submissions, and ends after all players submit', () => {
    const start = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db'), p('b', '#e74c3c')], hostAccountId: 'host' }, 'bank', 0, 'settle-start');
    const begin = makeEvent('settlement.started', { participantIds: ['host', 'b'] }, 'host', 1, 'settlement-begin');
    const hostSettlement = makeEvent('settlement.submitted', { playerId: 'host', settlement: settlement('host', 500) }, 'host', 2, 'host-submitted');
    const playerSettlement = makeEvent('settlement.submitted', { playerId: 'b', settlement: settlement('b', 300) }, 'b', 3, 'player-submitted');
    const tally = buildTallyFromSettlements(
      { bank, host: p('host', '#3498db'), b: p('b', '#e74c3c') },
      { host: 1500, b: 1500 },
      new Set(),
      { host: settlement('host', 500), b: settlement('b', 300) },
      new Set()
    );
    const ended = makeEvent('game.ended', { tally }, 'host', 4, 'settle-end');
    const state = fold([start, begin, hostSettlement, playerSettlement, ended]);

    expect(state.invalid).toBe(false);
    expect(state.settlementStarted).toBe(true);
    expect(state.settlementStatus).toEqual({ host: 'submitted', b: 'submitted' });
    expect(state.ended).toBe(true);
    expect(state.tally?.find((entry) => entry.playerId === 'host')?.assetTotal).toBe(500);
  });

  it('lets the Host dismiss a player and submit a Host override for that player', () => {
    const start = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db'), p('b', '#e74c3c')], hostAccountId: 'host' }, 'bank', 0, 'dismiss-start');
    const begin = makeEvent('settlement.started', { participantIds: ['host', 'b'] }, 'host', 1, 'dismiss-begin');
    const dismiss = makeEvent('settlement.dismissed', { playerId: 'b' }, 'host', 2, 'dismiss-b');
    const hostSettlement = makeEvent('settlement.submitted', { playerId: 'host', settlement: settlement('host', 0) }, 'host', 3, 'dismiss-host');
    const override = makeEvent('settlement.submitted', { playerId: 'b', settlement: settlement('b', 250) }, 'host', 4, 'dismiss-override');
    const tally = buildTallyFromSettlements(
      { bank, host: p('host', '#3498db'), b: p('b', '#e74c3c') },
      { host: 1500, b: 1500 },
      new Set(),
      { host: settlement('host', 0), b: settlement('b', 250) },
      new Set()
    );
    const ended = makeEvent('game.ended', { tally }, 'host', 5, 'dismiss-end');
    const state = fold([start, begin, dismiss, hostSettlement, override, ended]);

    expect(state.invalid).toBe(false);
    expect(state.settlementStatus.b).toBe('submitted');
    expect(state.tally?.find((entry) => entry.playerId === 'b')?.assetTotal).toBe(250);
  });

  it('rejects a client from starting or finalizing settlement', () => {
    const start = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db'), p('b', '#e74c3c')], hostAccountId: 'host' }, 'bank', 0, 'auth-start');
    expect(applyEvent(fold([start]), makeEvent('settlement.started', { participantIds: ['host', 'b'] }, 'b', 1, 'client-start')).invalid).toBe(true);
  });
});
