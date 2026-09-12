import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { UPDATE_MANIFEST_URL, UpdateManifest } from '../updates/manifest';
import { checkForUpdate } from '../updates/updateChecker';
import {
  ApkDownloadProgress,
  downloadApk,
  launchApkInstaller,
  openInstallUnknownAppsSettings,
} from '../updates/apkInstaller';

declare const __DEV__: boolean;

export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error';

/** Owns the in-app Android update flow: silent version check on launch (release
 * builds only), user-confirmed download with progress, then the system
 * installer. Renders nothing itself — app/index.tsx maps this to UpdateBanner. */
export function useAppUpdate() {
  const [phase, setPhase] = useState<AppUpdatePhase>('idle');
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [progress, setProgress] = useState<ApkDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const runCheck = useCallback(async (manual: boolean) => {
    if (Platform.OS !== 'android' || checkingRef.current) return;
    checkingRef.current = true;
    setNotice(null);
    if (manual) {
      setError(null);
      setPhase('checking');
    }
    const result = await checkForUpdate({
      currentVersion: Application.nativeApplicationVersion,
      fetchManifest: async () => {
        const response = await fetch(UPDATE_MANIFEST_URL);
        if (!response.ok) throw new Error(`Update server returned ${response.status}`);
        return response.json();
      },
    });
    checkingRef.current = false;
    if (result.status === 'available' && result.manifest) {
      setManifest(result.manifest);
      setPhase('available');
    } else if (manual) {
      setPhase(result.status === 'up-to-date' ? 'idle' : 'error');
      setNotice(result.status === 'up-to-date' ? "You're on the latest version" : null);
      setError(result.status === 'up-to-date' ? null : (result.error ?? 'Update check failed'));
    }
  }, []);

  // Auto-check silently on launch. Release builds only: installing a release
  // APK over a dev-client build would replace the dev client itself.
  useEffect(() => {
    if (!__DEV__) void runCheck(false);
  }, [runCheck]);

  const startDownload = useCallback(async () => {
    if (!manifest) return;
    setError(null);
    setProgress(null);
    setPhase('downloading');
    try {
      const { fileUri: downloaded } = await downloadApk({
        url: manifest.apkUrl,
        expectedSize: manifest.size,
        onProgress: setProgress,
      });
      setFileUri(downloaded);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
      setPhase('error');
    }
  }, [manifest]);

  const install = useCallback(async () => {
    if (!fileUri) return;
    setPhase('installing');
    try {
      await launchApkInstaller(fileUri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the installer');
      setPhase('error');
    }
  }, [fileUri]);

  const openUnknownSourcesSettings = useCallback(async () => {
    try {
      await openInstallUnknownAppsSettings(Application.applicationId ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open settings');
      setPhase('error');
    }
  }, []);

  const dismiss = useCallback(() => {
    setPhase('idle');
    setManifest(null);
    setProgress(null);
    setError(null);
    setNotice(null);
    setFileUri(null);
  }, []);

  return {
    phase,
    manifest,
    progress,
    error,
    notice,
    checkNow: () => runCheck(true),
    startDownload,
    install,
    openUnknownSourcesSettings,
    dismiss,
  };
}

export type AppUpdateViewModel = ReturnType<typeof useAppUpdate>;
