// In-memory ring buffer of connection diagnostics. Pure module — no React, no
// sockets — so the transport layer can write here and the diagnostics screen
// can read from it later. This is what makes "we couldn't connect" debuggable:
// every failed dial, timeout, and dropped peer leaves a timestamped trace.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory =
  | 'scan'
  | 'connect'
  | 'socket'
  | 'heartbeat'
  | 'protocol'
  | 'session'
  | 'host';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  detail?: string;
}

export const MAX_LOG_ENTRIES = 250;

let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // A broken subscriber must never break logging itself.
    }
  });
}

export function log(category: LogCategory, level: LogLevel, message: string, detail?: string): void {
  entries.push({ ts: Date.now(), level, category, message, detail });
  if (entries.length > MAX_LOG_ENTRIES) entries = entries.slice(entries.length - MAX_LOG_ENTRIES);
  notify();
}

/** Newest first — the most recent failure is what a report reader wants first. */
export function getLogs(): LogEntry[] {
  return [...entries].reverse();
}

export function clearLogs(): void {
  entries = [];
  notify();
}

export function subscribeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
