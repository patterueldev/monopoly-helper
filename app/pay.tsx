import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { colors } from '../src/theme';
import { buildTransfer } from '../src/ledger/intents';

export default function Pay() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const players = Object.values(state.accounts).filter((a) => a.kind === 'player' && !state.eliminated.has(a.id));
  const [from, setFrom] = useState(players[0]?.id ?? '');
  const [to, setTo] = useState(players[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const submit = () => {
    const value = Number(amount);
    if (!from || !to || !Number.isSafeInteger(value) || value <= 0 || from === to) return;
    const intent = buildTransfer(state, from, to, value, { kind: 'other' }, state.events.length);
    const result = dispatch({ ...intent, intentId: `payment-${Date.now()}-${from}-${to}-${value}` });
    if (result.ok) router.back();
  };
  const options = [...players, { id: 'bank', name: 'Bank' }];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}><View style={{ padding: 20, gap: 12 }}><Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Pay</Text><Text style={{ fontWeight: '800', color: colors.muted }}>From</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{players.map((p) => <Pressable key={p.id} onPress={() => setFrom(p.id)} style={{ padding: 12, borderRadius: 10, backgroundColor: from === p.id ? '#DCEBE1' : colors.white }}><Text>{p.name}</Text></Pressable>)}</View><Text style={{ fontWeight: '800', color: colors.muted }}>To</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.filter((p) => p.id !== from).map((p) => <Pressable key={p.id} onPress={() => setTo(p.id)} style={{ padding: 12, borderRadius: 10, backgroundColor: to === p.id ? '#DCEBE1' : colors.white }}><Text>{p.name}</Text></Pressable>)}</View><TextInput autoFocus keyboardType="number-pad" value={amount} onChangeText={setAmount} placeholder="Amount" style={{ backgroundColor: colors.white, fontSize: 34, padding: 16, borderRadius: 12, textAlign: 'center' }} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{(state.config?.quickAmounts ?? []).map((n) => <Pressable key={n} onPress={() => setAmount(String(n))} style={{ padding: 12, backgroundColor: '#EDE4D1', borderRadius: 9 }}><Text>{n}</Text></Pressable>)}</View><Pressable onPress={submit} style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Confirm payment</Text></Pressable></View></SafeAreaView>;
}
