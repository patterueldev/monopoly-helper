import { Account, GameEvent, GameState, Settlement, DEFAULT_CONFIG, parseEvent, SettlementStatus } from './types';

export const initialState = (): GameState => ({ started: false, ended: false, accounts: {}, balances: {}, eliminated: new Set(), reversed: new Set(), events: [], settlements: {}, settlementStatus: {}, settlementStarted: false, jailed: new Set(), lostInCirculation: 0, requests: {}, invalid: false });
const copy = (s: GameState): GameState => ({ ...s, accounts: { ...s.accounts }, balances: { ...s.balances }, eliminated: new Set(s.eliminated), reversed: new Set(s.reversed), events: [...s.events], tally: s.tally?.map(x => ({ ...x, rows: x.rows?.map(row => ({ ...row })) })), settlements: Object.fromEntries(Object.entries(s.settlements).map(([id, settlement]) => [id, { ...settlement, rows: settlement.rows?.map(row => ({ ...row })) }])), settlementStatus: { ...s.settlementStatus }, jailed: new Set(s.jailed), requests: { ...s.requests }, currentTurnAccountId: s.currentTurnAccountId });
const bankId = (s: GameState) => Object.values(s.accounts).find(a => a.kind === 'bank' && a.unlimited)?.id;
const activePlayers = (s: GameState) => Object.values(s.accounts).filter(a => a.kind === 'player' && !s.eliminated.has(a.id));
const hostId = (s: GameState) => s.hostAccountId ?? Object.values(s.accounts).find(a => a.kind === 'player')?.id;
const isHost = (s: GameState, actorId: string) => actorId === hostId(s);
// Banker authority is stricter than host settlement authority: only the Host's
// player account may issue Bank money or jail/release players. Without an
// explicit hostAccountId (legacy/dev single-device games) there is no banker,
// so banker-only events fail closed.
const isBanker = (s: GameState, actorId: string) => !!s.hostAccountId && actorId === s.hostAccountId;
const settlementAssetTotal = (settlement: Settlement): number => {
  if (settlement.mode === 'fast') return settlement.valuation;
  const rows = settlement.rows ?? [];
  const isNamedMortgageList = rows.length === 0 || rows.every(row => row.kind === 'mortgage' && !!row.name);
  return isNamedMortgageList
    ? rows.reduce((sum, row) => sum + row.value, 0)
    : rows.reduce((sum, row) => sum + (row.kind === 'mortgage' ? -row.value : row.kind === 'property' ? row.value : row.value * (row.quantity ?? 1)), 0);
};
function validAccounts(accounts: Account[], config: typeof DEFAULT_CONFIG): boolean { const ids = new Set(accounts.map(a => a.id)); const players = accounts.filter(a => a.kind === 'player'); const banks = accounts.filter(a => a.kind === 'bank'); const pots = accounts.filter(a => a.kind === 'pot'); const colors = new Set(players.map(a => a.color)); return config.bankerMode && players.length >= 1 && players.length <= 8 && ids.size === accounts.length && colors.size === players.length && banks.length === 1 && banks[0].unlimited && pots.length <= 1 && (!config.freeParkingPot ? pots.length === 0 : pots.length === 1) && accounts.every(a => a.assets.length === 0 && (a.kind === 'bank' ? a.unlimited : !a.unlimited)); }
function change(s: GameState, id: string, delta: number): boolean { const account = s.accounts[id]; if (!account || account.unlimited) return true; const next = (s.balances[id] ?? 0) + delta; if (!Number.isSafeInteger(next)) return false; s.balances[id] = next; return true; }
function validSettlement(s: GameState, settlement: Settlement): boolean { const player = s.accounts[settlement.playerId]; return !!player && player.kind === 'player' && !s.eliminated.has(player.id) && settlement.cash === (s.balances[player.id] ?? 0) && settlement.assetTotal === settlementAssetTotal(settlement) && settlement.valuation === settlement.assetTotal && settlement.netWorth === settlement.cash + settlement.assetTotal; }
function validTally(s: GameState, tally: Settlement[]): boolean { const players = Object.values(s.accounts).filter(a => a.kind === 'player'); if (tally.length !== players.length) return false; const ids = new Set(tally.map(x => x.playerId)); if (ids.size !== players.length || players.some(p => !ids.has(p.id))) return false; const active = tally.filter(x => !s.eliminated.has(x.playerId)).sort((a,b) => b.netWorth - a.netWorth); return tally.every(x => { const eliminated = s.eliminated.has(x.playerId); if (eliminated && (x.cash !== 0 || x.assetTotal !== 0 || x.netWorth !== 0 || x.rank !== undefined)) return false; if (x.cash !== (s.balances[x.playerId] ?? 0) || x.netWorth !== x.cash + x.assetTotal) return false; const total = settlementAssetTotal(x); if (x.assetTotal !== total || x.valuation !== total) return false; if (!eliminated) { const i = active.findIndex(y => y.playerId === x.playerId); const expected = i === 0 || active[i - 1].netWorth !== x.netWorth ? i + 1 : active[i - 1].rank; if (x.rank !== expected) return false; } return true; }); }
export function applyEvent(previous: GameState, input: GameEvent): GameState { const parsed = parseEvent(input); if (!parsed) return { ...previous, invalid: true }; if (previous.events.some(e => e.intentId === parsed.intentId)) return previous; if (parsed.seq !== previous.events.length) return { ...previous, invalid: true }; const s = copy(previous); const fail = () => ({ ...previous, invalid: true });
  switch (parsed.type) {
    case 'game.started': { const { config, accounts, hostAccountId } = parsed.payload; if (s.started || parsed.seq !== 0 || !validAccounts(accounts, config) || (hostAccountId && !accounts.some(a => a.id === hostAccountId && a.kind === 'player'))) return fail(); s.started = true; s.config = config; s.hostAccountId = hostAccountId; accounts.forEach(a => { s.accounts[a.id] = a; s.balances[a.id] = a.kind === 'player' ? config.startingCash : 0; }); s.currentTurnAccountId = accounts.find(a => a.kind === 'player')?.id; break; }
    case 'player.joined': { const a = parsed.payload.account; if (!s.started || s.ended || s.settlementStarted || s.accounts[a.id] || a.kind !== 'player' || a.unlimited || a.assets.length !== 0 || activePlayers(s).length >= 8 || Object.values(s.accounts).some(x => x.color === a.color && x.kind === 'player' && !s.eliminated.has(x.id))) return fail(); s.accounts[a.id] = a; s.balances[a.id] = s.config!.startingCash; break; }
    case 'player.renamed': { const a = s.accounts[parsed.payload.accountId]; if (!s.started || s.ended || !a || a.kind !== 'player' || Object.values(s.accounts).some(x => x.id !== a.id && x.kind === 'player' && !s.eliminated.has(x.id) && x.color === parsed.payload.color)) return fail(); s.accounts[a.id] = { ...a, name: parsed.payload.name, color: parsed.payload.color }; break; }
    case 'transfer': { const { from, to, amount } = parsed.payload; const fa = s.accounts[from], ta = s.accounts[to]; if (!s.started || s.ended || s.settlementStarted || !fa || !ta || from === to || s.eliminated.has(from) || s.eliminated.has(to) || !Number.isSafeInteger(amount) || amount <= 0) return fail(); if (from === bankId(s) && !isBanker(s, parsed.actorId)) return fail(); const beforeFrom = s.balances[from] ?? 0, beforeTo = s.balances[to] ?? 0; if (!change(s, from, -amount) || !change(s, to, amount)) { s.balances[from] = beforeFrom; s.balances[to] = beforeTo; return fail(); } s.events.push(parsed); if (fa.kind === 'player') s.lastPayer = from; return s; }
    case 'transfer.reversed': { const target = s.events.find(e => e.seq === parsed.payload.targetSeq); const boundary = [...s.events].reverse().find(e => e.type === 'player.eliminated')?.seq ?? -1; const latest = [...s.events].reverse().find(e => e.type === 'transfer' && e.seq > boundary && !s.reversed.has(e.seq)); if (!s.started || s.ended || !target || target.type !== 'transfer' || target.seq !== latest?.seq || s.reversed.has(target.seq)) return fail(); const beforeFrom = s.balances[target.payload.from] ?? 0, beforeTo = s.balances[target.payload.to] ?? 0; if (!change(s, target.payload.from, target.payload.amount) || !change(s, target.payload.to, -target.payload.amount)) { s.balances[target.payload.from] = beforeFrom; s.balances[target.payload.to] = beforeTo; return fail(); } s.reversed.add(target.seq); break; }
    case 'player.eliminated': { const { accountId, creditorId } = parsed.payload; const player = s.accounts[accountId], creditor = creditorId ? s.accounts[creditorId] : undefined, bank = bankId(s); if (!s.started || s.ended || s.settlementStarted || !player || player.kind !== 'player' || s.eliminated.has(accountId) || (creditorId !== null && (!creditor || creditor.kind !== 'player' || creditorId === accountId || s.eliminated.has(creditorId))) || !bank) return fail(); const bal = s.balances[accountId] ?? 0; const before = { ...s.balances }; if (bal > 0 && (!change(s, accountId, -bal) || !change(s, creditorId ?? bank, bal))) { s.balances = before; return fail(); } if (bal < 0 && !change(s, accountId, -bal)) { s.balances = before; return fail(); } if (bal > 0 && creditorId === null) { const next = s.lostInCirculation + bal; if (!Number.isSafeInteger(next)) { s.balances = before; return fail(); } s.lostInCirculation = next; } s.balances[accountId] = 0; s.eliminated.add(accountId); s.jailed.delete(accountId); if (s.currentTurnAccountId === accountId) { const remaining = activePlayers(s); s.currentTurnAccountId = remaining[0]?.id; } break; }
    case 'settlement.started': { const ids = new Set(parsed.payload.participantIds); const active = activePlayers(s); if (!s.started || s.ended || s.settlementStarted || !isHost(s, parsed.actorId) || ids.size !== active.length || active.some(player => !ids.has(player.id))) return fail(); s.settlementStarted = true; active.forEach(player => { s.settlementStatus[player.id] = 'pending'; }); break; }
    case 'settlement.submitted': { const { playerId, settlement } = parsed.payload; const status: SettlementStatus | undefined = s.settlementStatus[playerId]; if (!s.started || s.ended || !s.settlementStarted || !status || status === 'dismissed' && !isHost(s, parsed.actorId) || (!isHost(s, parsed.actorId) && parsed.actorId !== playerId) || !validSettlement(s, settlement) || settlement.playerId !== playerId) return fail(); s.settlements[playerId] = settlement; s.settlementStatus[playerId] = 'submitted'; break; }
    case 'settlement.dismissed': { const { playerId } = parsed.payload; if (!s.started || s.ended || !s.settlementStarted || !isHost(s, parsed.actorId) || s.settlementStatus[playerId] !== 'pending' || !s.accounts[playerId] || s.accounts[playerId].kind !== 'player') return fail(); s.settlementStatus[playerId] = 'dismissed'; break; }
    case 'game.ended': { const active = activePlayers(s); const complete = active.every(player => s.settlementStatus[player.id] === 'submitted' || s.settlementStatus[player.id] === 'dismissed'); const legacyDirectEnd = !s.hostAccountId && !s.settlementStarted; if (!s.started || s.ended || (!legacyDirectEnd && (!s.settlementStarted || !isHost(s, parsed.actorId) || !complete)) || !validTally(s, parsed.payload.tally)) return fail(); s.ended = true; s.tally = parsed.payload.tally; break; }
    case 'turn.advanced': { const to = parsed.payload.toAccountId; const a = s.accounts[to]; if (!s.started || s.ended || !a || a.kind !== 'player' || s.eliminated.has(to)) return fail(); s.currentTurnAccountId = to; break; }
    case 'player.jailed': { const id = parsed.payload.accountId; const a = s.accounts[id]; if (!s.started || s.ended || !a || a.kind !== 'player' || s.eliminated.has(id) || !isBanker(s, parsed.actorId)) return fail(); s.jailed.add(id); break; }
    case 'player.released': { const id = parsed.payload.accountId; const a = s.accounts[id]; if (!s.started || s.ended || !a || a.kind !== 'player' || s.eliminated.has(id) || !isBanker(s, parsed.actorId)) return fail(); s.jailed.delete(id); break; }
    case 'request.created': {
      const { requestId, from, to, amount } = parsed.payload;
      const fa = s.accounts[from], ta = s.accounts[to];
      const bank = bankId(s);
      // The requester is the destination: normally the requester's own account,
      // the Banker when collecting into the Bank. A non-banker can never demand
      // money into the Bank, and nobody can bill the Bank (feature 1 covers payouts).
      const requesterOk = to === bank ? isBanker(s, parsed.actorId) : parsed.actorId === to;
      if (!s.started || s.ended || s.settlementStarted || !fa || !ta || from === to || from === bank || s.eliminated.has(from) || s.eliminated.has(to) || s.requests[requestId] || !Number.isSafeInteger(amount) || amount <= 0 || !requesterOk) return fail();
      s.requests[requestId] = { id: requestId, from, to, amount, reason: parsed.payload.reason, createdBy: parsed.actorId, createdSeq: parsed.seq, status: 'pending' };
      break;
    }
    case 'request.resolved': {
      const { requestId, outcome } = parsed.payload;
      const r = s.requests[requestId];
      if (!s.started || s.ended || !r || r.status !== 'pending') return fail();
      if (outcome === 'cancelled') {
        if (parsed.actorId !== r.createdBy) return fail();
        s.requests[requestId] = { ...r, status: 'cancelled', resolvedSeq: parsed.seq };
        break;
      }
      // Paid and declined both belong to the payer; declining closes the request
      // with no money movement, approving moves funds atomically below.
      if (parsed.actorId !== r.from) return fail();
      if (outcome === 'declined') { s.requests[requestId] = { ...r, status: 'declined', resolvedSeq: parsed.seq }; break; }
      const fa = s.accounts[r.from], ta = s.accounts[r.to];
      if (s.settlementStarted || !fa || !ta || s.eliminated.has(r.from) || s.eliminated.has(r.to)) return fail();
      const beforeFrom = s.balances[r.from] ?? 0, beforeTo = s.balances[r.to] ?? 0;
      if (!change(s, r.from, -r.amount) || !change(s, r.to, r.amount)) { s.balances[r.from] = beforeFrom; s.balances[r.to] = beforeTo; return fail(); }
      if (fa.kind === 'player') s.lastPayer = r.from;
      s.requests[requestId] = { ...r, status: 'paid', resolvedSeq: parsed.seq };
      break;
    }
  }
  s.events.push(parsed); return s;
}
export const fold = (events: GameEvent[]) => events.reduce(applyEvent, initialState());
