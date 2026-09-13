import { useCallback, useEffect, useState } from 'react';
import { Platform, Share } from 'react-native';
import { useConnectionStore } from '../store/connectionStore';
import { clearLogs, getLogs, subscribeLogs, LogEntry } from '../diagnostics/logBuffer';
import { getLastSeenHosts } from '../diagnostics/lastSeen';
import { formatDiagnosticsReport } from '../diagnostics/formatReport';

declare const require: (name: string) => any;

/** Builds the connection report from live stores + native device info, and
 * hands it to the OS share sheet (Messages, Messenger, Mail, …) — no account,
 * no backend. The require() guards keep this importable in Node tests. */
export function useDiagnostics() {
  const role = useConnectionStore((s) => s.role);
  const status = useConnectionStore((s) => s.status);
  const lastError = useConnectionStore((s) => s.lastError);
  const lastSocketSummary = useConnectionStore((s) => s.lastSocketSummary);

  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs());
  useEffect(() => subscribeLogs(() => setLogs(getLogs())), []);

  const buildReport = useCallback(async (): Promise<string> => {
    let appVersion = 'unknown';
    let osVersion = 'unknown';
    let deviceModel = 'unknown';
    try {
      const Device = require('expo-device');
      deviceModel = Device.modelName ?? Device.deviceName ?? 'unknown';
      osVersion = Device.osVersion ?? 'unknown';
    } catch {
      // Native module unavailable (tests) — 'unknown' stands in.
    }
    try {
      const Application = require('expo-application');
      appVersion = Application.nativeApplicationVersion ?? 'unknown';
    } catch {
      // Same as above.
    }
    let localIp: string | null = null;
    let networkType: string | null = null;
    try {
      const Network = require('expo-network');
      localIp = await Network.getIpAddressAsync();
      try {
        networkType = (await Network.getNetworkStateAsync())?.type ?? null;
      } catch {
        // Older expo-network without getNetworkStateAsync — leave unknown.
      }
    } catch {
      // Native module unavailable (tests) — 'unknown' stands in.
    }
    return formatDiagnosticsReport({
      appVersion,
      platform: Platform.OS,
      osVersion,
      deviceModel,
      role,
      status,
      lastError,
      localIp,
      networkType,
      socketSummary: lastSocketSummary,
      discoveredHosts: getLastSeenHosts(),
      logs: getLogs(),
    });
  }, [role, status, lastError, lastSocketSummary]);

  const shareReport = useCallback(async (): Promise<void> => {
    const message = await buildReport();
    await Share.share({ message, title: 'Monopoly Banker connection report' });
  }, [buildReport]);

  return { role, status, lastError, logs, buildReport, shareReport, clearLogs };
}
