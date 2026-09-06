import { useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { DEFAULT_PORT } from '../transport/wireProtocol';

/** Composes connectionStore into exactly what app/join.tsx renders: the
 * IP/port entry, connect action, and live status/error. Per plan.md
 * Section 12's MVVM mapping — the screen itself stays presentational. */
export function useJoinViewModel() {
  const status = useConnectionStore(s => s.status);
  const lastError = useConnectionStore(s => s.lastError);
  const joinGame = useConnectionStore(s => s.joinGame);
  const leaveSession = useConnectionStore(s => s.leaveSession);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(String(DEFAULT_PORT));

  // Leave a still-connecting attempt behind if this screen is dismissed before
  // it resolves — but not a session the user successfully joined and then
  // navigated on from (e.g. to /table), which owns its own lifetime after that.
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => () => { if (statusRef.current !== 'connected') leaveSession(); }, []);

  const connect = async () => {
    const portNumber = Number(port) || DEFAULT_PORT;
    if (!host.trim()) return { ok: false as const, error: 'Enter the host device’s IP address' };
    return joinGame(host.trim(), portNumber);
  };

  return {
    host,
    setHost,
    port,
    setPort,
    status,
    error: lastError,
    isConnecting: status === 'connecting' || status === 'reconnecting',
    isConnected: status === 'connected',
    connect,
  };
}
