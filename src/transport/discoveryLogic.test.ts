import { describe, expect, it } from 'vitest';
import { chunkArray, getSubnetIps, parseWelcomeResponse } from './discoveryLogic';
import { GameEvent, Account, DEFAULT_CONFIG } from '../ledger/types';

describe('discoveryLogic', () => {
  describe('getSubnetIps', () => {
    it('generates 254 candidate IPs in /24 subnet excluding self in middle', () => {
      const ips = getSubnetIps('192.168.1.100');
      expect(ips).toContain('192.168.1.1');
      expect(ips).toContain('192.168.1.99');
      expect(ips).toContain('192.168.1.101');
      expect(ips).toContain('192.168.1.254');
      expect(ips[ips.length - 1]).toBe('192.168.1.100');
      expect(ips.length).toBe(254);
    });

    it('returns fallback for invalid or loopback IP', () => {
      expect(getSubnetIps(null)).toEqual(['127.0.0.1']);
      expect(getSubnetIps('')).toEqual(['127.0.0.1']);
      expect(getSubnetIps('invalid')).toEqual(['127.0.0.1']);
    });
  });

  describe('chunkArray', () => {
    it('chunks an array into specified sizes', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunkArray(items, 3);
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });
  });

  describe('parseWelcomeResponse', () => {
    it('extracts host name, color, and player count from welcome message', () => {
      const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: '#000', unlimited: true, assets: [] };
      const host: Account = { id: 'p1', kind: 'player', name: 'Pat', color: '#e74c3c', unlimited: false, assets: [] };
      const player2: Account = { id: 'p2', kind: 'player', name: 'Sam', color: '#3498db', unlimited: false, assets: [] };

      const startEvent: GameEvent = {
        seq: 0,
        ts: 1000,
        actorId: 'bank',
        intentId: 'start',
        type: 'game.started',
        payload: { config: DEFAULT_CONFIG, accounts: [bank, host] },
      };

      const joinEvent: GameEvent = {
        seq: 1,
        ts: 2000,
        actorId: 'bank',
        intentId: 'join',
        type: 'player.joined',
        payload: { account: player2 },
      };

      const parsed = parseWelcomeResponse('192.168.1.42', 51837, {
        kind: 'welcome',
        protocolVersion: 1,
        gameId: 'game-123',
        events: [startEvent, joinEvent],
      });

      expect(parsed).toEqual({
        ip: '192.168.1.42',
        port: 51837,
        hostName: 'Pat',
        hostColor: '#e74c3c',
        playerCount: 2,
        gameId: 'game-123',
      });
    });

    it('returns null for non-welcome messages', () => {
      expect(parseWelcomeResponse('127.0.0.1', 51837, { kind: 'pong' })).toBeNull();
    });
  });
});
