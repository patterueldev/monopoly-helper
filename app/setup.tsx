import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { colors, PLAYER_PALETTE } from '../src/theme';
import { DEFAULT_CONFIG, Account } from '../src/ledger/types';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';

export default function Setup() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const profile = useProfileStore((s) => s.profile);
  const saveProfile = useProfileStore((s) => s.saveProfile);

  const [names, setNames] = useState<string[]>(() => [profile?.name ?? '', '']);
  const createGame = useGameStore((x) => x.createGame);

  const p1Color = profile?.color ?? PLAYER_PALETTE[0];
  const remainingPalette = PLAYER_PALETTE.filter((c) => c !== p1Color);
  const getPlayerColor = (index: number) => {
    if (index === 0) return p1Color;
    return remainingPalette[(index - 1) % remainingPalette.length];
  };

  const start = () => {
    const validNames = names.map((n) => n.trim()).filter(Boolean);
    if (validNames.length < 2) return;

    // Persist player 1 as this device's profile
    saveProfile({ name: validNames[0], color: p1Color });

    const bank: Account = {
      id: 'bank',
      kind: 'bank',
      name: 'Bank',
      color: colors.green,
      unlimited: true,
      assets: [],
    };
    const accounts: Account[] = [
      bank,
      ...validNames.map((name, i) => ({
        id: `p${i + 1}`,
        kind: 'player' as const,
        name,
        color: getPlayerColor(i),
        unlimited: false,
        assets: [],
      })),
    ];

    const result = createGame(DEFAULT_CONFIG, accounts);
    if (result.ok) router.replace(mode === 'host' ? '/host' : '/table');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.green }}>Set up your table</Text>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Add 2–8 players</Text>
        </View>

        <View style={{ gap: 10 }}>
          {names.map((name, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: getPlayerColor(i),
                }}
              />
              <TextInput
                value={name}
                onChangeText={(value) =>
                  setNames((all) => all.map((x, j) => (j === i ? value : x)))
                }
                placeholder={i === 0 ? 'Your name (Player 1)' : `Player ${i + 1}`}
                placeholderTextColor={colors.muted}
                style={{
                  flex: 1,
                  backgroundColor: colors.white,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 18,
                }}
              />
            </View>
          ))}
        </View>

        {names.length < 8 && (
          <Pressable onPress={() => setNames((all) => [...all, ''])}>
            <Text style={{ color: colors.green, fontWeight: '800', fontSize: 17 }}>+ Add player</Text>
          </Pressable>
        )}

        <Pressable
          onPress={start}
          style={{
            backgroundColor: colors.green,
            padding: 17,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 19, fontWeight: '800' }}>Start game</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
