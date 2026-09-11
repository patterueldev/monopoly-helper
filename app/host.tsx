import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { colors } from '../src/theme';
import { useHostViewModel } from '../src/viewmodels/useHostViewModel';

export default function Host() {
  useKeepAwake();
  const vm = useHostViewModel();
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const onChangePlayerColor = (playerId: string, color: string) => {
    vm.updatePlayerColor(playerId, color);
    setEditingPlayerId(null);
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
            {vm.players.map((player, idx) => {
              const isEditing = editingPlayerId === player.id;
              return (
                <View key={player.id} style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      backgroundColor: colors.cream,
                      borderRadius: 10,
                    }}
                  >
                    <Pressable
                      onPress={() => setEditingPlayerId(isEditing ? null : player.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: player.color,
                          borderWidth: 2,
                          borderColor: isEditing ? colors.green : 'rgba(0,0,0,0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      />
                      <View>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>
                          {player.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>Tap token to change color</Text>
                      </View>
                    </Pressable>

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

                  {/* Inline Color Chooser if user is editing this player's color */}
                  {isEditing && vm.availableColors.length > 0 ? (
                    <View
                      style={{
                        backgroundColor: colors.white,
                        padding: 12,
                        borderRadius: 10,
                        gap: 8,
                        borderColor: colors.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>
                        Choose alternative color for {player.name}:
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {vm.availableColors.map((color) => (
                          <Pressable
                            key={color}
                            onPress={() => onChangePlayerColor(player.id, color)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: color,
                              borderWidth: 1,
                              borderColor: 'rgba(0,0,0,0.15)',
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* Start Game Button */}
        <Pressable
          onPress={vm.startGame}
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

