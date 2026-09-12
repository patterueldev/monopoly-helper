import { create } from 'zustand';
import { Account } from '../ledger/types';
import { KeyValueStorage, MemoryStorage, productionStorage } from './persistence';
import { loadProfile, saveProfile, loadSoundEnabled, saveSoundEnabled, PlayerProfile } from './profilePersistence';

declare const process: { env: Record<string, string | undefined> };
const defaultStorage = (): KeyValueStorage =>
  process.env.NODE_ENV === 'test' ? new MemoryStorage() : productionStorage();

export interface ProfileStore {
  profile: PlayerProfile | null;
  soundEnabled: boolean;
  saveProfile: (profile: PlayerProfile) => boolean;
  setSoundEnabled: (enabled: boolean) => void;
  findMyAccount: (accounts: Record<string, Account>) => Account | undefined;
}

export const createProfileStore = (storage: KeyValueStorage = defaultStorage()) => {
  return create<ProfileStore>((set, get) => ({
    profile: loadProfile(storage),
    soundEnabled: loadSoundEnabled(storage),

    saveProfile: (profile: PlayerProfile) => {
      const ok = saveProfile(storage, profile);
      if (ok) {
        set({ profile: loadProfile(storage) });
      }
      return ok;
    },

    setSoundEnabled: (enabled: boolean) => {
      if (saveSoundEnabled(storage, enabled)) set({ soundEnabled: enabled });
    },

    findMyAccount: (accounts: Record<string, Account>) => {
      const current = get().profile;
      if (!current) return undefined;
      const targetName = current.name.trim().toLowerCase();
      return Object.values(accounts).find(
        (a) => a.kind === 'player' && a.name.trim().toLowerCase() === targetName
      );
    },
  }));
};

export const useProfileStore = createProfileStore();
