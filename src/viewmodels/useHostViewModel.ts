import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';
import { PLAYER_PALETTE } from '../theme';

declare const require: (name: string) => any;

/** Composes connectionStore and gameStore into the Host lobby screen:
 * LAN address, live connected players, and start-game gate. */
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
  const navigatingToTable = useRef(false);

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
    return () => {
      if (!navigatingToTable.current) {
        leaveSession();
      }
    };
  }, []);

  const startGame = () => {
    if (players.length < 2) return;
    navigatingToTable.current = true;
    router.replace('/table');
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
    startGame,
    updatePlayerColor,
    stopHosting: leaveSession,
  };
}


