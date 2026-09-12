import { Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { incomingRequests, outgoingRequests } from '../src/ledger/selectors';
import { RequestOutcome, TransferReason } from '../src/ledger/types';
import { colors } from '../src/theme';

const reasonLabel = (reason: TransferReason) =>
  reason.kind === 'other' ? (reason.note || 'Other') : reason.kind.charAt(0).toUpperCase() + reason.kind.slice(1);

function ActionButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: primary ? colors.green : colors.white,
        borderColor: colors.green,
        borderWidth: 1.5,
      }}
    >
      <Text style={{ color: primary ? colors.white : colors.green, fontWeight: '800', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export default function Requests() {
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);
  const me = myAccount?.id ?? '';
  const symbol = state.config?.currencySymbol ?? '$';

  const name = (id: string) => state.accounts[id]?.name ?? id;
  const incoming = me ? incomingRequests(state, me) : [];
  const outgoing = me ? outgoingRequests(state, me) : [];

  const resolve = (requestId: string, outcome: RequestOutcome) => {
    if (!me) return;
    const result = dispatch({ type: 'request.resolved', actorId: me, intentId: `resolve-${Date.now()}-${requestId}-${outcome}`, payload: { requestId, outcome } });
    if (!result.ok) Alert.alert('Unable to resolve request', result.error);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Requests</Text>

        <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16 }}>To pay ({incoming.length})</Text>
        {incoming.length === 0 ? (
          <Text style={{ color: colors.muted }}>Nobody is asking you for money.</Text>
        ) : (
          incoming.map((r) => (
            <View key={r.id} style={{ backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 6, borderColor: colors.border, borderWidth: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800' }}>
                {name(r.createdBy)} requests {symbol}{r.amount.toLocaleString()}{r.to === 'bank' ? ' for the Bank' : ''}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>{reasonLabel(r.reason)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <ActionButton label="Approve & pay" primary onPress={() => resolve(r.id, 'paid')} />
                <ActionButton label="Decline" onPress={() => resolve(r.id, 'declined')} />
              </View>
            </View>
          ))
        )}

        <Text style={{ fontWeight: '800', color: colors.muted, fontSize: 16, marginTop: 8 }}>Sent ({outgoing.length})</Text>
        {outgoing.length === 0 ? (
          <Text style={{ color: colors.muted }}>You have no pending requests.</Text>
        ) : (
          outgoing.map((r) => (
            <View key={r.id} style={{ backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 6, borderColor: colors.border, borderWidth: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800' }}>
                You requested {symbol}{r.amount.toLocaleString()} from {name(r.from)}{r.to === 'bank' ? ' for the Bank' : ''}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>{reasonLabel(r.reason)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <ActionButton label="Cancel" onPress={() => resolve(r.id, 'cancelled')} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
