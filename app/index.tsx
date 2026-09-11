import { Link, router } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { useProfileStore } from '../src/store/profileStore';
import { colors, PLAYER_PALETTE } from '../src/theme';
import { DEFAULT_CONFIG, Account } from '../src/ledger/types';

export default function Home() {
  const games = useGameStore((x) => x.listGames)();
  const createGame = useGameStore((x) => x.createGame);
  const profile = useProfileStore((s) => s.profile);

  const onHostGame = () => {
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
      name: profile?.name?.trim() || 'Host',
      color: profile?.color || PLAYER_PALETTE[0],
      unlimited: false,
      assets: [],
    };

    const result = createGame(DEFAULT_CONFIG, [bank, hostAccount]);
    if (result.ok) {
      router.push('/host');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 12 }}>
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
          onPress={onHostGame}
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
      </View>
    </SafeAreaView>
  );
}
