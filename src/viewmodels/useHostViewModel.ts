import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';
import { useProfileStore } from '../store/profileStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';
import { PLAYER_PALETTE } from '../theme';

declare const require: (name: string) => any;

/** Composes connectionStore and gameStore into the Host lobby screen:
 * LAN address, live connected players, and start-game gate. */
export function useHostViewModel() {
  const status = useConnectionStore((s) => s.status);
  const role = useConnectionStore((s) => s.role);
  const peerCount = useConnectionStore((s) => s.peerCount);
  const lastError = useConnectionStore((s) => s.lastError);
  const hostGame = useConnectionStore((s) => s.hostGame);
  const leaveSession = useConnectionStore((s) => s.leaveSession);

  const state = useGameStore((s) => s.state);
  const accounts = state.accounts;
  const dispatch = useGameStore((s) => s.dispatch);
  const findMyAccount = useProfileStore((s) => s.findMyAccount);
  const players = Object.values(accounts).filter((a) => a.kind === 'player');
  const hostPlayerId = findMyAccount(accounts)?.id;

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
    if (role !== 'host' || status !== 'listening') hostGame(DEFAULT_PORT);
    return () => {
      if (!navigatingToTable.current) {
        leaveSession();
      }
    };
  }, []);

  const startGame = () => {
    if (players.length < 2 || state.gameStarted || !state.hostAccountId) return;
    const result = dispatch({
      type: 'game.begun',
      actorId: state.hostAccountId,
      intentId: `begin-${Date.now()}`,
      payload: {},
    });
    if (result.ok) {
      navigatingToTable.current = true;
      router.replace('/table');
    }
  };

  const movePlayer = (playerId: string, direction: -1 | 1) => {
    if (state.gameStarted || !state.hostAccountId) {
      return { ok: false as const, error: 'Players can only be reordered before the game starts' };
    }
    const index = players.findIndex((player) => player.id === playerId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= players.length) {
      return { ok: false as const, error: 'Player is already at the edge of the order' };
    }
    const playerIds = players.map((player) => player.id);
    [playerIds[index], playerIds[nextIndex]] = [playerIds[nextIndex], playerIds[index]];
    return dispatch({
      type: 'players.reordered',
      actorId: state.hostAccountId,
      intentId: `reorder-${Date.now()}-${playerId}-${direction}`,
      payload: { playerIds },
    });
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
    canStartGame: players.length >= 2 && !state.gameStarted,
    gameStarted: state.gameStarted,
    canArrangePlayers: !state.gameStarted,
    hostPlayerId,
    movePlayer,
    error: lastError,
    isListening: status === 'listening',
    startGame,
    updatePlayerColor,
    stopHosting: leaveSession,
  };
}
