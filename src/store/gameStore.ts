import { create } from 'zustand';
import { GameEvent, GameState, Account, GameConfig } from '../ledger/types';
import { Intent } from '../ledger/intents';
import { applyEvent, fold, initialState } from '../ledger/reducer';
import { KeyValueStorage, MemoryStorage, productionStorage, saveGame, loadGame, inspectGame, saveDraft, loadDraft, listGameIds, lastGameId } from './persistence';
import { Transport } from '../transport/Transport';

declare const require: (name: string) => any;
const uuid = () => { try { return require('expo-crypto').randomUUID(); } catch { return `game-${Date.now()}-${Math.random()}`; } };

interface ArchiveEntry { id: string; createdAt: number; updatedAt: number; status: 'unfinished' | 'ended' | 'unrecoverable'; players: string[]; winners: string[]; }
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Single writer role, per plan.md Section 2. 'single' and 'host' dispatch
 * identically (this device assigns seq); 'client' never assigns seq, it
 * only ever applies events it receives back over the transport.
 */
export type GameRole = 'single' | 'host' | 'client';

/** What a successful dispatch produced, for callers that need it — e.g. HostTransport,
 * which is wired in as the very `dispatch` a host's own screens call, and needs to know
 * whether to broadcast (see attachTransport's `onHostEvent`). Screens ignore this. */
export interface DispatchOutcome { event?: GameEvent; duplicate: boolean }

interface Store {
  gameId: string | null;
  state: GameState;
  storage: KeyValueStorage;
  role: GameRole;
  transport: Transport | null;
  dispatch: (intent: Intent) => Result<DispatchOutcome>;
  createGame: (config: GameConfig, accounts: Account[]) => Result<string>;
  loadGame: (id: string) => Result<{ recovered: number; corrupt: boolean }>;
  /** Seeds a client's local record from a host's `welcome` burst (or a later full resync). */
  createReplicaGame: (gameId: string, events: GameEvent[]) => Result<void>;
  listGames: () => ArchiveEntry[];
  saveDraft: (value: unknown) => void;
  loadDraft: <T>() => T | null;
  /** Wires a transport into this store. 'client' subscribes to pushed events and folds
   * them into local state (never assigns seq). 'host' keeps dispatching locally exactly
   * as 'single' does, but calls `onHostEvent` for every newly-appended (non-duplicate)
   * event so the caller (HostTransport) can broadcast it to connected peers. */
  attachTransport: (transport: Transport, role: 'host' | 'client', onHostEvent?: (event: GameEvent) => void) => void;
  detachTransport: () => void;
}

declare const process: { env: Record<string, string | undefined> };
const defaultStorage = (): KeyValueStorage => process.env.NODE_ENV === 'test' ? new MemoryStorage() : productionStorage();

export const createGameStore = (storage: KeyValueStorage = defaultStorage()) => {
  let unsubscribeTransport: (() => void) | undefined;
  let onHostEvent: ((event: GameEvent) => void) | undefined;

  return create<Store>((set, get) => ({
    gameId: lastGameId(storage) ?? null,
    state: (() => { const id = lastGameId(storage); return id ? fold(inspectGame(storage, id).events) : initialState(); })(),
    storage,
    role: 'single',
    transport: null,

    dispatch: intent => {
      const current = get();
      if (!current.gameId) return { ok: false, error: 'No game selected' };

      if (current.role === 'client') {
        if (!current.transport) return { ok: false, error: 'Not connected to host' };
        // Fire-and-forget: the resulting event (or a host `reject`) arrives back
        // through the subscribed broadcast channel set up in attachTransport, per
        // plan.md Section 2 — clients never apply local/optimistic state, so this
        // dispatch does not wait on or apply the submit() promise itself. Still
        // attach a rejection handler so a network failure doesn't surface as an
        // unhandled promise rejection; the UI simply won't see the balance change.
        current.transport.submit(intent).catch(() => { /* surfaced via connectionStore, not here */ });
        return { ok: true, value: { duplicate: false } };
      }

      // 'single' and 'host': today's exact behavior — this device is the writer.
      const event = { ...intent, seq: current.state.events.length, ts: Date.now(), intentId: intent.intentId || uuid() } as GameEvent;
      const next = applyEvent(current.state, event);
      if (next.invalid) return { ok: false, error: 'Invalid event' };
      const duplicate = next.events.length === current.state.events.length;
      try {
        saveGame(storage, current.gameId, next.events);
        set({ state: next });
        const resultEvent = duplicate ? current.state.events.find(e => e.intentId === event.intentId) : event;
        if (current.role === 'host' && !duplicate && onHostEvent) onHostEvent(event);
        return { ok: true, value: { event: resultEvent, duplicate } };
      } catch {
        return { ok: false, error: 'Could not save game' };
      }
    },

    createGame: (config, accounts) => {
      const id = uuid();
      const event = { type: 'game.started' as const, payload: { config, accounts }, actorId: accounts.find(a => a.kind === 'bank')?.id ?? '', seq: 0, ts: Date.now(), intentId: uuid() };
      const state = fold([event]);
      if (state.invalid || !state.started) return { ok: false, error: 'Invalid game configuration' };
      try { saveGame(storage, id, [event]); set({ gameId: id, state }); return { ok: true, value: id }; } catch { return { ok: false, error: 'Could not save game' }; }
    },

    loadGame: id => {
      const result = loadGame(storage, id);
      if (result.unrecoverable) return { ok: false, error: 'Game is unrecoverable' };
      try {
        set({ gameId: id, state: fold(result.events) });
        try { storage.set('lastGameId', id); } catch { /* advisory */ }
        return { ok: true, value: { recovered: result.recovered, corrupt: result.corrupt } };
      } catch { return { ok: false, error: 'Could not load game' }; }
    },

    createReplicaGame: (gameId, events) => {
      const state = fold(events);
      if (!state.started) return { ok: false, error: 'Invalid game configuration' };
      try {
        saveGame(storage, gameId, events);
        set({ gameId, state });
        try { storage.set('lastGameId', gameId); } catch { /* advisory */ }
        return { ok: true, value: undefined };
      } catch { return { ok: false, error: 'Could not save game' }; }
    },

    listGames: () => listGameIds(storage).map(id => {
      const result = inspectGame(storage, id);
      const state = fold(result.events);
      const first = result.events[0];
      return {
        id,
        createdAt: first?.ts ?? 0,
        updatedAt: result.events.at(-1)?.ts ?? 0,
        status: result.unrecoverable ? 'unrecoverable' as const : state.ended ? 'ended' as const : 'unfinished' as const,
        players: Object.values(state.accounts).filter(a => a.kind === 'player').map(a => a.name),
        winners: (state.tally ?? []).filter(x => x.rank === 1).map(x => state.accounts[x.playerId]?.name ?? x.playerId),
      };
    }),

    saveDraft: value => { const id = get().gameId; if (id) saveDraft(storage, id, value); },
    loadDraft: <T,>() => { const id = get().gameId; return id ? loadDraft<T>(storage, id) : null; },

    attachTransport: (transport, role, hostEventCallback) => {
      unsubscribeTransport?.();
      unsubscribeTransport = undefined;
      onHostEvent = role === 'host' ? hostEventCallback : undefined;
      if (role === 'client') {
        unsubscribeTransport = transport.subscribe(event => {
          const current = get();
          if (!current.gameId) return;
          const next = applyEvent(current.state, event);
          if (next.invalid) return; // malformed/out-of-order push from the host — ignore, per plan.md Section 5.4
          try { saveGame(storage, current.gameId, next.events); } catch { /* best-effort persistence */ }
          set({ state: next });
        });
      }
      set({ role, transport });
    },

    detachTransport: () => {
      unsubscribeTransport?.();
      unsubscribeTransport = undefined;
      onHostEvent = undefined;
      get().transport?.close();
      set({ role: 'single', transport: null });
    },
  }));
};
export const useGameStore = createGameStore();
