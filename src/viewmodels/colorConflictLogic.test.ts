import { describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../theme';
import { Account, DEFAULT_CONFIG } from '../ledger/types';
import { makeEvent } from '../ledger/intents';
import { fold } from '../ledger/reducer';

describe('color conflict detection & resolution logic', () => {
  const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: '#000', unlimited: true, assets: [] };
  const host: Account = { id: 'p1', kind: 'player', name: 'Host Player', color: PLAYER_PALETTE[0], unlimited: false, assets: [] };

  it('detects when joining player color conflicts with existing room accounts', () => {
    const existingAccounts = [bank, host];
    const usedColors = new Set(existingAccounts.map((a) => a.color));

    const joiningPlayerColor = PLAYER_PALETTE[0]; // same as host
    const isConflict = usedColors.has(joiningPlayerColor);
    expect(isConflict).toBe(true);

    const holder = existingAccounts.find((a) => a.color === joiningPlayerColor);
    expect(holder?.name).toBe('Host Player');

    const availableColors = PLAYER_PALETTE.filter((c) => !usedColors.has(c));
    expect(availableColors).not.toContain(PLAYER_PALETTE[0]);
    expect(availableColors.length).toBe(PLAYER_PALETTE.length - 1);
  });

  it('successfully joins with an alternative selected color when conflict is resolved', () => {
    const start = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts: [bank, host] }, 'bank', 0, 'start');
    const s0 = fold([start]);
    expect(s0.invalid).toBe(false);

    // Chosen alternative color
    const alternativeColor = PLAYER_PALETTE[1];
    const newPlayer: Account = {
      id: 'p2',
      kind: 'player',
      name: 'Guest Player',
      color: alternativeColor,
      unlimited: false,
      assets: [],
    };

    const joinEvent = makeEvent('player.joined', { account: newPlayer }, 'bank', 1, 'join-p2');
    const s1 = fold([start, joinEvent]);

    expect(s1.invalid).toBe(false);
    expect(s1.accounts.p2.color).toBe(alternativeColor);
    expect(Object.keys(s1.accounts)).toEqual(['bank', 'p1', 'p2']);
  });

  it('re-joining with the same player name preserves existing account without conflict', () => {
    const existingAccounts = [bank, host];
    const reconnectingName = 'Host Player';

    const existingPlayer = existingAccounts.find(
      (a) => a.name.trim().toLowerCase() === reconnectingName.toLowerCase()
    );
    expect(existingPlayer).toBeDefined();
    expect(existingPlayer?.id).toBe('p1');
  });

  it('generates unique colors for pass-and-play players with custom p1 color', () => {
    const p1Color = PLAYER_PALETTE[2]; // e.g. purple
    const count = 5;

    const remaining = PLAYER_PALETTE.filter((c) => c !== p1Color);
    const assigned = [p1Color];
    for (let i = 1; i < count; i++) {
      assigned.push(remaining[(i - 1) % remaining.length]);
    }

    const uniqueColors = new Set(assigned);
    expect(uniqueColors.size).toBe(5);
    expect(assigned[0]).toBe(p1Color);
  });
});
