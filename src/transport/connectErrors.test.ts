import { describe, expect, it } from 'vitest';
import { classifyConnectError } from './connectErrors';

describe('classifyConnectError', () => {
  it('flags the Android Wi-Fi-interface failure for fallback', () => {
    const result = classifyConnectError('socket error: Interface wifi unreachable', '192.168.1.50', 51837);
    expect(result.kind).toBe('wifi-interface');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('explains refused connections', () => {
    const result = classifyConnectError('isConnected failed: ECONNREFUSED (Connection refused)', '192.168.1.50', 51837);
    expect(result.kind).toBe('refused');
    expect(result.message).toContain('192.168.1.50:51837');
  });

  it('explains timeouts with the actionable checklist', () => {
    const result = classifyConnectError('Connection timed out', '192.168.1.50', 51837);
    expect(result.kind).toBe('timeout');
    expect(result.message).toContain('same Wi-Fi');
  });

  it('flags protocol mismatches', () => {
    const result = classifyConnectError('Protocol version mismatch', 'h', 1);
    expect(result.kind).toBe('protocol');
  });

  it('passes anything else through untouched', () => {
    const result = classifyConnectError('weird failure', 'h', 1);
    expect(result).toEqual({ kind: 'unknown', message: 'weird failure' });
    expect(classifyConnectError(null, 'h', 1).message).toBe('Could not connect');
  });
});
