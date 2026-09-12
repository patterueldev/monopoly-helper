import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { colors } from '../src/theme';
import { useDiagnostics } from '../src/viewmodels/useDiagnostics';

export default function Diagnostics() {
  const vm = useDiagnostics();
  const [preview, setPreview] = useState('Gathering diagnostics…');

  useEffect(() => {
    let cancelled = false;
    vm.buildReport().then((report) => {
      if (!cancelled) setPreview(report);
    });
    return () => {
      cancelled = true;
    };
  }, [vm.buildReport, vm.logs]);

  const onShare = async () => {
    try {
      await vm.shareReport();
    } catch {
      Alert.alert('Could not open the share sheet', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Connection help</Text>
        <Text style={{ color: colors.muted, fontSize: 15 }}>
          This report describes what your phone sees on the Wi-Fi network. Share it with the table's host or
          support — no account needed, you pick where it goes.
        </Text>

        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: 14, borderColor: colors.border, borderWidth: 1 }}>
          <Text selectable style={{ fontFamily: 'monospace', fontSize: 12, color: colors.ink }}>
            {preview}
          </Text>
        </View>

        <Pressable onPress={onShare} style={{ backgroundColor: colors.green, padding: 16, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 17, fontWeight: '800' }}>Share report</Text>
        </Pressable>

        <Pressable onPress={vm.clearLogs} style={{ borderColor: colors.green, borderWidth: 2, padding: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: colors.green, fontSize: 16, fontWeight: '800' }}>Clear connection log</Text>
        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 13 }}>
          The report lists app version, device, connection status, your local-network address, tables your phone
          detected, and the recent connection log. It never includes balances, player names beyond table titles,
          or anything outside this game.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
