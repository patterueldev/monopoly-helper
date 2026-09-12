import { Account, Settlement, SettlementMode, SettlementRow } from '../ledger/types';

export interface ItemizedPlayerEntry {
  properties?: string;
  housesCount?: string;
  housesCost?: string;
  hotelsCount?: string;
  hotelsCost?: string;
  mortgages?: string;
  mortgageEntries?: MortgageEntry[];
}

export interface MortgageEntry {
  id: string;
  name: string;
  value: string;
}

export const defaultItemizedEntry = (): ItemizedPlayerEntry => ({
  properties: '',
  housesCount: '',
  housesCost: '',
  hotelsCount: '',
  hotelsCost: '',
  mortgages: '',
  mortgageEntries: [],
});

/** Auto-fill name for a newly added mortgage row; numbering follows the current
 * row count and the name stays editable. */
export function defaultMortgageName(existingCount: number): string {
  return `Asset #${existingCount + 1}`;
}

export function parseNonNegativeInt(input: string | undefined): number {
  if (!input) return 0;
  const num = Math.floor(Number(input.trim()));
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function buildItemizedRows(entry: ItemizedPlayerEntry): SettlementRow[] {
  if (entry.mortgageEntries) {
    return entry.mortgageEntries.flatMap((mortgage) => {
      const value = parseNonNegativeInt(mortgage.value);
      const name = mortgage.name.trim();
      return value > 0 && name ? [{ kind: 'mortgage' as const, name, value }] : [];
    });
  }

  const rows: SettlementRow[] = [];

  const propertyVal = parseNonNegativeInt(entry.properties);
  if (propertyVal > 0) {
    rows.push({ kind: 'property', value: propertyVal });
  }

  const houseCount = parseNonNegativeInt(entry.housesCount);
  const houseCost = parseNonNegativeInt(entry.housesCost);
  if (houseCount > 0 && houseCost > 0) {
    rows.push({ kind: 'houses', value: houseCost, quantity: houseCount });
  } else if (houseCost > 0) {
    rows.push({ kind: 'houses', value: houseCost, quantity: 1 });
  }

  const hotelCount = parseNonNegativeInt(entry.hotelsCount);
  const hotelCost = parseNonNegativeInt(entry.hotelsCost);
  if (hotelCount > 0 && hotelCost > 0) {
    rows.push({ kind: 'hotels', value: hotelCost, quantity: hotelCount });
  } else if (hotelCost > 0) {
    rows.push({ kind: 'hotels', value: hotelCost, quantity: 1 });
  }

  const mortgageVal = parseNonNegativeInt(entry.mortgages);
  if (mortgageVal > 0) {
    rows.push({ kind: 'mortgage', value: mortgageVal });
  }

  return rows;
}

export function computeItemizedAssetTotal(rows: SettlementRow[]): number {
  if (rows.length === 0 || rows.every((row) => row.kind === 'mortgage' && !!row.name)) {
    return rows.reduce((sum, row) => sum + row.value, 0);
  }

  return rows.reduce(
    (sum, r) =>
      sum +
      (r.kind === 'mortgage'
        ? -r.value
        : r.kind === 'property'
        ? r.value
        : r.value * (r.quantity ?? 1)),
    0
  );
}

export function computePlayerSettlement(
  playerId: string,
  cash: number,
  mode: SettlementMode,
  fastValuation: string | undefined,
  itemizedEntry: ItemizedPlayerEntry | undefined
): { valuation: number; assetTotal: number; netWorth: number; rows?: SettlementRow[] } {
  if (mode === 'fast') {
    const valuation = parseNonNegativeInt(fastValuation);
    return {
      valuation,
      assetTotal: valuation,
      netWorth: cash + valuation,
    };
  }

  const rows = buildItemizedRows(itemizedEntry ?? defaultItemizedEntry());
  const assetTotal = computeItemizedAssetTotal(rows);
  return {
    valuation: assetTotal,
    assetTotal,
    netWorth: cash + assetTotal,
    rows,
  };
}

export function buildFinalTally(
  accounts: Record<string, Account>,
  balances: Record<string, number>,
  eliminated: Set<string>,
  mode: SettlementMode,
  fastValuations: Record<string, string>,
  itemizedEntries: Record<string, ItemizedPlayerEntry>
): Settlement[] {
  const players = Object.values(accounts).filter((a) => a.kind === 'player');

  const settlements = players
    .filter((p) => !eliminated.has(p.id))
    .map((p) => {
      const cash = balances[p.id] ?? 0;
      const comp = computePlayerSettlement(
        p.id,
        cash,
        mode,
        fastValuations[p.id],
        itemizedEntries[p.id]
      );
      return {
        playerId: p.id,
        mode,
        rows: comp.rows,
        valuation: comp.valuation,
        cash,
        assetTotal: comp.assetTotal,
        netWorth: comp.netWorth,
      };
    });

  return rankSettlements(players, eliminated, settlements);
}

export function buildTallyFromSettlements(
  accounts: Record<string, Account>,
  balances: Record<string, number>,
  eliminated: Set<string>,
  submitted: Record<string, Settlement>,
  dismissed: Set<string>
): Settlement[] {
  const players = Object.values(accounts).filter((a) => a.kind === 'player');
  const settlements = players
    .filter((p) => !eliminated.has(p.id))
    .map((p) => {
      const existing = submitted[p.id];
      if (existing) {
        const cash = balances[p.id] ?? 0;
        return { ...existing, cash, netWorth: cash + existing.assetTotal };
      }
      if (dismissed.has(p.id)) {
        const cash = balances[p.id] ?? 0;
        return { playerId: p.id, mode: 'itemized' as const, rows: [], valuation: 0, cash, assetTotal: 0, netWorth: cash };
      }
      return { playerId: p.id, mode: 'itemized' as const, rows: [], valuation: 0, cash: balances[p.id] ?? 0, assetTotal: 0, netWorth: balances[p.id] ?? 0 };
    });

  return rankSettlements(players, eliminated, settlements);
}

function rankSettlements(
  players: Account[],
  eliminated: Set<string>,
  activeSettlements: Settlement[]
): Settlement[] {

  const sorted = [...activeSettlements].sort((a, b) => b.netWorth - a.netWorth);

  const rankedActive: Array<typeof sorted[number] & { rank: number }> = [];
  sorted.forEach((item, i) => {
    const rank =
      i === 0 || rankedActive[i - 1].netWorth !== item.netWorth
        ? i + 1
        : rankedActive[i - 1].rank;
    rankedActive.push({ ...item, rank });
  });

  return players.map((p) => {
    if (eliminated.has(p.id)) {
      return {
        playerId: p.id,
        mode: activeSettlements[0]?.mode ?? 'itemized',
        valuation: 0,
        cash: 0,
        assetTotal: 0,
        netWorth: 0,
        rank: undefined,
      };
    }
    return rankedActive.find((r) => r.playerId === p.id)!;
  });
}
