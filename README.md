# Monopoly Banker

> A real-time companion app and event-sourced digital banker for physical Monopoly board games with family and friends.

Monopoly Banker replaces physical paper cash and the banker's mental arithmetic while leaving the physical board, dice, properties, and cards right on the table. Players connect over local Wi-Fi (one phone hosts, other phones join) to track cash balances, execute transfers with 1-tap undo, manage turns, and calculate final settlement standings.

---

## Key Features

- **Pure Event-Sourced Ledger**: Append-only immutable transaction log folded into derived state (`GameState`). Zero data mutation, instant transaction reversals/undo, real-time cash in circulation calculation, and full audit trail.
- **Zero-Config LAN Multiplayer**: Fast parallel subnet scanning (`/24` subnet on port `51837` via native TCP sockets). Players tap "Join Game" and automatically see host tables nearby on the same Wi-Fi network.
- **1-Tap Host Setup & Live Lobby**: Host sets their player profile and opens a live lobby. Starts automatically when 2+ players join over Wi-Fi.
- **Smart Color Conflict Resolution**: Prevents duplicate player token colors upon joining with an interactive color selection card to choose from remaining available colors.
- **Turn & Jail Tracking (Advisory)**: Turn advancement indicator, jailed/released status toggles, and advisory rent calculator presets.
- **Endgame Settlement & Standings**: Supports both rapid cash settlement and full itemized property/houses/hotels/mortgages net worth calculation to determine the winner.
- **Persistent Player Profile**: Player name and token color saved locally across sessions using MMKV storage.

---

## Architecture & Design Principles

The codebase strictly follows **SOLID** principles and a clean **MVVM (Model-View-ViewModel)** architecture:

```
src/
├── ledger/          # [Model] Pure TypeScript business logic (Zero React, Zero I/O)
│   ├── types.ts     # Zod-validated GameEvent and GameState schemas
│   ├── reducer.ts   # applyEvent, fold, initialState
│   ├── selectors.ts # Derived balances, net worth, circulation, history
│   └── intents.ts   # Transfer and reversal intent builders
├── store/           # [ViewModel - Stores] Zustand state management
│   ├── gameStore.ts       # Active game ledger and event log
│   ├── connectionStore.ts # Host/Client networking state & socket management
│   ├── profileStore.ts    # Local user profile state
│   └── persistence.ts     # MMKV local storage adapters
├── transport/       # [Networking] TCP socket and LAN discovery transport
│   ├── discovery.ts       # Subnet scanner & ping broadcast logic
│   ├── HostTransport.ts   # Host TCP server handling client connections
│   ├── ClientTransport.ts # Client TCP connection to host
│   └── Transport.ts       # Common transport interface & NDJSON framing
├── viewmodels/      # [ViewModel - Hooks] Screen-specific logic & presentation state
│   ├── useHostViewModel.ts
│   ├── useJoinViewModel.ts
│   └── useSettlementViewModel.ts
└── components/      # Reusable UI elements (Buttons, Cards, ColorPickers, Modals)

app/                 # [View] Expo Router navigation screens
├── index.tsx        # Home screen (Profile, Host Game, Join Game, Solo mode)
├── host.tsx         # Host live multiplayer room lobby
├── join.tsx         # LAN table discovery & color conflict resolution
├── game.tsx         # Active game dashboard (Banker, Turn, Players, History)
├── pay.tsx          # Transfer creation screen (Player-to-Player, Bank, GO)
└── settlement.tsx   # Final game settlement & leaderboard
```

### Architectural Boundaries
1. **Model Layer (`src/ledger/`)**: Completely decoupled from React, UI, and networking. Enforced via ESLint `no-restricted-imports`.
2. **ViewModel Layer (`src/store/`, `src/viewmodels/`)**: Coordinates ledger state, networking sockets, and exposes state/actions to screens.
3. **View Layer (`app/`, `src/components/`)**: Declarative Expo Router screens that consume ViewModels.
4. **File Length Cap**: Max 500 lines per file (enforced via ESLint `max-lines`).

---

## Development

### Prerequisites
- Node.js 20+
- npm 10+
- Expo CLI (`npx expo`)

### Setup & Scripts

```sh
# Install dependencies (respects legacy peer deps for native modules)
npm install

# Run pure ledger & viewmodel unit test suite (Vitest)
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint (architecture boundaries & code style)
npm run lint

# Start Expo development server (requires custom dev client for native sockets)
npm start
```

> **Note on Expo Go**: Because this project uses `react-native-tcp-socket` for local Wi-Fi multiplayer, it **cannot** run inside the standard Expo Go sandbox app. Use an installable build (APK / TestFlight) or compile a local development build (`eas build --profile development`).

---

## CI/CD & Build Pipelines

Both Android and iOS builds are fully automated via GitHub Actions using **local runner compilation** (`eas build --local`), consuming **0 Expo cloud build minutes**.

### CI (`.github/workflows/ci.yml`)
- Runs on every pull request targeting `main`.
- Gates the merge on `npm test`, `npm run typecheck`, and `npm run lint`.
- Superseded runs are cancelled automatically (`cancel-in-progress`).

### Release version gate (`.github/workflows/version-check.yml`)
- Runs on every pull request targeting `main`.
- A version bump is **required** when the PR touches app code or build config (`app/`, `src/`, `assets/`, `app.json`, `package.json`, `eas.json`, toolchain configs, `google-services.json`).
- Docs-only / CI-only PRs may merge without a bump; a bump is still accepted if present.
- When required, `app.json` (`expo.version`) and `package.json` (`version`) must match and be strictly higher than the version on `main`.
- `.github/workflows/tag-version.yml` creates an immutable `vX.Y.Z` git tag after a merge to `main` (or skips if the version is unchanged).

### Release builds (`.github/workflows/release.yml`)
- Runs on every push to `main` and detects whether `app.json`'s version changed.
- When a version bump merged, it calls **both** build workflows in parallel — never cancels an in-flight release:
  - Android → installable APK published to **GitHub Releases**.
  - iOS → signed production IPA uploaded directly to **Apple TestFlight** (no GitHub Release; the IPA is kept as a 14-day workflow artifact for debugging).
- Merges without a version bump build nothing.
- Both build workflows (`.github/workflows/build-android.yml`, `.github/workflows/build-ios.yml`) are also manually dispatchable; iOS accepts a `production`/`preview` profile and an optional TestFlight upload flag.

### iOS signing secrets
The iOS workflow compiles and signs locally on `macos-latest` using App Store Connect credentials stored in GitHub Secrets:
- `ASC_KEY_ID`: App Store Connect API Key ID
- `ASC_ISSUER_ID`: App Store Connect Issuer UUID
- `ASC_PRIVATE_KEY`: App Store Connect AuthKey (`.p8` private key)
- Uploads to **Apple TestFlight** from the runner using `xcrun altool --upload-app`.
- **Download**: [Latest Android APK Releases](https://github.com/patterueldev/monopoly-helper/releases). iOS builds go to TestFlight only — no iOS GitHub Releases.

---

## Device Troubleshooting & Compatibility

### Android 12+ "App Not Installed"
If sideloading an APK fails on Android 12 (API 31+):
- **Signature conflict**: If an earlier version of the app (or debug build) was installed with a different key, Android will reject the update. **Uninstall the previous version from the device first**, then install the new APK.
- **Install unknown apps**: Ensure your browser or file manager has "Allow from this source" enabled in *Settings -> Apps -> Special app access -> Install unknown apps*.

### Samsung One UI 6+ Auto Blocker
Samsung devices running One UI 6+ (Android 14) have "Auto Blocker" turned on by default, preventing third-party APK sideloading:
- **Workaround**: Go to **Settings -> Security and privacy -> Auto Blocker** and toggle it **OFF** before installing the APK.
- **Google Play Distribution**: Issue [#33](https://github.com/patterueldev/monopoly-helper/issues/33) tracks distributing via Google Play Console Internal Testing track, which bypasses Samsung Auto Blocker automatically.

---

## Contribution & Workflow

1. **Branch Protection**: Direct pushes to `main` are disabled. All changes must be made on feature branches and submitted via Pull Requests.
2. **Verification Gate**: Every PR must pass:
   - `npm test` (Unit tests)
   - `npm run typecheck` (TypeScript)
   - `npm run lint` (ESLint & architectural boundaries)
3. **Issue Workflow**:
   - File discrete GitHub Issues for new features, bug fixes, or enhancements.
   - Branch off `main` (`feat/...`, `fix/...`, `chore/...`).
   - Create PR referencing the issue (e.g. `Closes #123`).
   - Squash and merge upon passing CI checks.
