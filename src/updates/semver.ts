/** Strict MAJOR.MINOR.PATCH helpers. Mirrors the SemVer rule enforced by
 * `.github/workflows/version-check.yml` so in-app comparison agrees with CI. */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Parses a strict SemVer string; returns null for anything else. */
export function parseSemVer(value: unknown): SemVer | null {
  if (typeof value !== 'string') return null;
  const match = SEMVER_PATTERN.exec(value.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/** Orders two versions: -1 when a < b, 0 when equal, 1 when a > b. */
export function compareSemVer(a: SemVer, b: SemVer): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

/** True only when `latest` parses AND is strictly greater than `current`.
 * Fails closed: unparseable input never reports an update. */
export function isNewerThan(latest: string, current: string): boolean {
  const latestParsed = parseSemVer(latest);
  const currentParsed = parseSemVer(current);
  if (!latestParsed || !currentParsed) return false;
  return compareSemVer(latestParsed, currentParsed) > 0;
}
