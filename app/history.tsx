import { router } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { history, latestUndo } from '../src/ledger/selectors';
import { colors } from '../src/theme';

export default function History() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const undo = latestUndo(state);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}><View style={{ padding: 20, gap: 8 }}><Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>History</Text>{undo && <Pressable onPress={() => { const result = dispatch({ type: 'transfer.reversed', actorId: 'bank', intentId: `undo-${Date.now()}-${undo.seq}`, payload: { targetSeq: undo.seq } }); if (result.ok) router.replace('/history'); }} style={{ backgroundColor: colors.green, padding: 14, borderRadius: 10, alignItems: 'center' }}><Text style={{ color: colors.white, fontWeight: '800' }}>Undo latest payment</Text></Pressable>}{history(state).map((entry: any) => { const event = entry.event; const label = event.type === 'transfer' ? `${state.accounts[event.payload.from]?.name ?? event.payload.from} → ${state.accounts[event.payload.to]?.name ?? event.payload.to}  ${state.config?.currencySymbol ?? '$'}${event.payload.amount.toLocaleString()}` : event.type; return <View key={`${event.seq}-${event.intentId}`} style={{ flexDirection: 'row', padding: 14, backgroundColor: entry.reversed ? '#eee' : colors.white, borderRadius: 8 }}><Text style={{ color: colors.muted, width: 42 }}>#{event.seq}</Text><Text style={{ textDecorationLine: entry.reversed ? 'line-through' : 'none' }}>{label}</Text></View>; })}</View></SafeAreaView>;
}
