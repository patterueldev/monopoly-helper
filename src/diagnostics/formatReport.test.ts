import { describe, it, expect } from 'vitest';
import { formatDiagnosticsReport } from './formatReport';

describe('diagnostics report formatter', () => {
  it('renders session facts, hosts, and newest log lines', () => {
    const report = formatDiagnosticsReport({
      appVersion: '1.3.0',
      platform: 'ios',
      osVersion: '18.0',
      deviceModel: 'iPhone',
      role: 'client',
      status: 'error',
      lastError: 'Connection timed out',
      localIp: '192.168.1.50',
      discoveredHosts: [{ ip: '192.168.1.51', port: 51837, hostName: 'Pat', playerCount: 3 }],
      logs: [
        { ts: 1000, level: 'error', category: 'connect', message: 'connect failed', detail: 'timeout' },
        { ts: 500, level: 'info', category: 'scan', message: 'scan done' },
      ],
    });
    expect(report).toContain('Monopoly Banker — connection report');
    expect(report).toContain('App: 1.3.0 · ios 18.0 · iPhone');
    expect(report).toContain('Role: client · Status: error');
    expect(report).toContain('Last error: Connection timed out');
    expect(report).toContain('Pat @ 192.168.1.51:51837 (3 players)');
    const failedIdx = report.indexOf('connect failed');
    const scanIdx = report.indexOf('scan done');
    expect(failedIdx).toBeGreaterThan(-1);
    expect(scanIdx).toBeGreaterThan(failedIdx);
  });

  it('handles the saw-nothing case', () => {
    const report = formatDiagnosticsReport({
      appVersion: '1.3.0',
      platform: 'android',
      osVersion: '14',
      deviceModel: 'Pixel',
      role: 'single',
      status: 'idle',
      lastError: null,
      localIp: null,
      discoveredHosts: [],
      logs: [],
    });
    expect(report).toContain('Nearby tables seen: none');
    expect(report).toContain('Last error: none');
  });
});
