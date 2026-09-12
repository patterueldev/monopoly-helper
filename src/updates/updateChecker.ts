import { parseManifest, UpdateManifest } from './manifest';
import { isNewerThan } from './semver';

export type UpdateCheckStatus = 'up-to-date' | 'available' | 'unavailable' | 'error';

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  manifest?: UpdateManifest;
  error?: string;
}

export interface UpdateCheckDeps {
  /** Installed app version (e.g. expo-application.nativeApplicationVersion). */
  currentVersion: string | null;
  /** Resolves with the parsed body of update.json; rejects on network failure. */
  fetchManifest: () => Promise<unknown>;
}

/** Compares the installed version against the release manifest. Pure: all I/O
 * arrives through `deps`, so this is unit-testable in plain node. */
export async function checkForUpdate(deps: UpdateCheckDeps): Promise<UpdateCheckResult> {
  if (!deps.currentVersion) {
    return { status: 'unavailable', error: 'Could not read the installed app version' };
  }
  let json: unknown;
  try {
    json = await deps.fetchManifest();
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : 'Update check failed' };
  }
  const manifest = parseManifest(json);
  if (!manifest) {
    return { status: 'error', error: 'Update manifest is invalid' };
  }
  if (isNewerThan(manifest.version, deps.currentVersion)) {
    return { status: 'available', manifest };
  }
  return { status: 'up-to-date' };
}
