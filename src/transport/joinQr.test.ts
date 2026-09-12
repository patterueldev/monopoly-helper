import { describe, it, expect } from 'vitest';
import { encodeJoinQr, parseJoinQr } from './joinQr';
import { DEFAULT_PORT } from './wireProtocol';

describe('join QR handshake', () => {
  it('round-trips host and port through the deep-link URI', () => {
    const encoded = encodeJoinQr({ host: '192.168.1.50', port: 51837 });
    expect(encoded).toBe('monopolybanker://join?host=192.168.1.50&port=51837');
    expect(parseJoinQr(encoded)).toEqual({ host: '192.168.1.50', port: 51837 });
  });

  it('defaults the port when missing', () => {
    expect(parseJoinQr('monopolybanker://join?host=192.168.1.50')).toEqual({ host: '192.168.1.50', port: DEFAULT_PORT });
    expect(parseJoinQr('192.168.1.50')).toEqual({ host: '192.168.1.50', port: DEFAULT_PORT });
  });

  it('accepts the bare host:port shorthand', () => {
    expect(parseJoinQr('192.168.1.50:51837')).toEqual({ host: '192.168.1.50', port: 51837 });
  });

  it('rejects garbage', () => {
    expect(parseJoinQr('')).toBeNull();
    expect(parseJoinQr('hello world')).toBeNull();
    expect(parseJoinQr('https://example.com')).toBeNull();
    expect(parseJoinQr('monopolybanker://join')).toBeNull();
    expect(parseJoinQr('monopolybanker://other?host=1.2.3.4')).toBeNull();
  });
});
