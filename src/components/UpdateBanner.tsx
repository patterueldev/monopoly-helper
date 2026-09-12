import { Pressable, Text, View } from 'react-native';
import { colors } from '../theme';
import { ApkDownloadProgress } from '../updates/apkInstaller';
import { AppUpdatePhase } from '../viewmodels/useAppUpdate';

export interface UpdateBannerProps {
  phase: AppUpdatePhase;
  latestVersion: string;
  notes: string;
  progress: ApkDownloadProgress | null;
  error: string | null;
  onUpdate: () => void;
  onInstall: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

/** Presentational card for the Android in-app update flow. Renders the banner
 * states of useAppUpdate; the hook owns all logic. */
export function UpdateBanner(props: UpdateBannerProps) {
  const { phase } = props;
  if (phase === 'idle' || phase === 'checking') return null;

  const progressFraction = props.progress?.fraction ?? null;
  const progressLabel = props.progress
    ? props.progress.totalBytes
      ? `${formatBytes(props.progress.bytesWritten)} / ${formatBytes(props.progress.totalBytes)}`
      : `${formatBytes(props.progress.bytesWritten)} downloaded`
    : '';

  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderColor: colors.green,
        borderWidth: 2,
        borderRadius: 14,
        padding: 16,
        gap: 10,
      }}
    >
      <Text style={{ color: colors.green, fontSize: 18, fontWeight: '900' }}>
        {phase === 'error' ? 'Update failed' : `Update available · v${props.latestVersion}`}
      </Text>

      {phase === 'available' ? <Text style={{ color: colors.muted, fontSize: 14 }}>{props.notes}</Text> : null}

      {phase === 'downloading' ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.cream, overflow: 'hidden' }}>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.green,
                width: `${Math.round((progressFraction ?? 0) * 100)}%`,
              }}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Downloading… {progressLabel}
          </Text>
        </View>
      ) : null}

      {phase === 'ready' ? (
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          Download complete. Install will open the Android system installer — confirm there to finish.
        </Text>
      ) : null}

      {phase === 'installing' ? (
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          Opening the installer… confirm the system dialog to finish the update.
        </Text>
      ) : null}

      {phase === 'error' && props.error ? (
        <Text style={{ color: colors.red, fontSize: 14 }}>{props.error}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {phase === 'available' ? (
          <Pressable
            onPress={props.onUpdate}
            style={{ flex: 2, backgroundColor: colors.green, padding: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>Update</Text>
          </Pressable>
        ) : null}

        {phase === 'ready' ? (
          <Pressable
            onPress={props.onInstall}
            style={{ flex: 2, backgroundColor: colors.green, padding: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>Install now</Text>
          </Pressable>
        ) : null}

        {phase === 'error' ? (
          <Pressable
            onPress={props.onOpenSettings}
            style={{ flex: 2, backgroundColor: colors.green, padding: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '800' }}>Open install settings</Text>
          </Pressable>
        ) : null}

        {phase === 'error' ? (
          <Pressable
            onPress={props.onRetry}
            style={{ flex: 1, backgroundColor: colors.cream, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        ) : null}

        {phase !== 'downloading' && phase !== 'installing' ? (
          <Pressable
            onPress={props.onDismiss}
            style={{ flex: 1, backgroundColor: colors.cream, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}>Later</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
