// src/components/MapViewComponent.js
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';

const DEFAULT_REGION = {
  latitude: 21.0,
  longitude: 78.0,
  latitudeDelta: 10.0,
  longitudeDelta: 10.0,
};

async function requestLocationPermissionAndroid() {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app requires access to your location to center the map.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Permission error', err);
    return false;
  }
}

const MapViewComponent = forwardRef(({ followUser = true, markers = [] }, ref) => {
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);

  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [zoomLevel, setZoomLevel] = useState(15); // used for our own UI controls

  useImperativeHandle(ref, () => ({
    animateToRegion: (r, duration = 500) => {
      if (mapRef.current && mapRef.current.animateToRegion) {
        mapRef.current.animateToRegion(r, duration);
      }
    },
    fitToSuppliedMarkers: (ids = [], options = {}) => {
      if (mapRef.current && mapRef.current.fitToSuppliedMarkers) {
        mapRef.current.fitToSuppliedMarkers(ids, options);
      }
    },
    getNativeMap: () => mapRef.current,
  }));

  useEffect(() => {
    (async () => {
      let granted = true;
      if (Platform.OS === 'android') {
        granted = await requestLocationPermissionAndroid();
      } else {
        // iOS: geolocation permission prompt handled by Geolocation API call
        granted = true;
      }
      setHasLocationPermission(granted);
      if (granted) {
        centerToCurrentLocation();
        startWatchingPosition();
      } else {
        setLoading(false);
      }
    })();

    return () => {
      stopWatchingPosition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (followUser && userLocation) {
      const r = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      animateAndSetRegion(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, followUser]);

  function animateAndSetRegion(r) {
    setRegion(r);
    if (mapRef.current && mapRef.current.animateToRegion) {
      mapRef.current.animateToRegion(r, 500);
    }
  }

  async function centerToCurrentLocation() {
    setLoading(true);
    try {
      const pos = await getCurrentLocationOnce();
      if (pos) {
        const r = {
          latitude: pos.latitude,
          longitude: pos.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setUserLocation(pos);
        animateAndSetRegion(r);
      }
    } catch (e) {
      console.warn('Could not get current location: ', e);
    } finally {
      setLoading(false);
    }
  }

  function getCurrentLocationOnce() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve({ latitude, longitude, timestamp: position.timestamp });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
          forceRequestLocation: true,
          showLocationDialog: true,
        }
      );
    });
  }

  function startWatchingPosition() {
    if (watchIdRef.current) return;
    try {
      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          if (!position || !position.coords) return;
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude, timestamp: position.timestamp });
        },
        (error) => {
          console.warn('watchPosition error', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5, // update when device moved at least 5 meters
          interval: 3000,
          fastestInterval: 2000,
        }
      );
    } catch (e) {
      console.warn('startWatchingPosition failed', e);
    }
  }

  function stopWatchingPosition() {
    try {
      if (watchIdRef.current != null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    } catch (e) {
      // ignore
      watchIdRef.current = null;
    }
  }

  function onPressCenter() {
    centerToCurrentLocation();
  }

  function onZoomIn() {
    // reduce deltas to increase zoom
    const r = {
      ...region,
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.0005),
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.0005),
    };
    animateAndSetRegion(r);
    setZoomLevel((z) => Math.min(20, z + 1));
  }

  function onZoomOut() {
    const r = {
      ...region,
      latitudeDelta: Math.min(region.latitudeDelta * 2, 40),
      longitudeDelta: Math.min(region.longitudeDelta * 2, 40),
    };
    animateAndSetRegion(r);
    setZoomLevel((z) => Math.max(1, z - 1));
  }

  // If MapView isn't available (developer didn't install package) show placeholder
  if (!MapView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.placeholderText}>Map package not available</Text>
        <Text style={styles.placeholderTextSmall}>Install react-native-maps to show interactive map.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={region}
        showsUserLocation={false} // we place a custom marker; set true if you prefer native blue dot
        showsMyLocationButton={false}
        showsCompass={true}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {userLocation && (
          <Marker
            key="__user_marker"
            coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            title="You are here"
            description="Current device location"
          >
            {/* Custom marker UI */}
            <View style={styles.userMarker}>
              <View style={styles.userMarkerCore} />
            </View>
          </Marker>
        )}

        {markers.map((m) => (
          <Marker
            key={m.id ?? `${m.latitude}-${m.longitude}`}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.description}
          />
        ))}
      </MapView>

      {/* Controls: center + zoom */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={onPressCenter} style={styles.controlButton} accessibilityLabel="Center">
          <Image source={require('../assets/center.png')} style={styles.controlIcon} />
        </TouchableOpacity>

        <View style={styles.zoomContainer}>
          <TouchableOpacity onPress={onZoomIn} style={[styles.controlButton, styles.zoomBtn]}>
            <Text style={styles.zoomTxt}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onZoomOut} style={[styles.controlButton, styles.zoomBtn]}>
            <Text style={styles.zoomTxt}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading indicator while initial location resolves */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Getting location…</Text>
        </View>
      )}
    </View>
  );
});

export default MapViewComponent;

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%' },
  map: { flex: 1 },
  fallback: { flex: 1, backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center', padding: 14 },
  placeholderText: { fontSize: 16, color: '#333', marginBottom: 6 },
  placeholderTextSmall: { color: '#666', marginBottom: 10 },

  userMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,136,229,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(30,136,229,0.35)',
  },
  userMarkerCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1E88E5',
    borderWidth: 2,
    borderColor: '#fff',
  },

  controlsContainer: {
    position: 'absolute',
    right: 12,
    top: 12,
    alignItems: 'center',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  controlIcon: { width: 20, height: 20, tintColor: '#333' },

  zoomContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  zoomTxt: { fontSize: 22, fontWeight: '700', color: '#333' },

  loadingOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '46%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
