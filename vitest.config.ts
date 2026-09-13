import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: {
      // Unit tests run in node, where the real react-native package (Flow
      // sources) cannot load. Route it to a minimal stub so modules that
      // transitively touch react-native (e.g. react-native-tcp-socket) stay
      // importable; see src/testSupport/reactNativeStub.ts.
      'react-native': fileURLToPath(new URL('./src/testSupport/reactNativeStub.ts', import.meta.url)),
      // The real socket module mixes CJS/ESM and is native-only; tests inject
      // transport fakes instead (see src/testSupport/tcpSocketStub.ts).
      'react-native-tcp-socket': fileURLToPath(new URL('./src/testSupport/tcpSocketStub.ts', import.meta.url)),
    },
  },
});
