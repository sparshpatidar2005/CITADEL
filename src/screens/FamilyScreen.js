// src/screens/FamilyScreen.js
// Full replacement: Family screen now shows full KYC info for members (no map).
// Features:
// - Header merged into SafeAreaView (consistent theme).
// - Create / Join / Share family actions.
// - Search + filter members.
// - Member details modal showing full KYC fields (name, phone, aadhaar, address, destination, emergency contacts, role).
// - Actions per member: Call, SMS, Copy ID, Promote (if owner), Remove (if owner).
// - Pull-to-refresh (reads sessionService).
// - Uses sessionService.getProfile / saveProfile / generateFamilyId if available.
// Drop-in copy-paste ready.

import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  Clipboard,
  Share,
  RefreshControl,
} from 'react-native';
import sessionService from '../services/sessionService';

export default function FamilyScreen({ navigation, route }) {
  const tourist = route?.params?.tourist ?? { id: 'demo', name: 'Demo User' };
  const uid = tourist.id;

  // load profile
  const initialProfile = sessionService.getProfile(uid) || {};
  const initialFamilyId = route?.params?.familyId ?? initialProfile?.familyId ?? null;

  const [profile, setProfile] = useState(initialProfile);
  const [familyId, setFamilyId] = useState(initialFamilyId);
  const [members, setMembers] = useState(initialProfile?.members ?? []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isKycPending, setIsKycPending] = useState(!initialProfile || !initialProfile.kycCompleted);

  // UI
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);

  const isOwner = profile?.isFamilyOwner === true;

  useEffect(() => {
    // initialize from session
    refreshFromSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // sync derived states when profile changes
    setIsKycPending(!profile || !profile.kycCompleted);
    setMembers(profile?.members ?? []);
    setFamilyId(profile?.familyId ?? familyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function refreshFromSession() {
    setLoading(true);
    try {
      const refreshed = sessionService.getProfile(uid) || {};
      setProfile(refreshed);
      setMembers(refreshed?.members ?? []);
      setFamilyId(refreshed?.familyId ?? null);
      setIsKycPending(!refreshed || !refreshed.kycCompleted);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    // simulate fetching latest (but we read local sessionService)
    try {
      refreshFromSession();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }

  function createFamily() {
    if (!profile || !profile.kycCompleted) {
      Alert.alert('KYC required', 'Complete KYC before creating a family.');
      return;
    }

    const newFamilyId =
      typeof sessionService.generateFamilyId === 'function'
        ? sessionService.generateFamilyId()
        : `FAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const updated = { ...profile, familyId: newFamilyId, isFamilyOwner: true };
    if (typeof sessionService.saveProfile === 'function') sessionService.saveProfile(uid, updated);
    setProfile(updated);
    setFamilyId(newFamilyId);
    Alert.alert('Family created', `Your Family ID: ${newFamilyId}`);
  }

  function openJoinModal() {
    if (!profile || !profile.kycCompleted) {
      Alert.alert('KYC required', 'Complete KYC before joining a family.');
      return;
    }
    setJoinInput('');
    setJoinModalVisible(true);
  }

  function joinFamily() {
    if (!joinInput || joinInput.trim().length < 3) {
      Alert.alert('Invalid ID', 'Please enter a valid Family ID.');
      return;
    }
    const fid = joinInput.trim().toUpperCase();
    const updated = { ...profile, familyId: fid, isFamilyOwner: false };
    if (typeof sessionService.saveProfile === 'function') sessionService.saveProfile(uid, updated);
    setProfile(updated);
    setFamilyId(fid);
    setJoinModalVisible(false);
    Alert.alert('Joined', `Successfully joined family ${fid}`);
  }

  async function shareFamilyId() {
    if (!familyId) {
      Alert.alert('No Family', 'Create or join a family to share its ID.');
      return;
    }
    try {
      await Share.share({
        title: 'Family ID',
        message: `Join my family on the app using Family ID: ${familyId}`,
      });
    } catch (e) {
      // ignore
    }
  }

  function onInviteMember() {
    if (!familyId) {
      Alert.alert('Create or Join', 'Please create or join a family first to invite members.');
      return;
    }
    shareFamilyId();
  }

  function openMemberModal(item) {
    setSelectedMember(item);
    setMemberModalVisible(true);
  }

  function closeMemberModal() {
    setMemberModalVisible(false);
    setSelectedMember(null);
  }

  function callNumber(phone) {
    if (!phone) {
      Alert.alert('No phone', 'Phone number unavailable for this member.');
      return;
    }
    const url = `tel:${phone}`;
    LinkingOrAlert(url, 'Unable to start a call on this device.');
  }

  function smsNumber(phone) {
    if (!phone) {
      Alert.alert('No phone', 'Phone number unavailable for this member.');
      return;
    }
    const url = Platform.OS === 'ios' ? `sms:${phone}` : `sms:${phone}`;
    LinkingOrAlert(url, 'Unable to open SMS app on this device.');
  }

  function copyToClipboard(text, label = 'Copied') {
    try {
      // clipboard API: Clipboard.setString is deprecated in some RN; fallback to navigator
      Clipboard && Clipboard.setString ? Clipboard.setString(text) : null;
    } catch (e) {
      // ignore
    } finally {
      Alert.alert(label, text);
    }
  }

  function removeMember(memberId) {
    if (!isOwner) {
      Alert.alert('Permission denied', 'Only the family owner can remove members.');
      return;
    }
    Alert.alert('Remove member', 'Are you sure you want to remove this member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const updatedMembers = (profile.members || []).filter((m) => m.id !== memberId);
          const updated = { ...profile, members: updatedMembers };
          if (typeof sessionService.saveProfile === 'function') sessionService.saveProfile(uid, updated);
          setProfile(updated);
          setMembers(updatedMembers);
          closeMemberModal();
        },
      },
    ]);
  }

  function promoteToOwner(memberId) {
    if (!isOwner) {
      Alert.alert('Permission denied', 'Only the family owner can promote a member.');
      return;
    }
    // For this example we simply mark profile.isFamilyOwner = false and member becomes owner (simulated)
    const updatedProfile = { ...profile, isFamilyOwner: false };
    const updatedMembers = (profile.members || []).map((m) => (m.id === memberId ? { ...m, role: 'owner' } : { ...m, role: 'member' }));
    updatedProfile.members = updatedMembers;
    if (typeof sessionService.saveProfile === 'function') sessionService.saveProfile(uid, updatedProfile);
    setProfile(updatedProfile);
    setMembers(updatedMembers);
    Alert.alert('Promoted', 'Member has been promoted to owner (local change). You are no longer owner on this device.');
  }

  function LinkingOrAlert(url, fallbackMessage) {
    // helper to open URL and fallback to alert if unsupported
    try {
      // eslint-disable-next-line global-require
      const Linking = require('react-native').Linking;
      Linking.canOpenURL(url).then((supported) => {
        if (!supported) {
          Alert.alert('Error', fallbackMessage);
        } else {
          Linking.openURL(url).catch(() => Alert.alert('Error', fallbackMessage));
        }
      });
    } catch (e) {
      Alert.alert('Error', fallbackMessage);
    }
  }

  // search + filter
  const filteredMembers = members
    .filter((m) => {
      if (!m) return false;
      if (filterOnlineOnly && m.status !== 'online') return false;
      if (!searchText) return true;
      const q = searchText.toLowerCase();
      return (
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.phone && m.phone.toLowerCase().includes(q)) ||
        (m.id && m.id.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      // owners first then online
      if ((a.role === 'owner') !== (b.role === 'owner')) return a.role === 'owner' ? -1 : 1;
      if ((a.status === 'online') !== (b.status === 'online')) return a.status === 'online' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  function renderMemberRow({ item }) {
    return (
      <TouchableOpacity style={styles.memberRow} onPress={() => openMemberModal(item)} activeOpacity={0.8}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ maxWidth: '72%' }}>
              <Text style={styles.memberName}>{item.name}</Text>
              <Text style={styles.memberSmall}>{item.relation ?? item.phone ?? '—'}</Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.roleBadge, item.role === 'owner' ? styles.roleOwner : styles.roleMember]}>
                {item.role ? item.role.toUpperCase() : 'MEMBER'}
              </Text>
              <Text style={styles.statusText}>{item.status === 'online' ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.headerTitle}>Family</Text>
            <Text style={styles.headerSubtitle}>
              {familyId ? `Family ID • ${familyId}` : 'No family assigned'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} disabled={refreshing}>
            {refreshing ? <ActivityIndicator color="#fff" /> : <Text style={styles.iconBtnText}>Refresh</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 10 }]} onPress={() => navigation.navigate('Profile', { tourist })}>
            <Text style={styles.iconBtnText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KYC banner */}
      {isKycPending && (
        <TouchableOpacity style={styles.kycBanner} onPress={() => navigation.navigate('KYC', { tourist })}>
          <Text style={styles.kycTitle}>Complete Verification to enable family features</Text>
          <Text style={styles.kycSub}>Finish KYC to invite members, share family ID and enable group features.</Text>
        </TouchableOpacity>
      )}

      {/* Top actions */}
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.actionPrimary} onPress={createFamily}>
          <Text style={styles.actionPrimaryText}>Create Family</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionSecondary} onPress={openJoinModal}>
          <Text style={styles.actionSecondaryText}>Join Family</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionSecondary} onPress={shareFamilyId}>
          <Text style={styles.actionSecondaryText}>Share ID</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionSecondary} onPress={onInviteMember}>
          <Text style={styles.actionSecondaryText}>Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Search / Filter */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search members by name, phone or ID"
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={setSearchText}
          style={styles.searchInput}
        />
        <TouchableOpacity
          style={[styles.filterBtn, filterOnlineOnly && styles.filterBtnActive]}
          onPress={() => setFilterOnlineOnly((v) => !v)}
        >
          <Text style={[styles.filterText, filterOnlineOnly && styles.filterTextActive]}>
            {filterOnlineOnly ? 'Online' : 'All'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Members list */}
      <View style={styles.listWrap}>
        <Text style={styles.sectionTitle}>Members ({filteredMembers.length})</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={(i) => i.id || `${i.name}-${Math.random()}`}
            renderItem={renderMemberRow}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {isKycPending ? 'Family features locked. Complete KYC.' : 'No members found. Invite someone or join a family.'}
                </Text>
                {!isKycPending && (
                  <TouchableOpacity style={styles.emptyCTA} onPress={onInviteMember}>
                    <Text style={styles.emptyCTAText}>Invite Member</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>

      {/* Member detail modal */}
      <Modal visible={memberModalVisible} transparent animationType="slide" onRequestClose={closeMemberModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.memberModal}>
            {selectedMember ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>{(selectedMember.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.modalName}>{selectedMember.name}</Text>
                    <Text style={styles.modalSubtitle}>{selectedMember.relation ?? selectedMember.phone ?? 'Family member'}</Text>
                  </View>
                </View>

                <View style={styles.modalBody}>
                  <DetailRow label="Individual ID" value={selectedMember.id} onCopy={() => copyToClipboard(selectedMember.id || '')} />
                  <DetailRow label="Phone" value={selectedMember.phone || '—'} onCall={() => smsNumber(selectedMember.phone)} onCopy={() => copyToClipboard(selectedMember.phone || '')} />
                  <DetailRow label="Aadhaar" value={selectedMember.aadhar || '—'} onCopy={() => copyToClipboard(selectedMember.aadhar || '')} />
                  <DetailRow label="Address" value={selectedMember.address || '—'} />
                  <DetailRow label="Destination" value={selectedMember.destination || '—'} />
                  <DetailRow label="Emergency Contacts" value={(selectedMember.emergencyContacts || []).join(', ') || '—'} />
                  <View style={{ height: 8 }} />
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.modalBtn} onPress={() => smsNumber(selectedMember.phone)}>
                    <Text style={styles.modalBtnText}>Message</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalBtn} onPress={() => callNumber(selectedMember.phone)}>
                    <Text style={styles.modalBtnText}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalBtn} onPress={() => copyToClipboard(selectedMember.id || '', 'Copied ID')}>
                    <Text style={styles.modalBtnText}>Copy ID</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalFooterSecondary}>
                  {isOwner && selectedMember.id !== profile.id && (
                    <>
                      <TouchableOpacity style={[styles.dangerBtn]} onPress={() => removeMember(selectedMember.id)}>
                        <Text style={styles.dangerBtnText}>Remove</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.secondaryBtn} onPress={() => promoteToOwner(selectedMember.id)}>
                        <Text style={styles.secondaryBtnText}>Promote</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity style={styles.closeBtn} onPress={closeMemberModal}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        </View>
      </Modal>

      {/* Join family modal */}
      <Modal visible={joinModalVisible} animationType="slide" transparent onRequestClose={() => setJoinModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.joinModal}>
            <Text style={styles.joinTitle}>Join a Family</Text>
            <Text style={styles.joinDesc}>Enter Family ID you received from another member</Text>

            <TextInput
              value={joinInput}
              onChangeText={setJoinInput}
              placeholder="FAMILY-XXXX"
              placeholderTextColor="#9CA3AF"
              style={styles.joinInput}
              autoCapitalize="characters"
            />

            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setJoinModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.joinBtn} onPress={joinFamily}>
                <Text style={styles.joinBtnText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* Small helper component for showing labeled rows in member modal */
function DetailRow({ label, value, onCall, onCopy }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#0F172A', fontWeight: '700', flex: 1 }}>{value}</Text>
        <View style={{ flexDirection: 'row', marginLeft: 8 }}>
          {onCall && (
            <TouchableOpacity style={detailStyles.actionSmall} onPress={onCall}>
              <Text style={detailStyles.actionSmallText}>✉️</Text>
            </TouchableOpacity>
          )}
          {onCopy && (
            <TouchableOpacity style={[detailStyles.actionSmall, { marginLeft: 6 }]} onPress={onCopy}>
              <Text style={detailStyles.actionSmallText}>📋</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  actionSmall: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionSmallText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },

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

  kycBanner: { margin: 14, padding: 12, backgroundColor: '#FEF3C7', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  kycTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  kycSub: { color: '#A16207', marginTop: 6 },

  topActions: { flexDirection: 'row', paddingHorizontal: 14, marginTop: 8, justifyContent: 'space-between' },
  actionPrimary: { flex: 1, backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginRight: 8 },
  actionPrimaryText: { color: '#fff', fontWeight: '800' },
  actionSecondary: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginLeft: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  actionSecondaryText: { color: '#111827', fontWeight: '800' },

  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E6EEF8' },
  filterBtn: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6EEF8' },
  filterBtnActive: { backgroundColor: '#E7F2FF', borderColor: '#3B82F6' },
  filterText: { color: '#6B7280', fontWeight: '700' },
  filterTextActive: { color: '#0B5ED7' },

  listWrap: { flex: 1, paddingHorizontal: 16, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 8 },

  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, elevation: 1 },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#0F172A', fontWeight: '800', fontSize: 18 },
  memberName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  memberSmall: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  roleBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  roleOwner: { backgroundColor: '#EEF2FF', color: '#3730A3' },
  roleMember: { backgroundColor: '#F3F4F6', color: '#374151' },
  statusText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  emptyBox: { alignItems: 'center', padding: 20, marginTop: 6, backgroundColor: '#fff', borderRadius: 12 },
  emptyText: { color: '#6B7280', textAlign: 'center' },
  emptyCTA: { marginTop: 12, backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  emptyCTAText: { color: '#fff', fontWeight: '800' },

  // Member modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.5)', justifyContent: 'center', alignItems: 'center' },
  memberModal: { width: '92%', backgroundColor: '#fff', borderRadius: 14, padding: 18, maxHeight: '86%' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  modalAvatar: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  modalName: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  modalSubtitle: { color: '#6B7280', marginTop: 4 },

  modalBody: { marginTop: 8, paddingBottom: 8 },

  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  modalBtn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 6 },
  modalBtnText: { color: '#111827', fontWeight: '800' },

  modalFooterSecondary: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  dangerBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8 },
  dangerBtnText: { color: '#991B1B', fontWeight: '800' },
  secondaryBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8 },
  secondaryBtnText: { color: '#0B5ED7', fontWeight: '800' },
  closeBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  closeBtnText: { color: '#111827', fontWeight: '800' },

  // Join modal
  joinModal: { width: '90%', backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  joinTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  joinDesc: { color: '#6B7280', marginTop: 6 },
  joinInput: { marginTop: 12, borderWidth: 1, borderColor: '#E6EEF8', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FBFDFF' },
  cancelBtn: { flex: 1, backgroundColor: '#fff', paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  cancelBtnText: { color: '#111827', fontWeight: '800' },
  joinBtn: { flex: 1, backgroundColor: '#3B82F6', paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  joinBtnText: { color: '#fff', fontWeight: '900' },
});
