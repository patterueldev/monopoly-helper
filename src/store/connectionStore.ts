import { create } from 'zustand';
import { GameEvent } from '../ledger/types';
import { useGameStore, createGameStore } from './gameStore';
import { HostTransport } from '../transport/HostTransport';
import { ClientTransport, ConnectionState } from '../transport/ClientTransport';
import { DEFAULT_PORT } from '../transport/wireProtocol';
import {
  ConnectionSocketOptions,
  buildConnectionSocketOptions,
  currentPlatform,
} from '../transport/socketOptions';
import { classifyConnectError } from '../transport/connectErrors';
import { HandleInboundContext } from '../transport/hostInbound';
import { log } from '../diagnostics/logBuffer';
import { clearLastHostGameId, saveLastHostGameId } from './persistence';

declare const require: (name: string) => any;
const uuid = () => { try { return require('expo-crypto').randomUUID(); } catch { return `device-${Date.now()}-${Math.random()}`; } };
const readLocalIp = async (): Promise<string | null> => {
  try {
    return await require('expo-network').getIpAddressAsync();
  } catch {
    return null;
  }
};

/** Attempts per join: pinned dials first (Android Wi-Fi, issue #51), then one
 * unpinned fallback in case the pin itself is the problem. */
const MAX_JOIN_ATTEMPTS = 3;

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
  /** How the last successful join dialed: 'wifi-pinned', 'unpinned-fallback',
   * 'default', or null when never joined. Shown in diagnostics reports. */
  lastSocketSummary: string | null;
  hostGame: (port?: number) => Promise<Result<void>>;
  joinGame: (host: string, port?: number) => Promise<Result<void>>;
  leaveSession: () => void;
}

/** Injectable transport constructors — production defaults, fakes in tests. */
export interface ConnectionTransports {
  createHostTransport?: (ctx: HandleInboundContext) => HostTransport;
  createClientTransport?: () => ClientTransport;
}

/** `store` defaults to the app-wide singleton but is injectable for tests. */
export const createConnectionStore = (store: GameStoreApi = useGameStore, transports: ConnectionTransports = {}) => {
  const newHostTransport = transports.createHostTransport ?? ((ctx: HandleInboundContext) => new HostTransport(ctx));
  const newClientTransport = transports.createClientTransport ?? (() => new ClientTransport());
  let hostTransport: HostTransport | null = null;
  let clientTransport: ClientTransport | null = null;
  let peerPollTimer: ReturnType<typeof setInterval> | null = null;

  const stopPeerPoll = () => { if (peerPollTimer) clearInterval(peerPollTimer); peerPollTimer = null; };

  return create<ConnectionStore>((set, get) => ({
    role: 'single',
    status: 'idle',
    peerCount: 0,
    lastError: null,
    lastSocketSummary: null,

    hostGame: async (port = DEFAULT_PORT) => {
      const game = store.getState();
      if (!game.gameId) return { ok: false, error: 'No game to host' };

      if (hostTransport) {
        hostTransport.close();
        hostTransport = null;
      }
      if (clientTransport) {
        clientTransport.close();
        clientTransport = null;
      }
      stopPeerPoll();

      const transport = newHostTransport({
        gameId: game.gameId,
        dispatch: intent => store.getState().dispatch(intent),
        eventsAfter: sinceSeq => store.getState().state.events.filter(e => e.seq >= sinceSeq),
      });
      try {
        await transport.listen(port);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't start hosting";
        log('session', 'error', 'failed to start hosting', message);
        set({ status: 'error', lastError: message });
        return { ok: false, error: message };
      }
      hostTransport = transport;
      saveLastHostGameId(game.storage, game.gameId);
      log('session', 'info', `hosting on port ${port}`);
      store.getState().attachTransport(transport, 'host', { onHostEvent: (event: GameEvent) => transport.broadcastEvent(event) });
      set({ role: 'host', status: 'listening', peerCount: transport.connectedPeerCount, lastError: null });
      peerPollTimer = setInterval(() => set({ peerCount: transport.connectedPeerCount }), 2000);
      return { ok: true, value: undefined };
    },

    joinGame: async (host, port = DEFAULT_PORT) => {
      clearLastHostGameId(store.getState().storage);
      log('session', 'info', `joining ${host}:${port}`);
      const pinned = buildConnectionSocketOptions({ platform: currentPlatform(), localIp: await readLocalIp() });
      const usePin = Object.keys(pinned).length > 0;
      // Pinned dials first; the final attempt is always unpinned so a bad pin
      // (or a non-Wi-Fi table link) can still connect.
      const attempts: ConnectionSocketOptions[] = usePin ? [pinned, pinned, {}] : [{}, {}, {}];
      set({ status: 'connecting', lastError: null, lastSocketSummary: null });

      let lastMessage = 'Could not connect';
      for (let i = 0; i < Math.min(attempts.length, MAX_JOIN_ATTEMPTS); i += 1) {
        const transport = newClientTransport();
        const attemptOptions = attempts[i];
        const pinnedNote = Object.keys(attemptOptions).length > 0 ? 'wifi-pinned' : 'unpinned';
        if (i > 0) log('connect', 'info', `join attempt ${i + 1}/${MAX_JOIN_ATTEMPTS} (${pinnedNote})`, `${host}:${port}`);
        transport.onConnectionStateChange(state => {
          set({ status: state });
          if (state === 'disconnected') set({ lastError: 'Lost connection to host' });
        });
        try {
          const welcome = await transport.connect(host, port, uuid(), 0, attemptOptions);
          const seeded = store.getState().createReplicaGame(welcome.gameId, welcome.events);
          if (!seeded.ok) { transport.close(); set({ status: 'error', lastError: seeded.error }); return seeded; }
          clientTransport = transport;
          store.getState().attachTransport(transport, 'client', { isConnected: () => transport.connectionState === 'connected' });
          const summary = usePin ? (pinnedNote === 'wifi-pinned' ? 'wifi-pinned' : 'unpinned-fallback') : 'default';
          if (i > 0) log('connect', 'info', `join succeeded on attempt ${i + 1}`, summary);
          set({ role: 'client', status: 'connected', lastError: null, lastSocketSummary: summary });
          return { ok: true, value: undefined };
        } catch (error) {
          transport.close();
          const raw = error instanceof Error ? error.message : 'Could not connect';
          const classified = classifyConnectError(raw, host, port);
          lastMessage = classified.message;
          log('session', 'error', `join ${host}:${port} failed (attempt ${i + 1})`, `${classified.kind}: ${raw}`);
          if (classified.kind === 'wifi-interface') {
            // The pin itself is unusable on this device — drop it for the rest.
            for (let j = i + 1; j < attempts.length; j += 1) attempts[j] = {};
          }
        }
      }
      set({ status: 'error', lastError: lastMessage });
      return { ok: false, error: lastMessage };
    },

    leaveSession: () => {
      const wasHost = get().role === 'host';
      stopPeerPoll();
      store.getState().detachTransport();
      if (wasHost) clearLastHostGameId(store.getState().storage);
      // Close before dropping: a leaked listener keeps the port bound and the
      // next hostGame fails with EADDRINUSE until the app restarts (issue #51).
      hostTransport?.close();
      clientTransport?.close();
      hostTransport = null;
      clientTransport = null;
      log('session', 'info', 'left session');
      set({ role: 'single', status: 'idle', peerCount: 0, lastError: null });
    },
  }));
};

export const useConnectionStore = createConnectionStore();
