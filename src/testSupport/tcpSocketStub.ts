// react-native-tcp-socket stand-in for the Vitest (node) environment, wired
// via vitest.config.ts. The real module mixes CJS/ESM in a way node cannot
// load, and its behavior is native anyway (this repo covers transports with
// on-device verification, not unit tests). Tests that need a transport inject
// fakes through ConnectionTransports instead of touching this stub.
const TcpSocket = {
  createConnection: (): never => {
    throw new Error('react-native-tcp-socket is stubbed in tests');
  },
  createServer: (): never => {
    throw new Error('react-native-tcp-socket is stubbed in tests');
  },
};

export default TcpSocket;
