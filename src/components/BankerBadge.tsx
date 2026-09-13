import { Text, View } from 'react-native';

/** Light-gold role pill marking the game's Banker (the Host's player account).
 * Renders nothing's sibling-safe: callers guard with `player.id === bankerAccountId(state)`.
 * Used in app/table.tsx, app/settlement.tsx, and app/host.tsx. */
export function BankerBadge({ label = 'Banker' }: { label?: string }) {
  return (
    <View style={{ backgroundColor: '#FBF0D9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#8A6410' }}>🏦 {label}</Text>
    </View>
  );
}
