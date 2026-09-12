import { describe, it, expect } from 'vitest';
import { applyEvent, fold, initialState } from './reducer';
import { makeEvent } from './intents';
import { circulation, finalRankings, isJailed, currentTurnPlayer, lostInCirculation, nextTurnPlayer } from './selectors';
import { Account, DEFAULT_CONFIG, Settlement } from './types';
import { buildTallyFromSettlements } from '../viewmodels/settlementCalculations';

const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: '#000', unlimited: true, assets: [] };
const p = (id: string, color = '#fff'): Account => ({ id, kind: 'player', name: id, color, unlimited: false, assets: [] });
const started = () => makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('a', '#fff'), p('b', '#f00')], hostAccountId: 'a' }, 'bank', 0, 'start');
const unhosted = () => makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('a', '#fff'), p('b', '#f00')] }, 'bank', 0, 'start');

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
      makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'jail-a'),
    ]);
    expect(isJailed(s1, 'a')).toBe(true);
    expect(isJailed(s1, 'b')).toBe(false);

    const s2 = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'jail-a'),
      makeEvent('player.released', { accountId: 'a' }, 'a', 2, 'release-a'),
    ]);
    expect(isJailed(s2, 'a')).toBe(false);
  });

  it('allows jailed players to transact normally (advisory only)', () => {
    const s = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'jail-a'),
      makeEvent('transfer', { from: 'a', to: 'b', amount: 200, reason: { kind: 'rent' } }, 'b', 2, 'rent-pay'),
    ]);
    expect(s.invalid).toBe(false);
    expect(s.balances.a).toBe(1300);
    expect(s.balances.b).toBe(1700);
  });

  it('cleans up jailed status on player elimination', () => {
    const s = fold([
      started(),
      makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'jail-a'),
      makeEvent('player.eliminated', { accountId: 'a', creditorId: 'b' }, 'bank', 2, 'elim-a'),
    ]);
    expect(isJailed(s, 'a')).toBe(false);
  });
});

describe('banker authority (Host as Banker)', () => {
  const go = (actorId: string, seq: number, id: string) => makeEvent('transfer', { from: 'bank', to: 'b', amount: 200, reason: { kind: 'go' } }, actorId, seq, id);

  it('lets the Host-as-Banker issue Pass GO at any turn', () => {
    const s = fold([started(), go('a', 1, 'go-1')]);
    expect(s.invalid).toBe(false);
    expect(s.balances.b).toBe(1700);
  });

  it('rejects Bank-issued transfers submitted by a non-banker', () => {
    const s = fold([started(), go('b', 1, 'go-bad')]);
    expect(s.invalid).toBe(true);
    expect(s.balances.b).toBe(1500);
  });

  it('rejects Bank-issued transfers when no host is set', () => {
    const s = fold([unhosted(), go('a', 1, 'go-nohost')]);
    expect(s.invalid).toBe(true);
  });

  it('lets regular players pay each other and the Bank', () => {
    const s = fold([
      started(),
      makeEvent('transfer', { from: 'b', to: 'a', amount: 100, reason: { kind: 'rent' } }, 'b', 1, 'rent-1'),
      makeEvent('transfer', { from: 'a', to: 'bank', amount: 50, reason: { kind: 'tax' } }, 'a', 2, 'tax-1'),
    ]);
    expect(s.invalid).toBe(false);
    expect(s.balances.a).toBe(1550);
    expect(s.balances.b).toBe(1400);
  });

  it('rejects jailing or releasing by a non-banker', () => {
    expect(fold([started(), makeEvent('player.jailed', { accountId: 'b' }, 'b', 1, 'jail-bad')]).invalid).toBe(true);
    expect(fold([started(), makeEvent('player.jailed', { accountId: 'b' }, 'a', 1, 'jail-ok'), makeEvent('player.released', { accountId: 'b' }, 'b', 2, 'release-bad')]).invalid).toBe(true);
  });

  it('lets the Banker jail any player, including themselves', () => {
    const s = fold([started(), makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'jail-self')]);
    expect(s.invalid).toBe(false);
    expect(isJailed(s, 'a')).toBe(true);
  });

  it('rejects jailing when no host is set', () => {
    expect(fold([unhosted(), makeEvent('player.jailed', { accountId: 'a' }, 'a', 1, 'jail-nohost')]).invalid).toBe(true);
  });
});

describe('bank issuance and lost in circulation (T-003/T-009)', () => {
  it('lets the Banker issue an arbitrary amount from the Bank to a player', () => {
    const s = fold([
      started(),
      makeEvent('transfer', { from: 'bank', to: 'b', amount: 500, reason: { kind: 'other' } }, 'a', 1, 'bank-issue'),
    ]);
    expect(s.invalid).toBe(false);
    expect(s.balances.b).toBe(2000);
    expect(lostInCirculation(s)).toBe(0);
  });

  it('tracks money lost when a player is eliminated with no creditor', () => {
    const s = fold([
      started(),
      makeEvent('player.eliminated', { accountId: 'b', creditorId: null }, 'a', 1, 'elim-b'),
    ]);
    expect(s.invalid).toBe(false);
    expect(s.balances.b).toBe(0);
    expect(lostInCirculation(s)).toBe(1500);
    expect(circulation(s)).toBe(1500);
  });

  it('does not count money transferred to a creditor as lost', () => {
    const s = fold([
      started(),
      makeEvent('player.eliminated', { accountId: 'b', creditorId: 'a' }, 'a', 1, 'elim-b-creditor'),
    ]);
    expect(s.invalid).toBe(false);
    expect(lostInCirculation(s)).toBe(0);
    expect(circulation(s)).toBe(3000);
  });

  it('does not count forgiven debt as lost', () => {
    const s = fold([
      started(),
      makeEvent('transfer', { from: 'b', to: 'a', amount: 1700, reason: { kind: 'other' } }, 'b', 1, 'debt'),
      makeEvent('player.eliminated', { accountId: 'b', creditorId: null }, 'a', 2, 'elim-b-debt'),
    ]);
    expect(s.invalid).toBe(false);
    expect(lostInCirculation(s)).toBe(0);
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

describe('player trading (T-006)', () => {
  it('folds both trade legs into the expected balances', () => {
    const s = fold([
      started(),
      makeEvent('transfer', { from: 'a', to: 'b', amount: 300, reason: { kind: 'trade' } }, 'a', 1, 'trade-give'),
      makeEvent('transfer', { from: 'b', to: 'a', amount: 100, reason: { kind: 'trade' } }, 'b', 2, 'trade-receive'),
    ]);
    expect(s.invalid).toBe(false);
    expect(s.balances.a).toBe(1300);
    expect(s.balances.b).toBe(1700);
  });
});

describe('final rankings (T-007)', () => {
  const named = (playerId: string, value: number): Settlement => ({
    playerId,
    mode: 'itemized',
    rows: [{ kind: 'mortgage', name: 'Boardwalk', value }],
    valuation: value,
    cash: 1500,
    assetTotal: value,
    netWorth: 1500 + value,
  });
  const hosted2 = () => makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('host', '#3498db'), p('b', '#e74c3c')], hostAccountId: 'host' }, 'bank', 0, 'rank-start');

  it('returns an empty ranking while the game is running', () => {
    expect(finalRankings(fold([hosted2()]))).toEqual([]);
  });

  it('returns the authoritative tally sorted by rank once ended', () => {
    const begin = makeEvent('settlement.started', { participantIds: ['host', 'b'] }, 'host', 1, 'rank-begin');
    const hostSub = makeEvent('settlement.submitted', { playerId: 'host', settlement: named('host', 500) }, 'host', 2, 'rank-host');
    const bSub = makeEvent('settlement.submitted', { playerId: 'b', settlement: named('b', 300) }, 'b', 3, 'rank-b');
    const tally = buildTallyFromSettlements(
      { bank, host: p('host', '#3498db'), b: p('b', '#e74c3c') },
      { host: 1500, b: 1500 },
      new Set(),
      { host: named('host', 500), b: named('b', 300) },
      new Set()
    );
    const ended = makeEvent('game.ended', { tally }, 'host', 4, 'rank-end');
    const s = fold([hosted2(), begin, hostSub, bSub, ended]);
    expect(s.invalid).toBe(false);
    expect(finalRankings(s).map((e) => [e.playerId, e.rank])).toEqual([['host', 1], ['b', 2]]);
  });
});
