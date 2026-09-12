import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking, Pressable, Modal, SafeAreaView, Text, View } from 'react-native';
import { useState } from 'react';
import { colors } from '../theme';

interface QrScannerModalProps {
  visible: boolean;
  onScanned: (text: string) => void;
  onClose: () => void;
}

/** Full-screen QR scanner for joining a table without typing IP/port.
 * Locked to QR codes; the first successful scan wins and closes the modal. */
export function QrScannerModal({ visible, onScanned, onClose }: QrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  const handleScan = ({ data }: { data: string }) => {
    if (handled) return;
    setHandled(true);
    onScanned(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
        <View style={{ padding: 16, gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.white }}>Scan the host's QR code</Text>
          <Text style={{ color: '#B9C4BC', fontSize: 14 }}>Point the camera at the QR code shown on the host's lobby screen.</Text>
        </View>

        {!permission ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: colors.white }}>Requesting camera access…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
            <Text style={{ color: colors.white, textAlign: 'center', fontSize: 15 }}>
              Camera access is needed to scan QR codes. You can still join with the manual IP address instead.
            </Text>
            <Pressable
              onPress={requestPermission}
              style={{ backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: colors.white, fontWeight: '800' }}>Allow camera</Text>
            </Pressable>
            {permission.canAskAgain ? null : (
              <Pressable onPress={() => Linking.openSettings()} style={{ padding: 10 }}>
                <Text style={{ color: colors.gold, fontWeight: '700' }}>Open Settings</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />
          </View>
        )}

        <View style={{ padding: 16 }}>
          <Pressable
            onPress={() => { setHandled(false); onClose(); }}
            style={{ backgroundColor: colors.white, padding: 14, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
