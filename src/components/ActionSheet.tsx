import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  style?: 'default' | 'destructive';
}

export interface ActionSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
}

/** Cross-platform replacement for multi-button `Alert.alert`, which silently
 * drops everything past the first three buttons on Android (dropping Cancel and
 * jail actions). Renders an arbitrary number of actions with an explicit Cancel,
 * and closes on backdrop tap or the Android back button. */
export function ActionSheet({ visible, title, message, actions, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const run = (action: ActionSheetAction) => {
    onClose();
    action.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 16 + insets.bottom,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.green }}>{title}</Text>
          {message ? <Text style={{ color: colors.muted, fontSize: 14 }}>{message}</Text> : null}

          <ScrollView style={{ maxHeight: 320, marginTop: 6 }} bounces={false}>
            {actions.map((action, index) => (
              <Pressable
                key={`${action.label}-${index}`}
                onPress={() => run(action)}
                accessibilityRole="button"
                style={{ paddingVertical: 14, borderBottomColor: colors.border, borderBottomWidth: 1 }}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: action.style === 'destructive' ? colors.red : colors.ink }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={{ backgroundColor: colors.cream, borderColor: colors.border, borderWidth: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 }}
          >
            <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '800' }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
