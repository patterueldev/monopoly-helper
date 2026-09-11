import TcpSocket from 'react-native-tcp-socket';
import { GameEvent } from '../ledger/types';
import { Intent } from '../ledger/intents';
import { Transport } from './Transport';
import { HandleInboundContext, handleInbound } from './hostInbound';
import { DEFAULT_PORT, LineBuffer, decodeLine, encodeMessage } from './wireProtocol';

export type { DispatchOutcome, HandleInboundContext, InboundOutcome } from './hostInbound';
export { handleInbound } from './hostInbound';

// Socket adapter — thin I/O shim around react-native-tcp-socket, wrapping the
// pure decision logic in ./hostInbound. Manually verified on-device only
// (see plan §6) — this file's own logic is deliberately minimal.

interface Peer { socket: TcpSocket.Socket; buffer: LineBuffer; lastPongAt: number }

/** Implements the shared `Transport` interface plus host-only extras
 * (`listen`, `connectedPeerCount`, `broadcastEvent`) — the ISP split plan.md
 * §12 asks for, mirroring `KeyValueStorage`'s narrow-interface treatment.
 * gameStore itself only ever calls `close()` on this for the host role
 * (broadcasting is driven separately via `onHostEvent`, see gameStore.ts);
 * `submit`/`eventsAfter`/`subscribe` exist for interface completeness and
 * for tooling/tests that want to treat a host as its own client. */
export class HostTransport implements Transport {
  private server: ReturnType<typeof TcpSocket.createServer> | null = null;
  private peers = new Map<number, Peer>();
  private listeners = new Set<(event: GameEvent) => void>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private nextPeerId = 0;

  constructor(private readonly ctx: HandleInboundContext) {}

  get connectedPeerCount(): number {
    return this.peers.size;
  }

  async submit(intent: Intent): Promise<GameEvent> {
    const result = this.ctx.dispatch(intent);
    if (!result.ok) throw new Error(result.error);
    if (!result.value.event) throw new Error('dispatch succeeded without an event');
    return result.value.event;
  }

  async eventsAfter(seq: number): Promise<GameEvent[]> {
    return this.ctx.eventsAfter(seq);
  }

  subscribe(listener: (event: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  listen(port: number = DEFAULT_PORT): Promise<void> {
    if (this.server) {
      this.close();
    }
    return new Promise((resolve, reject) => {
      let resolved = false;
      const server = TcpSocket.createServer(socket => this.onConnection(socket));
      server.on('error', (err: Error) => {
        if (!resolved) {
          reject(err);
        }
      });
      server.listen({ port, host: '0.0.0.0' }, () => {
        resolved = true;
        this.server = server;
        this.heartbeatTimer = setInterval(() => this.checkHeartbeats(), 5000);
        resolve();
      });
    });
  }

  /** Send `event` to every connected peer. Called by gameStore's onHostEvent
   * hook after a genuinely new local (or already-inbound-dispatched) event. */
  broadcastEvent(event: GameEvent): void {
    const line = encodeMessage({ kind: 'event', event });
    for (const peer of this.peers.values()) peer.socket.write(line);
    for (const listener of this.listeners) listener(event);
  }

  close(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    for (const peer of this.peers.values()) peer.socket.destroy();
    this.peers.clear();
    this.server?.close();
    this.server = null;
  }

  private onConnection(socket: TcpSocket.Socket) {
    const id = this.nextPeerId++;
    const peer: Peer = { socket, buffer: new LineBuffer(), lastPongAt: Date.now() };
    this.peers.set(id, peer);

    socket.on('data', (chunk: string | Buffer) => {
      const lines = peer.buffer.push(chunk.toString('utf8'));
      if (peer.buffer.oversized) { socket.destroy(); this.peers.delete(id); return; }
      for (const line of lines) this.handleLine(peer, socket, line);
    });
    socket.on('close', () => this.peers.delete(id));
    socket.on('error', () => this.peers.delete(id));
  }

  private handleLine(peer: Peer, socket: TcpSocket.Socket, line: string) {
    const message = decodeLine(line);
    if (!message) return; // malformed — logged-and-ignored per plan §5.4
    if (message.kind === 'pong') { peer.lastPongAt = Date.now(); return; }
    const outcome = handleInbound(message, this.ctx);
    if (outcome.action === 'reply') socket.write(encodeMessage(outcome.message));
    else if (outcome.action === 'replyAndClose') { socket.write(encodeMessage(outcome.message)); socket.destroy(); }
  }

  private checkHeartbeats() {
    const now = Date.now();
    for (const [id, peer] of this.peers) {
      peer.socket.write(encodeMessage({ kind: 'ping' }));
      if (now - peer.lastPongAt > 15000) { peer.socket.destroy(); this.peers.delete(id); }
    }
  }
}
