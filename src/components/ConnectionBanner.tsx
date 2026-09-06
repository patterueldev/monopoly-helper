import { Text, View } from 'react-native';
import { useConnectionStore } from '../store/connectionStore';
import { colors } from '../theme';

const LABELS: Record<string, string> = {
  idle: '',
  listening: 'Hosting',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Lost connection to host',
  error: 'Connection error',
};

/** Small presentational status strip — reused on app/table.tsx and, optionally,
 * app/pay.tsx. Renders nothing in single-device play (role === 'single'). */
export function ConnectionBanner() {
  const role = useConnectionStore(s => s.role);
  const status = useConnectionStore(s => s.status);
  const peerCount = useConnectionStore(s => s.peerCount);
  const lastError = useConnectionStore(s => s.lastError);

  if (role === 'single') return null;

  const label = role === 'host'
    ? `${LABELS[status] || status} · ${peerCount} ${peerCount === 1 ? 'player' : 'players'} connected`
    : LABELS[status] || status;

  const tone = status === 'connected' || status === 'listening' ? colors.green : status === 'reconnecting' || status === 'connecting' ? colors.gold : colors.red;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.white, borderRadius: 10, borderColor: colors.border, borderWidth: 1 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone }} />
      <Text style={{ color: colors.ink, fontWeight: '700', flex: 1 }}>{label}</Text>
      {lastError && status !== 'connected' && status !== 'listening' ? <Text style={{ color: colors.red, fontSize: 12 }}>{lastError}</Text> : null}
    </View>
  );
}
