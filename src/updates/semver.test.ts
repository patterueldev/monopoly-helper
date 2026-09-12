import { describe, expect, it } from 'vitest';
import { compareSemVer, isNewerThan, parseSemVer } from './semver';

describe('parseSemVer', () => {
  it('parses strict MAJOR.MINOR.PATCH', () => {
    expect(parseSemVer('1.2.0')).toEqual({ major: 1, minor: 2, patch: 0 });
    expect(parseSemVer('  10.0.3  ')).toEqual({ major: 10, minor: 0, patch: 3 });
  });

  it('rejects non-strict versions', () => {
    expect(parseSemVer('1.2')).toBeNull();
    expect(parseSemVer('v1.2.0')).toBeNull();
    expect(parseSemVer('1.2.0-beta')).toBeNull();
    expect(parseSemVer('01.2.0')).toBeNull();
    expect(parseSemVer('')).toBeNull();
    expect(parseSemVer(null)).toBeNull();
    expect(parseSemVer(120)).toBeNull();
  });
});

describe('compareSemVer', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareSemVer({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 9, patch: 9 })).toBe(1);
    expect(compareSemVer({ major: 1, minor: 2, patch: 0 }, { major: 1, minor: 10, patch: 0 })).toBe(-1);
    expect(compareSemVer({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 4 })).toBe(-1);
    expect(compareSemVer({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 3 })).toBe(0);
  });
});

describe('isNewerThan', () => {
  it('reports newer patch/minor/major', () => {
    expect(isNewerThan('1.2.1', '1.2.0')).toBe(true);
    expect(isNewerThan('1.3.0', '1.2.9')).toBe(true);
    expect(isNewerThan('2.0.0', '1.9.9')).toBe(true);
  });

  it('is false for equal or older', () => {
    expect(isNewerThan('1.2.0', '1.2.0')).toBe(false);
    expect(isNewerThan('1.1.9', '1.2.0')).toBe(false);
  });

  it('fails closed on unparseable input', () => {
    expect(isNewerThan('not-a-version', '1.2.0')).toBe(false);
    expect(isNewerThan('1.3.0', 'unknown')).toBe(false);
  });
});
