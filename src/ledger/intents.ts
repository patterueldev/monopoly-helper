import { GameEvent, GameState, TransferReason, Payload, EventType } from './types';

export interface EventWriter { now(): number; id(): string; }
export type Intent = { [K in EventType]: { type: K; payload: Payload[K]; actorId: string; intentId: string } }[EventType];
export function assign<T extends EventType>(intent: { type: T; payload: Payload[T]; actorId: string; intentId: string }, seq: number, writer: EventWriter): GameEvent<T> { return { ...intent, seq, ts: writer.now(), intentId: intent.intentId || writer.id() } as GameEvent<T>; }
export function buildTransfer(_state: GameState, from: string, to: string, amount: number, reason: TransferReason, seq: number): Intent { return { type: 'transfer', payload: { from, to, amount, reason }, actorId: from, intentId: `transfer-${seq}-${from}-${to}` }; }
export function canTransfer(state: GameState, from: string, to: string, amount: number): boolean { return !state.ended && from !== to && amount > 0 && Number.isSafeInteger(amount) && !!state.accounts[from] && !!state.accounts[to] && !state.eliminated.has(from) && !state.eliminated.has(to); }
export function makeEvent<T extends EventType>(type: T, payload: Payload[T], actorId: string, seq: number, intentId?: string): GameEvent<T> { return { type, payload, actorId, seq, ts: 0, intentId: intentId ?? `${seq}-intent` } as GameEvent<T>; }
export function asIntent<T extends EventType>(event: GameEvent<T>): Intent { return { type: event.type, payload: event.payload, actorId: event.actorId, intentId: event.intentId } as Intent; }
