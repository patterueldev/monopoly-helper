import { describe, expect, it, vi } from 'vitest';
import { createConnectionStore } from './connectionStore';
import { createGameStore } from './gameStore';
import { MemoryStorage } from './persistence';
import { Account, DEFAULT_CONFIG } from '../ledger/types';
import { makeEvent } from '../ledger/intents';
import { ClientTransport } from '../transport/ClientTransport';
import { HostTransport } from '../transport/HostTransport';

const accounts: Account[] = [
  { id: 'bank', kind: 'bank', name: 'Bank', color: 'green', unlimited: true, assets: [] },
  { id: 'a', kind: 'player', name: 'A', color: 'red', unlimited: false, assets: [] },
  { id: 'b', kind: 'player', name: 'B', color: 'blue', unlimited: false, assets: [] },
];

const startEvent = makeEvent('game.started', { config: DEFAULT_CONFIG, accounts }, 'bank', 0, 'start');
const welcome = { gameId: 'table-1', events: [startEvent] };

function fakeHostTransport() {
  return {
    listen: vi.fn(async () => {}),
    close: vi.fn(),
    broadcastEvent: vi.fn(),
    connectedPeerCount: 0,
    submit: vi.fn(),
    eventsAfter: vi.fn(async () => []),
    subscribe: vi.fn(() => () => {}),
  } as unknown as HostTransport;
}

function fakeClientTransport(connectImpl: (...args: any[]) => Promise<typeof welcome>) {
  return {
    onConnectionStateChange: vi.fn(() => () => {}),
    connect: vi.fn(connectImpl),
    close: vi.fn(),
    connectionState: 'connected',
    submit: vi.fn(),
    eventsAfter: vi.fn(async () => []),
    subscribe: vi.fn(() => () => {}),
  } as unknown as ClientTransport;
}

function hostedGameStore() {
  const gameStore = createGameStore(new MemoryStorage());
  const created = gameStore.getState().createGame(DEFAULT_CONFIG, accounts);
  expect(created.ok).toBe(true);
  return gameStore;
}

describe('connectionStore socket lifecycle (issue #51)', () => {
  it('leaveSession closes the host transport so re-hosting never hits EADDRINUSE', async () => {
    const host = fakeHostTransport();
    const connections = createConnectionStore(hostedGameStore(), { createHostTransport: () => host });
    const hosted = await connections.getState().hostGame();
    expect(hosted.ok).toBe(true);
    expect(connections.getState().status).toBe('listening');
    connections.getState().leaveSession();
    // Closed via detachTransport and defensively again in leaveSession itself;
    // both are no-ops on an already-closed transport.
    expect(host.close).toHaveBeenCalled();
    expect(connections.getState().role).toBe('single');
    expect(connections.getState().status).toBe('idle');
    // Re-hosting in the same session must work (no zombie listener).
    const rehosted = await connections.getState().hostGame();
    expect(rehosted.ok).toBe(true);
    expect(connections.getState().status).toBe('listening');
  });

  it('leaveSession closes a failed client transport', async () => {
    const client = fakeClientTransport(async () => { throw new Error('Connection timed out'); });
    const connections = createConnectionStore(hostedGameStore(), { createClientTransport: () => client });
    const result = await connections.getState().joinGame('192.168.1.50');
    expect(result.ok).toBe(false);
    connections.getState().leaveSession();
    expect(client.close).toHaveBeenCalled();
  });
});

describe('connectionStore joinGame retries', () => {
  it('connects on the first attempt and records the socket summary', async () => {
    const client = fakeClientTransport(async () => welcome);
    const connections = createConnectionStore(hostedGameStore(), { createClientTransport: () => client });
    const result = await connections.getState().joinGame('192.168.1.50');
    expect(result.ok).toBe(true);
    expect(connections.getState().status).toBe('connected');
    expect(connections.getState().lastSocketSummary).toBe('default');
  });

  it('retries transient timeouts and connects on the third attempt', async () => {
    const client = fakeClientTransport(
      (() => {
        let calls = 0;
        return async () => {
          calls += 1;
          if (calls < 3) throw new Error('Connection timed out');
          return welcome;
        };
      })()
    );
    const connections = createConnectionStore(hostedGameStore(), { createClientTransport: () => client });
    const result = await connections.getState().joinGame('192.168.1.50');
    expect(result.ok).toBe(true);
    expect(client.connect).toHaveBeenCalledTimes(3);
  });

  it('falls back to an unpinned dial when the Wi-Fi pin is unavailable', async () => {
    const client = fakeClientTransport(
      (() => {
        let calls = 0;
        return async () => {
          calls += 1;
          if (calls === 1) throw new Error('socket error: Interface wifi unreachable');
          return welcome;
        };
      })()
    );
    const connections = createConnectionStore(hostedGameStore(), { createClientTransport: () => client });
    const result = await connections.getState().joinGame('192.168.1.50');
    expect(result.ok).toBe(true);
    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(client.connect).toHaveBeenLastCalledWith('192.168.1.50', 51837, expect.any(String), 0, {});
  });

  it('gives up after three attempts with an actionable message', async () => {
    const client = fakeClientTransport(async () => { throw new Error('Connection timed out'); });
    const connections = createConnectionStore(hostedGameStore(), { createClientTransport: () => client });
    const result = await connections.getState().joinGame('192.168.1.50');
    expect(result.ok).toBe(false);
    expect(client.connect).toHaveBeenCalledTimes(3);
    expect(connections.getState().status).toBe('error');
    expect(connections.getState().lastError).toContain('same Wi-Fi');
  });
});
