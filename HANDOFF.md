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
  - #6 CI: build + distribute Android builds via GitHub Actions (PR #12–#15, #17, #18)
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
7. **CI Android APK build & GitHub Release** (PR #12–#15, #17, #18, Issue #6, #24) —
   - GHA workflow (`build-android.yml`) compiles `.apk` locally on `ubuntu-latest`
     via `eas build --local` (0 Expo cloud minutes), uploads the artifact, and
     publishes to GitHub Releases. Ignores doc-only (`*.md`) commits on push.
   - Configured with `concurrency: { group: ..., cancel-in-progress: true }` so that rapid merges cancel obsolete intermediate builds and only the latest commit builds fully.
   - Verified live with Release **Android Preview #14**.
8. **Local iOS Build & Direct TestFlight Submission** (`build-ios.yml`, PR #17, #22, #23, #34, #35, Issue #24, #26) —
   - Compiles `.ipa` locally on `macos-latest` GitHub runner (0 Expo cloud minutes).
   - Injects App Store Connect API Key (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`) into runner keychain.
   - Uploads directly to TestFlight from runner via Apple's native `xcrun altool --upload-app` (0 Expo cloud submit minutes).
   - Configured with `ITSAppUsesNonExemptEncryption: false` in `app.json` and `ascAppId: "6811088179"` in `eas.json`.
   - Verified live on TestFlight via GitHub Actions Run **#34625467295**!

9. **Multiplayer Lobby, Zero-Config LAN Discovery & Robust Socket Lifecycle** (PR #20, #28, Issues #29, #30, #31) —
   - **Host Profile & Setup**: Host enters/confirms their player name and token color before launching the room. Live lobby view at `app/host.tsx` waits for players to join over Wi-Fi (phone-per-player only) and enables "Start Game" once 2+ players are present.
   - **Socket Teardown & EADDRINUSE Fix**: Defensive cleanup in `HostTransport.listen()`, `connectionStore.hostGame()`, and `useHostViewModel` unmount prevents port collisions when backing out and re-hosting.
   - **Subnet TCP Discovery**: Zero-config Wi-Fi table discovery via fast parallel subnet probing (`discovery.ts`, `discoveryLogic.ts`) over port 51837. Players tapping "Join Game" automatically see active nearby tables with host avatar, name, and room count, with a 1-tap "Join Table" action (and collapsible manual IP fallback).

10. **Color Conflict Prevention & Interactive Alternative Color Selection** (PR #21) —
   - **Join-time Conflict Resolution**: When a player joins a table where their preferred color is already taken by the host or an earlier participant, the app presents an interactive **Color Selection Card** showing who holds the color and allows them to pick from remaining available colors before entering the table.
   - **Host Lobby Color Swatches**: Players in the lobby can tap their player token to cycle/change to an available color before starting.
   - **Pass & Play Collision Guard**: Guaranteed conflict-free auto-assignment of unused colors across all single-device players.

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

- `npm test` — Vitest, pure-logic test suite (87 tests across 12 suites).
- `npm run typecheck`, `npm run lint` — both clean.
- **This app cannot run in Expo Go** — `react-native-tcp-socket` is a native
  module. Use the automated APK from GitHub Releases or run a local dev build
  via `eas build --profile development`.
- **Native builds use `legacy-peer-deps`** — `.npmrc` and `package.json`
  `eas-build-pre-install` configure `legacy-peer-deps=true` so that `npm ci`
  inside `eas build --local` succeeds without peer dependency resolution conflicts.
- **EAS Project**: Linked to project ID `79ce84c4-5868-4ce2-977c-79569035af49`
  under owner `jpteruel95`. Requires `EXPO_TOKEN` secret in GitHub Actions.
- **Releases**: Download the latest installable Android APK from:
  `https://github.com/patterueldev/monopoly-helper/releases`

## How to Pick Up & Fix Issues (AI Guide)

1. **Check open issues**: Run `gh issue list` or check the issue number provided by the user.
2. **Branching**: Direct push to `main` is blocked. Create a feature branch: `git checkout -b <feat|fix|chore>/<issue-number>-<short-description>`.
3. **Architectural boundaries**:
   - Never import store/transport/react in `src/ledger/`.
   - Keep business logic in ViewModels (`src/viewmodels/` or `src/store/`), keeping `app/*.tsx` lean.
   - Keep files under 500 lines.
4. **Validation**: Run `npm test`, `npm run typecheck`, `npm run lint`. Ensure all 87+ tests pass.
5. **Pull Request**: Push branch, open PR via `gh pr create --title "..." --body "Closes #<id>"`.
6. **Merge**: Once checks pass, merge with `gh pr merge --squash --delete-branch`.

## Open Backlog Tracking

- 📌 **Issue #32**: Sideloaded APK installation compatibility for Android 12 (minSdkVersion 24 = Android 7.0+ supported; signature mismatch resolution documented in README).
- 📌 **Issue #33**: Distribution: Support installation on Samsung devices with Auto Blocker (Documented temporary workaround; track Google Play Console Internal Testing pipeline).

## Next steps & verification

- **Manual on-device testing**: Download the APK from the latest GitHub Release or iOS build from TestFlight onto physical devices and verify:
  1. Profile persistence across app restarts.
  2. 1-Tap Host Game creation and live lobby player list.
  3. Zero-config LAN table detection and 1-tap "Join Table" from nearby devices.
  4. Joining with a conflicting token color and selecting an alternative available color.
  5. Turn advancement and rent transfer advisory actions.
  6. Fast vs. Itemized settlement calculations and final winner tally.
