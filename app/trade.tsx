import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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

const validAmount = (value: number) => Number.isSafeInteger(value) && value > 0;

function AmountField({ label, value, onChange, quickAmounts }: { label: string; value: string; onChange: (next: string) => void; quickAmounts: number[] }) {
  const bump = (n: number) => onChange(String(Math.max(0, Math.floor(Number(value || 0) + n))));
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.white,
          fontSize: 30,
          padding: 10,
          borderRadius: 12,
          textAlign: 'center',
          borderColor: colors.border,
          borderWidth: 1,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {quickAmounts.map((n) => (
          <Pressable
            key={n}
            onPress={() => bump(n)}
            style={{ flex: 1, paddingVertical: 9, backgroundColor: '#EDE4D1', borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ fontWeight: '700', fontSize: 13 }}>+{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Trade() {
  const { to: paramTo } = useLocalSearchParams<{ to?: string }>();
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);

  const players = Object.values(state.accounts).filter((a) => a.kind === 'player' && !state.eliminated.has(a.id));
  const partners = players.filter((p) => p.id !== myAccount?.id);

  const [partnerId, setPartnerId] = useState(
    paramTo && partners.some((p) => p.id === paramTo) ? paramTo : (partners[0]?.id ?? '')
  );
  const [give, setGive] = useState('');
  const [receive, setReceive] = useState('');

  const quickAmounts = state.config?.quickAmounts ?? [1, 10, 20, 50, 100, 200, 500];
  const from = myAccount?.id ?? '';
  const partner = partners.find((p) => p.id === partnerId);

  const submit = () => {
    const giveValue = Number(give);
    const receiveValue = Number(receive);
    if (!from || !partnerId || from === partnerId || !validAmount(giveValue) || !validAmount(receiveValue)) return;
    const ts = Date.now();
    const giveIntent = {
      ...buildTransfer(state, from, partnerId, giveValue, { kind: 'trade' }, state.events.length),
      intentId: `trade-${ts}-give-${from}-${partnerId}`,
    };
    const first = dispatch(giveIntent);
    if (!first.ok) {
      Alert.alert('Unable to submit trade', first.error);
      return;
    }
    const receiveIntent = {
      ...buildTransfer(state, partnerId, from, receiveValue, { kind: 'trade' }, state.events.length),
      intentId: `trade-${ts}-receive-${partnerId}-${from}`,
    };
    const second = dispatch(receiveIntent);
    if (!second.ok) {
      Alert.alert('Trade partially applied', `You paid ${partner?.name ?? 'partner'} but their payment failed: ${second.error}`);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Trade</Text>
          <Text style={{ color: colors.muted, fontSize: 15 }}>
            Exchange money both ways with another player, outside a one-way payment.
          </Text>

          <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>With</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {partners.map((p) => {
              const isSelected = partnerId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPartnerId(p.id)}
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

          <AmountField label="You give" value={give} onChange={setGive} quickAmounts={quickAmounts} />
          <AmountField label="You receive" value={receive} onChange={setReceive} quickAmounts={quickAmounts} />

          <Pressable
            onPress={submit}
            style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Confirm trade</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
