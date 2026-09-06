import { create } from 'zustand';
import { GameEvent, GameState, Account, GameConfig } from '../ledger/types';
import { applyEvent, fold, initialState } from '../ledger/reducer';
import { KeyValueStorage, MemoryStorage, productionStorage, saveGame, loadGame, saveDraft, loadDraft, listGameIds } from './persistence';
declare const require: (name: string) => any;
const uuid = () => { try { return require('expo-crypto').randomUUID(); } catch { return `game-${Date.now()}-${Math.random()}`; } };

interface ArchiveEntry { id: string; createdAt: number; updatedAt: number; status: 'unfinished' | 'ended'; players: string[]; winners: string[]; }
interface Store { gameId: string | null; state: GameState; storage: KeyValueStorage; dispatch: (event: GameEvent) => { ok: true } | { ok: false; error: string }; createGame: (config: GameConfig, accounts: Account[]) => string; loadGame: (id: string) => boolean; listGames: () => ArchiveEntry[]; saveDraft: (value: unknown) => void; loadDraft: <T>() => T | null; }

const archiveKey = 'archive';
function archive(storage: KeyValueStorage): ArchiveEntry[] { try { return JSON.parse(storage.getString(archiveKey) ?? '[]') as ArchiveEntry[]; } catch { return []; } }
function updateArchive(storage: KeyValueStorage, entry: ArchiveEntry) { const all = archive(storage).filter(x => x.id !== entry.id); storage.set(archiveKey, JSON.stringify([entry, ...all])); }

declare const process: { env: Record<string, string | undefined> };
const defaultStorage = (): KeyValueStorage => process.env.NODE_ENV === 'test' ? new MemoryStorage() : productionStorage();
export const createGameStore = (storage: KeyValueStorage = defaultStorage()) => create<Store>((set, get) => ({
  gameId: null, state: initialState(), storage,
  dispatch: event => { const current = get(); if (!current.gameId) return { ok: false, error: 'No game selected' }; const next = applyEvent(current.state, event); if (next.invalid) return { ok: false, error: 'Invalid event' }; try { saveGame(storage, current.gameId, next.events); set({ state: next }); return { ok: true }; } catch { return { ok: false, error: 'Could not save game' }; } },
  createGame: (config, accounts) => { const id = uuid(); const event = { type: 'game.started' as const, payload: { config, accounts }, actorId: accounts.find(a => a.kind === 'bank')?.id ?? '', seq: 0, ts: Date.now(), intentId: uuid() }; saveGame(storage, id, [event]); updateArchive(storage, { id, createdAt: event.ts, updatedAt: event.ts, status: 'unfinished', players: accounts.filter(a => a.kind === 'player').map(a => a.name), winners: [] }); set({ gameId: id, state: fold([event]) }); return id; },
  loadGame: id => { const result = loadGame(storage, id); if (result.unrecoverable) return false; set({ gameId: id, state: fold(result.events) }); return true; },
  listGames: () => listGameIds(storage).flatMap(id => { const result = loadGame(storage, id); if (result.unrecoverable) return []; const state = fold(result.events); const first = result.events[0]; return [{ id, createdAt: first?.ts ?? 0, updatedAt: result.events.at(-1)?.ts ?? 0, status: state.ended ? 'ended' as const : 'unfinished' as const, players: Object.values(state.accounts).filter(a => a.kind === 'player').map(a => a.name), winners: (state.tally ?? []).filter(x => x.rank === 1).map(x => state.accounts[x.playerId]?.name ?? x.playerId) }]; }),
  saveDraft: value => { const id = get().gameId; if (id) saveDraft(storage, id, value); },
  loadDraft: <T,>() => { const id = get().gameId; return id ? loadDraft<T>(storage, id) : null; },
}));
export const useGameStore = createGameStore();
