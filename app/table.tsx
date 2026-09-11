import { Link, router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { activePlayers, balance, circulation, currentTurnPlayer, nextTurnPlayer, isJailed } from '../src/ledger/selectors';
import { colors } from '../src/theme';
import { ConnectionBanner } from '../src/components/ConnectionBanner';

export default function Table() {
  useKeepAwake();
  const state = useGameStore((x) => x.state);
  const dispatch = useGameStore((x) => x.dispatch);
  const findMyAccount = useProfileStore((x) => x.findMyAccount);
  const myAccount = findMyAccount(state.accounts);

  const players = activePlayers(state);
  const currentTurn = currentTurnPlayer(state);
  const nextTurn = nextTurnPlayer(state);
  const isMyTurn = !!(currentTurn && myAccount && currentTurn.id === myAccount.id);

  const passGo = (id: string) =>
    dispatch({
      type: 'transfer',
      actorId: 'bank',
      intentId: `go-${Date.now()}-${id}`,
      payload: { from: 'bank', to: id, amount: state.config?.goSalary ?? 200, reason: { kind: 'go' } },
    });

  const advanceTurn = () => {
    if (!nextTurn) return;
    dispatch({
      type: 'turn.advanced',
      actorId: currentTurn?.id ?? 'bank',
      intentId: `turn-${Date.now()}-${nextTurn.id}`,
      payload: { toAccountId: nextTurn.id },
    });
  };

  const toggleJail = (id: string) => {
    const jailed = isJailed(state, id);
    dispatch({
      type: jailed ? 'player.released' : 'player.jailed',
      actorId: 'bank',
      intentId: `jail-${Date.now()}-${id}`,
      payload: { accountId: id },
    });
  };

  const onPlayerPress = (p: typeof players[0]) => {
    const jailed = isJailed(state, p.id);
    Alert.alert(p.name, `${state.config?.currencySymbol}${balance(state, p.id).toLocaleString()} · ${jailed ? 'In Jail' : 'Active'}`, [
      { text: 'Pay this player', onPress: () => router.push({ pathname: '/pay', params: { to: p.id } }) },
      { text: jailed ? 'Release from Jail' : 'Send to Jail', onPress: () => toggleJail(p.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 34, fontWeight: '900', color: colors.green }}>Table</Text>
        <ConnectionBanner />

        {/* Turn Card */}
        {currentTurn ? (
          <View
            style={{
              backgroundColor: isMyTurn ? '#DCEBE1' : colors.white,
              borderRadius: 14,
              padding: 16,
              borderColor: isMyTurn ? colors.green : colors.border,
              borderWidth: 2,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: currentTurn.color }} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.green }}>
                  {isMyTurn ? 'Your turn!' : `${currentTurn.name}’s turn`}
                </Text>
              </View>
              {isJailed(state, currentTurn.id) ? (
                <View style={{ backgroundColor: '#FDE8E8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ color: colors.red, fontSize: 12, fontWeight: '800' }}>🔒 In Jail</Text>
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => router.push({ pathname: '/pay', params: { to: currentTurn.id, reason: 'rent' } })}
                style={{
                  flex: 1,
                  backgroundColor: colors.green,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.white, fontWeight: '700', fontSize: 14 }}>Collect Rent</Text>
              </Pressable>

              <Pressable
                onPress={advanceTurn}
                style={{
                  flex: 1,
                  borderColor: colors.green,
                  borderWidth: 1.5,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: colors.white,
                }}
              >
                <Text style={{ color: colors.green, fontWeight: '700', fontSize: 14 }}>End Turn →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Players List */}
        <View style={{ gap: 8 }}>
          {players.map((p) => {
            const isMe = p.id === myAccount?.id;
            const isTurn = p.id === currentTurn?.id;
            const jailed = isJailed(state, p.id);

            return (
              <Pressable
                key={p.id}
                onPress={() => onPlayerPress(p)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  backgroundColor: colors.white,
                  borderRadius: 12,
                  borderColor: isTurn ? colors.green : isMe ? colors.border : 'transparent',
                  borderWidth: isTurn ? 2 : 1,
                }}
              >
                <View style={{ width: 16, height: 16, borderRadius: 8, marginRight: 12, backgroundColor: p.color }} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700' }}>{p.name}</Text>
                  {isMe ? (
                    <View style={{ backgroundColor: '#DCEBE1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.green }}>You</Text>
                    </View>
                  ) : null}
                  {isTurn ? (
                    <View style={{ backgroundColor: '#EDE4D1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink }}>Turn</Text>
                    </View>
                  ) : null}
                  {jailed ? (
                    <View style={{ backgroundColor: '#FDE8E8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.red }}>🔒 Jail</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900' }}>
                  {state.config?.currencySymbol}
                  {balance(state, p.id).toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 6, fontSize: 14 }}>
          In circulation · {state.config?.currencySymbol}
          {circulation(state).toLocaleString()}
        </Text>

        <Link href="/pay" asChild>
          <Pressable style={{ backgroundColor: colors.green, padding: 16, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Pay</Text>
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
          style={{ borderColor: colors.green, borderWidth: 2, padding: 14, borderRadius: 12, alignItems: 'center' }}
        >
          <Text style={{ color: colors.green, fontSize: 16, fontWeight: '800' }}>Pass GO</Text>
        </Pressable>

        <Link href="/settlement" asChild>
          <Pressable style={{ borderColor: colors.green, borderWidth: 2, padding: 14, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontSize: 16, fontWeight: '800' }}>End game & settle</Text>
          </Pressable>
        </Link>

        <Link href="/history" asChild>
          <Pressable style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontWeight: '800', fontSize: 16 }}>History</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
