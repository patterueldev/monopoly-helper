import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import { useHostViewModel } from '../src/viewmodels/useHostViewModel';

export default function Host() {
  useKeepAwake();
  const vm = useHostViewModel();
  const [offlineName, setOfflineName] = useState('');
  const [showAddOffline, setShowAddOffline] = useState(false);

  const onAddOffline = () => {
    if (!offlineName.trim()) return;
    const result = vm.addLocalPlayer(offlineName);
    if (result.ok) {
      setOfflineName('');
      setShowAddOffline(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Game Lobby</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>
            {vm.isListening ? '🟢 Waiting for players to join on Wi-Fi' : 'Starting server…'}
          </Text>
        </View>

        {vm.error ? (
          <View style={{ backgroundColor: '#fde8e8', padding: 14, borderRadius: 12 }}>
            <Text style={{ color: colors.red, fontWeight: '700' }}>{vm.error}</Text>
          </View>
        ) : null}

        {/* LAN Info Card */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 6, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Wi-Fi Auto-Discovery Active
          </Text>
          <Text style={{ color: colors.ink, fontSize: 15 }}>
            Nearby phones on the same Wi-Fi will automatically detect this table when they tap &quot;Join Game&quot;.
          </Text>
          {vm.ip ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
              Manual address: <Text style={{ fontWeight: '700', color: colors.green }}>{vm.ip}:{vm.port}</Text>
            </Text>
          ) : null}
        </View>

        {/* Players In Room */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 18, gap: 12, borderColor: colors.border, borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: colors.green }}>
              Players in Room ({vm.players.length}/8)
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {vm.canStartGame ? 'Ready to play' : 'Need at least 2'}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {vm.players.map((player, idx) => (
              <View
                key={player.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  backgroundColor: colors.cream,
                  borderRadius: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: player.color,
                    }}
                  />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>
                    {player.name}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: idx === 0 ? colors.green : colors.border,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      color: idx === 0 ? colors.white : colors.muted,
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    {idx === 0 ? 'HOST (YOU)' : 'CONNECTED'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Add offline player toggle */}
          {vm.players.length < 8 ? (
            showAddOffline ? (
              <View style={{ gap: 8, marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>
                  Add player without a phone:
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={offlineName}
                    onChangeText={setOfflineName}
                    placeholder="Player Name"
                    placeholderTextColor={colors.muted}
                    style={{
                      flex: 1,
                      backgroundColor: colors.cream,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 16,
                    }}
                  />
                  <Pressable
                    onPress={onAddOffline}
                    style={{
                      backgroundColor: colors.green,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.white, fontWeight: '800' }}>Add</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowAddOffline(true)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <Text style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>
                  + Add player without phone
                </Text>
              </Pressable>
            )
          ) : null}
        </View>

        {/* Start Game Button */}
        <Pressable
          onPress={() => router.replace('/table')}
          disabled={!vm.canStartGame}
          style={{
            backgroundColor: vm.canStartGame ? colors.green : colors.border,
            padding: 18,
            borderRadius: 14,
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <Text
            style={{
              color: vm.canStartGame ? colors.white : colors.muted,
              fontSize: 19,
              fontWeight: '800',
            }}
          >
            {vm.canStartGame ? `Start Game (${vm.players.length} Players)` : 'Waiting for players… (need 2+)'}
          </Text>
        </Pressable>

        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>
          Keep this screen open while waiting for everyone to join.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
