import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { useProfileStore } from '../store/profileStore';
import { detectCues, AudioCue } from '../audio/cues';
import turnSound from '../../assets/sounds/turn.wav';
import jailSound from '../../assets/sounds/jail.wav';
import bankSound from '../../assets/sounds/bank.wav';

// Plays a distinct bell + haptic for your turn, being jailed, and collecting
// from the Bank. Mounted once in app/_layout.tsx; renders nothing.

let players: Record<AudioCue, AudioPlayer> | null = null;

function getPlayers(): Record<AudioCue, AudioPlayer> {
  if (!players) {
    players = {
      your_turn: createAudioPlayer(turnSound),
      jailed: createAudioPlayer(jailSound),
      bank_received: createAudioPlayer(bankSound),
    };
  }
  return players;
}

async function playCue(cue: AudioCue): Promise<void> {
  try {
    const player = getPlayers()[cue];
    try {
      player.seekTo(0);
    } catch {
      // Already at the start — just play.
    }
    player.play();
  } catch {
    // Audio is best-effort; a missing file must never break the game.
  }
  try {
    if (cue === 'your_turn') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (cue === 'jailed') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are best-effort too.
  }
}

/** Subscribes to the ledger and sounds only genuinely-new events — the seq
 * high-water mark is snapshotted on mount, so history loads and reconnect
 * catch-up bursts stay silent. Sounds fire only while foregrounded and unmuted. */
export function useGameAudio(): void {
  const seenSeqRef = useRef<number | null>(null);

  useEffect(() => {
    seenSeqRef.current = useGameStore.getState().state.events.length;
    const unsubscribe = useGameStore.subscribe((state) => {
      const events = state.state.events;
      const seen = seenSeqRef.current ?? 0;
      seenSeqRef.current = events.length;
      if (events.length <= seen) return;
      if (!useProfileStore.getState().soundEnabled) return;
      if (AppState.currentState !== 'active') return;
      const myAccount = useProfileStore.getState().findMyAccount(state.state.accounts);
      for (const event of events.slice(seen)) {
        for (const cue of detectCues(event, state.state.accounts, { myAccountId: myAccount?.id })) {
          void playCue(cue);
        }
      }
    });
    return unsubscribe;
  }, []);
}
