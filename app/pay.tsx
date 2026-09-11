import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { colors } from '../src/theme';
import { buildTransfer } from '../src/ledger/intents';
import { TransferReason } from '../src/ledger/types';

type ReasonKind = 'rent' | 'trade' | 'tax' | 'buy' | 'card' | 'go' | 'other';

const REASONS: Array<{ kind: ReasonKind; label: string }> = [
  { kind: 'rent', label: 'Rent' },
  { kind: 'trade', label: 'Trade' },
  { kind: 'tax', label: 'Tax' },
  { kind: 'buy', label: 'Buy' },
  { kind: 'card', label: 'Card' },
  { kind: 'go', label: 'Pass GO' },
  { kind: 'other', label: 'Other' },
];

export default function Pay() {
  const { to: paramTo, reason: paramReason } = useLocalSearchParams<{ to?: string; reason?: string }>();
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);

  const players = Object.values(state.accounts).filter((a) => a.kind === 'player' && !state.eliminated.has(a.id));

  const initialFrom = myAccount ? myAccount.id : (players.find((p) => p.id !== paramTo)?.id ?? players[0]?.id ?? '');
  const initialTo = paramTo ?? (players.find((p) => p.id !== initialFrom)?.id ?? 'bank');
  const initialReason: ReasonKind = REASONS.some((r) => r.kind === paramReason) ? (paramReason as ReasonKind) : 'other';

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [reason, setReason] = useState<ReasonKind>(initialReason);
  const [amount, setAmount] = useState('');

  const submit = () => {
    const value = Number(amount);
    if (!from || !to || !Number.isSafeInteger(value) || value <= 0 || from === to) return;
    const transferReason: TransferReason = reason === 'other' ? { kind: 'other' } : { kind: reason };
    const intent = buildTransfer(state, from, to, value, transferReason, state.events.length);
    const result = dispatch({ ...intent, intentId: `payment-${Date.now()}-${from}-${to}-${value}` });
    if (result.ok) router.back();
  };

  const options = [...players, { id: 'bank', name: 'Bank' }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Pay</Text>

        <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>From</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {players.map((p) => {
            const isMe = p.id === myAccount?.id;
            const isSelected = from === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setFrom(p.id)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: isSelected ? '#DCEBE1' : colors.white,
                  borderColor: isSelected ? colors.green : colors.border,
                  borderWidth: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                <Text style={{ fontWeight: isSelected ? '700' : '400' }}>
                  {p.name} {isMe ? '(You)' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>To</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options
            .filter((p) => p.id !== from)
            .map((p) => {
              const isMe = p.id === myAccount?.id;
              const isSelected = to === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setTo(p.id)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#DCEBE1' : colors.white,
                    borderColor: isSelected ? colors.green : colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ fontWeight: isSelected ? '700' : '400' }}>
                    {p.name} {isMe ? '(You)' : ''}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        {/* Reason Selector */}
        <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>Reason</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REASONS.map((r) => {
            const isSelected = reason === r.kind;
            return (
              <Pressable
                key={r.kind}
                onPress={() => setReason(r.kind)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: isSelected ? colors.green : colors.white,
                  borderColor: isSelected ? colors.green : colors.border,
                  borderWidth: 1,
                }}
              >
                <Text style={{ color: isSelected ? colors.white : colors.ink, fontWeight: '700', fontSize: 13 }}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          autoFocus
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount"
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.white,
            fontSize: 34,
            padding: 16,
            borderRadius: 12,
            textAlign: 'center',
            borderColor: colors.border,
            borderWidth: 1,
          }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
          {(state.config?.quickAmounts ?? [50, 100, 200, 500]).map((n) => (
            <Pressable
              key={n}
              onPress={() => setAmount(String(n))}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: '#EDE4D1',
                borderRadius: 9,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={submit}
          style={{
            backgroundColor: colors.green,
            padding: 17,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Confirm payment</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
