import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import { useSettlementViewModel } from '../src/viewmodels/useSettlementViewModel';

export default function Settlement() {
  const vm = useSettlementViewModel();

  const onRecord = () => {
    const result = vm.endGame();
    if (result.ok) router.replace('/table');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Settle the game</Text>
          <Text style={{ color: colors.muted, fontSize: 15 }}>
            Calculate each player’s net worth (cash + property assets) to record final standings.
          </Text>
        </View>

        {/* Mode Selector */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.white, borderRadius: 12, padding: 4, borderColor: colors.border, borderWidth: 1 }}>
          <Pressable
            onPress={() => vm.setMode('itemized')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: vm.mode === 'itemized' ? colors.green : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '800', color: vm.mode === 'itemized' ? colors.white : colors.ink }}>
              Itemized
            </Text>
          </Pressable>
          <Pressable
            onPress={() => vm.setMode('fast')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: vm.mode === 'fast' ? colors.green : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '800', color: vm.mode === 'fast' ? colors.white : colors.ink }}>
              Fast (Manual)
            </Text>
          </Pressable>
        </View>

        {/* Player Cards */}
        <View style={{ gap: 14 }}>
          {vm.players.map((p) => {
            const summary = vm.getPlayerSummary(p.id);
            const itemized = vm.itemizedEntries[p.id] ?? {
              properties: '',
              housesCount: '',
              housesCost: '',
              hotelsCount: '',
              hotelsCost: '',
              mortgages: '',
            };

            return (
              <View
                key={p.id}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 14,
                  padding: 16,
                  borderColor: colors.border,
                  borderWidth: 1,
                  gap: 12,
                }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.color }} />
                    <Text style={{ fontSize: 18, fontWeight: '800' }}>{p.name}</Text>
                  </View>
                  <View style={{ backgroundColor: '#DCEBE1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: colors.green, fontWeight: '900', fontSize: 13 }}>Rank #{summary.rank}</Text>
                  </View>
                </View>

                {/* Subtotals bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.cream, padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    Cash: <Text style={{ fontWeight: '800', color: colors.ink }}>{vm.currencySymbol}{summary.cash.toLocaleString()}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    Assets: <Text style={{ fontWeight: '800', color: colors.ink }}>{vm.currencySymbol}{summary.assetTotal.toLocaleString()}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    Total: <Text style={{ fontWeight: '900', color: colors.green }}>{vm.currencySymbol}{summary.netWorth.toLocaleString()}</Text>
                  </Text>
                </View>

                {/* Inputs */}
                {vm.mode === 'fast' ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>Agreed asset valuation</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="e.g. 1200"
                      placeholderTextColor={colors.muted}
                      value={vm.fastValuations[p.id] ?? ''}
                      onChangeText={(val) => vm.setFastValuation(p.id, val)}
                      style={{
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 16,
                      }}
                    />
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {/* Properties */}
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>Properties total ($)</Text>
                      <TextInput
                        keyboardType="number-pad"
                        placeholder="Total value of printed property deeds"
                        placeholderTextColor={colors.muted}
                        value={itemized.properties}
                        onChangeText={(val) => vm.setItemizedField(p.id, 'properties', val)}
                        style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 }}
                      />
                    </View>

                    {/* Houses */}
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>Houses</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          keyboardType="number-pad"
                          placeholder="Count"
                          placeholderTextColor={colors.muted}
                          value={itemized.housesCount}
                          onChangeText={(val) => vm.setItemizedField(p.id, 'housesCount', val)}
                          style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 }}
                        />
                        <TextInput
                          keyboardType="number-pad"
                          placeholder="Cost each ($)"
                          placeholderTextColor={colors.muted}
                          value={itemized.housesCost}
                          onChangeText={(val) => vm.setItemizedField(p.id, 'housesCost', val)}
                          style={{ flex: 2, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 }}
                        />
                      </View>
                    </View>

                    {/* Hotels */}
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>Hotels</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          keyboardType="number-pad"
                          placeholder="Count"
                          placeholderTextColor={colors.muted}
                          value={itemized.hotelsCount}
                          onChangeText={(val) => vm.setItemizedField(p.id, 'hotelsCount', val)}
                          style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 }}
                        />
                        <TextInput
                          keyboardType="number-pad"
                          placeholder="Cost each ($)"
                          placeholderTextColor={colors.muted}
                          value={itemized.hotelsCost}
                          onChangeText={(val) => vm.setItemizedField(p.id, 'hotelsCost', val)}
                          style={{ flex: 2, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 }}
                        />
                      </View>
                    </View>

                    {/* Mortgages */}
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>Mortgages to deduct (-$)</Text>
                      <TextInput
                        keyboardType="number-pad"
                        placeholder="Total mortgaged value"
                        placeholderTextColor={colors.muted}
                        value={itemized.mortgages}
                        onChangeText={(val) => vm.setItemizedField(p.id, 'mortgages', val)}
                        style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 }}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={onRecord}
          style={{
            backgroundColor: colors.green,
            padding: 17,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>Record standings</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
