# Monopoly Banker

Offline event-sourced banker for a physical Monopoly table. The ledger is pure and replayable; the app stores accepted event logs locally and derives balances, circulation, history, and standings.

## Development

```sh
npm install
npm run test
npm run typecheck
npx expo start
```

## Distribution

`eas.json` has development, Firebase-ready Android preview APK, and production iOS profiles. Set the EAS project ID in `app.json`, then use `eas build --profile preview --platform android` and upload the APK through Firebase App Distribution. For TestFlight, configure the Apple team/App Store Connect credentials and run `eas build --profile production --platform ios` followed by `eas submit --platform ios --profile production`. No credentials or uploads are stored in this repository.
