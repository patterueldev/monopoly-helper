import { GameEvent, GameState, TransferReason, Payload, EventType } from './types';

export interface EventWriter { now(): number; id(): string; }
export const defaultWriter: EventWriter = { now: () => 0, id: () => 'unassigned-intent' };
export type Intent = { type: EventType; payload: Payload[EventType]; actorId: string };
export function assign<T extends EventType>(intent: { type: T; payload: Payload[T]; actorId: string }, seq: number, writer: EventWriter = defaultWriter): GameEvent<T> { return { ...intent, seq, ts: writer.now(), intentId: writer.id() } as GameEvent<T>; }
export function buildTransfer(_state: GameState, from: string, to: string, amount: number, reason: TransferReason, seq: number, writer?: EventWriter): GameEvent<'transfer'> { return assign({ type: 'transfer', payload: { from, to, amount, reason }, actorId: from }, seq, writer); }
export function canTransfer(state: GameState, from: string, to: string, amount: number): boolean { return !state.ended && from !== to && amount > 0 && Number.isSafeInteger(amount) && !!state.accounts[from] && !!state.accounts[to] && !state.eliminated.has(from) && !state.eliminated.has(to); }
export function makeEvent<T extends EventType>(type: T, payload: Payload[T], actorId: string, seq: number, intentId?: string): GameEvent<T> { return { type, payload, actorId, seq, ts: 0, intentId: intentId ?? `${seq}-intent` } as GameEvent<T>; }
