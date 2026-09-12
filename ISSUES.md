# Multiplayer-First Issue Tracker

This checklist tracks the current product work. Multiplayer Host/Client behavior is the source of truth; Pass & Play is temporarily disabled while these changes land.

## Status

- [x] Temporarily disable Pass & Play entry points.
- [x] Simplify Pay screen payer selection.
- [x] Redesign Pay amount entry and keyboard behavior.
- [x] Add Station payment reason.
- [x] Gate table actions by the local player’s turn.
- [x] Remove Collect Rent until a dedicated rent flow exists.
- [x] Restrict settlement start and game finalization to the Host.
- [x] Prompt all connected players into their own settlement screen.
- [x] Restrict settlement editing to the local player, with Host override for dismissed players.
- [x] Replace settlement asset fields with a dynamic Mortgages list.
- [x] Support reconnect-before-dismissal and explicit Host dismissal.
- [x] Finalize only after all players submit or are explicitly dismissed.
- [x] Broadcast and display final rankings to all players.

## Acceptance notes

- Pass & Play is hidden from Home and `/setup` redirects back to Home.
- A player’s Pay action uses their local account as the payer and only asks them to choose a recipient.
- Quick amount buttons add to the amount; manual typing remains available without auto-opening the keyboard.
- Final settlement is a two-phase flow: Host starts settlement, then Host finalizes after participation is complete.
- A transient disconnect does not dismiss a player. Only an explicit Host action makes a player non-blocking.
- Dismissed players use cash-only settlement data unless the Host enters an override.

## New tickets

- [x] T-001 — Make Pass GO a Banker function; remove it from individual players, except the Host/Banker.
- [x] T-002 — Define the Host as both Banker and Player, with the major game functions; regular players should primarily initiate payments.
- [x] T-003 — Add a receive-from-Bank function so players can receive money from the Banker.
- [x] T-004 — Add `+20`, `+10`, and `+1` amount denominations.
- [x] T-005 — Auto-fill settlement mortgage names as `Asset #1`, `Asset #2`, etc.; keep names editable.
- [x] T-006 — Add player-to-player trading for situations where a player needs to trade outside the payment flow.
- [x] T-007 — Fix Host game completion so all clients leave the active settlement state, the final rankings screen is shown, and the Finish game button disappears.
- [x] T-008 — Remove Tax and Card from payment reasons, and remove Pass GO from the reason list now that it is a Banker function.
- [x] T-009 — Track Lost in Circulation as an explicit amount when money leaves play and the destination is unclear.
- [x] T-010 — Restrict sending any player, including the Host/Banker, to Jail to the Host/Banker.
- [x] T-011 — Add player-to-player payment requests: any active player can request anytime; the payer approves (atomic transfer) or declines; the requester can cancel. Requests are ledger events (`request.created`/`request.resolved`) so all devices see them.
- [x] T-012 — Let the Banker collect into the Bank with the same request flow: the Host picks "Receive into: Me / Bank" when requesting; only the Banker may request into the Bank.
