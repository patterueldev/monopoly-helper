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
- **GitHub issues** (`patterueldev/monopoly-helper`) — one issue per remaining
  MVP v2 build item, each with its own design notes. Check `gh issue list` for
  current state; as of this writing:
  - #3 Turn tracking + rent/jail events (advisory only)
  - #4 Itemized settlement mode
  - #5 Per-device player profile
  - #6 CI: build + distribute Android builds via GitHub Actions
- **`main` branch requires PRs** — branch protection is on, direct pushes to
  `main` are rejected. Branch, PR, merge.

## Built so far (merged to `main`)

1. **Ledger core** (`src/ledger/`) — pure, no React/I/O. `GameEvent[]` folded via
   `fold`/`applyEvent` into `GameState`. Zod-validated event schemas
   (`parseEvent`). Fully unit-tested (`reducer.test.ts`, `m1.test.ts`).
2. **Single-device store + screens** (`src/store/gameStore.ts`, `app/*.tsx`) —
   setup, table, pay, history, settlement (fast mode only — itemized is #4).
3. **LAN transport** (PR #7, merged) — `react-native-tcp-socket` + NDJSON,
   host/client roles, manual IP:port join. `gameStore` now takes an optional
   `role` + injected `Transport`; host path is byte-for-byte the original local
   `dispatch`, client path never assigns its own `seq`. New: `app/host.tsx`,
   `app/join.tsx`, `src/transport/*`, `src/store/connectionStore.ts`,
   `src/viewmodels/use{Host,Join}ViewModel.ts`. **Not yet manually verified on
   real devices** — see the checklist in PR #7's description (multi-device
   convergence, backgrounding/reconnect, Wi-Fi toggling, wrong-IP handling).
4. **Firebase App Distribution wiring** (PR #1, merged) — `google-services.json`
   (gitignored, present locally, not in git history), bundle ID unified to
   `dev.patteruel.monopolybanker` everywhere. No Firestore/Auth/Analytics — see
   `plan.md` §13 for the one remaining manual console step.

## Working conventions established this project

- **SOLID + MVVM**, enforced where practical: `src/ledger/` (Model) has an
  ESLint `no-restricted-imports` boundary rule blocking imports from
  `store/`, `transport/`, `app/`, `react`, `react-native` — it must stay pure.
  `src/store/` + `src/viewmodels/` are the ViewModel layer; `app/*.tsx` is the
  View. New screens (`host.tsx`, `join.tsx`) got per-screen viewmodel hooks
  from day one — the older screens (`table.tsx`, `pay.tsx`, etc.) still inline
  business logic and are known debt, not a pattern to extend.
- **500-line file cap** — `eslint.config.js` `max-lines` rule (`warn`, not
  `error`, since the existing dense one-line-per-file style in older screens
  makes a hard cap unreliable right now — see `plan.md` §12). Don't let new
  files creep past it; split by responsibility (see how LAN transport split
  `HostTransport.ts`/`hostInbound.ts` — socket adapter vs. pure decision logic
  — specifically so the logic could be unit-tested without a native module).
- **Never commit secrets.** `.gitignore` blocks `google-services.json`,
  `GoogleService-Info.plist`, `.env*`, `*.pem`, `*.key`, `firebase-debug.log`.
  If you ever see one of these staged, stop and ask before committing.
- **Plan → execute pipeline for nontrivial features**: a high-effort planning
  pass (produce a concrete file-by-file design, resolve open questions, no
  code) followed by a separate execution pass that builds it, tests as it
  goes, and opens a PR. Used for the LAN transport work (#2 → PR #7); worth
  repeating for #3–#6 rather than freehanding a big feature in one pass.
- **Verify, don't just trust a worker's self-report.** After PR #7's
  `worker_done` claimed tests/lint/typecheck were clean, that was independently
  re-run from a fresh checkout before merging. Do the same before merging
  anything nontrivial.

## Running it

- `npm test` — Vitest, pure-logic only (ledger, store, wire protocol, transport
  decision logic). Fast, no native modules needed.
- `npm run typecheck`, `npm run lint` — should both be clean (lint's only
  acceptable warning is a cosmetic Node ESM one from `eslint.config.js`, plus
  possibly an unrelated `.expo/types/router.d.ts` warning).
- **This app cannot run in Expo Go** — `react-native-tcp-socket` is a native
  module. Needs a dev-client build (`eas build --profile development` or
  `preview`, per `eas.json`) installed on-device. `expo start` alone won't load
  the transport code.
- Fresh `npm install` may hit an `ERESOLVE` peer-dependency conflict (react/
  react-dom/expo versions) unrelated to any of this project's own code — use
  `npm install --legacy-peer-deps` if that happens.
- `npm run distribute:android -- <path-to-apk>` — uploads a build to Firebase
  App Distribution's `family` tester group (see `plan.md` §13 for the one-time
  manual console step this depends on).

## Suggested next step

Pick up one of issues #3/#4/#5 (independent of each other, no new native deps,
lowest risk) or #6 (CI build/distribution — now more useful since there's a
real multiplayer feature to test builds of). Follow the plan → execute pattern
above rather than jumping straight to code for anything bigger than a small
fix.
