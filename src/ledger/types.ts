import { z } from 'zod';

export type AccountKind = 'player' | 'bank' | 'pot';
export interface Account { id: string; kind: AccountKind; name: string; color: string; unlimited: boolean; assets: unknown[]; }
export interface GameConfig { startingCash: number; goSalary: number; doubleOnExactGo: boolean; freeParkingPot: boolean; bankerMode: boolean; currencySymbol: string; quickAmounts: number[]; }
export const DEFAULT_QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500];
export type TransferReason = { kind: 'go' | 'rent' | 'buy' | 'tax' | 'card' | 'trade' | 'station' } | { kind: 'other'; note?: string };
export type SettlementMode = 'fast' | 'itemized';
export interface SettlementRow { kind: 'property' | 'houses' | 'hotels' | 'mortgage'; name?: string; value: number; quantity?: number; }
export interface Settlement { playerId: string; mode: SettlementMode; rows?: SettlementRow[]; valuation: number; cash: number; assetTotal: number; netWorth: number; rank?: number; }
export type EventType = 'game.started' | 'players.reordered' | 'game.begun' | 'player.joined' | 'player.renamed' | 'transfer' | 'transfer.reversed' | 'player.eliminated' | 'settlement.started' | 'settlement.submitted' | 'settlement.dismissed' | 'game.ended' | 'turn.advanced' | 'player.jailed' | 'player.released' | 'request.created' | 'request.resolved';
export type SettlementStatus = 'pending' | 'submitted' | 'dismissed';
/** A payment request: `from` owes/pays, `to` receives (a player account, or the
 * Bank when the Banker collects on the Bank's behalf). Money moves only when the
 * payer approves (request.resolved with outcome 'paid'), atomically in that event. */
export interface TransferRequest { id: string; from: string; to: string; amount: number; reason: TransferReason; createdBy: string; createdSeq: number; status: 'pending' | 'paid' | 'declined' | 'cancelled'; resolvedSeq?: number; }
export type RequestOutcome = 'paid' | 'declined' | 'cancelled';
export type Payload = {
  'game.started': { config: GameConfig; accounts: Account[]; hostAccountId?: string };
  'players.reordered': { playerIds: string[] };
  'game.begun': Record<string, never>;
  'player.joined': { account: Account };
  'player.renamed': { accountId: string; name: string; color: string };
  transfer: { from: string; to: string; amount: number; reason: TransferReason };
  'transfer.reversed': { targetSeq: number };
  'player.eliminated': { accountId: string; creditorId: string | null };
  'settlement.started': { participantIds: string[] };
  'settlement.submitted': { playerId: string; settlement: Settlement };
  'settlement.dismissed': { playerId: string };
  'game.ended': { tally: Settlement[] };
  'turn.advanced': { toAccountId: string };
  'player.jailed': { accountId: string };
  'player.released': { accountId: string };
  'request.created': { requestId: string; from: string; to: string; amount: number; reason: TransferReason };
  'request.resolved': { requestId: string; outcome: RequestOutcome };
};
export type GameEvent<T extends EventType = EventType> = { [K in T]: { seq: number; ts: number; actorId: string; intentId: string; type: K; payload: Payload[K] } }[T];
export interface GameState { started: boolean; gameStarted: boolean; ended: boolean; config?: GameConfig; accounts: Record<string, Account>; balances: Record<string, number>; eliminated: Set<string>; reversed: Set<number>; events: GameEvent[]; tally?: Settlement[]; settlements: Record<string, Settlement>; settlementStatus: Record<string, SettlementStatus>; settlementStarted: boolean; hostAccountId?: string; lastPayer?: string; currentTurnAccountId?: string; jailed: Set<string>; lostInCirculation: number; requests: Record<string, TransferRequest>; invalid: boolean; }
export const DEFAULT_CONFIG: GameConfig = { startingCash: 1500, goSalary: 200, doubleOnExactGo: false, freeParkingPot: false, bankerMode: true, currencySymbol: '$', quickAmounts: DEFAULT_QUICK_AMOUNTS };
const reason = z.discriminatedUnion('kind', [z.object({ kind: z.enum(['go','rent','buy','tax','card','trade','station']) }), z.object({ kind: z.literal('other'), note: z.string().optional() })]);
export const accountSchema = z.object({ id: z.string().min(1), kind: z.enum(['player','bank','pot']), name: z.string().min(1), color: z.string().min(1), unlimited: z.boolean(), assets: z.array(z.unknown()) });
export const configSchema = z.object({ startingCash: z.number().int().nonnegative(), goSalary: z.number().int().nonnegative(), doubleOnExactGo: z.boolean(), freeParkingPot: z.boolean(), bankerMode: z.boolean(), currencySymbol: z.string().min(1), quickAmounts: z.array(z.number().int().positive()) });
export const settlementRowSchema = z.object({ kind: z.enum(['property','houses','hotels','mortgage']), name: z.string().trim().min(1).optional(), value: z.number().int().nonnegative(), quantity: z.number().int().nonnegative().optional() });
export const settlementSchema = z.object({ playerId: z.string(), mode: z.enum(['fast','itemized']), rows: z.array(settlementRowSchema).optional(), valuation: z.number().int(), cash: z.number().int(), assetTotal: z.number().int(), netWorth: z.number().int(), rank: z.number().int().positive().optional() });
export const payloadSchemas = {
  'game.started': z.object({ config: configSchema, accounts: z.array(accountSchema), hostAccountId: z.string().optional() }),
  'players.reordered': z.object({ playerIds: z.array(z.string().min(1)).min(1) }),
  'game.begun': z.object({}),
  'player.joined': z.object({ account: accountSchema }),
  'player.renamed': z.object({ accountId: z.string(), name: z.string().min(1), color: z.string().min(1) }),
  transfer: z.object({ from: z.string(), to: z.string(), amount: z.number().int().positive().safe(), reason }),
  'transfer.reversed': z.object({ targetSeq: z.number().int().nonnegative() }),
  'player.eliminated': z.object({ accountId: z.string(), creditorId: z.string().nullable() }),
  'settlement.started': z.object({ participantIds: z.array(z.string().min(1)).min(1) }),
  'settlement.submitted': z.object({ playerId: z.string().min(1), settlement: settlementSchema }),
  'settlement.dismissed': z.object({ playerId: z.string().min(1) }),
  'game.ended': z.object({ tally: z.array(settlementSchema) }),
  'turn.advanced': z.object({ toAccountId: z.string().min(1) }),
  'player.jailed': z.object({ accountId: z.string().min(1) }),
  'player.released': z.object({ accountId: z.string().min(1) }),
  'request.created': z.object({ requestId: z.string().min(1), from: z.string().min(1), to: z.string().min(1), amount: z.number().int().positive().safe(), reason }),
  'request.resolved': z.object({ requestId: z.string().min(1), outcome: z.enum(['paid', 'declined', 'cancelled']) }),
} as const;
export function parseEvent(input: unknown): GameEvent | null { if (!input || typeof input !== 'object') return null; const raw = input as any; if (!Object.prototype.hasOwnProperty.call(payloadSchemas, raw.type)) return null; const schema = payloadSchemas[raw.type as EventType]; const base = z.object({ seq: z.number().int().nonnegative(), ts: z.number().finite(), actorId: z.string(), intentId: z.string().min(1), type: z.string(), payload: schema }); const parsed = base.safeParse(input); return parsed.success ? parsed.data as GameEvent : null; }
