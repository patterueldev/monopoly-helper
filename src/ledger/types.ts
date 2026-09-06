import { z } from 'zod';

export type AccountKind = 'player' | 'bank' | 'pot';
export interface Account { id: string; kind: AccountKind; name: string; color: string; unlimited: boolean; assets: unknown[]; }
export interface GameConfig { startingCash: number; goSalary: number; doubleOnExactGo: boolean; freeParkingPot: boolean; bankerMode: boolean; currencySymbol: string; quickAmounts: number[]; }
export type TransferReason = { kind: 'go' | 'rent' | 'buy' | 'tax' | 'card' | 'trade' } | { kind: 'other'; note?: string };
export type SettlementMode = 'fast' | 'itemized';
export interface SettlementRow { kind: 'property' | 'houses' | 'hotels' | 'mortgage'; value: number; quantity?: number; }
export interface Settlement { playerId: string; mode: SettlementMode; rows?: SettlementRow[]; valuation: number; cash: number; assetTotal: number; netWorth: number; rank?: number; }
export type EventType = 'game.started' | 'player.joined' | 'player.renamed' | 'transfer' | 'transfer.reversed' | 'player.eliminated' | 'game.ended';
export type Payload = {
  'game.started': { config: GameConfig; accounts: Account[] };
  'player.joined': { account: Account };
  'player.renamed': { accountId: string; name: string; color: string };
  transfer: { from: string; to: string; amount: number; reason: TransferReason };
  'transfer.reversed': { targetSeq: number };
  'player.eliminated': { accountId: string; creditorId: string | null };
  'game.ended': { tally: Settlement[] };
};
export type GameEvent<T extends EventType = EventType> = { [K in T]: { seq: number; ts: number; actorId: string; intentId: string; type: K; payload: Payload[K] } }[T];
export interface GameState { started: boolean; ended: boolean; config?: GameConfig; accounts: Record<string, Account>; balances: Record<string, number>; eliminated: Set<string>; reversed: Set<number>; events: GameEvent[]; tally?: Settlement[]; lastPayer?: string; invalid: boolean; }
export const DEFAULT_CONFIG: GameConfig = { startingCash: 1500, goSalary: 200, doubleOnExactGo: false, freeParkingPot: false, bankerMode: true, currencySymbol: '$', quickAmounts: [50, 100, 200, 500] };
const reason = z.discriminatedUnion('kind', [z.object({ kind: z.enum(['go','rent','buy','tax','card','trade']) }), z.object({ kind: z.literal('other'), note: z.string().optional() })]);
export const accountSchema = z.object({ id: z.string().min(1), kind: z.enum(['player','bank','pot']), name: z.string().min(1), color: z.string().min(1), unlimited: z.boolean(), assets: z.array(z.unknown()) });
export const configSchema = z.object({ startingCash: z.number().int().nonnegative(), goSalary: z.number().int().nonnegative(), doubleOnExactGo: z.boolean(), freeParkingPot: z.boolean(), bankerMode: z.boolean(), currencySymbol: z.string().min(1), quickAmounts: z.array(z.number().int().positive()) });
export const settlementRowSchema = z.object({ kind: z.enum(['property','houses','hotels','mortgage']), value: z.number().int().nonnegative(), quantity: z.number().int().nonnegative().optional() });
export const settlementSchema = z.object({ playerId: z.string(), mode: z.enum(['fast','itemized']), rows: z.array(settlementRowSchema).optional(), valuation: z.number().int(), cash: z.number().int(), assetTotal: z.number().int(), netWorth: z.number().int(), rank: z.number().int().positive().optional() });
export const payloadSchemas = {
  'game.started': z.object({ config: configSchema, accounts: z.array(accountSchema) }),
  'player.joined': z.object({ account: accountSchema }),
  'player.renamed': z.object({ accountId: z.string(), name: z.string().min(1), color: z.string().min(1) }),
  transfer: z.object({ from: z.string(), to: z.string(), amount: z.number().int().positive().safe(), reason }),
  'transfer.reversed': z.object({ targetSeq: z.number().int().nonnegative() }),
  'player.eliminated': z.object({ accountId: z.string(), creditorId: z.string().nullable() }),
  'game.ended': z.object({ tally: z.array(settlementSchema) }),
} as const;
export function parseEvent(input: unknown): GameEvent | null { if (!input || typeof input !== 'object') return null; const raw = input as any; if (!Object.prototype.hasOwnProperty.call(payloadSchemas, raw.type)) return null; const schema = payloadSchemas[raw.type as EventType]; const base = z.object({ seq: z.number().int().nonnegative(), ts: z.number().finite(), actorId: z.string(), intentId: z.string().min(1), type: z.string(), payload: schema }); const parsed = base.safeParse(input); return parsed.success ? parsed.data as GameEvent : null; }
