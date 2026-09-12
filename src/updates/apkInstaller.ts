import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { DownloadProgressData } from 'expo-file-system/legacy';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';

/** Intent.FLAG_GRANT_READ_URI_PERMISSION — lets the system installer read the APK. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;
/** Intent.FLAG_ACTIVITY_NEW_TASK — required when launching outside an activity context. */
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const APK_FILE_NAME = 'monopoly-banker-update.apk';

export interface ApkDownloadProgress {
  bytesWritten: number;
  totalBytes: number | null;
  /** 0..1, or null when the server did not send Content-Length. */
  fraction: number | null;
}

export interface ApkDownloadOptions {
  url: string;
  expectedSize: number;
  onProgress?: (progress: ApkDownloadProgress) => void;
}

function requireAndroid(): void {
  if (Platform.OS !== 'android') {
    throw new Error('APK install is only supported on Android');
  }
}

/** Downloads the release APK into the app cache with progress callbacks.
 * Verifies the byte count against the release manifest; a mismatch means the
 * file was truncated or tampered with in transit, so it is deleted.
 * Authenticity beyond that is enforced by Android itself: the package installer
 * rejects APKs not signed with the release key. */
export async function downloadApk(options: ApkDownloadOptions): Promise<{ fileUri: string }> {
  requireAndroid();
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) throw new Error('App cache storage is unavailable');
  const dest = `${cacheDir}${APK_FILE_NAME}`;

  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    // Stale partial download may not exist — safe to ignore.
  }

  const report = (data: DownloadProgressData) => {
    const total = data.totalBytesExpectedToWrite > 0 ? data.totalBytesExpectedToWrite : null;
    options.onProgress?.({
      bytesWritten: data.totalBytesWritten,
      totalBytes: total,
      fraction: total ? data.totalBytesWritten / total : null,
    });
  };

  const download = FileSystem.createDownloadResumable(options.url, dest, {}, report);
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('APK download failed');

  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || info.size !== options.expectedSize) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error(`APK size mismatch: expected ${options.expectedSize} bytes`);
  }
  return { fileUri: result.uri };
}

/** Hands the downloaded APK to the Android system package installer. The user
 * still confirms one system dialog — silent install is impossible for
 * non-Play, non-device-owner apps. Requires the REQUEST_INSTALL_PACKAGES
 * permission (declared in app.json); on first use Android prompts the user to
 * allow "Install unknown apps" for this app. */
export async function launchApkInstaller(fileUri: string): Promise<void> {
  requireAndroid();
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  await startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME_TYPE,
    flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
  });
}

/** Opens this app's "Install unknown apps" system settings page — the fallback
 * when the installer never appears (e.g. the user previously denied it). */
export async function openInstallUnknownAppsSettings(packageName: string): Promise<void> {
  requireAndroid();
  await startActivityAsync(ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, {
    data: `package:${packageName}`,
  });
}
