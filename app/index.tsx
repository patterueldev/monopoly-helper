import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { colors, PLAYER_PALETTE } from '../src/theme';
import { DEFAULT_CONFIG, Account } from '../src/ledger/types';

export default function Home() {
  const games = useGameStore((x) => x.listGames)();
  const createGame = useGameStore((x) => x.createGame);
  const profile = useProfileStore((s) => s.profile);
  const saveProfile = useProfileStore((s) => s.saveProfile);

  const [showHostModal, setShowHostModal] = useState(false);
  const [hostName, setHostName] = useState(profile?.name ?? '');
  const [hostColor, setHostColor] = useState(profile?.color ?? PLAYER_PALETTE[0]);
  const [hostError, setHostError] = useState<string | null>(null);

  const openHostSetup = () => {
    setHostName(profile?.name ?? '');
    setHostColor(profile?.color ?? PLAYER_PALETTE[0]);
    setHostError(null);
    setShowHostModal(true);
  };

  const onConfirmHost = () => {
    const trimmed = hostName.trim();
    if (!trimmed) {
      setHostError('Please enter your name');
      return;
    }

    saveProfile({ name: trimmed, color: hostColor });

    const bank: Account = {
      id: 'bank',
      kind: 'bank',
      name: 'Bank',
      color: colors.green,
      unlimited: true,
      assets: [],
    };
    const hostAccount: Account = {
      id: 'p1',
      kind: 'player',
      name: trimmed,
      color: hostColor,
      unlimited: false,
      assets: [],
    };

    const result = createGame(DEFAULT_CONFIG, [bank, hostAccount]);
    if (result.ok) {
      setShowHostModal(false);
      router.push('/host');
    } else {
      setHostError(result.error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 5, color: colors.green }}>
          MONOPOLY
        </Text>
        <Text style={{ fontSize: 58, fontWeight: '900', color: colors.green, marginTop: -8 }}>
          BANKER
        </Text>
        <Text style={{ fontSize: 18, color: colors.muted, marginBottom: 24 }}>
          The table’s money, handled.
        </Text>

        <Link href="/setup" asChild>
          <Pressable style={{ backgroundColor: colors.green, padding: 18, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 20, fontWeight: '800' }}>
              Pass & Play (Single Device)
            </Text>
          </Pressable>
        </Link>

        <Pressable
          onPress={openHostSetup}
          style={{ borderColor: colors.green, borderWidth: 2, padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.white }}
        >
          <Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>
            Host Game (Wi-Fi Multiplayer)
          </Text>
        </Pressable>

        <Link href="/join" asChild>
          <Pressable style={{ borderColor: colors.green, borderWidth: 2, padding: 16, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>
              Join Game
            </Text>
          </Pressable>
        </Link>

        {games.length > 0 && (
          <View style={{ gap: 6, marginTop: 18 }}>
            <Text style={{ color: colors.green, fontWeight: '900' }}>Saved games</Text>
            {games.slice(0, 5).map((game) => (
              <Text key={game.id} style={{ color: colors.ink }}>
                {game.status} · {game.players.join(', ')}
              </Text>
            ))}
          </View>
        )}

        {/* Host Setup Modal */}
        <Modal
          visible={showHostModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowHostModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: 18,
                padding: 22,
                gap: 16,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: colors.green }}>Host Profile</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  Enter your player name and choose your token color as Host (Player 1)
                </Text>
              </View>

              <TextInput
                value={hostName}
                onChangeText={setHostName}
                placeholder="Your player name"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 18,
                  backgroundColor: colors.cream,
                }}
              />

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted }}>Token Color</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {PLAYER_PALETTE.map((color) => {
                    const isSelected = hostColor === color;
                    return (
                      <Pressable
                        key={color}
                        onPress={() => setHostColor(color)}
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
                        {isSelected ? (
                          <Text style={{ color: colors.white, fontWeight: '900', fontSize: 16 }}>✓</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {hostError ? (
                <Text style={{ color: colors.red, fontWeight: '700', fontSize: 14 }}>{hostError}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Pressable
                  onPress={() => setShowHostModal(false)}
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
                  onPress={onConfirmHost}
                  style={{
                    flex: 2,
                    backgroundColor: colors.green,
                    padding: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>
                    Launch Room
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

