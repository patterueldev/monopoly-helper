import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import { useSettlementViewModel } from '../src/viewmodels/useSettlementViewModel';

export default function Settlement() {
  const vm = useSettlementViewModel();
  const [hostEditingPlayerId, setHostEditingPlayerId] = useState<string | null>(null);

  const targetPlayerId = hostEditingPlayerId ?? vm.myAccount?.id ?? '';
  const targetPlayer = vm.players.find((player) => player.id === targetPlayerId);
  const targetStatus = vm.settlementStatus[targetPlayerId];
  const isHostOverride = vm.isHost && targetPlayerId !== vm.myAccount?.id;
  const targetEntry = vm.getItemizedEntry(targetPlayerId);
  const targetDraft = targetPlayerId ? vm.buildSettlement(targetPlayerId) : null;
  const targetSummary = targetPlayerId ? vm.getPlayerSummary(targetPlayerId) : null;

  const startSettlement = () => {
    const result = vm.startSettlement();
    if (!result.ok) Alert.alert('Unable to start settlement', result.error);
  };

  const submitSettlement = () => {
    const result = vm.submitSettlement(targetPlayerId, isHostOverride);
    if (!result.ok) Alert.alert('Unable to submit settlement', result.error);
  };

  const finalizeGame = () => {
    const result = vm.finalizeGame();
    if (!result.ok) Alert.alert('Unable to finish game', result.error);
  };

  if (!vm.isSettlementStarted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={{ flex: 1, padding: 20, justifyContent: 'center', gap: 16 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Settle the game</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>
            The Host must start settlement before players can submit their standings.
          </Text>
          {vm.isHost ? (
            <Pressable onPress={startSettlement} style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Start settlement</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.back()} style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontWeight: '800' }}>Back to table</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>{vm.isGameEnded ? 'Final rankings' : 'Settle the game'}</Text>
            <Text style={{ color: colors.muted, fontSize: 15 }}>
              {vm.isGameEnded ? 'The game is complete. Everyone can see the final standings.' : vm.canFinalize ? 'Everyone has finished. The Host can record the final standings.' : 'Submit your own settlement. The Host will finish the game when everyone is done.'}
            </Text>
          </View>

          {vm.isHost ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: 14, gap: 10, borderColor: colors.border, borderWidth: 1 }}>
              <Text style={{ color: colors.green, fontWeight: '900' }}>Settlement progress</Text>
              {vm.players.map((player) => {
                const status = vm.settlementStatus[player.id] ?? 'pending';
                return (
                  <View key={player.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: player.color }} />
                    <Text style={{ flex: 1, fontWeight: '700' }}>{player.name}</Text>
                    <Text style={{ color: status === 'submitted' ? colors.green : colors.muted, fontWeight: '800' }}>{status}</Text>
                    {status === 'pending' && player.id !== vm.myAccount?.id ? (
                      <Pressable onPress={() => Alert.alert('Dismiss player?', `${player.name} will no longer block finalization.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Dismiss', style: 'destructive', onPress: () => vm.dismissPlayer(player.id) }])}>
                        <Text style={{ color: colors.red, fontWeight: '800' }}>Dismiss</Text>
                      </Pressable>
                    ) : null}
                    {status === 'dismissed' ? (
                      <Pressable onPress={() => setHostEditingPlayerId(player.id)}>
                        <Text style={{ color: colors.green, fontWeight: '800' }}>Edit</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {isHostOverride ? (
            <View style={{ backgroundColor: '#EDE4D1', padding: 12, borderRadius: 10 }}>
              <Text style={{ color: colors.ink, fontWeight: '800' }}>Editing settlement for {targetPlayer?.name ?? 'player'} as Host</Text>
            </View>
          ) : null}

          {targetPlayer ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 16, borderColor: colors.border, borderWidth: 1, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: targetPlayer.color }} />
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.green }}>{isHostOverride ? targetPlayer.name : 'Your settlement'}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['fast', 'itemized'] as const).map((settlementMode) => (
                  <Pressable key={settlementMode} onPress={() => vm.setMode(settlementMode)} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: vm.mode === settlementMode ? colors.green : colors.cream, alignItems: 'center' }}>
                    <Text style={{ color: vm.mode === settlementMode ? colors.white : colors.ink, fontWeight: '800' }}>{settlementMode === 'fast' ? 'Fast' : 'Mortgages'}</Text>
                  </Pressable>
                ))}
              </View>

              {vm.mode === 'fast' ? (
                <TextInput keyboardType="number-pad" placeholder="Total asset value" placeholderTextColor={colors.muted} value={vm.fastValuations[targetPlayerId] ?? ''} onChangeText={(value) => vm.setFastValuation(targetPlayerId, value)} style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 17 }} />
              ) : (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>Mortgages</Text>
                  {(targetEntry.mortgageEntries ?? []).map((mortgage) => (
                    <View key={mortgage.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TextInput placeholder="Asset name" placeholderTextColor={colors.muted} value={mortgage.name} onChangeText={(value) => vm.updateMortgage(targetPlayerId, mortgage.id, 'name', value)} style={{ flex: 2, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10 }} />
                      <TextInput keyboardType="number-pad" placeholder={`${vm.currencySymbol} value`} placeholderTextColor={colors.muted} value={mortgage.value} onChangeText={(value) => vm.updateMortgage(targetPlayerId, mortgage.id, 'value', value)} style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10 }} />
                      <Pressable onPress={() => vm.removeMortgage(targetPlayerId, mortgage.id)} accessibilityLabel={`Remove ${mortgage.name || 'mortgage'}`}>
                        <Text style={{ color: colors.red, fontSize: 22, fontWeight: '800' }}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable onPress={() => vm.addMortgage(targetPlayerId)} style={{ borderColor: colors.green, borderWidth: 1.5, borderRadius: 8, padding: 11, alignItems: 'center' }}>
                    <Text style={{ color: colors.green, fontWeight: '800' }}>+ Add mortgage</Text>
                  </Pressable>
                </View>
              )}

              <View style={{ backgroundColor: colors.cream, padding: 12, borderRadius: 8, gap: 4 }}>
                <Text style={{ color: colors.muted }}>Cash: <Text style={{ color: colors.ink, fontWeight: '800' }}>{vm.currencySymbol}{targetSummary?.cash.toLocaleString()}</Text></Text>
                <Text style={{ color: colors.muted }}>Current total: <Text style={{ color: colors.green, fontWeight: '900' }}>{vm.currencySymbol}{(targetDraft?.netWorth ?? targetSummary?.netWorth ?? 0).toLocaleString()}</Text></Text>
              </View>

              {vm.isGameEnded ? (
                <Text style={{ color: colors.green, textAlign: 'center', fontWeight: '800' }}>Finalized.</Text>
              ) : (
                <Pressable onPress={submitSettlement} style={{ backgroundColor: colors.green, padding: 16, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: colors.white, fontSize: 17, fontWeight: '800' }}>{isHostOverride ? 'Save Host adjustment' : targetStatus === 'submitted' ? 'Update my settlement' : 'Submit my settlement'}</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.green, fontSize: 18, fontWeight: '900' }}>Current rankings</Text>
            {vm.players.map((player) => {
              const summary = vm.getPlayerSummary(player.id);
              return (
                <View key={player.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 10, padding: 13 }}>
                  <Text style={{ width: 32, fontWeight: '900', color: colors.green }}>#{summary.rank}</Text>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: player.color }} />
                  <Text style={{ flex: 1, fontWeight: '800' }}>{player.name}</Text>
                  <Text style={{ fontWeight: '900' }}>{vm.currencySymbol}{summary.netWorth.toLocaleString()}</Text>
                </View>
              );
            })}
          </View>

          {vm.isHost ? (
            <Pressable disabled={!vm.canFinalize} onPress={finalizeGame} style={{ backgroundColor: vm.canFinalize ? colors.green : colors.border, padding: 17, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: vm.canFinalize ? colors.white : colors.muted, fontSize: 18, fontWeight: '800' }}>{vm.canFinalize ? 'Finish game & show rankings' : 'Waiting for settlements…'}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
