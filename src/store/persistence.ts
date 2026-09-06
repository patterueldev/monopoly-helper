import { GameEvent, GameState, parseEvent } from '../ledger/types';
import { fold } from '../ledger/reducer';

export interface KeyValueStorage { getString(key: string): string | undefined; set(key: string, value: string): void; getAllKeys(): string[]; }
export interface PersistedGame { version: 1; events: GameEvent[]; lastSeq: number; }
export interface RecoveryResult { events: GameEvent[]; recovered: number; corrupt: boolean; unrecoverable: boolean; }

export class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>();
  getString(key: string) { return this.values.get(key); }
  set(key: string, value: string) { this.values.set(key, value); }
  getAllKeys() { return [...this.values.keys()]; }
}

declare const require: (name: string) => any;
export function productionStorage(): KeyValueStorage { return require('react-native-mmkv').createMMKV({ id: 'monopoly-banker' }) as KeyValueStorage; }
export const gameKey = (id: string) => `game:${id}`;
export const draftKey = (id: string) => `draft:${id}`;

export function saveGame(storage: KeyValueStorage, id: string, events: GameEvent[]) {
  storage.set(gameKey(id), JSON.stringify(events));
  try { storage.set(`${gameKey(id)}:version`, '1'); storage.set(`${gameKey(id)}:lastSeq`, String(events.at(-1)?.seq ?? -1)); storage.set('lastGameId', id); } catch { /* advisory metadata must not fail a transaction */ }
}
export function loadGame(storage: KeyValueStorage, id: string): RecoveryResult {
  const raw = storage.getString(gameKey(id));
  if (!raw || storage.getString(`${gameKey(id)}:version`) !== '1') return { events: [], recovered: 0, corrupt: false, unrecoverable: true };
  const scan = scanEvents(raw);
  const valid: GameEvent[] = [];
  for (const event of scan.events) { const parsed = parseEvent(event); if (!parsed || parsed.seq !== valid.length || fold([...valid, parsed]).invalid) break; valid.push(parsed); }
  const state = fold(valid);
  const corrupt = scan.corrupt || valid.length !== scan.events.length;
  if (corrupt) storage.set(`${gameKey(id)}:corrupt:${Date.now()}`, raw);
  if (corrupt && valid.length > 0 && state.started) saveGame(storage, id, valid);
  return { events: valid, recovered: valid.length, corrupt, unrecoverable: !state.started };
}
export function saveDraft(storage: KeyValueStorage, id: string, draft: unknown) { storage.set(draftKey(id), JSON.stringify(draft)); }
export function loadDraft<T>(storage: KeyValueStorage, id: string): T | null { const raw = storage.getString(draftKey(id)); if (!raw) return null; try { return JSON.parse(raw) as T; } catch { return null; } }

export function scanEvents(raw: string): { events: GameEvent[]; corrupt: boolean } {
  const events: GameEvent[] = []; const text = raw.trim(); if (!text.startsWith('[')) return { events, corrupt: true }; let i = 1;
  const ws = () => { while (/\s/.test(text[i] ?? '')) i += 1; };
  while (i < text.length) { ws(); if (text[i] === ']') { let previous = i - 1; while (previous > 0 && /\s/.test(text[previous])) previous -= 1; return { events, corrupt: i !== text.length - 1 || text[previous] === ',' }; } const start = i; let braces = 0; let brackets = 0; let quoted = false; let escaped = false;
    for (; i < text.length; i += 1) { const c = text[i]; if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; } if (c === '"') { quoted = true; continue; } if (c === '{') braces += 1; else if (c === '}') braces -= 1; else if (c === '[') brackets += 1; else if (c === ']') { if (braces === 0 && brackets === 0) break; brackets -= 1; } else if (c === ',' && braces === 0 && brackets === 0) break; }
    const piece = text.slice(start, i).trim(); if (!piece.startsWith('{') || braces !== 0 || quoted) return { events, corrupt: true }; try { events.push(JSON.parse(piece) as GameEvent); } catch { return { events, corrupt: true }; } ws(); if (text[i] === ',') { i += 1; continue; } if (text[i] === ']') return { events, corrupt: i !== text.length - 1 }; return { events, corrupt: true };
  }
  return { events, corrupt: true };
}
export function listGameIds(storage: KeyValueStorage): string[] { return storage.getAllKeys().filter(k => k.startsWith('game:') && !k.includes(':version') && !k.includes(':lastSeq') && !k.includes(':corrupt:')).map(k => k.slice(5)); }
