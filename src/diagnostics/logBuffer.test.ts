import { describe, it, expect, beforeEach } from 'vitest';
import { clearLogs, getLogs, log, subscribeLogs, MAX_LOG_ENTRIES } from './logBuffer';

describe('diagnostics log buffer', () => {
  beforeEach(() => clearLogs());

  it('stores entries newest-first', () => {
    log('scan', 'info', 'first');
    log('connect', 'error', 'second');
    const logs = getLogs();
    expect(logs.map((e) => e.message)).toEqual(['second', 'first']);
    expect(logs[0].category).toBe('connect');
    expect(logs[0].level).toBe('error');
  });

  it('caps the buffer as a ring', () => {
    for (let i = 0; i < MAX_LOG_ENTRIES + 20; i += 1) log('socket', 'debug', `m${i}`);
    const logs = getLogs();
    expect(logs).toHaveLength(MAX_LOG_ENTRIES);
    expect(logs[0].message).toBe(`m${MAX_LOG_ENTRIES + 19}`);
  });

  it('clears and notifies subscribers', () => {
    let calls = 0;
    const unsubscribe = subscribeLogs(() => { calls += 1; });
    log('session', 'info', 'hello');
    expect(calls).toBe(1);
    clearLogs();
    expect(calls).toBe(2);
    expect(getLogs()).toEqual([]);
    unsubscribe();
    log('session', 'info', 'after');
    expect(calls).toBe(2);
  });
});
