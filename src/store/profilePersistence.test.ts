import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from './persistence';
import { loadProfile, saveProfile, PROFILE_STORAGE_KEY, PlayerProfile } from './profilePersistence';

describe('profilePersistence', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns null when no profile has been saved', () => {
    expect(loadProfile(storage)).toBeNull();
  });

  it('saves and loads a valid player profile', () => {
    const profile: PlayerProfile = { name: 'Alice', color: '#B8433B' };
    const saved = saveProfile(storage, profile);
    expect(saved).toBe(true);

    const loaded = loadProfile(storage);
    expect(loaded).toEqual(profile);
  });

  it('trims whitespace when saving profile', () => {
    const profile: PlayerProfile = { name: '  Bob  ', color: ' #4B85B5 ' };
    const saved = saveProfile(storage, profile);
    expect(saved).toBe(true);

    const loaded = loadProfile(storage);
    expect(loaded).toEqual({ name: 'Bob', color: '#4B85B5' });
  });

  it('rejects profiles with empty name or color', () => {
    expect(saveProfile(storage, { name: '', color: '#B8433B' })).toBe(false);
    expect(saveProfile(storage, { name: '   ', color: '#B8433B' })).toBe(false);
    expect(saveProfile(storage, { name: 'Alice', color: '' })).toBe(false);
    expect(saveProfile(storage, { name: 'Alice', color: '  ' })).toBe(false);
    expect(loadProfile(storage)).toBeNull();
  });

  it('handles corrupt JSON in storage gracefully', () => {
    storage.set(PROFILE_STORAGE_KEY, 'not valid json');
    expect(loadProfile(storage)).toBeNull();
  });

  it('handles invalid schema in storage gracefully', () => {
    storage.set(PROFILE_STORAGE_KEY, JSON.stringify({ name: 123, color: true }));
    expect(loadProfile(storage)).toBeNull();
  });
});
