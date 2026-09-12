import { GameState, Account, Settlement } from './types';
export const balance = (s: GameState, id: string) => s.balances[id] || 0;
export const circulation = (s: GameState) => Object.entries(s.accounts).reduce((n, [id, a]) => n + (a.kind === 'player' || a.kind === 'pot' ? balance(s, id) : 0), 0);
export const netWorth = (s: GameState, id: string) => balance(s, id);
export const activePlayers = (s: GameState) => Object.values(s.accounts).filter(a => a.kind === 'player' && !s.eliminated.has(a.id));
export const isJailed = (s: GameState, id: string) => s.jailed?.has(id) ?? false;
/** The Banker is the Host's player account; undefined when no host is set
 * (legacy/dev single-device games have no banker). */
export const bankerAccountId = (s: GameState): string | undefined => s.hostAccountId;
/** Money that left play with no creditor (e.g. elimination with unclear destination). */
export const lostInCirculation = (s: GameState) => s.lostInCirculation ?? 0;
/** Authoritative final standings once the game has ended, sorted by rank.
 * Empty while the game is still running. */
export const finalRankings = (s: GameState): Settlement[] =>
  s.ended && s.tally
    ? [...s.tally].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
    : [];
export const currentTurnPlayer = (s: GameState): Account | undefined => s.currentTurnAccountId ? s.accounts[s.currentTurnAccountId] : undefined;
export const nextTurnPlayer = (s: GameState): Account | undefined => {
  const players = activePlayers(s);
  if (players.length === 0) return undefined;
  if (!s.currentTurnAccountId) return players[0];
  const idx = players.findIndex(p => p.id === s.currentTurnAccountId);
  if (idx === -1) return players[0];
  return players[(idx + 1) % players.length];
};
export const history = (s: GameState) => s.events.filter(e => e.type !== 'transfer.reversed').map(e => e.type === 'transfer' ? { event: e, reversed: s.reversed.has(e.seq) } : { event: e, reversed: false }).reverse();
export const latestUndo = (s: GameState) => { const boundary = [...s.events].reverse().find(e => e.type === 'player.eliminated')?.seq ?? -1; return [...s.events].reverse().find(e => e.type === 'transfer' && e.seq > boundary && !s.reversed.has(e.seq)); };
/** Incoming payment requests: pending, and I am the payer — I approve or decline. */
export const incomingRequests = (s: GameState, id: string) => Object.values(s.requests ?? {}).filter(r => r.status === 'pending' && r.from === id).sort((a, b) => a.createdSeq - b.createdSeq);
/** Outgoing payment requests: pending, created by me — I may cancel. */
export const outgoingRequests = (s: GameState, id: string) => Object.values(s.requests ?? {}).filter(r => r.status === 'pending' && r.createdBy === id).sort((a, b) => a.createdSeq - b.createdSeq);
export const pendingRequestCount = (s: GameState, id: string) => incomingRequests(s, id).length;
