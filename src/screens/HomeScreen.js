// src/screens/HomeScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  StatusBar,
  Dimensions,
  FlatList,
} from 'react-native';

import MapViewComponent from '../components/MapViewComponent';
import sessionService from '../services/sessionService';

const { width } = Dimensions.get('window');

export default function HomeScreen({ route, navigation }) {
  const tourist = route.params?.tourist ?? { id: 'demo', name: 'Demo User' };
  const uid = tourist.id;

  // load profile from local session service
  const [profile, setProfile] = useState(() => sessionService.getProfile(uid));
  const [luggages, setLuggages] = useState(profile?.luggages ?? []);

  // animations & scroll
  const kycPulseAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // KYC pulse animation if not completed
    if (!profile?.kycCompleted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(kycPulseAnim, { toValue: 1.05, duration: 900, useNativeDriver: true }),
          Animated.timing(kycPulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }

    // Content entrance animations
    Animated.parallel([
      Animated.timing(slideUpAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(fadeInAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    setLuggages(profile?.luggages ?? []);
  }, [profile]);

  const openFullKycScreen = () => {
    navigation.navigate('KYC', { tourist });
  };

  const openFamilyMap = () => {
    if (!profile?.familyId) {
      Alert.alert('Family', 'No family assigned yet. Complete KYC and create/join a family to view family map.');
      return;
    }
    navigation.navigate('MapTab', { familyId: profile.familyId });
  };

  /* -------------------
     LUGGAGE + QR HANDLERS
     ------------------- */
  function generateLuggageId() {
    return `LUG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  function createLuggage() {
    if (!profile?.kycCompleted) {
      Alert.alert('KYC Required', 'Please complete your KYC verification first to register luggage.');
      return;
    }

    const lugId = generateLuggageId();
    const now = new Date().toISOString();
    const newLug = {
      id: lugId,
      label: `Luggage ${luggages.length + 1}`,
      ownerId: profile.id,
      ownerName: profile.name,
      status: 'safe',
      createdAt: now,
      qrPayload: JSON.stringify({ type: 'luggage', luggageId: lugId, ownerId: profile.id, ownerName: profile.name }),
    };

    const updated = {
      ...profile,
      luggages: [...(profile.luggages || []), newLug],
    };

    sessionService.saveProfile(uid, updated);
    setProfile(updated);
    setLuggages(updated.luggages);

    navigation.navigate('QRCode', { mode: 'display', qrData: newLug.qrPayload, title: `${newLug.label} — QR` });
  }

  function openScanScreen() {
    navigation.navigate('QRCode', { mode: 'scan', onScanResult: handleScanResult });
  }

  function handleScanResult(scanText) {
    try {
      const parsed = JSON.parse(scanText);
      if (parsed?.type === 'luggage' && parsed.luggageId) {
        const found = findLuggageAcrossSession(parsed.luggageId);
        if (found) {
          Alert.alert('Luggage Found', `Luggage ID: ${parsed.luggageId}\nOwner: ${found.ownerName}\nPhone: ${found.ownerPhone ?? profile?.phone ?? 'N/A'}`);
        } else {
          Alert.alert('Luggage Scanned', `Luggage ID: ${parsed.luggageId}\nOwner ID: ${parsed.ownerId ?? 'unknown'}\n\nContact support for assistance.`);
        }
      } else {
        Alert.alert('QR Code Scanned', scanText);
      }
    } catch (e) {
      Alert.alert('QR Code Content', scanText);
    }
  }

  function findLuggageAcrossSession(luggageId) {
    const p = sessionService.getProfile(uid);
    const all = p?.luggages ?? [];
    return all.find((l) => l.id === luggageId) ?? null;
  }

  function viewLuggage(luggage) {
    navigation.navigate('QRCode', { mode: 'display', qrData: luggage.qrPayload, title: `${luggage.label} — QR` });
  }

  function toggleLuggageStatus(luggageId) {
    const updatedLugs = (profile.luggages || []).map((l) =>
      l.id === luggageId ? { ...l, status: l.status === 'lost' ? 'safe' : 'lost' } : l
    );
    const updatedProfile = { ...profile, luggages: updatedLugs };
    sessionService.saveProfile(uid, updatedProfile);
    setProfile(updatedProfile);
    setLuggages(updatedLugs);
  }

  /* -------------------
     RENDER HELPERS
     ------------------- */

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [160, 96],
    extrapolate: 'clamp',
  });

  const headerTitleScale = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const kycProgress = (() => {
    if (!profile) return 0;
    const fields = ['name', 'aadhar', 'phone', 'address', 'destination', 'emergencyContacts'];
    let filled = 0;
    if (profile.name) filled++;
    if (profile.aadhar) filled++;
    if (profile.phone) filled++;
    if (profile.address) filled++;
    if (profile.destination) filled++;
    if (profile.emergencyContacts && profile.emergencyContacts.length > 0) filled++;
    return Math.round((filled / fields.length) * 100);
  })();

  const renderKYCBanner = () => {
    if (profile?.kycCompleted) return null;

    return (
      <Animated.View style={[styles.kycBanner, { transform: [{ scale: kycPulseAnim }] }]}>
        <View style={styles.kycContent}>
          <View style={styles.kycIcon}>
            <Text style={styles.kycIconText}>⚠️</Text>
          </View>
          <View style={styles.kycTextContainer}>
            <Text style={styles.kycTitle}>Complete Your Verification</Text>
            <Text style={styles.kycSubtitle}>Unlock all features by completing your KYC</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.kycButton} onPress={openFullKycScreen}>
          <Text style={styles.kycButtonText}>Verify Now</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderStatsCards = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{luggages.length}</Text>
        <Text style={styles.statLabel}>Total Luggage</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statNumber, { color: luggages.filter(l => l.status === 'safe').length === luggages.length ? '#10B981' : '#F59E0B' }]}>
          {luggages.filter(l => l.status === 'safe').length}
        </Text>
        <Text style={styles.statLabel}>Safe Items</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{profile?.familyId ? '1' : '0'}</Text>
        <Text style={styles.statLabel}>Family Groups</Text>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={[styles.quickActionCard, !profile?.kycCompleted && styles.quickActionDisabled]}
          onPress={createLuggage}
        >
          <View style={styles.quickActionIcon}><Text style={styles.quickActionIconText}>📦</Text></View>
          <Text style={styles.quickActionTitle}>Create Luggage</Text>
          <Text style={styles.quickActionSubtitle}>Generate QR code</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={openScanScreen}>
          <View style={styles.quickActionIcon}><Text style={styles.quickActionIconText}>📱</Text></View>
          <Text style={styles.quickActionTitle}>Scan QR</Text>
          <Text style={styles.quickActionSubtitle}>Find luggage</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('MapTab')}>
          <View style={styles.quickActionIcon}><Text style={styles.quickActionIconText}>🗺️</Text></View>
          <Text style={styles.quickActionTitle}>View Map</Text>
          <Text style={styles.quickActionSubtitle}>Track location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('FamilyTab')}>
          <View style={styles.quickActionIcon}><Text style={styles.quickActionIconText}>👨‍👩‍👧‍👦</Text></View>
          <Text style={styles.quickActionTitle}>Family</Text>
          <Text style={styles.quickActionSubtitle}>Manage group</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLuggageItem = ({ item }) => (
    <Animated.View style={[styles.luggageCard, { transform: [{ translateY: slideUpAnim }], opacity: fadeInAnim }]}>
      <View style={styles.luggageHeader}>
        <View style={styles.luggageInfo}>
          <Text style={styles.luggageTitle}>{item.label}</Text>
          <Text style={styles.luggageId}>ID: {item.id}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'safe' ? styles.statusSafe : styles.statusLost]}>
          <Text style={[styles.statusText, item.status === 'safe' ? styles.statusTextSafe : styles.statusTextLost]}>
            {item.status === 'safe' ? '✓ Safe' : '⚠ Lost'}
          </Text>
        </View>
      </View>

      <View style={styles.luggageActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => viewLuggage(item)}>
          <Text style={styles.actionButtonText}>View QR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.statusToggleButton]} onPress={() => toggleLuggageStatus(item.id)}>
          <Text style={styles.statusToggleText}>{item.status === 'lost' ? 'Mark Safe' : 'Mark Lost'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    // SafeAreaView background uses header color so top notch area blends with header
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header merged into SafeAreaView for seamless top area */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Animated.View style={[styles.headerInner, { transform: [{ scale: headerTitleScale }] }]}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile?.name || tourist.name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerNames}>
              <Text style={styles.greetingText}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}</Text>
              <Text style={styles.headerName}>{profile?.name ?? tourist.name}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.iconText}>🔔</Text>
            </TouchableOpacity>

            {/* KYC progress chip */}
            <TouchableOpacity style={styles.progressChip} onPress={openFullKycScreen}>
              <View style={styles.progressLeft}>
                <Text style={styles.progressNumber}>{kycProgress}%</Text>
              </View>
              <View style={styles.progressRight}>
                <Text style={styles.progressLabel}>{profile?.kycCompleted ? 'Verified' : 'KYC'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Main surface - white rounded content that sits under header */}
      <View style={styles.surface}>
        <Animated.ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {/* KYC banner (prominent) */}
          {renderKYCBanner()}

          {/* Stats */}
          {renderStatsCards()}

          {/* Map */}
          <View style={styles.mapContainer}>
            <Text style={styles.sectionTitle}>Live Location</Text>
            <View style={styles.mapCard}>
              <MapViewComponent followUser={true} markers={[]} style={styles.mapView} />
              <TouchableOpacity style={styles.mapOverlay} onPress={() => navigation.navigate('MapTab')}>
                <Text style={styles.mapOverlayText}>Tap to expand map</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick actions */}
          {renderQuickActions()}

          {/* Luggage */}
          <View style={styles.luggageSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Luggage</Text>
              {profile?.kycCompleted && (
                <TouchableOpacity style={styles.addButton} onPress={createLuggage}>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {luggages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🧳</Text>
                <Text style={styles.emptyTitle}>No luggage yet</Text>
                <Text style={styles.emptySubtitle}>
                  {!profile?.kycCompleted ? 'Complete KYC verification to start adding luggage' : 'Create your first luggage item to get started'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={luggages}
                keyExtractor={(item) => item.id}
                renderItem={renderLuggageItem}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
        </Animated.ScrollView>
      </View>

      {/* Floating Chatbot */}
      <TouchableOpacity style={styles.chatbotFloat} onPress={() => navigation.navigate('Chatbot')} activeOpacity={0.85}>
        <Text style={styles.chatbotIcon}>💬</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' }, // header color so notch blends nicely

  /* Header (merged into SafeAreaView) */
  header: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 10,
    paddingTop: 3,
    zIndex: 0,
    marginBottom:0,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  headerNames: { justifyContent: 'center' },
  greetingText: { color: '#9CA3AF', fontSize: 13 },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 2 },

  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconText: { color: '#fff', fontSize: 16 },

  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    elevation: 2,
  },
  progressLeft: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  progressNumber: { fontWeight: '800', color: '#3730A3' },
  progressRight: {},
  progressLabel: { fontSize: 12, color: '#0F172A', fontWeight: '700' },

  /* Main white surface under header */
  surface: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -80, // small negative so content visually pulls up
    zIndex: 1,
    paddingTop:15,
  },

  /* Content area (scroll) */
  content: { flex: 1 },

  /* KYC banner */
  kycBanner: {
    margin: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  kycContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kycIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  kycIconText: { fontSize: 18 },
  kycTextContainer: { flex: 1 },
  kycTitle: { fontSize: 15, fontWeight: '800', color: '#92400E' },
  kycSubtitle: { fontSize: 13, color: '#A16207' },
  kycButton: { backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-end' },
  kycButtonText: { color: '#fff', fontWeight: '800' },

  /* Stats */
  statsContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', marginRight: 8 },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 6 },

  /* Map */
  mapContainer: { paddingHorizontal: 20, marginBottom: 18 },
  mapCard: { height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  mapView: { flex: 1 },
  mapOverlay: { position: 'absolute', bottom: 8, left: 8, right: 8, backgroundColor: 'rgba(15,23,42,0.8)', padding: 8, borderRadius: 8, alignItems: 'center' },
  mapOverlayText: { color: '#fff', fontWeight: '700' },

  /* Quick actions */
  quickActionsContainer: { paddingHorizontal: 20, marginBottom: 12 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickActionCard: {
    width: (width - 56) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  quickActionDisabled: { opacity: 0.5 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickActionIconText: { fontSize: 18 },
  quickActionTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  quickActionSubtitle: { fontSize: 12, color: '#6B7280', textAlign: 'center' },

  /* Luggage */
  luggageSection: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 12 },
  addButton: { backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  addButtonText: { color: '#fff', fontWeight: '800' },

  luggageCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  luggageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  luggageInfo: { flex: 1 },
  luggageTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  luggageId: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusSafe: { backgroundColor: '#D1FAE5' },
  statusLost: { backgroundColor: '#FEE2E2' },
  statusText: { fontWeight: '700' },
  statusTextSafe: { color: '#065F46' },
  statusTextLost: { color: '#991B1B' },

  luggageActions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginRight: 8 },
  actionButtonText: { color: '#374151', fontWeight: '700' },
  statusToggleButton: { backgroundColor: '#EF4444', marginRight: 0 },
  statusToggleText: { color: '#fff', fontWeight: '800' },

  emptyState: { alignItems: 'center', padding: 28, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },

  /* Floating Chatbot */
  chatbotFloat: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  chatbotIcon: { fontSize: 22, color: '#fff' },
});
