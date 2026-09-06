# Monopoly Banker — initial plan

A React Native companion app for a physical Monopoly board. It replaces the paper
money and the banker's mental arithmetic. The board, the dice, and the rules stay
on the table.

Status: planning. MVP scope is the money system only.

---

## 1. Scope

### What this is

A shared ledger. Players hold balances, money moves between them and the bank,
and every movement is recorded and reversible.

### What this is not

Not a Monopoly engine. The app deliberately does **not**:

- know where any token is on the board
- compute rent
- enforce turn order
- validate that a payment was legal or correct
- own the rulebook

Anything the app cannot verify, it does not try to. If two players agree a
payment should happen, it happens.

### Consequences of that boundary

Permanently out of scope: board packs, title deed data, rent tiers, position
tracking, auction flow, card decks with automatic effects, legality checks.

This keeps the surface small enough that v1 is genuinely buildable in a few
sittings, and it is the reason the data model below is as simple as it is.

---

## 2. Architecture

### Event-sourced ledger

Balances are never stored. An append-only log of events is stored, and state is
derived by folding over it:

```ts
const state = events.reduce(applyEvent, initialState(config));
```

This is the single most important decision in the app. It gives, for free:

| Need | How the log provides it |
|---|---|
| Undo | Append an inverse event. Nothing is mutated or deleted. |
| History feed | The log, rendered in reverse. |
| Money in circulation | A derived sum. Always consistent by construction. |
| Multiplayer sync (v2) | Send events after `seq` N. No diffing, no merging. |
| Crash recovery | Replay from disk. |
| Testability | `applyEvent` is pure. No React, no sockets, no mocks. |

### Single writer

In v1 there is one device, so this is trivially true. In v2 the host device is
the only writer: clients send *intents*, the host validates, assigns `seq`, and
broadcasts the resulting event. Because there is exactly one writer there are
never conflicts, and no CRDT or vector clock is needed.

Build v1 with this in mind. The reducer should already be written as though
events arrive from elsewhere.

### Module boundaries

```
src/
  ledger/          pure, no React, no I/O
    types.ts
    reducer.ts     applyEvent, initialState
    selectors.ts   balances, circulation, netWorth, history
    intents.ts     buildTransfer, buildReversal, validation
  store/
    gameStore.ts   Zustand: log + derived state + dispatch
    persistence.ts MMKV read/write
  transport/       v2 only. Interface defined in v1, unimplemented.
    Transport.ts
  screens/
  components/
```

`ledger/` must never import from `store/`, `transport/`, or `screens/`. That
rule is what makes the whole thing testable and portable.

---

## 3. Data model

### Accounts

Everything that can hold money is an account. This makes every money movement
one shape instead of four.

```ts
type AccountKind = 'player' | 'bank' | 'pot';

interface Account {
  id: string;          // uuid
  kind: AccountKind;
  name: string;
  color: string;       // token color, hex
  unlimited: boolean;  // true only for the bank
  assets: Asset[];     // always [] in v1. Reserved for v3.
}
```

The bank is an account with `unlimited: true`. The pot is the Free Parking pile,
created only if house rules enable it.

`assets` is present but empty in v1. Adding it now costs nothing; adding it to
persisted events later costs a migration.

### Game config

Set at game creation, stored inside the `game.started` event so the log is
self-describing and replayable without external context.

```ts
interface GameConfig {
  startingCash: number;      // default 1500
  goSalary: number;          // default 200
  doubleOnExactGo: boolean;  // default false
  freeParkingPot: boolean;   // default false
  bankerMode: boolean;       // default true in v1 (single device)
  currencySymbol: string;    // default '$'
  quickAmounts: number[];    // default [50, 100, 200, 500]
}
```

### Events

```ts
interface GameEvent<T extends EventType = EventType> {
  seq: number;         // monotonic, assigned by the writer
  ts: number;          // epoch ms, from the writer's clock
  actorId: string;     // account that initiated it
  intentId: string;    // client-generated uuid, used for dedupe
  type: T;
  payload: PayloadFor<T>;
}
```

`intentId` is not needed in v1 but is the single most important correctness
detail in v2: it lets the host reject a duplicate that arrives after a flaky
reconnect, which is what stops a retry from double-charging someone. Generate it
from day one so the shape never changes.

#### Event catalog (v1)

| Type | Payload | Notes |
|---|---|---|
| `game.started` | `{ config: GameConfig; accounts: Account[] }` | Always `seq: 0`. |
| `player.joined` | `{ account: Account }` | Late joiners. Gets `startingCash`. |
| `player.renamed` | `{ accountId, name, color }` | Fixing typos mid-game. |
| `transfer` | `{ from, to, amount, reason }` | The workhorse. |
| `transfer.reversed` | `{ targetSeq }` | Undo. |
| `player.eliminated` | `{ accountId, creditorId \| null }` | Bankruptcy. |
| `game.ended` | `{ tally: Settlement[] }` | Final standings. |

That is the whole catalog. Rent, tax, buying a property, passing GO, paying a
card, settling a trade: all of these are `transfer` with a different `reason`.

#### Transfer reason

A tagged union, not a bare string. In v3 a mortgage reason needs a
`propertyName`, and if reasons are strings by then you will be parsing text.

```ts
type TransferReason =
  | { kind: 'go' }
  | { kind: 'rent' }
  | { kind: 'buy' }
  | { kind: 'tax' }
  | { kind: 'card' }
  | { kind: 'trade' }
  | { kind: 'other'; note?: string };
```

These are labels for the history feed. Nothing validates them, and the user can
always leave it as `other`.

---

## 4. Reducer rules

`applyEvent(state, event) => state`. Pure, synchronous, total.

**Transfers**

- Debit `from`, credit `to`, unless the account is `unlimited` (bank balances
  are not tracked).
- Negative balances are **allowed**. Blocking them just means the table works
  around the app. A negative account renders as in debt.
- Amount must be a positive integer. Reject zero and negatives at the intent
  layer, not the reducer.
- `from` and `to` must differ.

**Reversals**

- `targetSeq` must point at a `transfer` that has not already been reversed.
- Applies the inverse. The original event stays in the log; it is marked
  reversed in derived state and rendered struck through.
- A reversal cannot itself be reversed. Reverse the reversal by making a new
  transfer if you really need to.
- v1 restricts reversal to the most recent unreversed transfer. Arbitrary
  reversal is confusing at the table and can wait.

**Elimination**

- Transfers the eliminated player's full balance to `creditorId`, or to the bank
  if null.
- The account stays in the log and in the history, flagged `eliminated`, and is
  hidden from the pay sheet.

**Derived values**

```ts
balance(accountId)   // fold of transfers
circulation()        // sum of all player + pot balances
netWorth(accountId)  // v1: balance. v3: balance + assets.
history()            // reverse-chronological, reversals collapsed onto originals
```

`circulation` only changes when the bank is on one side of a transfer. That is a
useful invariant to assert in tests.

---

## 5. Screens

### 5.1 Home

New game, or resume the game found in storage. Resume is the common path and
should be the larger button.

### 5.2 Setup

Add players (name + color from a fixed palette of eight). Starting cash, GO
salary, Free Parking pot toggle, currency symbol. Sensible defaults so the fast
path is: add four names, tap Start.

### 5.3 Table (main screen)

The screen the app sits on for four hours. Must be readable from across a table.

- One row per player: color chip, name, balance. Large type.
- Negative balances in the danger color with the amount in parentheses.
- Total in circulation as a small footer stat.
- Tap a row to open the pay sheet with that player pre-filled as recipient.
- Primary FAB: **Pay**.
- Secondary: **Pass GO**, which is a one-tap `bank -> player` transfer of
  `goSalary`. This is the single most frequent action in a game and deserves its
  own button.

### 5.4 Pay sheet

A bottom sheet, not a screen push. Speed matters more than ceremony.

- From (defaults to the last-used payer, or the tapped row).
- To. Includes Bank and, if enabled, Pot.
- Numeric keypad. Big keys.
- Quick-amount chips from `config.quickAmounts`, plus a `×2` and `÷2` for the
  common doubling cases.
- Reason chips, optional, defaulting to none.
- Confirm.

### 5.5 History

Reverse-chronological list. Each row: time, from → to, amount, reason label.
Reversed entries struck through and dimmed. The most recent unreversed transfer
has an Undo affordance.

### 5.6 Settlement

The feature that makes a money-only app actually finish a game. Most tables stop
on a time limit rather than playing to bankruptcy, and then argue about who won.

Two entry modes per player:

- **Fast**: one number. "My properties and buildings come to 1,840."
- **Itemized**: an adder with rows for property value, houses × cost,
  hotels × cost, minus mortgaged amounts, with a running total.

Then: net worth = cash + entered total, ranked, winner shown. Emits `game.ended`
with the full tally so the log remains a complete record of the session.

In v3 the itemized side pre-fills from the tracked property list and the banker
only confirms.

---

## 6. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo with a **dev client** | Not Expo Go. v2 needs a native socket module, so plan the prebuild now rather than migrating later. |
| Builds | EAS | |
| State | Zustand | Holds the log and memoized derived state. The reducer stays a separate pure module. |
| Persistence | MMKV | A four-hour game is tens of KB of JSON. SQLite is overkill until v3. |
| Validation | Zod | Schemas for every event payload. Needed at the wire boundary in v2; useful for persisted-log validation in v1. |
| Navigation | Expo Router | |
| Screen awake | expo-keep-awake | The table screen should never sleep. |
| Testing | Vitest or Jest on `ledger/` | Pure functions, no RN environment needed. |

### Persistence strategy

Write the log to MMKV after every event, as a single JSON array under one key.
Also store a `lastSeq` so a corrupt tail can be detected. On boot, parse,
validate with Zod, and replay. If validation fails, keep the longest valid
prefix and warn rather than losing the game.

---

## 7. Milestones

**M1 — Ledger core.** `types`, `reducer`, `selectors`, `intents`, full unit
tests. No UI. Done when a scripted 200-event game produces correct balances and
the circulation invariant holds.

**M2 — Single-device app.** Setup, Table, Pay sheet, History, undo,
persistence. This is the MVP. It is fully useful on its own and is a real
fallback for when the Wi-Fi does not cooperate.

**M3 — Settlement.** Both entry modes, `game.ended`, standings screen. M2 + M3
is a complete product for a money-only table.

**M4 — LAN multiplayer.** Covered in a separate spec. The bulk of the
engineering risk lives here and none of it touches the ledger.

**M5 — Properties and mortgages.** A flat per-player list of
`{ name, mortgageValue, mortgaged }`. A mortgage is already just a transfer, so
this phase is not about enabling mortgages, it is about three conveniences: not
double-mortgaging by accident, auto-computing the 10% unmortgage interest, and
pre-filling settlement.

**M6 — Optional extras.** Dice. A card reference view that displays text without
applying effects. None of it load-bearing.

---

## 8. Test plan

The pure reducer makes this cheap, so there is no excuse for skipping it.

- **Property test**: for any random event sequence, `sum(player balances) +
  pot == circulation`, and circulation changes only on bank-involved transfers.
- **Replay determinism**: `fold(log)` twice gives identical state.
- **Reversal**: applying a transfer then reversing it returns to the prior
  balance state exactly.
- **Idempotence**: applying an event with a duplicate `intentId` is a no-op.
- **Persistence round-trip**: serialize, parse, replay, compare.
- **Truncated log**: a log cut mid-array recovers to the longest valid prefix.

---

## 9. Open decisions

1. **Player-per-device or banker-per-table in v2.** v1 forces banker mode. If v2
   gives everyone a device, is the default still banker mode with per-transaction
   approval available, or approval-required by default? Faster versus more
   correct, and it depends on the group.
2. **Arbitrary reversal.** v1 allows undoing only the most recent transfer. Is
   that enough in practice, or does a mistake three transfers back need fixing
   without three undos?
3. **Currency display.** Plain integers, or thousands separators and a symbol?
   Affects the numeric keypad design.
4. **Pot rules.** If Free Parking is on, what feeds it, and who collects? Worth
   a config toggle or worth hardcoding one common variant.

---

## 10. Design principles to hold onto

- **The log is the truth.** Never mutate derived state directly. If something
  needs to change, it is an event.
- **The app does not know the rules.** Every time a feature request starts with
  "it should automatically...", check whether it requires knowing where a token
  is. If so, it belongs in a different app.
- **Optimize the two frequent actions.** Pass GO and pay another player are 80%
  of all taps. Everything else can take an extra tap.
- **Never block on correctness.** Negative balances, weird amounts, and payments
  in the wrong direction are all allowed. Undo is the safety net, not
  validation.
