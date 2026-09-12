import { GameEvent } from '../ledger/types';

// Maps ledger events to the sounds this device should play. Pure — the
// useGameAudio viewmodel feeds it only genuinely-new events (never replays)
// and owns the "only while foregrounded, only if unmuted" policy.

export type AudioCue = 'your_turn' | 'jailed' | 'bank_received';

export interface CueContext {
  myAccountId: string | undefined;
}

/** The bank account id in this state, if one exists. */
function bankAccountId(accounts: Record<string, { kind: string }>): string | undefined {
  return Object.entries(accounts).find(([, a]) => a.kind === 'bank')?.[0];
}

/** Returns the cues (possibly none) that `event` should trigger for me. */
export function detectCues(
  event: GameEvent,
  accounts: Record<string, { kind: string }>,
  ctx: CueContext
): AudioCue[] {
  if (!ctx.myAccountId) return [];
  const cues: AudioCue[] = [];
  switch (event.type) {
    case 'turn.advanced':
      if (event.payload.toAccountId === ctx.myAccountId) cues.push('your_turn');
      break;
    case 'player.jailed':
      if (event.payload.accountId === ctx.myAccountId) cues.push('jailed');
      break;
    case 'transfer': {
      const bank = bankAccountId(accounts);
      if (bank && event.payload.from === bank && event.payload.to === ctx.myAccountId) {
        cues.push('bank_received');
      }
      break;
    }
    case 'request.resolved':
      // Approvals move money through request.resolved, but a bank payout never
      // goes through the request flow, so transfers cover bank_received fully.
      break;
    default:
      break;
  }
  return cues;
}
