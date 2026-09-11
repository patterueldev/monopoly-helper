import { GameEvent, Account } from '../ledger/types';
import { WireMessage } from './wireProtocol';

export interface DiscoveredHost {
  ip: string;
  port: number;
  hostName: string;
  hostColor: string;
  playerCount: number;
  gameId: string;
}

/**
 * Given a local IPv4 address (e.g. "192.168.1.45"), derives all candidate host IPs
 * in the same /24 subnet ("192.168.1.1" .. "192.168.1.254"), excluding self.
 * If local IP is loopback or cannot be parsed, returns fallback candidates.
 */
export function getSubnetIps(localIp: string | null | undefined): string[] {
  if (!localIp || typeof localIp !== 'string') return ['127.0.0.1'];
  const trimmed = localIp.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4 || parts.some((p) => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
    return ['127.0.0.1'];
  }

  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const selfLast = Number(parts[3]);
  const ips: string[] = [];

  for (let i = 1; i <= 254; i += 1) {
    if (i !== selfLast) {
      ips.push(`${prefix}.${i}`);
    }
  }

  // Also include self at the end in case the device is testing against local host
  ips.push(trimmed);

  return ips;
}

/**
 * Splits an array into chunks of a given maximum size for throttled parallel operations.
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Pure parser that extracts DiscoveredHost metadata from a 'welcome' wire message.
 */
export function parseWelcomeResponse(
  ip: string,
  port: number,
  message: WireMessage
): DiscoveredHost | null {
  if (message.kind !== 'welcome') return null;

  const startEvent = message.events.find((e): e is GameEvent<'game.started'> => e.type === 'game.started');
  if (!startEvent) return null;

  const accounts: Account[] = (startEvent.payload as any)?.accounts ?? [];
  const players = accounts.filter((a) => a.kind === 'player');
  const hostAccount = players[0];

  // Count joined players from subsequent events
  const joinedEvents = message.events.filter((e) => e.type === 'player.joined');
  const totalPlayers = players.length + joinedEvents.length;

  return {
    ip,
    port,
    hostName: hostAccount?.name ?? 'Monopoly Host',
    hostColor: hostAccount?.color ?? '#2ecc71',
    playerCount: Math.max(1, totalPlayers),
    gameId: message.gameId,
  };
}
