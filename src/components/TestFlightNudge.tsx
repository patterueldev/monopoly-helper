import { Linking, Pressable, Text, View } from 'react-native';
import { colors } from '../theme';

/** iOS cannot check TestFlight builds programmatically and cannot install
 * them itself, so this is a nudge: version display + a shortcut that opens
 * the TestFlight app, which auto-updates and notifies on its own. */
export function TestFlightNudge({ version }: { version: string }) {
  const openTestFlight = () => {
    void Linking.openURL('itms-beta://');
  };

  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.ink, fontWeight: '800' }}>v{version} · TestFlight build</Text>
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        New builds arrive through TestFlight — open it to install the latest.
      </Text>
      <Pressable
        onPress={openTestFlight}
        style={{ backgroundColor: colors.green, padding: 12, borderRadius: 12, alignItems: 'center' }}
      >
        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '800' }}>Open TestFlight</Text>
      </Pressable>
    </View>
  );
}
