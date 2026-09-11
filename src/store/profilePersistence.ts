import { z } from 'zod';
import { KeyValueStorage } from './persistence';

export interface PlayerProfile {
  name: string;
  color: string;
}

export const playerProfileSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1),
});

export const PROFILE_STORAGE_KEY = 'player:profile';

export function loadProfile(storage: KeyValueStorage): PlayerProfile | null {
  const raw = storage.getString(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const result = playerProfileSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveProfile(storage: KeyValueStorage, profile: PlayerProfile): boolean {
  const result = playerProfileSchema.safeParse(profile);
  if (!result.success) return false;
  try {
    storage.set(PROFILE_STORAGE_KEY, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}
