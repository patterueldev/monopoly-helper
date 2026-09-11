import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { activePlayers, balance } from '../ledger/selectors';
import { SettlementMode } from '../ledger/types';
import {
  ItemizedPlayerEntry,
  defaultItemizedEntry,
  buildFinalTally,
} from './settlementCalculations';

declare const require: (name: string) => any;
const uuid = () => {
  try {
    return require('expo-crypto').randomUUID();
  } catch {
    return `end-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
};

export function useSettlementViewModel() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const players = activePlayers(state);

  const [mode, setMode] = useState<SettlementMode>('itemized');
  const [fastValuations, setFastValuations] = useState<Record<string, string>>({});
  const [itemizedEntries, setItemizedEntries] = useState<Record<string, ItemizedPlayerEntry>>({});

  const setFastValuation = (playerId: string, value: string) => {
    setFastValuations((prev) => ({ ...prev, [playerId]: value }));
  };

  const setItemizedField = (
    playerId: string,
    field: keyof ItemizedPlayerEntry,
    value: string
  ) => {
    setItemizedEntries((prev) => {
      const current = prev[playerId] ?? defaultItemizedEntry();
      return {
        ...prev,
        [playerId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  // Live calculated tally and ranks for all players
  const liveTally = useMemo(() => {
    return buildFinalTally(
      state.accounts,
      state.balances,
      state.eliminated,
      mode,
      fastValuations,
      itemizedEntries
    );
  }, [state.accounts, state.balances, state.eliminated, mode, fastValuations, itemizedEntries]);

  const getPlayerSummary = (playerId: string) => {
    const cash = balance(state, playerId);
    const item = liveTally.find((t) => t.playerId === playerId);
    return {
      cash,
      assetTotal: item?.assetTotal ?? 0,
      netWorth: item?.netWorth ?? cash,
      rank: item?.rank ?? 1,
    };
  };

  const endGame = () => {
    const tally = buildFinalTally(
      state.accounts,
      state.balances,
      state.eliminated,
      mode,
      fastValuations,
      itemizedEntries
    );
    return dispatch({
      type: 'game.ended',
      actorId: 'bank',
      intentId: uuid(),
      payload: { tally },
    });
  };

  return {
    mode,
    setMode,
    players,
    fastValuations,
    setFastValuation,
    itemizedEntries,
    setItemizedField,
    getPlayerSummary,
    currencySymbol: state.config?.currencySymbol ?? '$',
    endGame,
  };
}
