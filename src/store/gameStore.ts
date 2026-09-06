import { create } from 'zustand';
import { GameEvent, GameState, Account, GameConfig } from '../ledger/types';
import { Intent } from '../ledger/intents';
import { applyEvent, fold, initialState } from '../ledger/reducer';
import { KeyValueStorage, MemoryStorage, productionStorage, saveGame, loadGame, inspectGame, saveDraft, loadDraft, listGameIds, lastGameId } from './persistence';
declare const require: (name: string) => any;
const uuid = () => { try { return require('expo-crypto').randomUUID(); } catch { return `game-${Date.now()}-${Math.random()}`; } };

interface ArchiveEntry { id: string; createdAt: number; updatedAt: number; status: 'unfinished' | 'ended' | 'unrecoverable'; players: string[]; winners: string[]; }
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
interface Store { gameId: string | null; state: GameState; storage: KeyValueStorage; dispatch: (intent: Intent) => Result<void>; createGame: (config: GameConfig, accounts: Account[]) => Result<string>; loadGame: (id: string) => Result<{ recovered: number; corrupt: boolean }>; listGames: () => ArchiveEntry[]; saveDraft: (value: unknown) => void; loadDraft: <T>() => T | null; }

declare const process: { env: Record<string, string | undefined> };
const defaultStorage = (): KeyValueStorage => process.env.NODE_ENV === 'test' ? new MemoryStorage() : productionStorage();
export const createGameStore = (storage: KeyValueStorage = defaultStorage()) => create<Store>((set, get) => ({
  gameId: lastGameId(storage) ?? null, state: (() => { const id = lastGameId(storage); return id ? fold(inspectGame(storage, id).events) : initialState(); })(), storage,
  dispatch: intent => { const current = get(); if (!current.gameId) return { ok: false, error: 'No game selected' }; const event = { ...intent, seq: current.state.events.length, ts: Date.now(), intentId: intent.intentId || uuid() } as GameEvent; const next = applyEvent(current.state, event); if (next.invalid) return { ok: false, error: 'Invalid event' }; try { saveGame(storage, current.gameId, next.events); set({ state: next }); return { ok: true, value: undefined }; } catch { return { ok: false, error: 'Could not save game' }; } },
  createGame: (config, accounts) => { const id = uuid(); const event = { type: 'game.started' as const, payload: { config, accounts }, actorId: accounts.find(a => a.kind === 'bank')?.id ?? '', seq: 0, ts: Date.now(), intentId: uuid() }; const state = fold([event]); if (state.invalid || !state.started) return { ok: false, error: 'Invalid game configuration' }; try { saveGame(storage, id, [event]); set({ gameId: id, state }); return { ok: true, value: id }; } catch { return { ok: false, error: 'Could not save game' }; } },
  loadGame: id => { const result = loadGame(storage, id); if (result.unrecoverable) return { ok: false, error: 'Game is unrecoverable' }; try { set({ gameId: id, state: fold(result.events) }); try { storage.set('lastGameId', id); } catch { /* advisory */ } return { ok: true, value: { recovered: result.recovered, corrupt: result.corrupt } }; } catch { return { ok: false, error: 'Could not load game' }; } },
  listGames: () => listGameIds(storage).map(id => { const result = inspectGame(storage, id); const state = fold(result.events); const first = result.events[0]; return { id, createdAt: first?.ts ?? 0, updatedAt: result.events.at(-1)?.ts ?? 0, status: result.unrecoverable ? 'unrecoverable' as const : state.ended ? 'ended' as const : 'unfinished' as const, players: Object.values(state.accounts).filter(a => a.kind === 'player').map(a => a.name), winners: (state.tally ?? []).filter(x => x.rank === 1).map(x => state.accounts[x.playerId]?.name ?? x.playerId) }; }),
  saveDraft: value => { const id = get().gameId; if (id) saveDraft(storage, id, value); },
  loadDraft: <T,>() => { const id = get().gameId; return id ? loadDraft<T>(storage, id) : null; },
}));
export const useGameStore = createGameStore();
