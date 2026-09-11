import { create } from 'zustand';
import { Account } from '../ledger/types';
import { KeyValueStorage, MemoryStorage, productionStorage } from './persistence';
import { loadProfile, saveProfile, PlayerProfile } from './profilePersistence';

declare const process: { env: Record<string, string | undefined> };
const defaultStorage = (): KeyValueStorage =>
  process.env.NODE_ENV === 'test' ? new MemoryStorage() : productionStorage();

export interface ProfileStore {
  profile: PlayerProfile | null;
  saveProfile: (profile: PlayerProfile) => boolean;
  findMyAccount: (accounts: Record<string, Account>) => Account | undefined;
}

export const createProfileStore = (storage: KeyValueStorage = defaultStorage()) => {
  return create<ProfileStore>((set, get) => ({
    profile: loadProfile(storage),

    saveProfile: (profile: PlayerProfile) => {
      const ok = saveProfile(storage, profile);
      if (ok) {
        set({ profile: loadProfile(storage) });
      }
      return ok;
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
