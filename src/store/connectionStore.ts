import { create } from 'zustand';
import { GameEvent } from '../ledger/types';
import { useGameStore, createGameStore } from './gameStore';
import { HostTransport } from '../transport/HostTransport';
import { ClientTransport, ConnectionState } from '../transport/ClientTransport';
import { DEFAULT_PORT } from '../transport/wireProtocol';

declare const require: (name: string) => any;
const uuid = () => { try { return require('expo-crypto').randomUUID(); } catch { return `device-${Date.now()}-${Math.random()}`; } };

/** Displayed connection status, spanning both roles — plan §4: "the single
 * place that knows whether this device is hosting, joining, or solo, and
 * what the socket status is." 'idle' is the pre-session default. */
export type SessionStatus = 'idle' | 'listening' | ConnectionState | 'error';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type GameStoreApi = typeof useGameStore;

interface ConnectionStore {
  role: 'single' | 'host' | 'client';
  status: SessionStatus;
  peerCount: number;
  lastError: string | null;
  hostGame: (port?: number) => Promise<Result<void>>;
  joinGame: (host: string, port?: number) => Promise<Result<void>>;
  leaveSession: () => void;
}

/** `store` defaults to the app-wide singleton but is injectable for tests. */
export const createConnectionStore = (store: GameStoreApi = useGameStore) => {
  let hostTransport: HostTransport | null = null;
  let clientTransport: ClientTransport | null = null;
  let peerPollTimer: ReturnType<typeof setInterval> | null = null;

  const stopPeerPoll = () => { if (peerPollTimer) clearInterval(peerPollTimer); peerPollTimer = null; };

  return create<ConnectionStore>((set, get) => ({
    role: 'single',
    status: 'idle',
    peerCount: 0,
    lastError: null,

    hostGame: async (port = DEFAULT_PORT) => {
      const game = store.getState();
      if (!game.gameId) return { ok: false, error: 'No game to host' };
      const transport = new HostTransport({
        gameId: game.gameId,
        dispatch: intent => store.getState().dispatch(intent),
        eventsAfter: sinceSeq => store.getState().state.events.filter(e => e.seq >= sinceSeq),
      });
      try {
        await transport.listen(port);
      } catch {
        set({ status: 'error', lastError: "Couldn't start hosting" });
        return { ok: false, error: "Couldn't start hosting" };
      }
      hostTransport = transport;
      store.getState().attachTransport(transport, 'host', { onHostEvent: (event: GameEvent) => transport.broadcastEvent(event) });
      set({ role: 'host', status: 'listening', peerCount: transport.connectedPeerCount, lastError: null });
      peerPollTimer = setInterval(() => set({ peerCount: transport.connectedPeerCount }), 2000);
      return { ok: true, value: undefined };
    },

    joinGame: async (host, port = DEFAULT_PORT) => {
      const transport = new ClientTransport();
      transport.onConnectionStateChange(state => {
        set({ status: state });
        if (state === 'disconnected') set({ lastError: 'Lost connection to host' });
      });
      set({ status: 'connecting', lastError: null });
      try {
        const welcome = await transport.connect(host, port, uuid(), 0);
        const seeded = store.getState().createReplicaGame(welcome.gameId, welcome.events);
        if (!seeded.ok) { transport.close(); set({ status: 'error', lastError: seeded.error }); return seeded; }
        clientTransport = transport;
        store.getState().attachTransport(transport, 'client', { isConnected: () => transport.connectionState === 'connected' });
        set({ role: 'client', status: 'connected', lastError: null });
        return { ok: true, value: undefined };
      } catch (error) {
        transport.close();
        const message = error instanceof Error ? error.message : 'Could not connect';
        set({ status: 'error', lastError: message });
        return { ok: false, error: message };
      }
    },

    leaveSession: () => {
      stopPeerPoll();
      store.getState().detachTransport();
      hostTransport = null;
      clientTransport = null;
      set({ role: 'single', status: 'idle', peerCount: 0, lastError: null });
    },
  }));
};

export const useConnectionStore = createConnectionStore();
