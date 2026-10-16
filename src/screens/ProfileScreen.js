// src/screens/ProfileScreen.js
//
// Fully redesigned profile screen to match the app theme used across Home / Family / Map screens.
//
// Features:
// - Merged header in SafeAreaView with dark theme.
// - Large avatar, name, and family/kyc status summary.
// - Editable profile modal (save to backend and sessionService).
// - Quick action buttons: Edit, Share ID, Copy ID, Call, Message.
// - Emergency contacts shown with quick-call buttons.
// - Small "more info" section (blood group, allergies, notes).
// - Pulls initial data from route.params.tourist and sessionService.getProfile (if available).

import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../services/api';
import sessionService from '../services/sessionService';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
  Share,
  Linking,
  ScrollView,
} from 'react-native';

const PROFILE_PREFIX = 'profile_';

// helper to find saved UID if route gives demo
async function findStoredUid() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pKey = keys.find((k) => typeof k === 'string' && k.startsWith(PROFILE_PREFIX));
    if (pKey) {
      const raw = await AsyncStorage.getItem(pKey);
      if (raw) {
        const p = JSON.parse(raw);
        return p?.id ?? null;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export default function ProfileScreen({ route, navigation }) {
  const touristParam = route.params?.tourist ?? { id: 'demo', name: 'Demo User' };
  const routeUid = touristParam.id;

  // initial UI state (defaults). We'll hydrate from cache/backend below.
  const [uid, setUid] = useState(routeUid);
  const [profile, setProfile] = useState({
    id: routeUid,
    name: touristParam.name ?? 'Demo User',
    phone: '',
    aadhar: '',
    bloodGroup: '',
    allergies: '',
    address: '',
    destination: '',
    emergencyContacts: [],
    familyId: null,
    isFamilyOwner: false,
    kycCompleted: false,
    notes: '',
    peopleCount: 1,
    lastLocation: null,
  });

  const [editVisible, setEditVisible] = useState(false);
  const [temp, setTemp] = useState(profile);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) quick in-memory cache by routeUid
        const inMem = (sessionService && typeof sessionService.getProfile === 'function') ? sessionService.getProfile(routeUid) : null;
        if (inMem && mounted) {
          setUid(inMem.id || routeUid);
          setProfile((p) => ({ ...p, ...inMem }));
        }

        // 2) if route uid is 'demo' or no in-memory, try to find any saved profile uid
        if ((!routeUid || routeUid === 'demo') && mounted) {
          const storedUid = await findStoredUid();
          if (storedUid) {
            setUid(storedUid);
            const local = await sessionService.loadProfileAsync(storedUid);
            if (local && mounted) setProfile((p) => ({ ...p, ...local }));
          }
        } else {
          // try AsyncStorage cached profile for routeUid
          const local = await sessionService.loadProfileAsync(routeUid);
          if (local && mounted) {
            setUid(routeUid);
            setProfile((p) => ({ ...p, ...local }));
          }
        }

        // 3) If token present, fetch /profiles/me for authoritative server data
        const token = await sessionService.getToken();
        if (token && mounted) {
          try {
            const r = await apiFetch('/profiles/me', { method: 'GET' });
            if (r.ok && r.body && mounted) {
              const serverProfile = r.body;
              // normalize emergencyContacts
              if (serverProfile && serverProfile.emergencyContacts && !Array.isArray(serverProfile.emergencyContacts)) {
                try { serverProfile.emergencyContacts = JSON.parse(serverProfile.emergencyContacts); } catch { serverProfile.emergencyContacts = []; }
              }
              setUid(serverProfile.id || serverProfile?.id || routeUid);
              setProfile((p) => ({ ...p, ...serverProfile }));
              if (sessionService && typeof sessionService.saveProfile === 'function') {
                await sessionService.saveProfile(serverProfile.id || routeUid, serverProfile);
              }
            } else {
              // if server rejects (401) we keep local data loaded above
            }
          } catch (e) {
            // ignore network errors
          }
        } else {
          // No token: optionally, try to fetch `/profiles/:id` only if routeUid is a real id
          if (routeUid && routeUid !== 'demo') {
            try {
              const r2 = await apiFetch(`/profiles/${routeUid}`, { method: 'GET' });
              if (r2.ok && r2.body && mounted) {
                const serverProfile = r2.body;
                if (serverProfile && serverProfile.emergencyContacts && !Array.isArray(serverProfile.emergencyContacts)) {
                  try { serverProfile.emergencyContacts = JSON.parse(serverProfile.emergencyContacts); } catch { serverProfile.emergencyContacts = []; }
                }
                setProfile((p) => ({ ...p, ...serverProfile }));
                if (sessionService && typeof sessionService.saveProfile === 'function') {
                  await sessionService.saveProfile(routeUid, serverProfile);
                }
              }
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep temp aligned when profile changes *and* not currently editing
  useEffect(() => {
    if (!editVisible) {
      setTemp(profile);
    }
  }, [profile, editVisible]);

  function openEdit() {
    setTemp(profile);
    setEditVisible(true);
  }

  // whitelist fields allowed by Prisma User model
  function buildAllowedPayload(obj) {
    // Allowed: name, phone, aadhar, address, destination, emergencyContacts, familyId, isFamilyOwner, kycCompleted, peopleCount, bloodGroup, allergies, notes, lastLocation
    const payload = {};
    if (typeof obj.name === 'string') payload.name = obj.name;
    if (typeof obj.phone !== 'undefined') payload.phone = obj.phone;
    if (typeof obj.aadhar !== 'undefined') payload.aadhar = obj.aadhar;
    if (typeof obj.address !== 'undefined') payload.address = obj.address;
    if (typeof obj.destination !== 'undefined') payload.destination = obj.destination;
    if (typeof obj.emergencyContacts !== 'undefined') payload.emergencyContacts = obj.emergencyContacts;
    if (typeof obj.familyId !== 'undefined') payload.familyId = obj.familyId;
    if (typeof obj.isFamilyOwner !== 'undefined') payload.isFamilyOwner = obj.isFamilyOwner;
    if (typeof obj.kycCompleted !== 'undefined') payload.kycCompleted = obj.kycCompleted;
    if (typeof obj.peopleCount !== 'undefined') payload.peopleCount = obj.peopleCount;
    if (typeof obj.bloodGroup !== 'undefined') payload.bloodGroup = obj.bloodGroup;
    if (typeof obj.allergies !== 'undefined') payload.allergies = obj.allergies;
    if (typeof obj.notes !== 'undefined') payload.notes = obj.notes;
    if (typeof obj.lastLocation !== 'undefined') payload.lastLocation = obj.lastLocation;
    return payload;
  }

  // Save profile: send to backend (only allowed fields), save server response locally.
  async function saveProfile() {
    const updated = { ...profile, ...temp };

    // ensure emergencyContacts is an array
    if (typeof updated.emergencyContacts === 'string') {
      updated.emergencyContacts = updated.emergencyContacts.split(',').map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(updated.emergencyContacts)) {
      updated.emergencyContacts = updated.emergencyContacts ? [updated.emergencyContacts] : [];
    }

    // optimistic UI update
    setProfile(updated);
    setEditVisible(false);

    // prefer authenticated server update if token exists
    const token = await sessionService.getToken();
    if (!token) {
      // offline / unauthenticated: save locally
      if (updated.id) {
        if (sessionService && typeof sessionService.saveProfile === 'function') {
          await sessionService.saveProfile(updated.id, updated);
        }
        Alert.alert('Saved locally', 'Profile updated locally (not synced).');
      } else {
        Alert.alert('No ID', 'Profile saved locally but no user id present.');
      }
      return;
    }

    // If authenticated, send to /profiles/me
    try {
      const payload = buildAllowedPayload(updated);

      const r = await apiFetch(`/profiles/me`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const saved = r.body;
        if (saved && saved.emergencyContacts && !Array.isArray(saved.emergencyContacts)) {
          try { saved.emergencyContacts = JSON.parse(saved.emergencyContacts); } catch { saved.emergencyContacts = []; }
        }
        const sid = saved?.id || uid;
        // persist local cache
        if (sessionService && typeof sessionService.saveProfile === 'function') {
          await sessionService.saveProfile(sid, saved || updated);
        }
        setProfile(saved || updated);
        setUid(sid);
        Alert.alert('Saved', 'Profile updated successfully.');
      } else {
        // backend error, still save locally
        if (sessionService && typeof sessionService.saveProfile === 'function') {
          await sessionService.saveProfile(uid || updated.id || 'local', updated);
        }
        Alert.alert('Error', r.body?.message || 'Failed to update profile (saved locally).');
      }
    } catch (e) {
      // network issue — save locally and inform user
      if (sessionService && typeof sessionService.saveProfile === 'function') {
        await sessionService.saveProfile(uid || updated.id || 'local', updated);
      }
      Alert.alert('Offline', 'Saved locally. Will sync when online.');
    }
  }

  function copyToClipboard(text, label = 'Copied') {
    try {
      // try RN Clipboard if available
      // eslint-disable-next-line global-require
      const Clipboard = require('react-native').Clipboard || (require('@react-native-clipboard/clipboard').default);
      if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(String(text ?? ''));
      }
    } catch (e) {
      // fallback: do nothing
    } finally {
      Alert.alert(label, String(text ?? ''));
    }
  }

  async function shareProfile() {
    try {
      const shareText = `My profile — ${profile.name}\nID: ${profile.id}\nPhone: ${profile.phone || 'N/A'}\nFamily ID: ${profile.familyId ?? 'N/A'}`;
      await Share.share({ message: shareText, title: 'My Digital Tourist ID' });
    } catch (e) {
      Alert.alert('Error', 'Unable to share at this time.');
    }
  }

  function callNumber(phone) {
    if (!phone) {
      Alert.alert('No phone', 'This profile does not have a phone number.');
      return;
    }
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then((supported) => (supported ? Linking.openURL(url) : Alert.alert('Not supported', 'Phone calls not supported on this device.')))
      .catch(() => Alert.alert('Error', 'Unable to start a call.'));
  }

  function smsNumber(phone) {
    if (!phone) {
      Alert.alert('No phone', 'This profile does not have a phone number.');
      return;
    }
    const url = Platform.OS === 'ios' ? `sms:${phone}` : `sms:${phone}`;
    Linking.canOpenURL(url)
      .then((supported) => (supported ? Linking.openURL(url) : Alert.alert('Not supported', 'SMS not supported on this device.')))
      .catch(() => Alert.alert('Error', 'Unable to open SMS app.'));
  }

  function renderEmergencyContacts() {
    if (!profile.emergencyContacts || profile.emergencyContacts.length === 0) {
      return <Text style={styles.muted}>No emergency contacts added.</Text>;
    }

    return profile.emergencyContacts.map((p, i) => (
      <View key={`ec-${i}`} style={styles.contactRow}>
        <View style={styles.contactLeft}>
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>{String(p || '').charAt(0).toUpperCase() || 'E'}</Text>
          </View>
          <Text style={styles.contactPhone}>{p}</Text>
        </View>

        <View style={styles.contactActions}>
          <TouchableOpacity style={styles.smallAction} onPress={() => callNumber(p)}>
            <Text style={styles.smallActionText}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallAction, { marginLeft: 8 }]} onPress={() => smsNumber(p)}>
            <Text style={styles.smallActionText}>✉️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallAction, { marginLeft: 8 }]} onPress={() => copyToClipboard(p, 'Phone copied')}>
            <Text style={styles.smallActionText}>📋</Text>
          </TouchableOpacity>
        </View>
      </View>
    ));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Digital Tourist ID</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={openEdit}><Text style={styles.iconBtnText}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 10 }]} onPress={shareProfile}><Text style={styles.iconBtnText}>Share</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{(profile.name || '?').charAt(0).toUpperCase()}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.nameLarge}>{profile.name}</Text>
              <Text style={styles.subtle}>ID: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{profile.id}</Text></Text>

              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TouchableOpacity style={styles.primarySmall} onPress={() => copyToClipboard(profile.id, 'ID copied')}>
                  <Text style={styles.primarySmallText}>Copy ID</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.primarySmall, { marginLeft: 10 }]} onPress={() => {
                  if (profile.familyId) {
                    Share.share({ message: `Join my family using ID: ${profile.familyId}` }).catch(()=>{});
                  } else {
                    Alert.alert('No family', 'You are not part of a family yet.');
                  }
                }}>
                  <Text style={styles.primarySmallText}>Share Family</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.profileRow}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.rowActions}>
              <Text style={styles.value}>{profile.phone || '—'}</Text>
              <View style={styles.rowButtons}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => callNumber(profile.phone)}><Text style={styles.actionBtnText}>📞</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { marginLeft: 8 }]} onPress={() => smsNumber(profile.phone)}><Text style={styles.actionBtnText}>✉️</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.profileRow}>
            <Text style={styles.label}>Aadhaar</Text>
            <View style={styles.rowActions}>
              <Text style={styles.value}>{profile.aadhar || '—'}</Text>
              <TouchableOpacity style={styles.iconGhost} onPress={() => copyToClipboard(profile.aadhar || '', 'Aadhaar copied')}>
                <Text style={styles.iconGhostText}>📋</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileRow}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.valueFull}>{profile.address || '—'}</Text>
          </View>

          <View style={styles.profileRow}>
            <Text style={styles.label}>Destination</Text>
            <Text style={styles.valueFull}>{profile.destination || '—'}</Text>
          </View>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          {renderEmergencyContacts()}

          <View style={styles.sectionDivider} />

          <View style={styles.twoCols}>
            <View style={styles.col}>
              <Text style={styles.faintLabel}>Blood group</Text>
              <Text style={styles.faintValue}>{profile.bloodGroup || '—'}</Text>
            </View>

            <View style={styles.col}>
              <Text style={styles.faintLabel}>Allergies</Text>
              <Text style={styles.faintValue}>{profile.allergies || '—'}</Text>
            </View>
          </View>

          <View style={{ height: 8 }} />
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.valueFull}>{profile.notes || 'No additional notes.'}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editModal}>
            <Text style={styles.editTitle}>Edit Profile</Text>

            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full name</Text>
              <TextInput style={styles.input} value={temp.name} onChangeText={(t) => setTemp((s) => ({ ...s, name: t }))} />

              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput style={styles.input} keyboardType="phone-pad" value={temp.phone} onChangeText={(t) => setTemp((s) => ({ ...s, phone: t }))} />

              <Text style={styles.inputLabel}>Aadhaar</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={temp.aadhar} onChangeText={(t) => setTemp((s) => ({ ...s, aadhar: t }))} />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput style={[styles.input, { height: 80 }]} multiline value={temp.address} onChangeText={(t) => setTemp((s) => ({ ...s, address: t }))} />

              <Text style={styles.inputLabel}>Emergency contacts (comma separated)</Text>
              <TextInput
                style={styles.input}
                value={(temp.emergencyContacts || []).join(', ')}
                onChangeText={(t) => setTemp((s) => ({ ...s, emergencyContacts: t.split(',').map(x => x.trim()).filter(Boolean) }))}
                placeholder="e.g. +919999999999, +918888888888"
              />

              <Text style={styles.inputLabel}>Blood group</Text>
              <TextInput style={styles.input} value={temp.bloodGroup} onChangeText={(t) => setTemp((s) => ({ ...s, bloodGroup: t }))} />

              <Text style={styles.inputLabel}>Allergies</Text>
              <TextInput style={styles.input} value={temp.allergies} onChangeText={(t) => setTemp((s) => ({ ...s, allergies: t }))} />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput style={[styles.input, { height: 80 }]} multiline value={temp.notes} onChangeText={(t) => setTemp((s) => ({ ...s, notes: t }))} />
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* Styles — matches app theme used previously (dark header, blue accents) */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    backgroundColor: '#1F2937',
    paddingTop: Platform.OS === 'ios' ? 14 : 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },

  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  iconBtnText: { color: '#fff', fontWeight: '700' },

  content: { padding: 16, paddingTop: 20, paddingBottom: 40 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#EFF6FF',
  },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarLarge: { width: 90, height: 90, borderRadius: 18, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { fontSize: 36, fontWeight: '900', color: '#0F172A' },
  nameLarge: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  subtle: { color: '#6B7280', marginTop: 6 },

  primarySmall: { backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  primarySmallText: { color: '#fff', fontWeight: '800' },

  profileRow: { marginTop: 10 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  value: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  valueFull: { fontSize: 14, color: '#0F172A' },

  rowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowButtons: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 16 },

  iconGhost: { backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 },
  iconGhostText: { fontSize: 14 },

  sectionDivider: { height: 1, backgroundColor: '#F3F7FA', marginVertical: 12 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 8 },

  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  contactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  smallAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  smallAvatarText: { fontWeight: '800', color: '#0F172A' },
  contactPhone: { fontWeight: '800', color: '#0F172A' },
  contactActions: { flexDirection: 'row', alignItems: 'center' },

  smallAction: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  smallActionText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  twoCols: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  col: { flex: 1, marginRight: 8 },
  faintLabel: { fontSize: 12, color: '#6B7280' },
  faintValue: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 6 },

  muted: { color: '#9CA3AF' },

  /* Edit modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', justifyContent: 'center', alignItems: 'center' },
  editModal: { width: '92%', maxHeight: '86%', backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  editTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 12 },

  inputLabel: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#E6EEF8', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginTop: 6, backgroundColor: '#FBFDFF' },

  cancelBtn: { flex: 1, backgroundColor: '#fff', paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  cancelBtnText: { color: '#111827', fontWeight: '800' },
  saveBtn: { flex: 1, backgroundColor: '#3B82F6', paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  saveBtnText: { color: '#fff', fontWeight: '900' },
});
