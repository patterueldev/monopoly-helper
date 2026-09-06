import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { activePlayers, balance } from '../src/ledger/selectors';
import { colors } from '../src/theme';

export default function Settlement() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const players = activePlayers(state);
  const [values, setValues] = useState<Record<string, string>>({});
  const end = () => {
    const rows = players.map((player) => { const valuation = Number(values[player.id] ?? 0); return { playerId: player.id, mode: 'fast' as const, valuation, cash: balance(state, player.id), assetTotal: valuation, netWorth: balance(state, player.id) + valuation }; });
    const ranked = [...rows].sort((a, b) => b.netWorth - a.netWorth).reduce<Array<typeof rows[number] & { rank: number }>>((all, row, i) => [...all, { ...row, rank: i === 0 || all[i - 1].netWorth !== row.netWorth ? i + 1 : all[i - 1].rank }], []);
    const result = dispatch({ type: 'game.ended', actorId: 'bank', intentId: `end-${Date.now()}`, payload: { tally: ranked } });
    if (result.ok) router.replace('/table');
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}><View style={{ padding: 20, gap: 10 }}><Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Settle the game</Text><Text style={{ color: colors.muted }}>Enter each player’s agreed property and building value.</Text>{players.map((p) => <View key={p.id} style={{ backgroundColor: colors.white, padding: 14, borderRadius: 10 }}><Text style={{ fontWeight: '800' }}>{p.name} · cash {balance(state, p.id).toLocaleString()}</Text><TextInput keyboardType="numbers-and-punctuation" placeholder="Assets / valuation" value={values[p.id] ?? ''} onChangeText={(value) => setValues({ ...values, [p.id]: value })} style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8, fontSize: 18 }} /></View>)}<Pressable onPress={end} style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Record standings</Text></Pressable></View></SafeAreaView>;
}
