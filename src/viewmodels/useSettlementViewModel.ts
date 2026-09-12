import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useProfileStore } from '../store/profileStore';
import { useConnectionStore } from '../store/connectionStore';
import { activePlayers, balance, finalRankings } from '../ledger/selectors';
import { Settlement, SettlementMode } from '../ledger/types';
import {
  ItemizedPlayerEntry,
  MortgageEntry,
  buildTallyFromSettlements,
  computePlayerSettlement,
  defaultItemizedEntry,
  defaultMortgageName,
} from './settlementCalculations';

declare const require: (name: string) => any;
const uuid = () => {
  try {
    return require('expo-crypto').randomUUID();
  } catch {
    return `settlement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
};

function entryFromSettlement(settlement: Settlement | undefined): ItemizedPlayerEntry {
  return {
    ...defaultItemizedEntry(),
    mortgageEntries: settlement?.rows?.map((row, index) => ({
      id: `${settlement.playerId}-${index}`,
      name: row.name ?? 'Mortgage',
      value: String(row.value),
    })) ?? [],
  };
}

export function useSettlementViewModel() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const role = useConnectionStore((x) => x.role);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);
  const players = activePlayers(state);
  const isHost = role === 'host';

  const [mode, setMode] = useState<SettlementMode>('itemized');
  const [fastValuations, setFastValuations] = useState<Record<string, string>>({});
  const [itemizedEntries, setItemizedEntries] = useState<Record<string, ItemizedPlayerEntry>>({});

  const dismissedPlayers = useMemo(
    () => new Set(Object.entries(state.settlementStatus).filter(([, status]) => status === 'dismissed').map(([id]) => id)),
    [state.settlementStatus]
  );

  const liveTally = useMemo(
    () => buildTallyFromSettlements(state.accounts, state.balances, state.eliminated, state.settlements, dismissedPlayers),
    [state.accounts, state.balances, state.eliminated, state.settlements, dismissedPlayers]
  );

  const finalTally = useMemo(() => finalRankings(state), [state]);
  const allPlayers = useMemo(() => Object.values(state.accounts).filter((a) => a.kind === 'player'), [state.accounts]);

  const setFastValuation = (playerId: string, value: string) => {
    setFastValuations((prev) => ({ ...prev, [playerId]: value }));
  };

  const getItemizedEntry = (playerId: string) => itemizedEntries[playerId] ?? entryFromSettlement(state.settlements[playerId]);

  const ensureEntry = (playerId: string) => {
    setItemizedEntries((prev) => {
      if (prev[playerId]) return prev;
      return { ...prev, [playerId]: entryFromSettlement(state.settlements[playerId]) };
    });
  };

  const setItemizedField = (playerId: string, field: keyof ItemizedPlayerEntry, value: string) => {
    setItemizedEntries((prev) => ({
      ...prev,
      [playerId]: { ...getItemizedEntry(playerId), [field]: value },
    }));
  };

  const addMortgage = (playerId: string) => {
    const entry = getItemizedEntry(playerId);
    const existingCount = entry.mortgageEntries?.length ?? 0;
    setItemizedEntries((prev) => ({
      ...prev,
      [playerId]: {
        ...entry,
        mortgageEntries: [
          ...(entry.mortgageEntries ?? []),
          { id: `${playerId}-${Date.now()}-${Math.random()}`, name: defaultMortgageName(existingCount), value: '' },
        ],
      },
    }));
  };

  const updateMortgage = (playerId: string, mortgageId: string, field: keyof MortgageEntry, value: string) => {
    const entry = getItemizedEntry(playerId);
    setItemizedEntries((prev) => ({
      ...prev,
      [playerId]: {
        ...entry,
        mortgageEntries: (entry.mortgageEntries ?? []).map((mortgage) => (
          mortgage.id === mortgageId ? { ...mortgage, [field]: value } : mortgage
        )),
      },
    }));
  };

  const removeMortgage = (playerId: string, mortgageId: string) => {
    const entry = getItemizedEntry(playerId);
    setItemizedEntries((prev) => ({
      ...prev,
      [playerId]: {
        ...entry,
        mortgageEntries: (entry.mortgageEntries ?? []).filter((mortgage) => mortgage.id !== mortgageId),
      },
    }));
  };

  const getPlayerSummary = (playerId: string) => {
    const cash = balance(state, playerId);
    const item = liveTally.find((tally) => tally.playerId === playerId);
    return {
      cash,
      assetTotal: item?.assetTotal ?? 0,
      netWorth: item?.netWorth ?? cash,
      rank: item?.rank ?? 1,
    };
  };

  const buildSettlement = (playerId: string): Settlement => {
    const cash = balance(state, playerId);
    const calculated = computePlayerSettlement(playerId, cash, mode, fastValuations[playerId], getItemizedEntry(playerId));
    return {
      playerId,
      mode,
      rows: calculated.rows,
      valuation: calculated.valuation,
      cash,
      assetTotal: calculated.assetTotal,
      netWorth: calculated.netWorth,
    };
  };

  const startSettlement = () => {
    if (!isHost || state.settlementStarted || !state.hostAccountId) return { ok: false as const, error: 'Only the Host can start settlement' };
    return dispatch({
      type: 'settlement.started',
      actorId: state.hostAccountId,
      intentId: uuid(),
      payload: { participantIds: players.map((player) => player.id) },
    });
  };

  const submitSettlement = (playerId = myAccount?.id ?? '', asHost = false) => {
    if (!playerId || (!myAccount && !asHost)) return { ok: false as const, error: 'Player profile not found' };
    return dispatch({
      type: 'settlement.submitted',
      actorId: asHost ? state.hostAccountId ?? '' : playerId,
      intentId: uuid(),
      payload: { playerId, settlement: buildSettlement(playerId) },
    });
  };

  const dismissPlayer = (playerId: string) => {
    if (!isHost || !state.hostAccountId) return { ok: false as const, error: 'Only the Host can dismiss a player' };
    return dispatch({
      type: 'settlement.dismissed',
      actorId: state.hostAccountId,
      intentId: uuid(),
      payload: { playerId },
    });
  };

  const finalizeGame = () => {
    if (!isHost || !state.hostAccountId) return { ok: false as const, error: 'Only the Host can finalize the game' };
    const tally = buildTallyFromSettlements(state.accounts, state.balances, state.eliminated, state.settlements, dismissedPlayers);
    return dispatch({ type: 'game.ended', actorId: state.hostAccountId, intentId: uuid(), payload: { tally } });
  };

  const canFinalize = players.every((player) => {
    const status = state.settlementStatus[player.id];
    return status === 'submitted' || status === 'dismissed';
  });

  return {
    mode,
    setMode,
    players,
    allPlayers,
    finalTally,
    myAccount,
    isHost,
    isSettlementStarted: state.settlementStarted,
    isGameEnded: state.ended,
    settlementStatus: state.settlementStatus,
    settlements: state.settlements,
    fastValuations,
    setFastValuation,
    itemizedEntries,
    ensureEntry,
    getItemizedEntry,
    setItemizedField,
    addMortgage,
    updateMortgage,
    removeMortgage,
    getPlayerSummary,
    buildSettlement,
    startSettlement,
    submitSettlement,
    dismissPlayer,
    finalizeGame,
    canFinalize,
    currencySymbol: state.config?.currencySymbol ?? '$',
  };
}
