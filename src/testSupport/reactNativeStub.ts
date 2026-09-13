// Minimal react-native stand-in for the Vitest (node) environment, wired via
// vitest.config.ts. Production code must never import this file directly — it
// exists so modules that transitively touch react-native (e.g. anything
// importing react-native-tcp-socket) stay importable in unit tests. Anything
// exercising real native behavior is covered by on-device verification.
export const NativeModules: Record<string, unknown> = {};

export class NativeEventEmitter {
  addListener(): { remove(): void } {
    return { remove() {} };
  }

  removeAllListeners(): void {}

  removeSubscription(): void {}
}

export const Platform = {
  OS: 'unknown',
  select: <T>(options: Record<string, T>): T | undefined => options.default,
};
