import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import { DiscoveredHost } from '../src/transport/discovery';
import { useJoinViewModel } from '../src/viewmodels/useJoinViewModel';

export default function Join() {
  const vm = useJoinViewModel();
  const [showManual, setShowManual] = useState(false);
  const [altColor, setAltColor] = useState<string | null>(null);

  // Sync default altColor when conflict occurs
  const conflictColors = vm.colorConflict?.availableColors;
  const firstAvailable = conflictColors && conflictColors.length > 0 ? conflictColors[0] : null;
  const selectedAltColor = altColor && conflictColors?.includes(altColor) ? altColor : firstAvailable;

  const onJoinDiscovered = async (dh: DiscoveredHost) => {
    const result = await vm.connectToHost(dh);
    if (result.ok) {
      router.replace('/table');
    }
  };

  const onConnectManual = async () => {
    const result = await vm.connect();
    if (result.ok) {
      router.replace('/table');
    }
  };

  const onConfirmConflictColor = async () => {
    if (!selectedAltColor) return;
    const result = await vm.resolveColorConflict(selectedAltColor);
    if (result.ok) {
      router.replace('/table');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Join a game</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Connect to a table on your local Wi-Fi</Text>
        </View>

        {/* Color Conflict Resolution Card */}
        {vm.colorConflict ? (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: 16,
              padding: 20,
              gap: 14,
              borderColor: colors.gold,
              borderWidth: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: vm.colorConflict.takenColor,
                }}
              />
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, flex: 1 }}>
                Token Color Taken
              </Text>
            </View>

            <Text style={{ fontSize: 15, color: colors.ink, lineHeight: 22 }}>
              Your color is already used by{' '}
              <Text style={{ fontWeight: '800', color: colors.green }}>{vm.colorConflict.takenBy}</Text>.
              Please choose an available color for this table:
            </Text>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>
                Available Colors ({vm.colorConflict.availableColors.length})
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {vm.colorConflict.availableColors.map((color) => {
                  const isSelected = selectedAltColor === color;
                  return (
                    <Pressable
                      key={color}
                      onPress={() => setAltColor(color)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: color,
                        borderWidth: isSelected ? 3 : 1,
                        borderColor: isSelected ? colors.ink : 'rgba(0,0,0,0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: [{ scale: isSelected ? 1.15 : 1 }],
                      }}
                    >
                      {isSelected ? (
                        <Text style={{ color: colors.white, fontWeight: '900', fontSize: 18 }}>✓</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={vm.cancelConflict}
                style={{
                  flex: 1,
                  backgroundColor: colors.cream,
                  borderColor: colors.border,
                  borderWidth: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onConfirmConflictColor}
                disabled={!selectedAltColor}
                style={{
                  flex: 2,
                  backgroundColor: colors.green,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: selectedAltColor ? 1 : 0.6,
                }}
              >
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>
                  Confirm & Join
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {vm.error && !vm.colorConflict ? (
          <View style={{ backgroundColor: '#fde8e8', padding: 14, borderRadius: 12 }}>
            <Text style={{ color: colors.red, fontWeight: '700' }}>{vm.error}</Text>
          </View>
        ) : null}

        {/* Profile Card */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 18, gap: 14, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.green }}>Your profile</Text>

          <TextInput
            value={vm.playerName}
            onChangeText={vm.setPlayerName}
            placeholder="Your player name"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={{
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              fontSize: 17,
              backgroundColor: colors.cream,
            }}
          />

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>Token color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {vm.palette.map((color) => {
                const isSelected = vm.playerColor === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => vm.setPlayerColor(color)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: color,
                      borderWidth: isSelected ? 3 : 1,
                      borderColor: isSelected ? colors.ink : 'rgba(0,0,0,0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ scale: isSelected ? 1.15 : 1 }],
                    }}
                  >
                    {isSelected ? <Text style={{ color: colors.white, fontWeight: '900', fontSize: 16 }}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Nearby Tables / Discovered Games */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 18, gap: 14, borderColor: colors.border, borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: colors.green }}>
              Nearby Tables
            </Text>
            <Pressable
              onPress={vm.rescan}
              disabled={vm.isScanning || vm.isConnecting}
              style={{
                backgroundColor: colors.cream,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {vm.isScanning ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : null}
              <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>
                {vm.isScanning ? 'Scanning…' : '↻ Rescan'}
              </Text>
            </Pressable>
          </View>

          {vm.discoveredHosts.length > 0 ? (
            <View style={{ gap: 10 }}>
              {vm.discoveredHosts.map((host) => (
                <View
                  key={`${host.ip}:${host.port}`}
                  style={{
                    backgroundColor: colors.cream,
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: host.hostColor || colors.green,
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.1)',
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>
                        {host.hostName ? `${host.hostName}’s Table` : 'Game Table'}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.muted }}>
                        {host.playerCount} player{host.playerCount === 1 ? '' : 's'} • {host.ip}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => onJoinDiscovered(host)}
                    disabled={vm.isConnecting}
                    style={{
                      backgroundColor: colors.green,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                      opacity: vm.isConnecting ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.white, fontWeight: '800', fontSize: 15 }}>
                      {vm.isConnecting ? 'Joining…' : 'Join Table'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 16, alignItems: 'center', gap: 8 }}>
              {vm.isScanning ? (
                <>
                  <ActivityIndicator size="small" color={colors.green} />
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    Searching local Wi-Fi for active games…
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>
                    No game tables detected on this Wi-Fi.
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
                    Make sure the host device has tapped &quot;Host Game&quot; and is on the same Wi-Fi.
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Collapsible Manual Connection Fallback */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 12, borderColor: colors.border, borderWidth: 1 }}>
          <Pressable
            onPress={() => setShowManual((prev) => !prev)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.green }}>
              {showManual ? '▾ Hide manual IP setup' : '▸ Manual IP connection'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Fallback</Text>
          </Pressable>

          {showManual ? (
            <View style={{ gap: 12, paddingTop: 6 }}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                value={vm.host}
                onChangeText={vm.setHost}
                placeholder="Host IP (e.g. 192.168.1.50)"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: colors.cream,
                  textAlign: 'center',
                }}
              />

              <TextInput
                value={vm.port}
                onChangeText={vm.setPort}
                placeholder="Port"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 15,
                  backgroundColor: colors.cream,
                  textAlign: 'center',
                }}
              />

              <Pressable
                onPress={onConnectManual}
                disabled={vm.isConnecting}
                style={{
                  backgroundColor: colors.green,
                  padding: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                  opacity: vm.isConnecting ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>
                  {vm.isConnecting ? 'Connecting…' : 'Connect Manually'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>
          Ensure all players are connected to the same local Wi-Fi router (avoid guest networks with client isolation).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
