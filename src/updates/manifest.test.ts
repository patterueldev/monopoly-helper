import { describe, expect, it } from 'vitest';
import { parseManifest, UPDATE_MANIFEST_URL } from './manifest';

const valid = {
  version: '1.2.0',
  apkUrl: 'https://github.com/patterueldev/monopoly-helper/releases/download/x/app.apk',
  size: 42_000_000,
  notes: 'Monopoly Banker 1.2.0 for Android',
};

describe('parseManifest', () => {
  it('accepts a well-formed manifest with optional sha256', () => {
    expect(parseManifest(valid)).toEqual(valid);
    expect(
      parseManifest({ ...valid, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }),
    ).toEqual({ ...valid, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' });
  });

  it('rejects manifests with missing or mistyped fields', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({})).toBeNull();
    expect(parseManifest({ ...valid, version: 120 })).toBeNull();
    expect(parseManifest({ ...valid, apkUrl: 'not-a-url' })).toBeNull();
    expect(parseManifest({ ...valid, size: -3 })).toBeNull();
    expect(parseManifest({ ...valid, notes: undefined })).toBeNull();
    expect(parseManifest({ ...valid, sha256: 'xyz' })).toBeNull();
  });

  it('points at the latest release asset', () => {
    expect(UPDATE_MANIFEST_URL).toBe(
      'https://github.com/patterueldev/monopoly-helper/releases/latest/download/update.json',
    );
  });
});
