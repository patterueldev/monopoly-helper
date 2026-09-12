import { describe, expect, it } from 'vitest';
import { checkForUpdate } from './updateChecker';

const manifest = {
  version: '1.2.0',
  apkUrl: 'https://github.com/patterueldev/monopoly-helper/releases/download/x/app.apk',
  size: 42_000_000,
  notes: 'Monopoly Banker 1.2.0 for Android',
};

describe('checkForUpdate', () => {
  it('reports available when the manifest is newer', async () => {
    const result = await checkForUpdate({
      currentVersion: '1.1.1',
      fetchManifest: async () => manifest,
    });
    expect(result.status).toBe('available');
    expect(result.manifest).toEqual(manifest);
  });

  it('reports up-to-date for equal or newer installed versions', async () => {
    for (const currentVersion of ['1.2.0', '1.3.0', '2.0.0']) {
      const result = await checkForUpdate({ currentVersion, fetchManifest: async () => manifest });
      expect(result.status).toBe('up-to-date');
    }
  });

  it('reports unavailable when the installed version is unknown', async () => {
    const result = await checkForUpdate({ currentVersion: null, fetchManifest: async () => manifest });
    expect(result.status).toBe('unavailable');
  });

  it('reports error on network failure', async () => {
    const result = await checkForUpdate({
      currentVersion: '1.1.1',
      fetchManifest: async () => {
        throw new Error('offline');
      },
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe('offline');
  });

  it('reports error on invalid manifest', async () => {
    const result = await checkForUpdate({
      currentVersion: '1.1.1',
      fetchManifest: async () => ({ version: 'nope' }),
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe('Update manifest is invalid');
  });
});
