import { describe, expect, it } from 'vitest';
import { MAX_RECONNECT_ATTEMPTS, canSubmit, initialClientConnectionState, reduceClientConnection } from './clientConnection';

describe('clientConnection state machine', () => {
  it('starts disconnected, and connect() moves to connecting', () => {
    expect(initialClientConnectionState.connectionState).toBe('disconnected');
    const next = reduceClientConnection(initialClientConnectionState, { type: 'connect' });
    expect(next).toEqual({ connectionState: 'connecting', attempts: 0 });
  });

  it('welcomed while connecting reaches connected with attempts reset', () => {
    const connecting = reduceClientConnection(initialClientConnectionState, { type: 'connect' });
    const connected = reduceClientConnection(connecting, { type: 'welcomed' });
    expect(connected).toEqual({ connectionState: 'connected', attempts: 0 });
  });

  it('losing a connected session moves to reconnecting, attempt 1', () => {
    const connected: ReturnType<typeof reduceClientConnection> = { connectionState: 'connected', attempts: 0 };
    const next = reduceClientConnection(connected, { type: 'lost' });
    expect(next).toEqual({ connectionState: 'reconnecting', attempts: 1 });
  });

  it('a reconnect tick while reconnecting attempts another dial (connecting) without resetting attempts', () => {
    const reconnecting = { connectionState: 'reconnecting' as const, attempts: 2 };
    const next = reduceClientConnection(reconnecting, { type: 'reconnectTick' });
    expect(next).toEqual({ connectionState: 'connecting', attempts: 2 });
  });

  it('a stray reconnect tick outside "reconnecting" is a no-op', () => {
    const connected = { connectionState: 'connected' as const, attempts: 0 };
    expect(reduceClientConnection(connected, { type: 'reconnectTick' })).toBe(connected);
  });

  it('repeated losses eventually exhaust attempts and land on disconnected', () => {
    let state: ReturnType<typeof reduceClientConnection> = { connectionState: 'connected', attempts: 0 };
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i += 1) {
      state = reduceClientConnection(state, { type: 'lost' });
      state = i < MAX_RECONNECT_ATTEMPTS - 1 ? reduceClientConnection(state, { type: 'reconnectTick' }) : state;
    }
    expect(state.connectionState).toBe('disconnected');
    expect(state.attempts).toBe(MAX_RECONNECT_ATTEMPTS);
  });

  it('a further loss while already disconnected is a no-op (no runaway attempts)', () => {
    const disconnected = { connectionState: 'disconnected' as const, attempts: MAX_RECONNECT_ATTEMPTS };
    expect(reduceClientConnection(disconnected, { type: 'lost' })).toBe(disconnected);
  });

  it('a manual retry from disconnected resets attempts and starts connecting again', () => {
    const disconnected = { connectionState: 'disconnected' as const, attempts: MAX_RECONNECT_ATTEMPTS };
    expect(reduceClientConnection(disconnected, { type: 'retry' })).toEqual({ connectionState: 'connecting', attempts: 0 });
  });

  it('a deliberate disconnect lands on disconnected with attempts reset, from any state', () => {
    const reconnecting = { connectionState: 'reconnecting' as const, attempts: 3 };
    expect(reduceClientConnection(reconnecting, { type: 'disconnect' })).toEqual({ connectionState: 'disconnected', attempts: 0 });
    const connected = { connectionState: 'connected' as const, attempts: 0 };
    expect(reduceClientConnection(connected, { type: 'disconnect' })).toEqual({ connectionState: 'disconnected', attempts: 0 });
  });

  it('canSubmit is true only when fully connected', () => {
    expect(canSubmit({ connectionState: 'connected', attempts: 0 })).toBe(true);
    expect(canSubmit({ connectionState: 'connecting', attempts: 0 })).toBe(false);
    expect(canSubmit({ connectionState: 'reconnecting', attempts: 1 })).toBe(false);
    expect(canSubmit({ connectionState: 'disconnected', attempts: 5 })).toBe(false);
  });
});
