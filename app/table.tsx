import { Link, router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { activePlayers, balance, circulation } from '../src/ledger/selectors';
import { colors } from '../src/theme';
import { ConnectionBanner } from '../src/components/ConnectionBanner';

export default function Table() {
  useKeepAwake();
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);

  const players = activePlayers(state);
  const passGo = (id: string) =>
    dispatch({
      type: 'transfer',
      actorId: 'bank',
      intentId: `go-${Date.now()}-${id}`,
      payload: { from: 'bank', to: id, amount: state.config?.goSalary ?? 200, reason: { kind: 'go' } },
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Table</Text>
        <ConnectionBanner />

        {players.map((p) => {
          const isMe = p.id === myAccount?.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/pay', params: { to: p.id } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 17,
                backgroundColor: colors.white,
                borderRadius: 12,
                borderColor: isMe ? colors.green : 'transparent',
                borderWidth: isMe ? 2 : 0,
              }}
            >
              <View style={{ width: 16, height: 16, borderRadius: 8, marginRight: 12, backgroundColor: p.color }} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 19, fontWeight: '700' }}>{p.name}</Text>
                {isMe ? (
                  <View style={{ backgroundColor: '#DCEBE1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.green }}>You</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900' }}>
                {state.config?.currencySymbol}
                {balance(state, p.id).toLocaleString()}
              </Text>
            </Pressable>
          );
        })}

        <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 12 }}>
          In circulation · {state.config?.currencySymbol}
          {circulation(state).toLocaleString()}
        </Text>

        <Link href="/pay" asChild>
          <Pressable style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 19, fontWeight: '800' }}>Pay</Text>
          </Pressable>
        </Link>

        <Pressable
          onPress={() =>
            Alert.alert(
              'Pass GO',
              'Choose a player',
              players.map((p) => ({ text: p.name, onPress: () => passGo(p.id) }))
            )
          }
          style={{ borderColor: colors.green, borderWidth: 2, padding: 15, borderRadius: 12, alignItems: 'center' }}
        >
          <Text style={{ color: colors.green, fontSize: 17, fontWeight: '800' }}>Pass GO</Text>
        </Pressable>

        <Link href="/settlement" asChild>
          <Pressable style={{ borderColor: colors.green, borderWidth: 2, padding: 15, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontSize: 17, fontWeight: '800' }}>End game & settle</Text>
          </Pressable>
        </Link>

        <Link href="/history" asChild>
          <Pressable style={{ padding: 15, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontWeight: '800' }}>History</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
