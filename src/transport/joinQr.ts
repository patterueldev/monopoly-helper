import { DEFAULT_PORT } from './wireProtocol';

// QR-based join handshake: the host renders a QR code, the joiner scans it
// instead of typing an IP/port. Pure logic (no camera, no React) — the
// CameraView lives in src/components/QrScannerModal.tsx.

export const JOIN_QR_SCHEME = 'monopolybanker';
export const JOIN_QR_PATH = 'join';

export interface JoinTarget {
  host: string;
  port: number;
}

/** Encode a host+port as a scannable deep-link URI. */
export function encodeJoinQr(target: JoinTarget): string {
  return `${JOIN_QR_SCHEME}://${JOIN_QR_PATH}?host=${encodeURIComponent(target.host)}&port=${target.port}`;
}

/** Decode a scanned QR payload. Accepts the deep-link URI above, or a bare
 * `host:port` / `host` shorthand. Returns null for anything else. */
export function parseJoinQr(text: string): JoinTarget | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;

  const fromParams = (host: string | null, port: string | null): JoinTarget | null => {
    if (!host) return null;
    const parsedPort = port ? Number(port) : NaN;
    const finalPort = Number.isSafeInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
      ? parsedPort
      : DEFAULT_PORT;
    return { host, port: finalPort };
  };

  // monopolybanker://join?host=..&port=..
  try {
    const url = new URL(trimmed);
    if (url.protocol === `${JOIN_QR_SCHEME}:` && url.hostname === JOIN_QR_PATH) {
      return fromParams(url.searchParams.get('host'), url.searchParams.get('port'));
    }
  } catch {
    // Not a URL — fall through to the bare shorthand below.
  }

  // 192.168.1.50:51837 or 192.168.1.50 (default port). IPv6 stays
  // deep-link-only — a bare colon form is ambiguous there.
  const match = /^(?<host>[A-Za-z0-9.\-_~%]+)(?::(?<port>\d{1,5}))?$/.exec(trimmed);
  if (!match?.groups?.host) return null;
  return fromParams(match.groups.host, match.groups.port ?? null);
}
