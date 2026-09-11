import { useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { useGameStore } from '../store/gameStore';
import { useProfileStore } from '../store/profileStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';
import { PLAYER_PALETTE } from '../theme';
import { Account } from '../ledger/types';

declare const require: (name: string) => any;
const uuid = () => {
  try {
    return require('expo-crypto').randomUUID();
  } catch {
    return `player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
};

/** Composes connectionStore and profileStore into what app/join.tsx renders:
 * Player name and token color, host IP/port, connect action, and live status/error.
 * Per plan.md Section 11 item 6 and Section 12 MVVM architecture. */
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

  // Leave a still-connecting attempt behind if this screen is dismissed before
  // it resolves — but not a session the user successfully joined and then
  // navigated on from (e.g. to /table), which owns its own lifetime after that.
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => () => { if (statusRef.current !== 'connected') leaveSession(); }, []);

  const connect = async () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      return { ok: false as const, error: 'Enter your player name' };
    }
    if (!host.trim()) {
      return { ok: false as const, error: 'Enter the host device’s IP address' };
    }

    // Persist confirmed profile so it survives across sessions
    saveProfile({ name: trimmedName, color: playerColor });

    const portNumber = Number(port) || DEFAULT_PORT;
    const joinResult = await joinGame(host.trim(), portNumber);
    if (!joinResult.ok) return joinResult;

    // After connecting and seeding the replica game, check if this player already
    // exists in the host's accounts. If not, submit a player.joined intent.
    const game = useGameStore.getState();
    const existingAccounts = Object.values(game.state.accounts).filter((a) => a.kind === 'player');
    const existingPlayer = existingAccounts.find(
      (a) => a.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (!existingPlayer) {
      const usedColors = new Set(existingAccounts.map((a) => a.color));
      let chosenColor = playerColor;
      if (usedColors.has(chosenColor)) {
        const available = PLAYER_PALETTE.find((c) => !usedColors.has(c));
        if (available) chosenColor = available;
      }

      const account: Account = {
        id: uuid(),
        kind: 'player',
        name: trimmedName,
        color: chosenColor,
        unlimited: false,
        assets: [],
      };

      game.dispatch({
        type: 'player.joined',
        actorId: 'bank',
        intentId: `join-${Date.now()}-${account.id}`,
        payload: { account },
      });
    }

    return { ok: true as const, value: undefined };
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
    connect,
  };
}
