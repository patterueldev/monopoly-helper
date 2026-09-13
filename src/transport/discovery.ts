import { DiscoveredHost, getSubnetIps, chunkArray, parseWelcomeResponse } from './discoveryLogic';
import { DEFAULT_PORT, PROTOCOL_VERSION, decodeLine, encodeMessage } from './wireProtocol';
import { ConnectionSocketOptions, buildConnectionSocketOptions, currentPlatform } from './socketOptions';
import { log } from '../diagnostics/logBuffer';
import { setLastSeenHosts } from '../diagnostics/lastSeen';

export * from './discoveryLogic';

/** How a single probe ended — tallied by scanLocalSubnet so the next
 * connection report distinguishes "host unreachable" from "host refused". */
export type ProbeOutcome = 'found' | 'timeout' | 'refused' | 'rejected';

declare const require: (name: string) => any;

/**
 * Attempts a lightweight TCP probe to a single host:port.
 * Sends a 'hello' probe and parses the host's 'welcome' response.
 * `onOutcome` reports how the probe ended for scan-level tallies.
 */
export async function probeHost(
  host: string,
  port = DEFAULT_PORT,
  timeoutMs = 1000,
  socketOptions: ConnectionSocketOptions = {},
  onOutcome?: (outcome: ProbeOutcome) => void
): Promise<DiscoveredHost | null> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: any = null;
    let timer: any = null;

    const finish = (outcome: ProbeOutcome, value: DiscoveredHost | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        if (socket) {
          socket.removeAllListeners();
          socket.destroy();
        }
      } catch {}
      try {
        onOutcome?.(outcome);
      } catch {
        // A broken tally subscriber must never break probing itself.
      }
      resolve(value);
    };

    timer = setTimeout(() => {
      finish('timeout', null);
    }, timeoutMs);

    try {
      const TcpSocket = require('react-native-tcp-socket');
      const nativeOptions: Record<string, unknown> = { host, port };
      if (socketOptions.interface) nativeOptions.interface = socketOptions.interface;
      if (socketOptions.localAddress) nativeOptions.localAddress = socketOptions.localAddress;
      socket = TcpSocket.createConnection(nativeOptions, () => {
        try {
          const hello = encodeMessage({
            kind: 'hello',
            protocolVersion: PROTOCOL_VERSION,
            clientId: 'probe',
            sinceSeq: 0,
          });
          socket.write(hello);
        } catch {
          finish('refused', null);
        }
      });

      let buffer = '';
      socket.on('data', (chunk: string | { toString: () => string }) => {
        buffer += chunk.toString();
        const newlineIdx = buffer.indexOf('\n');
        if (newlineIdx !== -1) {
          const line = buffer.slice(0, newlineIdx);
          const msg = decodeLine(line);
          const found = msg ? parseWelcomeResponse(host, port, msg) : null;
          finish(found ? 'found' : 'rejected', found);
        }
      });

      socket.on('error', () => {
        finish('refused', null);
      });

      socket.on('close', () => {
        finish('refused', null);
      });
    } catch {
      finish('refused', null);
    }
  });
}

export interface ScanOptions {
  port?: number;
  batchSize?: number;
  timeoutMs?: number;
  onHostFound?: (host: DiscoveredHost) => void;
  onProbeOutcome?: (ip: string, outcome: ProbeOutcome) => void;
  /** Overrides the Wi-Fi-pinned socket options built from the local IP (tests). */
  socketOptions?: ConnectionSocketOptions;
}

/**
 * Probes the local /24 subnet for active Monopoly Banker game hosts in parallel batches.
 */
export async function scanLocalSubnet(options?: ScanOptions): Promise<DiscoveredHost[]> {
  const port = options?.port ?? DEFAULT_PORT;
  const batchSize = options?.batchSize ?? 50;
  // 1000ms: sub-second probe timeouts are unreliable on recent phones
  // (upstream react-native-tcp-socket#231) and on congested table Wi-Fi.
  const timeoutMs = options?.timeoutMs ?? 1000;

  let localIp: string | null = null;
  try {
    const Network = require('expo-network');
    localIp = await Network.getIpAddressAsync();
  } catch {
    log('scan', 'warn', 'could not read local IP; scanning loopback only');
  }

  const ips = getSubnetIps(localIp);
  const socketOptions = options?.socketOptions
    ?? buildConnectionSocketOptions({ platform: currentPlatform(), localIp });
  const pinnedNote = socketOptions.interface ? ' (Wi-Fi pinned)' : '';
  log('scan', 'info', `scanning ${ips.length} addresses on port ${port}${pinnedNote}`, localIp ? `from ${localIp}` : undefined);
  const chunks = chunkArray(ips, batchSize);
  const found: DiscoveredHost[] = [];
  const foundIps = new Set<string>();
  let timeouts = 0;
  let refused = 0;

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (ip) => {
        const host = await probeHost(ip, port, timeoutMs, socketOptions, (outcome) => {
          if (outcome === 'timeout') timeouts += 1;
          else if (outcome === 'refused') refused += 1;
          try {
            options?.onProbeOutcome?.(ip, outcome);
          } catch {
            // A broken tally subscriber must never break the scan itself.
          }
        });
        if (host && !foundIps.has(host.ip)) {
          foundIps.add(host.ip);
          found.push(host);
          log('scan', 'info', `found table "${host.hostName}"`, `${host.ip}:${host.port} (${host.playerCount} players)`);
          options?.onHostFound?.(host);
        }
        return host;
      })
    );
  }

  log('scan', 'info', `scan finished: ${found.length} table${found.length === 1 ? '' : 's'} found`, `${timeouts} timeouts, ${refused} refused`);
  setLastSeenHosts(found.map((h) => ({ ip: h.ip, port: h.port, hostName: h.hostName, playerCount: h.playerCount })));
  return found;
}
