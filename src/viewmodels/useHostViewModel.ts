import { useEffect, useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';
import { Account } from '../ledger/types';
import { PLAYER_PALETTE } from '../theme';

declare const require: (name: string) => any;

/** Composes connectionStore and gameStore into the Host lobby screen:
 * LAN address, live connected players, offline player addition, and start-game gate. */
export function useHostViewModel() {
  const status = useConnectionStore((s) => s.status);
  const peerCount = useConnectionStore((s) => s.peerCount);
  const lastError = useConnectionStore((s) => s.lastError);
  const hostGame = useConnectionStore((s) => s.hostGame);
  const leaveSession = useConnectionStore((s) => s.leaveSession);

  const accounts = useGameStore((s) => s.state.accounts);
  const dispatch = useGameStore((s) => s.dispatch);
  const players = Object.values(accounts).filter((a) => a.kind === 'player');

  const usedColors = new Set(players.map((p) => p.color));
  const availableColors = PLAYER_PALETTE.filter((c) => !usedColors.has(c));

  const [ip, setIp] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Network = require('expo-network');
        const address = await Network.getIpAddressAsync();
        if (!cancelled) setIp(address);
      } catch {
        if (!cancelled) setIp(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    hostGame(DEFAULT_PORT);
  }, []);

  const addLocalPlayer = (name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: 'Name cannot be empty' };
    if (players.length >= 8) return { ok: false as const, error: 'Maximum 8 players reached' };
    if (players.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return { ok: false as const, error: 'A player with this name already exists' };
    }

    let chosenColor = color;
    if (!chosenColor || usedColors.has(chosenColor)) {
      chosenColor = availableColors[0] ?? PLAYER_PALETTE[players.length % PLAYER_PALETTE.length];
    }

    const newAccount: Account = {
      id: `p${players.length + 1}-${Date.now().toString(36)}`,
      kind: 'player',
      name: trimmed,
      color: chosenColor,
      unlimited: false,
      assets: [],
    };

    const result = dispatch({
      type: 'player.joined',
      actorId: 'bank',
      intentId: `add-local-${Date.now()}-${newAccount.id}`,
      payload: { account: newAccount },
    });

    return result;
  };

  const updatePlayerColor = (playerId: string, newColor: string) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return { ok: false as const, error: 'Player not found' };
    if (usedColors.has(newColor) && player.color !== newColor) {
      return { ok: false as const, error: 'Color already taken' };
    }
    return dispatch({
      type: 'player.renamed',
      actorId: 'bank',
      intentId: `color-${Date.now()}-${playerId}`,
      payload: { accountId: playerId, name: player.name, color: newColor },
    });
  };

  return {
    ip,
    port: DEFAULT_PORT,
    status,
    peerCount,
    players,
    availableColors,
    canStartGame: players.length >= 2,
    error: lastError,
    isListening: status === 'listening',
    addLocalPlayer,
    updatePlayerColor,
    stopHosting: leaveSession,
  };
}

