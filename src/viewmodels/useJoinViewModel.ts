import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';
import { useProfileStore } from '../store/profileStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';
import { PLAYER_PALETTE } from '../theme';
import { Account } from '../ledger/types';
import { DiscoveredHost, scanLocalSubnet } from '../transport/discovery';

declare const require: (name: string) => any;
const uuid = () => {
  try {
    return require('expo-crypto').randomUUID();
  } catch {
    return `player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
};

export interface ColorConflictInfo {
  takenBy: string;
  takenColor: string;
  availableColors: string[];
}

/** Composes connectionStore and profileStore into what app/join.tsx renders:
 * Player name and token color, auto-discovered LAN hosts, manual IP/port, connect action, and live status. */
export function useJoinViewModel() {
  const status = useConnectionStore((s) => s.status);
  const lastError = useConnectionStore((s) => s.lastError);
  const joinGame = useConnectionStore((s) => s.joinGame);
  const leaveSession = useConnectionStore((s) => s.leaveSession);

  const profile = useProfileStore((s) => s.profile);
  const saveProfile = useProfileStore((s) => s.saveProfile);

  const [playerName, setPlayerName] = useState(profile?.name ?? '');
  const [playerColor, setPlayerColor] = useState(profile?.color ?? PLAYER_PALETTE[0]);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(String(DEFAULT_PORT));

  const [discoveredHosts, setDiscoveredHosts] = useState<DiscoveredHost[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [colorConflict, setColorConflict] = useState<ColorConflictInfo | null>(null);

  // Leave a still-connecting attempt behind if this screen is dismissed before
  // it resolves — but not a session the user successfully joined and then
  // navigated on from (e.g. to /table), which owns its own lifetime after that.
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => () => { if (statusRef.current !== 'connected') leaveSession(); }, []);

  const rescan = useCallback(async () => {
    setIsScanning(true);
    setDiscoveredHosts([]);
    try {
      await scanLocalSubnet({
        port: Number(port) || DEFAULT_PORT,
        onHostFound: (newHost) => {
          setDiscoveredHosts((prev) => {
            if (prev.some((h) => h.ip === newHost.ip)) return prev;
            return [...prev, newHost];
          });
        },
      });
    } catch {
      // Ignore scan failures in background
    } finally {
      setIsScanning(false);
    }
  }, [port]);

  useEffect(() => {
    rescan();
  }, [rescan]);

  const connectWithTarget = async (targetHost: string, targetPort: number) => {
    setColorConflict(null);
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      return { ok: false as const, error: 'Enter your player name' };
    }
    if (!targetHost.trim()) {
      return { ok: false as const, error: 'Enter the host device’s IP address' };
    }

    // Persist confirmed profile so it survives across sessions
    saveProfile({ name: trimmedName, color: playerColor });

    const joinResult = await joinGame(targetHost.trim(), targetPort);
    if (!joinResult.ok) return joinResult;

    // After connecting and seeding the replica game, check if this player already
    // exists in the host's accounts.
    const game = useGameStore.getState();
    const existingAccounts = Object.values(game.state.accounts).filter((a) => a.kind === 'player');
    const existingPlayer = existingAccounts.find(
      (a) => a.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (!existingPlayer) {
      const usedColors = new Set(existingAccounts.map((a) => a.color));

      if (usedColors.has(playerColor)) {
        const holder = existingAccounts.find((a) => a.color === playerColor);
        const available = PLAYER_PALETTE.filter((c) => !usedColors.has(c));
        setColorConflict({
          takenBy: holder?.name ?? 'Another player',
          takenColor: playerColor,
          availableColors: available,
        });
        return {
          ok: false as const,
          conflict: true as const,
          error: `Color is already taken by ${holder?.name ?? 'another player'}`,
        };
      }

      const account: Account = {
        id: uuid(),
        kind: 'player',
        name: trimmedName,
        color: playerColor,
        unlimited: false,
        assets: [],
      };

      const dispatchResult = game.dispatch({
        type: 'player.joined',
        actorId: 'bank',
        intentId: `join-${Date.now()}-${account.id}`,
        payload: { account },
      });

      if (!dispatchResult.ok) {
        return { ok: false as const, error: dispatchResult.error };
      }
    }

    return { ok: true as const, value: undefined };
  };

  const resolveColorConflict = async (chosenColor: string) => {
    const trimmedName = playerName.trim();
    const game = useGameStore.getState();
    const existingAccounts = Object.values(game.state.accounts).filter((a) => a.kind === 'player');
    const usedColors = new Set(existingAccounts.map((a) => a.color));

    if (usedColors.has(chosenColor)) {
      return { ok: false as const, error: 'That color is also already taken' };
    }

    setPlayerColor(chosenColor);
    saveProfile({ name: trimmedName, color: chosenColor });

    const account: Account = {
      id: uuid(),
      kind: 'player',
      name: trimmedName,
      color: chosenColor,
      unlimited: false,
      assets: [],
    };

    const dispatchResult = game.dispatch({
      type: 'player.joined',
      actorId: 'bank',
      intentId: `join-${Date.now()}-${account.id}`,
      payload: { account },
    });

    if (!dispatchResult.ok) {
      return { ok: false as const, error: dispatchResult.error };
    }

    setColorConflict(null);
    return { ok: true as const, value: undefined };
  };

  const cancelConflict = () => {
    setColorConflict(null);
    leaveSession();
  };

  const connect = () => connectWithTarget(host, Number(port) || DEFAULT_PORT);

  const connectToHost = (dh: DiscoveredHost) => {
    setHost(dh.ip);
    setPort(String(dh.port));
    return connectWithTarget(dh.ip, dh.port);
  };

  return {
    playerName,
    setPlayerName,
    playerColor,
    setPlayerColor,
    palette: PLAYER_PALETTE,
    host,
    setHost,
    port,
    setPort,
    status,
    error: lastError,
    isConnecting: status === 'connecting' || status === 'reconnecting',
    isConnected: status === 'connected',
    discoveredHosts,
    isScanning,
    rescan,
    connect,
    connectToHost,
    colorConflict,
    resolveColorConflict,
    cancelConflict,
  };
}

