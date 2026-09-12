import { router } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { history, latestUndo } from '../src/ledger/selectors';
import { colors } from '../src/theme';

export default function History() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const undo = latestUndo(state);
  const symbol = state.config?.currencySymbol ?? '$';
  const name = (id: string) => state.accounts[id]?.name ?? id;
  const labelFor = (event: any): string => {
    if (event.type === 'transfer') return `${name(event.payload.from)} → ${name(event.payload.to)}  ${symbol}${event.payload.amount.toLocaleString()}`;
    if (event.type === 'request.created') {
      const { from, to, amount } = event.payload;
      return `${name(event.actorId)} requested ${symbol}${amount.toLocaleString()} from ${name(from)}${to === 'bank' ? ' for the Bank' : ''}`;
    }
    if (event.type === 'request.resolved') {
      const r = state.requests?.[event.payload.requestId];
      const detail = r ? `${name(r.from)} → ${r.to === 'bank' ? 'Bank' : name(r.to)} ${symbol}${r.amount.toLocaleString()}` : event.payload.requestId;
      return `Request ${event.payload.outcome}: ${detail}`;
    }
    return event.type;
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}><View style={{ padding: 20, gap: 8 }}><Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>History</Text>{undo && <Pressable onPress={() => { const result = dispatch({ type: 'transfer.reversed', actorId: 'bank', intentId: `undo-${Date.now()}-${undo.seq}`, payload: { targetSeq: undo.seq } }); if (result.ok) router.replace('/history'); }} style={{ backgroundColor: colors.green, padding: 14, borderRadius: 10, alignItems: 'center' }}><Text style={{ color: colors.white, fontWeight: '800' }}>Undo latest payment</Text></Pressable>}{history(state).map((entry: any) => { const event = entry.event; const label = labelFor(event); return <View key={`${event.seq}-${event.intentId}`} style={{ flexDirection: 'row', padding: 14, backgroundColor: entry.reversed ? '#eee' : colors.white, borderRadius: 8 }}><Text style={{ color: colors.muted, width: 42 }}>#{event.seq}</Text><Text style={{ textDecorationLine: entry.reversed ? 'line-through' : 'none' }}>{label}</Text></View>; })}</View></SafeAreaView>;
}
