import TcpSocket from 'react-native-tcp-socket';
import { GameEvent } from '../ledger/types';
import { Intent } from '../ledger/intents';
import { Transport } from './Transport';
import { ConnectionState, canSubmit, initialClientConnectionState, reduceClientConnection } from './clientConnection';
import { DEFAULT_PORT, LineBuffer, PROTOCOL_VERSION, WireMessage, decodeLine, encodeMessage } from './wireProtocol';

export type { ConnectionState } from './clientConnection';

const RECONNECT_INTERVAL_MS = 3000;
const CONNECT_TIMEOUT_MS = 8000; // plan §5.10: a bad join attempt times out, never hangs
const HEARTBEAT_INTERVAL_MS = 5000;
const PONG_TIMEOUT_MS = 15000;

interface PendingSubmit { resolve: (event: GameEvent) => void; reject: (error: Error) => void }
interface PendingSync { resolve: (events: GameEvent[]) => void }

/** Implements `Transport` plus client-only extras (`connect`, `disconnect`,
 * `connectionState`, `onConnectionStateChange`) — wraps a react-native-tcp-socket
 * client socket and owns the reconnect/heartbeat state machine from
 * ./clientConnection. Socket wiring is manually verified on-device only
 * (see plan §6); the state machine itself is fully Vitest-covered. */
export class ClientTransport implements Transport {
  private socket: TcpSocket.Socket | null = null;
  private buffer = new LineBuffer();
  private state = initialClientConnectionState;
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private eventListeners = new Set<(event: GameEvent) => void>();
  private pendingSubmits = new Map<string, PendingSubmit>();
  private pendingSyncs = new Map<string, PendingSync>();
  private welcomeEvents: GameEvent[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = Date.now();
  private host = '';
  private port = DEFAULT_PORT;
  private clientId = '';
  private sinceSeq = 0;

  get connectionState(): ConnectionState {
    return this.state.connectionState;
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Resolves once `welcome` arrives (or rejects on timeout/error), carrying
   * the game id and initial event burst — the caller (connectionStore) seeds
   * gameStore.createReplicaGame from it. */
  connect(host: string, port: number = DEFAULT_PORT, clientId: string, sinceSeq = 0): Promise<{ gameId: string; events: GameEvent[] }> {
    this.host = host;
    this.port = port;
    this.clientId = clientId;
    this.sinceSeq = sinceSeq;
    this.transition({ type: 'connect' });
    return this.dial();
  }

  disconnect(): void {
    this.clearTimers();
    this.socket?.destroy();
    this.socket = null;
    this.transition({ type: 'disconnect' }); // deliberate — no further auto-reconnect
  }

  async submit(intent: Intent): Promise<GameEvent> {
    if (!canSubmit(this.state)) throw new Error('Not connected to host');
    return new Promise((resolve, reject) => {
      this.pendingSubmits.set(intent.intentId, { resolve, reject });
      this.socket!.write(encodeMessage({ kind: 'intent', intent }));
    });
  }

  async eventsAfter(sinceSeq: number): Promise<GameEvent[]> {
    if (!canSubmit(this.state)) return [];
    const requestId = `sync-${Date.now()}-${Math.random()}`;
    return new Promise(resolve => {
      this.pendingSyncs.set(requestId, { resolve });
      this.socket!.write(encodeMessage({ kind: 'sync', requestId, sinceSeq }));
    });
  }

  subscribe(listener: (event: GameEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  close(): void {
    this.clearTimers();
    this.socket?.destroy();
    this.socket = null;
  }

  // -- internals -------------------------------------------------------

  private dial(): Promise<{ gameId: string; events: GameEvent[] }> {
    return new Promise((resolve, reject) => {
      const socket = TcpSocket.createConnection({ port: this.port, host: this.host }, () => {
        socket.write(encodeMessage({ kind: 'hello', protocolVersion: PROTOCOL_VERSION, clientId: this.clientId, sinceSeq: this.sinceSeq }));
      });
      this.socket = socket;
      this.buffer = new LineBuffer();

      this.connectTimeoutTimer = setTimeout(() => { socket.destroy(); reject(new Error('Connection timed out')); }, CONNECT_TIMEOUT_MS);

      const onWelcome = (gameId: string, events: GameEvent[]) => {
        if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
        this.connectTimeoutTimer = null;
        resolve({ gameId, events });
      };
      this.pendingWelcome = onWelcome;
      this.pendingWelcomeReject = reject;

      socket.on('data', (chunk: string | Buffer) => this.onData(chunk));
      socket.on('close', () => this.onLost());
      socket.on('error', () => this.onLost());
    });
  }

  private pendingWelcome: ((gameId: string, events: GameEvent[]) => void) | null = null;
  private pendingWelcomeReject: ((error: Error) => void) | null = null;

  private onData(chunk: string | Buffer) {
    const lines = this.buffer.push(chunk.toString('utf8'));
    if (this.buffer.oversized) { this.socket?.destroy(); return; }
    for (const line of lines) this.onLine(line);
  }

  private onLine(line: string) {
    const message = decodeLine(line);
    if (!message) return; // malformed — logged-and-ignored per plan §5.4
    this.onMessage(message);
  }

  private onMessage(message: WireMessage) {
    switch (message.kind) {
      case 'welcome':
        this.welcomeEvents = message.events;
        this.startHeartbeat();
        this.transition({ type: 'welcomed' });
        if (this.pendingWelcome) {
          // First connect: the caller (connectionStore) is awaiting connect()'s
          // promise and will seed gameStore.createReplicaGame from these events.
          this.pendingWelcome(message.gameId, message.events);
          this.pendingWelcome = null;
          this.pendingWelcomeReject = null;
        } else {
          // A reconnect's catch-up burst — gameStore is already seeded and
          // subscribed, so replay these through the normal per-event channel
          // (applyEvent's own intentId/seq checks make this dedup-safe).
          for (const event of message.events) this.eventListeners.forEach(l => l(event));
        }
        break;
      case 'event':
        this.eventListeners.forEach(l => l(message.event));
        this.pendingSubmits.get(message.event.intentId)?.resolve(message.event);
        this.pendingSubmits.delete(message.event.intentId);
        break;
      case 'reject':
        this.pendingSubmits.get(message.intentId)?.reject(new Error(message.reason));
        this.pendingSubmits.delete(message.intentId);
        break;
      case 'synced':
        this.pendingSyncs.get(message.requestId)?.resolve(message.events);
        this.pendingSyncs.delete(message.requestId);
        break;
      case 'pong':
        this.lastPongAt = Date.now();
        break;
      case 'ping':
        this.socket?.write(encodeMessage({ kind: 'pong' }));
        break;
      case 'error':
        this.pendingWelcomeReject?.(new Error(message.message));
        this.pendingWelcomeReject = null;
        this.socket?.destroy();
        break;
      default:
        break; // hello/intent/sync are client->host only, never expected inbound
    }
  }

  private onLost() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.pendingWelcomeReject?.(new Error('Connection lost'));
    this.pendingWelcomeReject = null;
    for (const pending of this.pendingSubmits.values()) pending.reject(new Error('Connection lost'));
    this.pendingSubmits.clear();
    this.transition({ type: 'lost' });
    if (this.state.connectionState === 'reconnecting') this.scheduleReconnect();
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.transition({ type: 'reconnectTick' });
      this.sinceSeq = this.welcomeEvents.at(-1)?.seq ?? this.sinceSeq;
      this.dial().catch(() => { /* onLost() will run again from the socket's own close/error */ });
    }, RECONNECT_INTERVAL_MS);
  }

  private startHeartbeat() {
    this.lastPongAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastPongAt > PONG_TIMEOUT_MS) { this.socket?.destroy(); return; }
      this.socket?.write(encodeMessage({ kind: 'ping' }));
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.reconnectTimer = null;
    this.connectTimeoutTimer = null;
    this.heartbeatTimer = null;
  }

  private transition(event: Parameters<typeof reduceClientConnection>[1]) {
    this.state = reduceClientConnection(this.state, event);
    this.stateListeners.forEach(l => l(this.state.connectionState));
  }
}
