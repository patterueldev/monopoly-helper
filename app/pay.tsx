import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { colors } from '../src/theme';
import { buildTransfer } from '../src/ledger/intents';
import { TransferReason } from '../src/ledger/types';

type ReasonKind = 'rent' | 'trade' | 'tax' | 'buy' | 'card' | 'go' | 'station' | 'other';

const REASONS: Array<{ kind: ReasonKind; label: string }> = [
  { kind: 'rent', label: 'Rent' },
  { kind: 'trade', label: 'Trade' },
  { kind: 'tax', label: 'Tax' },
  { kind: 'buy', label: 'Buy' },
  { kind: 'station', label: 'Station' },
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

  const initialTo = paramTo && paramTo !== myAccount?.id
    ? paramTo
    : (players.find((p) => p.id !== myAccount?.id)?.id ?? 'bank');
  const initialReason: ReasonKind = REASONS.some((r) => r.kind === paramReason) ? (paramReason as ReasonKind) : 'other';

  const [to, setTo] = useState(initialTo);
  const [reason, setReason] = useState<ReasonKind>(initialReason);
  const [amount, setAmount] = useState('');
  const [amountHistory, setAmountHistory] = useState<string[]>([]);

  const amountInputAccessoryId = 'pay-amount-input-accessory';

  const changeAmount = (next: number) => {
    const safeNext = Math.max(0, Math.floor(next));
    setAmountHistory((history) => [...history, amount]);
    setAmount(String(safeNext));
  };

  const undoAmount = () => {
    const previous = amountHistory[amountHistory.length - 1];
    if (previous === undefined) return;
    setAmount(previous);
    setAmountHistory(amountHistory.slice(0, -1));
  };

  const submit = () => {
    const value = Number(amount);
    const from = myAccount?.id ?? '';
    if (!from || !to || !Number.isSafeInteger(value) || value <= 0 || from === to) return;
    const transferReason: TransferReason = reason === 'other' ? { kind: 'other' } : { kind: reason };
    const intent = buildTransfer(state, from, to, value, transferReason, state.events.length);
    const result = dispatch({ ...intent, intentId: `payment-${Date.now()}-${from}-${to}-${value}` });
    if (result.ok) router.back();
  };

  const options = [...players, { id: 'bank', name: 'Bank' }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Pay</Text>

          <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>To</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {options
              .filter((p) => p.id !== myAccount?.id)
              .map((p) => {
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
                    <Text style={{ fontWeight: isSelected ? '700' : '400' }}>{p.name}</Text>
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityLabel="Decrease amount by one"
              onPress={() => changeAmount(Number(amount || 0) - 1)}
              style={{ width: 48, height: 56, borderRadius: 12, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.green, fontSize: 28, fontWeight: '800' }}>−</Text>
            </Pressable>

            <TextInput
              inputAccessoryViewID={amountInputAccessoryId}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount"
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                backgroundColor: colors.white,
                fontSize: 34,
                padding: 10,
                borderRadius: 12,
                textAlign: 'center',
                borderColor: colors.border,
                borderWidth: 1,
              }}
            />

            <Pressable
              accessibilityLabel="Increase amount by one"
              onPress={() => changeAmount(Number(amount || 0) + 1)}
              style={{ width: 48, height: 56, borderRadius: 12, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.green, fontSize: 28, fontWeight: '800' }}>+</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
            {(state.config?.quickAmounts ?? [50, 100, 200, 500]).map((n) => (
              <Pressable
                key={n}
                onPress={() => changeAmount(Number(amount || 0) + n)}
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor: '#EDE4D1',
                  borderRadius: 9,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 16 }}>+{n}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={amountHistory.length === 0}
            onPress={undoAmount}
            style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, opacity: amountHistory.length === 0 ? 0.4 : 1 }}
          >
            <Text style={{ color: colors.green, fontWeight: '800', fontSize: 15 }}>Undo amount</Text>
          </Pressable>

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

        {Platform.OS === 'ios' ? (
          <InputAccessoryView nativeID={amountInputAccessoryId}>
            <View style={{ backgroundColor: colors.cream, alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderTopColor: colors.border, borderTopWidth: 1 }}>
              <Button title="Done" onPress={Keyboard.dismiss} />
            </View>
          </InputAccessoryView>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
