import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from './persistence';
import { createProfileStore } from './profileStore';
import { Account } from '../ledger/types';

describe('profileStore', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('initializes with null profile when storage is empty', () => {
    const store = createProfileStore(storage);
    expect(store.getState().profile).toBeNull();
  });

  it('persists and updates profile state on saveProfile', () => {
    const store = createProfileStore(storage);
    const result = store.getState().saveProfile({ name: 'Bob', color: '#4B85B5' });
    expect(result).toBe(true);
    expect(store.getState().profile).toEqual({ name: 'Bob', color: '#4B85B5' });

    // Creates new store from same storage to test persistence across store instances
    const store2 = createProfileStore(storage);
    expect(store2.getState().profile).toEqual({ name: 'Bob', color: '#4B85B5' });
  });

  it('defaults sounds to on and persists the mute toggle', () => {
    const store = createProfileStore(storage);
    expect(store.getState().soundEnabled).toBe(true);

    store.getState().setSoundEnabled(false);
    expect(store.getState().soundEnabled).toBe(false);

    const store2 = createProfileStore(storage);
    expect(store2.getState().soundEnabled).toBe(false);
  });

  it('findMyAccount matches account by name case-insensitively', () => {
    const store = createProfileStore(storage);
    store.getState().saveProfile({ name: 'Alice', color: '#B8433B' });

    const accounts: Record<string, Account> = {
      p1: { id: 'p1', kind: 'player', name: 'alice', color: '#B8433B', unlimited: false, assets: [] },
      p2: { id: 'p2', kind: 'player', name: 'Charlie', color: '#4B85B5', unlimited: false, assets: [] },
      bank: { id: 'bank', kind: 'bank', name: 'alice', color: '#174A3A', unlimited: true, assets: [] },
    };

    const found = store.getState().findMyAccount(accounts);
    expect(found).toBeDefined();
    expect(found?.id).toBe('p1');
  });

  it('findMyAccount returns undefined when no profile is set or no matching account', () => {
    const store = createProfileStore(storage);
    const accounts: Record<string, Account> = {
      p1: { id: 'p1', kind: 'player', name: 'Bob', color: '#4B85B5', unlimited: false, assets: [] },
    };
    expect(store.getState().findMyAccount(accounts)).toBeUndefined();

    store.getState().saveProfile({ name: 'Alice', color: '#B8433B' });
    expect(store.getState().findMyAccount(accounts)).toBeUndefined();
  });
});
