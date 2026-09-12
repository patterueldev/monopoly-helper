import { describe, it, expect } from 'vitest';
import {
  buildItemizedRows,
  computeItemizedAssetTotal,
  buildFinalTally,
  defaultItemizedEntry,
  defaultMortgageName,
  ItemizedPlayerEntry,
} from './settlementCalculations';
import { Account, DEFAULT_CONFIG } from '../ledger/types';
import { applyEvent, fold } from '../ledger/reducer';
import { makeEvent } from '../ledger/intents';

const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: '#000', unlimited: true, assets: [] };
const p = (id: string): Account => ({ id, kind: 'player', name: id, color: `#${id}`, unlimited: false, assets: [] });

describe('settlementCalculations', () => {
  it('builds itemized rows and sums assets accurately', () => {
    const entry: ItemizedPlayerEntry = {
      properties: '500',
      housesCount: '3',
      housesCost: '100', // 300
      hotelsCount: '1',
      hotelsCost: '200', // 200
      mortgages: '150', // -150
    };

    const rows = buildItemizedRows(entry);
    expect(rows).toEqual([
      { kind: 'property', value: 500 },
      { kind: 'houses', value: 100, quantity: 3 },
      { kind: 'hotels', value: 200, quantity: 1 },
      { kind: 'mortgage', value: 150 },
    ]);

    const total = computeItemizedAssetTotal(rows);
    // 500 + 300 + 200 - 150 = 850
    expect(total).toBe(850);
  });

  it('sums named mortgage entries as the player asset valuation', () => {
    const rows = buildItemizedRows({
      mortgageEntries: [
        { id: 'property', name: 'Boardwalk', value: '400' },
        { id: 'station', name: 'Reading Railroad', value: '100' },
      ],
    });

    expect(rows).toEqual([
      { kind: 'mortgage', name: 'Boardwalk', value: 400 },
      { kind: 'mortgage', name: 'Reading Railroad', value: 100 },
    ]);
    expect(computeItemizedAssetTotal(rows)).toBe(500);
  });

  it('builds final tally in fast mode with correct ranks and ties', () => {
    const accounts = { bank, a: p('a'), b: p('b'), c: p('c') };
    const balances = { a: 1000, b: 1500, c: 500 };
    const eliminated = new Set<string>();
    const fastValuations = { a: '500', b: '0', c: '1000' };

    // Net worths:
    // a: 1000 + 500 = 1500
    // b: 1500 + 0 = 1500 (tied for 1st)
    // c: 500 + 1000 = 1500 (tied for 1st)
    const tally = buildFinalTally(accounts, balances, eliminated, 'fast', fastValuations, {});
    expect(tally).toHaveLength(3);
    expect(tally.map((t) => t.rank)).toEqual([1, 1, 1]);
  });

  it('builds final tally in itemized mode and passes ledger validTally', () => {
    const startEvent = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('a'), p('b')] }, 'bank', 0, 's');
    const state = fold([startEvent]);

    const itemizedEntries: Record<string, ItemizedPlayerEntry> = {
      a: { properties: '400', housesCount: '2', housesCost: '50', hotelsCount: '0', hotelsCost: '0', mortgages: '0' }, // 400 + 100 = 500 assets -> net worth 1500 + 500 = 2000
      b: { properties: '600', housesCount: '0', housesCost: '0', hotelsCount: '1', hotelsCost: '150', mortgages: '50' }, // 600 + 150 - 50 = 700 assets -> net worth 1500 + 700 = 2200
    };

    const tally = buildFinalTally(state.accounts, state.balances, state.eliminated, 'itemized', {}, itemizedEntries);

    expect(tally.find((t) => t.playerId === 'a')).toMatchObject({
      mode: 'itemized',
      valuation: 500,
      cash: 1500,
      assetTotal: 500,
      netWorth: 2000,
      rank: 2,
    });

    expect(tally.find((t) => t.playerId === 'b')).toMatchObject({
      mode: 'itemized',
      valuation: 700,
      cash: 1500,
      assetTotal: 700,
      netWorth: 2200,
      rank: 1,
    });

    // Verify ledger acceptance
    const endEvent = makeEvent('game.ended', { tally }, 'bank', 1, 'end');
    const endedState = applyEvent(state, endEvent);
    expect(endedState.invalid).toBe(false);
    expect(endedState.ended).toBe(true);
    expect(endedState.tally).toEqual(tally);
  });

  it('handles eliminated players with 0 values and undefined rank', () => {
    const startEvent = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, p('a'), p('b')] }, 'bank', 0, 's');
    const elimEvent = makeEvent('player.eliminated', { accountId: 'b', creditorId: 'a' }, 'bank', 1, 'elim');
    const state = fold([startEvent, elimEvent]);

    const tally = buildFinalTally(state.accounts, state.balances, state.eliminated, 'itemized', {}, { a: defaultItemizedEntry() });

    const playerB = tally.find((t) => t.playerId === 'b');
    expect(playerB).toEqual({
      playerId: 'b',
      mode: 'itemized',
      valuation: 0,
      cash: 0,
      assetTotal: 0,
      netWorth: 0,
      rank: undefined,
    });

    // Verify ledger acceptance with eliminated player
    const endEvent = makeEvent('game.ended', { tally }, 'bank', 2, 'end');
    const endedState = applyEvent(state, endEvent);
    expect(endedState.invalid).toBe(false);
    expect(endedState.ended).toBe(true);
  });
});

describe('defaultMortgageName (T-005)', () => {
  it('auto-fills sequential asset names starting at Asset #1', () => {
    expect(defaultMortgageName(0)).toBe('Asset #1');
    expect(defaultMortgageName(1)).toBe('Asset #2');
    expect(defaultMortgageName(4)).toBe('Asset #5');
  });
});
