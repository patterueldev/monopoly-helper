import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import { DEFAULT_CONFIG, Account } from '../src/ledger/types';
import { useGameStore } from '../src/store/gameStore';

const palette = [colors.red, colors.blue, colors.purple, colors.teal, colors.orange, colors.pink, colors.lime, colors.gold];

export default function Setup() {
  const [names, setNames] = useState(['', '']);
  const createGame = useGameStore((x) => x.createGame);
  const start = () => {
    const bank: Account = { id: 'bank', kind: 'bank', name: 'Bank', color: colors.green, unlimited: true, assets: [] };
    const accounts: Account[] = [bank, ...names.filter(Boolean).map((name, i) => ({ id: `p${i + 1}`, kind: 'player' as const, name, color: palette[i], unlimited: false, assets: [] }))];
    const result = createGame(DEFAULT_CONFIG, accounts);
    if (result.ok) router.replace('/table');
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}><View style={{ padding: 24, gap: 10 }}><Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Set up your table</Text><Text style={{ color: colors.muted }}>Add 2–8 players</Text>{names.map((name, i) => <TextInput key={i} value={name} onChangeText={(value) => setNames((all) => all.map((x, j) => j === i ? value : x))} placeholder={`Player ${i + 1}`} style={{ backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 18 }} />)}{names.length < 8 && <Pressable onPress={() => setNames((all) => [...all, ''])}><Text style={{ color: colors.green, fontWeight: '800', fontSize: 17 }}>+ Add player</Text></Pressable>}<Pressable onPress={start} style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: colors.white, fontSize: 19, fontWeight: '800' }}>Start game</Text></Pressable></View></SafeAreaView>;
}
