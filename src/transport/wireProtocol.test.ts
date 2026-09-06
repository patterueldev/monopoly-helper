import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORT,
  LineBuffer,
  MAX_LINE_BYTES,
  PROTOCOL_VERSION,
  WireMessage,
  decodeLine,
  encodeMessage,
  parseWireMessage,
} from './wireProtocol';
import { GameEvent } from '../ledger/types';

const sampleEvent: GameEvent = {
  seq: 3,
  ts: 1000,
  actorId: 'a',
  intentId: 'intent-3',
  type: 'transfer',
  payload: { from: 'a', to: 'b', amount: 100, reason: { kind: 'other' } },
};

describe('wireMessage encode/decode round-trip', () => {
  it('round-trips every message kind through encode -> decode', () => {
    const messages: WireMessage[] = [
      { kind: 'hello', protocolVersion: PROTOCOL_VERSION, clientId: 'c1', sinceSeq: 0 },
      { kind: 'welcome', protocolVersion: PROTOCOL_VERSION, gameId: 'g1', events: [sampleEvent] },
      { kind: 'intent', intent: { type: 'transfer', payload: sampleEvent.payload, actorId: 'a', intentId: 'intent-3' } },
      { kind: 'event', event: sampleEvent },
      { kind: 'reject', intentId: 'intent-3', reason: 'invalid' },
      { kind: 'sync', requestId: 'r1', sinceSeq: 2 },
      { kind: 'synced', requestId: 'r1', events: [sampleEvent] },
      { kind: 'ping' },
      { kind: 'pong' },
      { kind: 'error', message: 'protocol mismatch' },
    ];
    for (const message of messages) {
      const line = encodeMessage(message);
      expect(line.endsWith('\n')).toBe(true);
      expect(decodeLine(line.slice(0, -1))).toEqual(message);
    }
  });

  it('rejects malformed WireMessages', () => {
    expect(parseWireMessage({ kind: 'hello' })).toBeNull();
    expect(parseWireMessage({ kind: 'nonsense' })).toBeNull();
    expect(parseWireMessage({ kind: 'event', event: { ...sampleEvent, payload: { bad: true } } })).toBeNull();
    expect(parseWireMessage(null)).toBeNull();
    expect(parseWireMessage('not an object')).toBeNull();
  });

  it('decodeLine returns null for invalid JSON without throwing', () => {
    expect(decodeLine('{not json')).toBeNull();
    expect(decodeLine('')).toBeNull();
  });

  it('exposes a fixed default port', () => {
    expect(DEFAULT_PORT).toBe(51837);
  });
});

describe('LineBuffer', () => {
  it('splits a single chunk containing multiple lines', () => {
    const buffer = new LineBuffer();
    const lines = buffer.push('{"kind":"ping"}\n{"kind":"pong"}\n');
    expect(lines).toEqual(['{"kind":"ping"}', '{"kind":"pong"}']);
  });

  it('reassembles a message split across chunks', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('{"kind":"pi')).toEqual([]);
    expect(buffer.push('ng"}\n')).toEqual(['{"kind":"ping"}']);
  });

  it('holds a partial final line until it is completed', () => {
    const buffer = new LineBuffer();
    expect(buffer.push('{"kind":"ping"}\n{"kind":"pon')).toEqual(['{"kind":"ping"}']);
    expect(buffer.push('g"}\n')).toEqual(['{"kind":"pong"}']);
  });

  it('flags an oversized line and stops yielding further lines', () => {
    const buffer = new LineBuffer();
    const huge = 'x'.repeat(MAX_LINE_BYTES + 1);
    const lines = buffer.push(huge + '\n{"kind":"ping"}\n');
    expect(buffer.oversized).toBe(true);
    expect(lines).toEqual([]);
  });

  it('flags an oversized unterminated buffered remainder', () => {
    const buffer = new LineBuffer();
    expect(buffer.oversized).toBe(false);
    buffer.push('x'.repeat(MAX_LINE_BYTES + 1));
    expect(buffer.oversized).toBe(true);
  });

  it('accepts a line right at the byte cap', () => {
    const buffer = new LineBuffer();
    const atCap = 'x'.repeat(MAX_LINE_BYTES);
    expect(buffer.push(atCap + '\n')).toEqual([atCap]);
    expect(buffer.oversized).toBe(false);
  });

  it('counts multi-byte UTF-8 characters correctly, not UTF-16 code units', () => {
    const buffer = new LineBuffer();
    // '€' is 1 UTF-16 code unit but 3 UTF-8 bytes; a line of these should be
    // judged by byte length, not string length.
    const line = '€'.repeat(Math.floor(MAX_LINE_BYTES / 3));
    expect(buffer.push(line + '\n')).toEqual([line]);
    expect(buffer.oversized).toBe(false);
  });
});
