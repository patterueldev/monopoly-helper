import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { colors } from '../src/theme';
import { useHostViewModel } from '../src/viewmodels/useHostViewModel';

export default function Host() {
  useKeepAwake();
  const vm = useHostViewModel();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Hosting</Text>

        {vm.error ? (
          <Text style={{ color: colors.red, fontWeight: '700' }}>{vm.error}</Text>
        ) : (
          <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: 18, gap: 6, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>Have players enter this on their Join screen</Text>
            <Text style={{ fontSize: 30, fontWeight: '900', color: colors.green }}>{vm.ip ?? 'Looking up address…'}</Text>
            <Text style={{ fontSize: 18, color: colors.muted }}>Port {vm.port}</Text>
          </View>
        )}

        <Text style={{ textAlign: 'center', color: colors.muted }}>
          {vm.isListening ? `${vm.peerCount} ${vm.peerCount === 1 ? 'player' : 'players'} connected` : 'Starting…'}
        </Text>

        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>
          Keep this phone open on this screen while hosting — the game log lives here.
        </Text>

        <Pressable onPress={() => router.replace('/table')} style={{ backgroundColor: colors.green, padding: 17, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 19, fontWeight: '800' }}>Go to table</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
