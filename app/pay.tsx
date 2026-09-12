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
import { useConnectionStore } from '../src/store/connectionStore';
import { bankerAccountId } from '../src/ledger/selectors';
import { colors } from '../src/theme';
import { buildRequest, buildTransfer } from '../src/ledger/intents';
import { DEFAULT_QUICK_AMOUNTS, TransferReason } from '../src/ledger/types';

type ReasonKind = 'rent' | 'trade' | 'buy' | 'other';

const REASONS: Array<{ kind: ReasonKind; label: string }> = [
  { kind: 'rent', label: 'Rent' },
  { kind: 'trade', label: 'Trade' },
  { kind: 'buy', label: 'Buy' },
  { kind: 'other', label: 'Other' },
];

export default function Pay() {
  const { to: paramTo, reason: paramReason, from: paramFrom, mode: paramMode, collect: paramCollect } = useLocalSearchParams<{ to?: string; reason?: string; from?: string; mode?: string; collect?: string }>();
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);
  const role = useConnectionStore((x) => x.role);

  const players = Object.values(state.accounts).filter((a) => a.kind === 'player' && !state.eliminated.has(a.id));

  // Banker mode: the Host pays a player from the Bank (T-003). Only the Host
  // device acting as the Host's player account may use it; everyone else falls
  // back to a regular player-initiated payment.
  // Request mode: same screen asks another player to pay into my own account.
  // The Host (wearing the banker hat) may instead collect directly into the
  // Bank — that posts an immediate transfer, no approval (the Collect-for-Bank
  // flow); one request.created intent covers the approval-based half (T-011).
  const bankerId = bankerAccountId(state);
  const isRequestMode = paramMode === 'request';
  const canCollectForBank = role === 'host' && !!bankerId;
  const isBankerMode = !isRequestMode && paramFrom === 'bank' && role === 'host' && !!bankerId;
  const from = isBankerMode ? 'bank' : (myAccount?.id ?? '');

  const initialTo = isBankerMode
    ? (paramTo && players.some((p) => p.id === paramTo) ? paramTo : (players[0]?.id ?? ''))
    : (paramTo && paramTo !== myAccount?.id
      ? paramTo
      : (players.find((p) => p.id !== myAccount?.id)?.id ?? 'bank'));
  const initialReason: ReasonKind = REASONS.some((r) => r.kind === paramReason) ? (paramReason as ReasonKind) : 'other';

  const [to, setTo] = useState(initialTo);
  // Request mode reinterprets the fields: `payer` is who should pay, `destination`
  // is who-approved-money goes to (me, or the Bank when the Banker collects).
  const defaultDestination = isRequestMode
    ? (canCollectForBank && paramCollect === 'bank' ? 'bank' : (myAccount?.id ?? ''))
    : '';
  const [destination, setDestination] = useState(defaultDestination);
  const initialPayer = paramTo && players.some((p) => p.id === paramTo) && paramTo !== defaultDestination
    ? paramTo
    : (players.find((p) => p.id !== defaultDestination)?.id ?? '');
  const [payer, setPayer] = useState(initialPayer);
  const [reason, setReason] = useState<ReasonKind>(initialReason);
  const [amount, setAmount] = useState('');
  const [amountHistory, setAmountHistory] = useState<string[]>([]);
  // Older saved games may still carry the previous seven-button config. Keep
  // the new +5 shortcut available without requiring a new game.
  const quickAmounts = Array.from(new Set([...(state.config?.quickAmounts ?? DEFAULT_QUICK_AMOUNTS), 5])).sort((a, b) => a - b);

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

  const pickDestination = (next: string) => {
    setDestination(next);
    // Keep the payer valid: it can never equal the destination.
    if (payer === next) setPayer(players.find((p) => p.id !== next)?.id ?? '');
  };

  const submit = () => {
    if (isRequestMode) {
      const value = Number(amount);
      const transferReason: TransferReason = reason === 'other' ? { kind: 'other' } : { kind: reason };
      // The Banker's collection into the Bank is immediate — no payer approval.
      if (destination === 'bank' && bankerId) {
        if (!payer || payer === destination || !Number.isSafeInteger(value) || value <= 0) return;
        const intent = buildTransfer(state, payer, 'bank', value, transferReason, state.events.length);
        const result = dispatch({ ...intent, actorId: bankerId, intentId: `collect-${Date.now()}-${payer}-${value}` });
        if (result.ok) router.back();
        return;
      }
      const requester = myAccount?.id ?? '';
      if (!payer || !destination || !requester || payer === destination || !Number.isSafeInteger(value) || value <= 0) return;
      const intent = buildRequest(state, payer, destination, value, transferReason, requester, `request-${Date.now()}-${payer}-${destination}-${value}`);
      const result = dispatch(intent);
      if (result.ok) router.back();
      return;
    }
    const value = Number(amount);
    if (!from || !to || !Number.isSafeInteger(value) || value <= 0 || from === to) return;
    const transferReason: TransferReason = reason === 'other' ? { kind: 'other' } : { kind: reason };
    const intent = buildTransfer(state, from, to, value, transferReason, state.events.length);
    const result = dispatch({ ...intent, actorId: isBankerMode ? bankerId! : from, intentId: `payment-${Date.now()}-${from}-${to}-${value}` });
    if (result.ok) router.back();
  };

  const options = isRequestMode
    ? players // you can't bill the Bank; the "receive into" toggle below chooses Bank as destination instead
    : (isBankerMode ? players : [...players, { id: 'bank', name: 'Bank' }]);
  const visibleOptions = isRequestMode ? options.filter((p) => p.id !== destination) : options.filter((p) => p.id !== from);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>{isRequestMode ? (destination === 'bank' ? 'Collect for Bank' : 'Request money') : (isBankerMode ? 'Pay from Bank' : 'Pay')}</Text>

          {isRequestMode && canCollectForBank ? (
            <>
              <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>Receive into</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ id: myAccount?.id ?? '', label: 'Me' }, { id: 'bank', label: 'Bank' }].map((d) => {
                  const isSelected = destination === d.id;
                  return (
                    <Pressable
                      key={d.label}
                      onPress={() => pickDestination(d.id)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: isSelected ? '#DCEBE1' : colors.white,
                        borderColor: isSelected ? colors.green : colors.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text style={{ fontWeight: isSelected ? '700' : '400' }}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>{isRequestMode ? 'From' : 'To'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {visibleOptions
              .map((p) => {
                const isSelected = isRequestMode ? payer === p.id : to === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => (isRequestMode ? setPayer(p.id) : setTo(p.id))}
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

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {quickAmounts.map((n) => (
              <Pressable
                key={n}
                onPress={() => changeAmount(Number(amount || 0) + n)}
                style={{
                  width: '23%',
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
            <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>{isRequestMode ? (destination === 'bank' ? 'Collect into Bank' : 'Send request') : 'Confirm payment'}</Text>
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
