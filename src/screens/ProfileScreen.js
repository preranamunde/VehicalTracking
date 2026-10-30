import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { apiGet, ENDPOINTS } from '../utils/Api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── helpers ───────────────────────────────────────────────────────────────────
const show = (v) => (v === undefined || v === null || String(v).trim() === '' ? '-' : String(v));

const capitalize = (s) =>
  s ? String(s).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-';

const formatDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildAddress = (o) =>
  [o.address1, o.address2, o.city, o.district, o.state, o.pincode]
    .filter((p) => p && String(p).trim() !== '')
    .join(', ');

const ProfileScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [addressProofName, setAddressProofName] = useState('');
  const [idProofName, setIdProofName] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null); // { user, organisation, employee }
  const [orgExpanded, setOrgExpanded] = useState(false);

  // ── fetch /api/client-auth/me ───────────────────────────────────────────────
  const fetchProfile = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      const data = await apiGet(ENDPOINTS.ME);
      setProfile(data);
    } catch (e) {
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const toggleOrg = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOrgExpanded((prev) => !prev);
  };

  const employee = profile?.employee || {};
  const organisation = profile?.organisation || {};
  const user = profile?.user || {};

  // ── data for UI ─────────────────────────────────────────────────────────────
  const profileData = [
    { icon: 'account', label: 'Full Name', value: show(employee.name) },
    { icon: 'email', label: 'Email', value: show(employee.email) },
    { icon: 'phone', label: 'Mobile Number', value: show(employee.mobile_number) },
    { icon: 'briefcase', label: 'Designation', value: show(employee.designation) },
    { icon: 'shield-account', label: 'Role', value: capitalize(user.role) },
    { icon: 'account-network', label: 'Scope', value: capitalize(employee.scope) },
  ];

  const orgData = [
    { icon: 'domain', label: 'Entity Name', value: show(organisation.entity_name) },
    { icon: 'account-tie', label: 'Contact Name', value: show(organisation.contact_name) },
    { icon: 'file-document-outline', label: 'GST Number', value: show(organisation.gst_number) },
    { icon: 'card-text-outline', label: 'CIN Number', value: show(organisation.cin_number) },
    { icon: 'map-marker', label: 'Address', value: show(buildAddress(organisation)) },
    { icon: 'phone', label: 'Mobile Number', value: show(organisation.mobile_number) },
    { icon: 'whatsapp', label: 'WhatsApp Number', value: show(organisation.whatsapp_number) },
    { icon: 'email', label: 'Email', value: show(organisation.email_id) },
    { icon: 'tag-outline', label: 'Client Type', value: capitalize(organisation.client_type) },
    { icon: 'check-decagram', label: 'Status', value: capitalize(organisation.status) },
    { icon: 'calendar', label: 'Created On', value: formatDate(organisation.created_at) },
  ];

  const handleSubmitKYC = () => {
    if (!addressProofName.trim() || !idProofName.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both Address Proof and ID Proof names before submitting.');
      return;
    }
    Alert.alert('KYC Submitted', 'Your KYC documents have been submitted successfully!');
  };

  // ── reusable row ────────────────────────────────────────────────────────────
  const renderRow = (item, index, list) => (
    <View
      key={`${item.label}-${index}`}
      style={[styles.detailItem, index === list.length - 1 && styles.detailItemLast]}
    >
      <View style={styles.detailIconContainer}>
        <LinearGradient colors={['#3477eb15', '#5a94f515']} style={styles.iconGradient}>
          <Icon name={item.icon} size={22} color="#3477eb" />
        </LinearGradient>
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{item.label}</Text>
        <Text style={styles.detailValue}>{item.value}</Text>
      </View>
    </View>
  );

  const renderPersonalTab = () => (
    <>
      {/* Employee details */}
      <View style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.detailsContainer}>{profileData.map(renderRow)}</View>
      </View>

      {/* Organisation (expandable) */}
      <View style={styles.detailsCard}>
        <TouchableOpacity
          style={styles.orgHeader}
          onPress={toggleOrg}
          activeOpacity={0.7}
        >
          <LinearGradient colors={['#3477eb15', '#5a94f515']} style={styles.orgIconGradient}>
            <Icon name="office-building" size={22} color="#3477eb" />
          </LinearGradient>
          <View style={styles.orgHeaderText}>
            <Text style={styles.orgTitle}>Organisation</Text>
            <Text style={styles.orgSubtitle} numberOfLines={1}>
              {show(organisation.entity_name)}
            </Text>
          </View>
          <Icon
            name={orgExpanded ? 'chevron-up' : 'chevron-down'}
            size={28}
            color="#3477eb"
          />
        </TouchableOpacity>

        {orgExpanded && (
          <View style={styles.orgBody}>
            <View style={styles.detailsContainer}>{orgData.map(renderRow)}</View>
          </View>
        )}
      </View>
    </>
  );

  const renderKYCTab = () => (
    <View style={styles.detailsCard}>
      <Text style={styles.sectionTitle}>KYC Verification</Text>

      {/* Address Proof Section */}
      <View style={styles.kycSection}>
        <View style={styles.kycSectionHeader}>
          <LinearGradient colors={['#3477eb15', '#5a94f515']} style={styles.kycIconGradient}>
            <Icon name="home-city" size={20} color="#3477eb" />
          </LinearGradient>
          <Text style={styles.kycSectionTitle}>Address Proof</Text>
        </View>

        <Text style={styles.kycSubText}>Accepted: Aadhar Card / Voter ID / Driving Licence</Text>

        <Text style={styles.inputLabel}>Document Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter document name"
          placeholderTextColor="#94A3B8"
          value={addressProofName}
          onChangeText={setAddressProofName}
        />

        <TouchableOpacity style={styles.uploadButton} activeOpacity={0.8}>
          <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.uploadButtonGradient}>
            <Icon name="upload" size={20} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>Upload Address Proof</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.kycDivider} />

      {/* ID Proof Section */}
      <View style={styles.kycSection}>
        <View style={styles.kycSectionHeader}>
          <LinearGradient colors={['#3477eb15', '#5a94f515']} style={styles.kycIconGradient}>
            <Icon name="card-account-details" size={20} color="#3477eb" />
          </LinearGradient>
          <Text style={styles.kycSectionTitle}>ID Proof</Text>
        </View>

        <Text style={styles.kycSubText}>Accepted: Pan Card</Text>

        <Text style={styles.inputLabel}>Document Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter document name"
          placeholderTextColor="#94A3B8"
          value={idProofName}
          onChangeText={setIdProofName}
        />

        <TouchableOpacity style={styles.uploadButton} activeOpacity={0.8}>
          <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.uploadButtonGradient}>
            <Icon name="upload" size={20} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>Upload ID Proof</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmitKYC} activeOpacity={0.85}>
        <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.submitButtonGradient}>
          <Icon name="check-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.submitButtonText}>Submit KYC</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'personal', label: 'Personal', icon: 'account-details' },
        { key: 'kyc', label: 'KYC', icon: 'shield-check' },
      ].map((t) => {
        const active = activeTab === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={styles.tab}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.8}
          >
            {active ? (
              <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.activeTabGradient}>
                <Icon name={t.icon} size={18} color="#FFFFFF" />
                <Text style={styles.activeTabText}>{t.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.inactiveTabInner}>
                <Icon name={t.icon} size={18} color="#64748B" />
                <Text style={styles.inactiveTabText}>{t.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3477eb" />
          <Text style={styles.centerText}>Loading profile...</Text>
        </View>
      ) : error && !profile ? (
        <View style={styles.centerBox}>
          <Icon name="alert-circle-outline" size={56} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchProfile()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchProfile(true)}
              colors={['#3477eb']}
              tintColor="#3477eb"
            />
          }
        >
          {/* Profile Image Section */}
          <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.editProfileButton}>
              <Icon name="pencil" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.profileImageWrapper}>
              <LinearGradient
                colors={['#3477eb', '#5a94f5']}
                style={styles.profileImageContainer}
              >
                <Icon name="account" size={80} color="#FFFFFF" />
              </LinearGradient>
              <TouchableOpacity style={styles.cameraButton}>
                <Icon name="camera" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileName}>{show(employee.name)}</Text>
            <Text style={styles.profileRole}>{show(employee.designation)}</Text>
          </View>

          {renderTabs()}

          {activeTab === 'personal' ? renderPersonalTab() : renderKYCTab()}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },

  // loading / error
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  centerText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#3477eb',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  profileHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 40,
    paddingTop: 50,
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  editProfileButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3477eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3477eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  activeTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderRadius: 10,
  },
  inactiveTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inactiveTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },

  // Cards / rows
  detailsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  detailsContainer: {
    gap: 0,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailItemLast: {
    borderBottomWidth: 0,
  },
  detailIconContainer: {
    marginRight: 16,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },

  // Organisation (expandable)
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orgHeaderText: {
    flex: 1,
  },
  orgTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  orgSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  orgBody: {
    marginTop: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  // KYC Tab
  kycSection: {
    marginBottom: 4,
  },
  kycSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  kycIconGradient: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kycSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  kycSubText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3477eb',
    overflow: 'hidden',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#FAFAFA',
    marginBottom: 14,
  },
  uploadButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kycDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 20,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  bottomSpacer: {
    height: 30,
  },
});

export default ProfileScreen;