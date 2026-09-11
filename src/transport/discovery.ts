import { DiscoveredHost, getSubnetIps, chunkArray, parseWelcomeResponse } from './discoveryLogic';
import { DEFAULT_PORT, PROTOCOL_VERSION, decodeLine, encodeMessage } from './wireProtocol';

export * from './discoveryLogic';

declare const require: (name: string) => any;

/**
 * Attempts a lightweight TCP probe to a single host:port.
 * Sends a 'hello' probe and parses the host's 'welcome' response.
 */
export async function probeHost(
  host: string,
  port = DEFAULT_PORT,
  timeoutMs = 450
): Promise<DiscoveredHost | null> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: any = null;
    let timer: any = null;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        if (socket) {
          socket.removeAllListeners();
          socket.destroy();
        }
      } catch {}
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    try {
      const TcpSocket = require('react-native-tcp-socket');
      socket = TcpSocket.createConnection({ host, port }, () => {
        try {
          const hello = encodeMessage({
            kind: 'hello',
            protocolVersion: PROTOCOL_VERSION,
            clientId: 'probe',
            sinceSeq: 0,
          });
          socket.write(hello);
        } catch {
          cleanup();
          resolve(null);
        }
      });

      let buffer = '';
      socket.on('data', (chunk: string | { toString: () => string }) => {
        buffer += chunk.toString();
        const newlineIdx = buffer.indexOf('\n');
        if (newlineIdx !== -1) {
          const line = buffer.slice(0, newlineIdx);
          const msg = decodeLine(line);
          cleanup();
          if (msg) {
            resolve(parseWelcomeResponse(host, port, msg));
          } else {
            resolve(null);
          }
        }
      });

      socket.on('error', () => {
        cleanup();
        resolve(null);
      });

      socket.on('close', () => {
        cleanup();
        resolve(null);
      });
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

export interface ScanOptions {
  port?: number;
  batchSize?: number;
  timeoutMs?: number;
  onHostFound?: (host: DiscoveredHost) => void;
}

/**
 * Probes the local /24 subnet for active Monopoly Banker game hosts in parallel batches.
 */
export async function scanLocalSubnet(options?: ScanOptions): Promise<DiscoveredHost[]> {
  const port = options?.port ?? DEFAULT_PORT;
  const batchSize = options?.batchSize ?? 35;
  const timeoutMs = options?.timeoutMs ?? 450;

  let localIp: string | null = null;
  try {
    const Network = require('expo-network');
    localIp = await Network.getIpAddressAsync();
  } catch {}

  const ips = getSubnetIps(localIp);
  const chunks = chunkArray(ips, batchSize);
  const found: DiscoveredHost[] = [];
  const foundIps = new Set<string>();

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (ip) => {
        const host = await probeHost(ip, port, timeoutMs);
        if (host && !foundIps.has(host.ip)) {
          foundIps.add(host.ip);
          found.push(host);
          options?.onHostFound?.(host);
        }
        return host;
      })
    );
  }

  return found;
}
