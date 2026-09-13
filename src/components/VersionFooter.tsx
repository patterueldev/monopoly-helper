import { Platform, Pressable, Text } from 'react-native';
import { colors } from '../theme';

export interface VersionFooterProps {
  version: string;
  /** Android-only manual update check. When omitted the footer is plain text. */
  onPress?: () => void;
  checking?: boolean;
  notice?: string;
}

function label(version: string, checking: boolean | undefined, notice: string | undefined): string {
  if (Platform.OS !== 'android') return `v${version}`;
  const checkLabel = checking ? 'Checking for updates…' : 'Tap to check for updates';
  return `v${version} · ${checkLabel}${notice ? ` · ${notice}` : ''}`;
}

/** App version, always visible at the bottom of the Home screen on both
 * platforms (Android additionally offers the manual update check). */
export function VersionFooter({ version, onPress, checking, notice }: VersionFooterProps) {
  const text = label(version, checking, notice);
  if (!onPress) {
    return (
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 18 }}>
        {text}
      </Text>
    );
  }
  return (
    <Pressable onPress={onPress} style={{ marginTop: 18, alignItems: 'center' }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
}
