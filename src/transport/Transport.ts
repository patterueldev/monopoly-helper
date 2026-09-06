import { GameEvent } from '../ledger/types';
import { Intent } from '../ledger/intents';
export interface Transport {
  submit(intent: Intent): Promise<GameEvent>;
  eventsAfter(seq: number): Promise<GameEvent[]>;
  subscribe(listener: (event: GameEvent) => void): () => void;
  close(): void;
}
