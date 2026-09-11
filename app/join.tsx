import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import { useJoinViewModel } from '../src/viewmodels/useJoinViewModel';

export default function Join() {
  const vm = useJoinViewModel();

  const onConnect = async () => {
    const result = await vm.connect();
    if (result.ok) router.replace('/table');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Join a game</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Confirm your profile and enter the host address</Text>
        </View>

        {/* Profile Card */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 18, gap: 14, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.green }}>Your profile</Text>

          <TextInput
            value={vm.playerName}
            onChangeText={vm.setPlayerName}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={{
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              fontSize: 18,
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

        {/* Host Connection Card */}
        <View style={{ backgroundColor: colors.white, borderRadius: 14, padding: 18, gap: 14, borderColor: colors.border, borderWidth: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.green }}>Host address</Text>

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={vm.host}
            onChangeText={vm.setHost}
            placeholder="192.168.1.23"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            style={{
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              fontSize: 18,
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
              fontSize: 16,
              backgroundColor: colors.cream,
              textAlign: 'center',
            }}
          />
        </View>

        {vm.error ? (
          <Text style={{ color: colors.red, textAlign: 'center', fontWeight: '700', fontSize: 15 }}>
            {vm.error}
          </Text>
        ) : null}

        <Pressable
          onPress={onConnect}
          disabled={vm.isConnecting}
          style={{
            backgroundColor: colors.green,
            padding: 17,
            borderRadius: 12,
            alignItems: 'center',
            opacity: vm.isConnecting ? 0.6 : 1,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 19, fontWeight: '800' }}>
            {vm.isConnecting ? 'Connecting…' : 'Connect'}
          </Text>
        </Pressable>

        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>
          On the same Wi-Fi as the host, and not a guest network that isolates devices.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
