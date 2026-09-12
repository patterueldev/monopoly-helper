// Pure report builder: takes already-gathered device/session facts plus the
// log buffer and renders the plain-text report the user shares. No native
// imports here — the viewmodel gathers the facts, this only formats them.

import { LogEntry } from './logBuffer';

export interface ReportedHost {
  ip: string;
  port: number;
  hostName: string;
  playerCount: number;
}

export interface DiagnosticsInput {
  appVersion: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  role: string;
  status: string;
  lastError: string | null;
  localIp: string | null;
  discoveredHosts: ReportedHost[];
  /** Newest first, as returned by getLogs(). */
  logs: LogEntry[];
}

export const MAX_REPORT_LOG_LINES = 120;

export function formatDiagnosticsReport(input: DiagnosticsInput): string {
  const lines: string[] = [
    'Monopoly Banker — connection report',
    `App: ${input.appVersion} · ${input.platform} ${input.osVersion} · ${input.deviceModel}`,
    `Role: ${input.role} · Status: ${input.status}`,
    `Last error: ${input.lastError ?? 'none'}`,
    `Local IP: ${input.localIp ?? 'unknown'}`,
  ];

  if (input.discoveredHosts.length === 0) {
    lines.push('Nearby tables seen: none');
  } else {
    lines.push(`Nearby tables seen (${input.discoveredHosts.length}):`);
    for (const h of input.discoveredHosts) {
      lines.push(`- ${h.hostName} @ ${h.ip}:${h.port} (${h.playerCount} player${h.playerCount === 1 ? '' : 's'})`);
    }
  }

  const logs = input.logs.slice(0, MAX_REPORT_LOG_LINES);
  lines.push(`--- connection log (newest first, showing ${logs.length}) ---`);
  for (const e of logs) {
    const time = new Date(e.ts).toISOString().slice(11, 19);
    lines.push(`[${time}] [${e.category}/${e.level}] ${e.message}${e.detail ? ` — ${e.detail}` : ''}`);
  }
  lines.push('--- end of report ---');
  lines.push('Sent from inside the Monopoly Banker app. IP addresses above are local-network only.');
  return lines.join('\n');
}
