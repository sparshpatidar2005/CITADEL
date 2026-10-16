// src/screens/QRCodeScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

// Lazy-require native modules so missing native libs won't crash the app.
let RNCamera = null;
let QRCodeSVG = null;
try {
  // eslint-disable-next-line global-require
  RNCamera = require('react-native-camera').RNCamera;
} catch (e) {
  RNCamera = null;
}
try {
  // eslint-disable-next-line global-require
  QRCodeSVG = require('react-native-qrcode-svg').default;
} catch (e) {
  QRCodeSVG = null;
}

export default function QRCodeScreen({ route, navigation }) {
  const tourist = route.params?.tourist ?? { id: 'demo', name: 'Demo User' };
  const [scannedData, setScannedData] = useState(null);

  useEffect(() => {
    return () => {};
  }, []);

  function onBarCodeRead({ data }) {
    if (!data) return;
    setScannedData(data);
    try {
      const payload = JSON.parse(data);
      Alert.alert('QR Scanned', `ID: ${payload.id || payload.name || data}`);
    } catch (e) {
      Alert.alert('QR Scanned', data);
    }
  }

  function renderScanner() {
    if (!RNCamera) {
      return (
        <View style={styles.fallback}>
          <Text style={{ marginBottom: 8 }}>Scanner not available (native module missing).</Text>
          <Text>Install and link react-native-camera to enable scanning.</Text>
        </View>
      );
    }
    return (
      <View style={styles.scannerWrap}>
        <RNCamera
          style={styles.camera}
          type={RNCamera.Constants.Type.back}
          onBarCodeRead={onBarCodeRead}
          captureAudio={false}
        />
      </View>
    );
  }

  function renderMyQR() {
    const payload = { id: tourist.id, name: tourist.name };
    const qrString = JSON.stringify(payload);
    if (!QRCodeSVG) {
      return (
        <View style={styles.qrFallback}>
          <Text>QR generation not available. Install react-native-qrcode-svg.</Text>
          <Text style={{ marginTop: 8 }}>{qrString}</Text>
        </View>
      );
    }
    return (
      <View style={styles.qrWrap}>
        <QRCodeSVG value={qrString} size={170} />
        <Text style={{ marginTop: 10 }}>{tourist.name}</Text>
        <Text style={{ color: '#666', marginTop: 6 }}>Travel ID: {tourist.id}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>QR & Scanner</Text>
      </View>

      <View style={{ flex: 1, padding: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>My Travel QR</Text>
        {renderMyQR()}

        <View style={{ height: 20 }} />
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Scan QR</Text>
        {renderScanner()}

        <View style={{ marginTop: 12 }}>
          <Text style={{ color: '#333' }}>Last scanned: {scannedData ?? '—'}</Text>
        </View>

        <View style={{ marginTop: 18 }}>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#fff' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, borderBottomWidth: 1, borderColor: '#f1f1f1' },
  title: { fontSize: 16, fontWeight: '800' },
  scannerWrap: { height: 260, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  fallback: { padding: 16, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center' },
  qrWrap: { alignItems: 'center', paddingVertical: 8 },
  qrFallback: { padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  btn: { backgroundColor: '#E53935', padding: 12, borderRadius: 8, alignItems: 'center' }
});
