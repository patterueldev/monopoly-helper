// Builds the react-native-tcp-socket options used for every client-side dial
// (table discovery probes in discovery.ts and game joins in ClientTransport).
//
// Why this exists: on Android the library routes a new socket through the OS
// default network unless `interface` is set — TcpSocketModule.selectNetwork
// returns early with a null network when it is absent, so `bindSocket` is
// skipped. When the phone's default network is cellular (Wi-Fi without
// internet at the table, mobile data preferred), dials to LAN addresses time
// out even though Wi-Fi is up — the systematic Android-client failure behind
// issue #51. Server sockets are unaffected (they bind all interfaces), which
// is why Android hosts stayed reachable. Passing `interface: 'wifi'` (plus
// the Wi-Fi source address when it is recognizably a LAN address) pins the
// socket to Wi-Fi. iOS ignores `interface`, so dials there stay identical.

export interface ConnectionSocketOptions {
  interface?: 'wifi';
  localAddress?: string;
}

/** True for private-use LAN ranges safe to bind as a Wi-Fi source address
 * (10/8, 172.16/12, 192.168/16). Deliberately excludes loopback, link-local,
 * IPv6, public addresses, and 100.64/10 CGNAT (almost always cellular). */
export function isPrivateLanIPv4(ip: string | null | undefined): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const nums = ip.trim().split('.').map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function buildConnectionSocketOptions(args: {
  platform: string;
  localIp?: string | null;
}): ConnectionSocketOptions {
  if (args.platform !== 'android') return {};
  const options: ConnectionSocketOptions = { interface: 'wifi' };
  if (isPrivateLanIPv4(args.localIp)) options.localAddress = args.localIp!.trim();
  return options;
}

declare const require: (name: string) => any;
declare const process: { env: Record<string, string | undefined> };

/** Platform.OS without a static react-native import (keeps this importable in
 * Node tests — under Vitest we short-circuit before touching require, the
 * same NODE_ENV convention gameStore.ts already uses). */
export function currentPlatform(): string {
  try {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return 'unknown';
    return require('react-native')?.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** The native Android error when no Wi-Fi network exists to bind the socket to. */
export function isWifiInterfaceUnavailable(message: string | null | undefined): boolean {
  return typeof message === 'string' && /interface\s+\S*\s*unreachable/i.test(message);
}
