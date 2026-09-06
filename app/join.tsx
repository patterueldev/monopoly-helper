import { router } from 'expo-router';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
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
      <View style={{ padding: 24, gap: 14 }}>
        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Join a game</Text>
        <Text style={{ color: colors.muted }}>Enter the address shown on the host’s screen</Text>

        <TextInput
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          value={vm.host}
          onChangeText={vm.setHost}
          placeholder="192.168.1.23"
          keyboardType="numbers-and-punctuation"
          style={{ backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 20, textAlign: 'center' }}
        />
        <TextInput
          value={vm.port}
          onChangeText={vm.setPort}
          placeholder="Port"
          keyboardType="number-pad"
          style={{ backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 18, textAlign: 'center' }}
        />

        {vm.error ? <Text style={{ color: colors.red, textAlign: 'center', fontWeight: '700' }}>{vm.error}</Text> : null}

        <Pressable
          onPress={onConnect}
          disabled={vm.isConnecting}
          style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center', opacity: vm.isConnecting ? 0.6 : 1 }}
        >
          <Text style={{ color: colors.white, fontSize: 19, fontWeight: '800' }}>{vm.isConnecting ? 'Connecting…' : 'Connect'}</Text>
        </Pressable>

        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>
          On the same Wi-Fi as the host, and not a guest network that isolates devices.
        </Text>
      </View>
    </SafeAreaView>
  );
}
