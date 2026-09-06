// Pure reconnect/heartbeat state machine for ClientTransport — no sockets, no
// timers, no React. The socket adapter (ClientTransport.ts) drives this with
// real events and owns the actual setInterval/setTimeout calls; this module
// just says what state comes next. Fully Vitest-covered — see plan §6.

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/** Reconnect attempts before giving up and requiring a manual Retry — plan §5.3. */
export const MAX_RECONNECT_ATTEMPTS = 5;

export interface ClientConnectionState {
  connectionState: ConnectionState;
  /** Reconnect attempts made since the last successful `connected`. */
  attempts: number;
}

export type ClientConnectionEvent =
  /** User pressed "Join" or a fresh connect() call started. */
  | { type: 'connect' }
  /** The host replied `welcome` — fully connected, per plan §2 step 2. */
  | { type: 'welcomed' }
  /** The TCP socket closed/errored, or a `ping` went unanswered for 15s. */
  | { type: 'lost' }
  /** The fixed-interval reconnect timer fired; the adapter should now retry the dial. */
  | { type: 'reconnectTick' }
  /** User pressed the manual "Retry" button after attempts were exhausted. */
  | { type: 'retry' }
  /** User chose to leave the session (connectionStore.leaveSession()) — no
   * further reconnect attempts should be scheduled after this. */
  | { type: 'disconnect' };

export const initialClientConnectionState: ClientConnectionState = { connectionState: 'disconnected', attempts: 0 };

export function reduceClientConnection(state: ClientConnectionState, event: ClientConnectionEvent): ClientConnectionState {
  switch (event.type) {
    case 'connect':
    case 'retry':
      return { connectionState: 'connecting', attempts: 0 };

    case 'welcomed':
      return { connectionState: 'connected', attempts: 0 };

    case 'lost': {
      if (state.connectionState === 'disconnected') return state; // already given up, no-op
      const attempts = state.attempts + 1;
      return attempts >= MAX_RECONNECT_ATTEMPTS ? { connectionState: 'disconnected', attempts } : { connectionState: 'reconnecting', attempts };
    }

    case 'reconnectTick':
      // Only meaningful mid-backoff; a stray timer tick after the state moved
      // on (e.g. the user hit Retry, or a fresh connect landed) is a no-op.
      if (state.connectionState !== 'reconnecting') return state;
      return { connectionState: 'connecting', attempts: state.attempts };

    case 'disconnect':
      return { connectionState: 'disconnected', attempts: 0 };

    default:
      return state;
  }
}

/** Whether a dispatch should be allowed to actually submit over the wire. */
export function canSubmit(state: ClientConnectionState): boolean {
  return state.connectionState === 'connected';
}
