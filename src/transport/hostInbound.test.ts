import { describe, expect, it } from 'vitest';
import { DispatchOutcome, HandleInboundContext, handleInbound } from './hostInbound';
import { GameEvent } from '../ledger/types';
import { Intent } from '../ledger/intents';
import { PROTOCOL_VERSION } from './wireProtocol';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const sampleEvent: GameEvent = {
  seq: 1,
  ts: 1000,
  actorId: 'a',
  intentId: 'intent-1',
  type: 'transfer',
  payload: { from: 'a', to: 'b', amount: 100, reason: { kind: 'other' } },
};
const sampleIntent: Intent = { type: 'transfer', payload: sampleEvent.payload, actorId: 'a', intentId: 'intent-1' };

function contextWith(dispatch: (intent: Intent) => Result<DispatchOutcome>, events: GameEvent[] = []): HandleInboundContext {
  return { gameId: 'game-1', dispatch, eventsAfter: sinceSeq => events.filter(e => e.seq >= sinceSeq) };
}

describe('HostTransport handleInbound', () => {
  it('hello with a matching protocol version replies with welcome + events since sinceSeq', () => {
    const ctx = contextWith(() => ({ ok: true, value: { duplicate: false } }), [sampleEvent, { ...sampleEvent, seq: 2, intentId: 'x' }]);
    const outcome = handleInbound({ kind: 'hello', protocolVersion: PROTOCOL_VERSION, clientId: 'c1', sinceSeq: 2 }, ctx);
    expect(outcome).toEqual({ action: 'reply', message: { kind: 'welcome', protocolVersion: PROTOCOL_VERSION, gameId: 'game-1', events: [{ ...sampleEvent, seq: 2, intentId: 'x' }] } });
  });

  it('hello with a mismatched protocol version replies with error and closes', () => {
    const ctx = contextWith(() => ({ ok: true, value: { duplicate: false } }));
    const outcome = handleInbound({ kind: 'hello', protocolVersion: 999, clientId: 'c1', sinceSeq: 0 }, ctx);
    expect(outcome.action).toBe('replyAndClose');
    expect(outcome.action === 'replyAndClose' && outcome.message.kind).toBe('error');
  });

  it('a successful, non-duplicate intent dispatches and produces no direct reply (broadcast handles it)', () => {
    const ctx = contextWith(() => ({ ok: true, value: { event: sampleEvent, duplicate: false } }));
    const outcome = handleInbound({ kind: 'intent', intent: sampleIntent }, ctx);
    expect(outcome).toEqual({ action: 'none' });
  });

  it('a failed dispatch replies reject to the sender only', () => {
    const ctx = contextWith(() => ({ ok: false, error: 'Invalid event' }));
    const outcome = handleInbound({ kind: 'intent', intent: sampleIntent }, ctx);
    expect(outcome).toEqual({ action: 'reply', message: { kind: 'reject', intentId: 'intent-1', reason: 'Invalid event' } });
  });

  it('a duplicate intentId resolves the sender from the existing event, without re-broadcasting', () => {
    const ctx = contextWith(() => ({ ok: true, value: { event: sampleEvent, duplicate: true } }));
    const outcome = handleInbound({ kind: 'intent', intent: sampleIntent }, ctx);
    expect(outcome).toEqual({ action: 'reply', message: { kind: 'event', event: sampleEvent } });
  });

  it('a duplicate with no resolvable event replies reject rather than crashing', () => {
    const ctx = contextWith(() => ({ ok: true, value: { duplicate: true } }));
    const outcome = handleInbound({ kind: 'intent', intent: sampleIntent }, ctx);
    expect(outcome.action).toBe('reply');
    expect(outcome.action === 'reply' && outcome.message.kind).toBe('reject');
  });

  it('sync replies synced with events since the requested seq', () => {
    const ctx = contextWith(() => ({ ok: true, value: { duplicate: false } }), [sampleEvent]);
    const outcome = handleInbound({ kind: 'sync', requestId: 'r1', sinceSeq: 0 }, ctx);
    expect(outcome).toEqual({ action: 'reply', message: { kind: 'synced', requestId: 'r1', events: [sampleEvent] } });
  });

  it('ping replies pong', () => {
    const ctx = contextWith(() => ({ ok: true, value: { duplicate: false } }));
    expect(handleInbound({ kind: 'ping' }, ctx)).toEqual({ action: 'reply', message: { kind: 'pong' } });
  });

  it('a message a host should never receive from a client (e.g. welcome) is a no-op, not a crash', () => {
    const ctx = contextWith(() => ({ ok: true, value: { duplicate: false } }));
    const outcome = handleInbound({ kind: 'welcome', protocolVersion: PROTOCOL_VERSION, gameId: 'g', events: [] }, ctx);
    expect(outcome).toEqual({ action: 'none' });
  });

  it('rejects host-only settlement intents from clients before dispatch', () => {
    const intent: Intent = { type: 'game.ended', payload: { tally: [] }, actorId: 'b', intentId: 'client-end' };
    const ctx = contextWith(() => { throw new Error('must not dispatch'); });
    expect(handleInbound({ kind: 'intent', intent }, ctx)).toEqual({
      action: 'reply',
      message: { kind: 'reject', intentId: 'client-end', reason: 'Only the Host can perform this action' },
    });
  });
});
