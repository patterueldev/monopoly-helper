import { GameEvent } from '../ledger/types';
import { Intent } from '../ledger/intents';
import { PROTOCOL_VERSION, WireMessage } from './wireProtocol';

// Pure host-side decision logic — no sockets, no React, no react-native-tcp-socket
// import (that native module can't load under Vitest's node environment, which is
// exactly why this lives in its own module: HostTransport.ts's socket adapter
// imports this, but this file never imports it back). Fully Vitest-covered.
// See plan §3/§6: "the decision logic ... is unit-testable without a real socket."

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface DispatchOutcome { event?: GameEvent; duplicate: boolean }

export interface HandleInboundContext {
  gameId: string;
  /** The exact same function a local screen calls — every intent, local or
   * remote, goes through one dispatch path (plan §2). */
  dispatch: (intent: Intent) => Result<DispatchOutcome>;
  eventsAfter: (sinceSeq: number) => GameEvent[];
}

const HOST_ONLY_INTENT_TYPES = new Set(['players.reordered', 'game.begun', 'settlement.started', 'settlement.dismissed', 'game.ended', 'player.jailed', 'player.released']);

/** Banker-only intents a client may never submit: settlement controls, game end,
 * jail/release, any transfer issued by the Bank (e.g. Pass GO), and payment
 * requests that collect into the Bank (the reducer re-checks banker authority). */
export function isBankerOnlyIntent(intent: Intent): boolean {
  if (HOST_ONLY_INTENT_TYPES.has(intent.type)) return true;
  return (intent.type === 'transfer' && intent.payload.from === 'bank')
    || (intent.type === 'request.created' && intent.payload.to === 'bank');
}

export type InboundOutcome =
  /** Send `message` to the socket that sent the inbound message, only. */
  | { action: 'reply'; message: WireMessage }
  /** Send `message` (always a fatal `error`), then close that socket. */
  | { action: 'replyAndClose'; message: WireMessage }
  /** Nothing to send back directly — e.g. a successful non-duplicate intent,
   * where the broadcast (see HostTransport.broadcastEvent) covers the sender too. */
  | { action: 'none' };

export function handleInbound(message: WireMessage, ctx: HandleInboundContext): InboundOutcome {
  switch (message.kind) {
    case 'hello': {
      if (message.protocolVersion !== PROTOCOL_VERSION) {
        return { action: 'replyAndClose', message: { kind: 'error', message: `unsupported protocol version ${message.protocolVersion}` } };
      }
      return { action: 'reply', message: { kind: 'welcome', protocolVersion: PROTOCOL_VERSION, gameId: ctx.gameId, events: ctx.eventsAfter(message.sinceSeq) } };
    }
    case 'intent': {
      if (isBankerOnlyIntent(message.intent)) {
        return { action: 'reply', message: { kind: 'reject', intentId: message.intent.intentId, reason: 'Only the Host can perform this action' } };
      }
      const result = ctx.dispatch(message.intent);
      if (!result.ok) return { action: 'reply', message: { kind: 'reject', intentId: message.intent.intentId, reason: result.error } };
      if (result.value.duplicate) {
        // Already broadcast once when it was first appended — resolve only the
        // retrying sender, from the logged event, so a flaky-reconnect resend
        // doesn't hang forever. See plan §2 and §5.5.
        if (!result.value.event) return { action: 'reply', message: { kind: 'reject', intentId: message.intent.intentId, reason: 'duplicate intent could not be resolved' } };
        return { action: 'reply', message: { kind: 'event', event: result.value.event } };
      }
      // New event: no direct reply here. gameStore's onHostEvent hook drives
      // HostTransport.broadcastEvent, which reaches every connected peer,
      // submitter included (plan §2 step 3).
      return { action: 'none' };
    }
    case 'sync':
      return { action: 'reply', message: { kind: 'synced', requestId: message.requestId, events: ctx.eventsAfter(message.sinceSeq) } };
    case 'ping':
      return { action: 'reply', message: { kind: 'pong' } };
    default:
      // 'pong' (heartbeat liveness — tracked by the socket adapter's timers,
      // not this pure function) and any message a host should never receive
      // from a client (welcome/event/reject/synced/error) are no-ops here.
      return { action: 'none' };
  }
}
