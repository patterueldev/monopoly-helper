import { Link } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useGameStore } from '../src/store/gameStore';
import { colors } from '../src/theme';

export default function Home() {
  const games = useGameStore((x) => x.listGames)();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}><View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 12 }}><Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: 5, color: colors.green }}>MONOPOLY</Text><Text style={{ fontSize: 58, fontWeight: '900', color: colors.green }}>BANKER</Text><Text style={{ fontSize: 18, color: colors.muted, marginBottom: 24 }}>The table’s money, handled.</Text><Link href="/setup" asChild><Pressable style={{ backgroundColor: colors.green, padding: 18, borderRadius: 14, alignItems: 'center' }}><Text style={{ color: colors.white, fontSize: 20, fontWeight: '800' }}>New game</Text></Pressable></Link>{games.length > 0 && <View style={{ gap: 6, marginTop: 18 }}><Text style={{ color: colors.green, fontWeight: '900' }}>Saved games</Text>{games.slice(0, 5).map((game) => <Text key={game.id} style={{ color: colors.ink }}>{game.status} · {game.players.join(', ')}</Text>)}</View>}</View></SafeAreaView>;
}
