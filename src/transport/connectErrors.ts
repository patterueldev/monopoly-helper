import { isWifiInterfaceUnavailable } from './socketOptions';

// Turns raw socket/join failures into the message the player actually sees on
// the join screen (and into the kind connectionStore uses to decide whether
// to keep the Wi-Fi pin or fall back to an unpinned dial).

export type ConnectFailureKind = 'wifi-interface' | 'refused' | 'timeout' | 'protocol' | 'unknown';

export interface ClassifiedConnectFailure {
  kind: ConnectFailureKind;
  message: string;
}

export function classifyConnectError(
  raw: string | null | undefined,
  host: string,
  port: number
): ClassifiedConnectFailure {
  const detail = typeof raw === 'string' && raw.length > 0 ? raw : 'Could not connect';
  if (isWifiInterfaceUnavailable(detail)) {
    return {
      kind: 'wifi-interface',
      message: 'Phone Wi-Fi isn’t available for this connection — retrying without the Wi-Fi pin…',
    };
  }
  if (/econnrefused|connection refused/i.test(detail)) {
    return {
      kind: 'refused',
      message: `The host at ${host}:${port} isn’t accepting connections — is the host still in the lobby?`,
    };
  }
  if (/timed?\s*out|timeout/i.test(detail)) {
    return {
      kind: 'timeout',
      message: `Couldn’t reach ${host}:${port} — same Wi-Fi network? Host app open in the lobby? On some Android phones turning mobile data off helps.`,
    };
  }
  if (/protocol version|version mismatch/i.test(detail)) {
    return {
      kind: 'protocol',
      message: 'App versions don’t match — update Monopoly Banker on both phones.',
    };
  }
  return { kind: 'unknown', message: detail };
}
