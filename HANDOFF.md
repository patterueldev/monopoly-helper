# Handoff — Monopoly Banker

Read this first if you're picking up this project cold (new AI session, new tool,
new person). It's a fast-start summary of where things stand and how to keep
working the way this project has been worked so far. For the actual product/
architecture spec, read **`plan.md`** in full — this file doesn't repeat it.

## What this is

A companion app for physically playing Monopoly with family: track cash/transfers
as an event-sourced ledger, play turn-based over the same Wi-Fi (one phone hosts,
others join), settle up at the end. Not a full digital Monopoly — no board,
property automation, or dice UI. See `plan.md` §1 for the precise scope boundary
and §11 for why it's LAN-multiplayer-first (family-owned devices, not a
single-device "banker" app).

## Where state actually lives

- **`plan.md`** — the spec. Sections 1–10 are the original single-device design
  (still accurate for the ledger core). **Section 11 supersedes the milestone
  ordering in Section 7** — read §11 for the real current scope. §12 is
  architecture/lint standards (SOLID, MVVM, 500-line file cap). §13 is Firebase
  (App Distribution only, not a backend).
- **GitHub issues** (`patterueldev/monopoly-helper`) — all initial MVP v2 issues are now implemented and closed:
  - #2 LAN transport (PR #7)
  - #3 Turn tracking + rent/jail events (PR #10)
  - #4 Itemized settlement mode (PR #11)
  - #5 Per-device player profile (PR #9)
  - #6 CI: build + distribute Android builds via GitHub Actions (PR #12, #13, #14, #15)
- **`main` branch requires PRs** — branch protection is on, direct pushes to
  `main` are rejected. Branch, PR, merge.

## Built so far (merged to `main`)

1. **Ledger core** (`src/ledger/`) — pure, no React/I/O. `GameEvent[]` folded via
   `fold`/`applyEvent` into `GameState`. Zod-validated event schemas
   (`parseEvent`). Fully unit-tested (`reducer.test.ts`, `m1.test.ts`).
2. **Single-device store + screens** (`src/store/gameStore.ts`, `app/*.tsx`) —
   setup, table, pay, history, settlement (both fast and itemized modes).
3. **LAN transport** (PR #7) — `react-native-tcp-socket` + NDJSON, host/client
   roles, manual IP:port join. `gameStore` takes role + injected `Transport`.
4. **Per-device player profile** (PR #9, Issue #5) — `profileStore`,
   `profilePersistence` (MMKV), custom color picker, persistent local identity.
5. **Turn tracking + rent/jail events** (PR #10, Issue #3) — `turn.advanced`,
   `player.jailed`, `player.released` events, Turn Card UI, jail toggles,
   advisory rent helpers.
6. **Itemized settlement mode** (PR #11, Issue #4) — `settlementCalculations.ts`,
   `useSettlementViewModel.ts`, itemized property/houses/hotels/mortgage inputs,
   real-time net worth and leaderboard ranking.
7. **CI Android APK build & GitHub Release** (PR #12–#15, Issue #6) — GHA
   workflow triggered on push to `main` or manual dispatch. Builds APK via EAS
   cloud, downloads it, and creates a public GitHub Release with the APK
   attached. No Firebase required.

## Working conventions established this project

- **SOLID + MVVM**, enforced where practical: `src/ledger/` (Model) has an
  ESLint `no-restricted-imports` boundary rule blocking imports from
  `store/`, `transport/`, `app/`, `react`, `react-native` — it must stay pure.
  `src/store/` + `src/viewmodels/` are the ViewModel layer; `app/*.tsx` is the
  View.
- **500-line file cap** — `eslint.config.js` `max-lines` rule (`warn`). Don't let
  new files creep past it.
- **Never commit secrets.** `.gitignore` blocks sensitive files and keys.
- **Plan → execute pipeline for nontrivial features**: high-effort planning pass
  followed by execution pass and clean PR.
- **Verify, don't just trust a worker's self-report.** Independently run test,
  typecheck, and lint on `main` post-merge.

## Running it

- `npm test` — Vitest, pure-logic test suite (73 tests across 10 suites).
- `npm run typecheck`, `npm run lint` — both clean.
- **This app cannot run in Expo Go** — `react-native-tcp-socket` is a native
  module. Use the automated APK from GitHub Releases or run a local dev build
  via `eas build --profile development`.
- Automated Android builds publish to GitHub Releases under:
  `https://github.com/patterueldev/monopoly-helper/releases`

## Next steps & verification

- **Manual on-device testing**: Download the APK from the latest GitHub Release
  onto physical Android devices and verify:
  1. Profile persistence across app restarts.
  2. Host game creation + client join over local Wi-Fi.
  3. Turn advancement and rent transfer advisory actions.
  4. Fast vs. Itemized settlement calculations and final winner tally.
