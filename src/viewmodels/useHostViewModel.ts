import { useEffect, useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';

declare const require: (name: string) => any;

/** Composes connectionStore into exactly what app/host.tsx renders: the LAN
 * address to share, connected-peer count, and start/stop hosting. Per
 * plan.md Section 12's MVVM mapping — the screen itself stays presentational. */
export function useHostViewModel() {
  const status = useConnectionStore(s => s.status);
  const peerCount = useConnectionStore(s => s.peerCount);
  const lastError = useConnectionStore(s => s.lastError);
  const hostGame = useConnectionStore(s => s.hostGame);
  const leaveSession = useConnectionStore(s => s.leaveSession);
  const [ip, setIp] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Network = require('expo-network');
        const address = await Network.getIpAddressAsync();
        if (!cancelled) setIp(address);
      } catch {
        if (!cancelled) setIp(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Starts listening once, on mount. Deliberately does NOT stop hosting on
    // unmount — navigating on to /table must not tear down the session; only
    // an explicit stopHosting() (or leaving the game entirely) should.
    hostGame(DEFAULT_PORT);
  }, []);

  return {
    ip,
    port: DEFAULT_PORT,
    status,
    peerCount,
    error: lastError,
    isListening: status === 'listening',
    stopHosting: leaveSession,
  };
}
