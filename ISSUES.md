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
