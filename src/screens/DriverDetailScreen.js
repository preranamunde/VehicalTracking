import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import { apiGet, ENDPOINTS } from '../utils/Api';

const formatDateTime = (iso) => {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── small reusable row ──
const InfoRow = ({ icon, label, value, onPress }) => (
  <TouchableOpacity
    activeOpacity={onPress ? 0.6 : 1}
    onPress={onPress}
    style={styles.infoRow}
  >
    <View style={styles.infoIconWrap}>
      <Icon name={icon} size={18} color="#3477eb" />
    </View>
    <View style={styles.infoTextWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, onPress && styles.infoValueLink]} selectable>
        {value || 'N/A'}
      </Text>
    </View>
  </TouchableOpacity>
);

const Section = ({ title, icon, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Icon name={icon} size={20} color="#3477eb" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const DriverDetailScreen = ({ navigation, route }) => {
  const { driverId, assignment } = route.params || {};

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ============================================
  // GET /api/driver/:id   →   { driver: {...} }
  // ============================================
  const fetchDriver = useCallback(async () => {
    try {
      setError(null);
      const res = await apiGet(ENDPOINTS.DRIVER_BY_ID(driverId));
      setDriver(res?.driver || res?.data || res);
    } catch (err) {
      console.error('❌ Error fetching driver detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDriver();
  };

  // ── derived values ──
  const employee = driver?.employee_id || {};
  const user = driver?.user_id || {};
  const name = employee.name || assignment?.name || 'Driver';
  const phone = employee.mobile_number || assignment?.phone;
  const email = employee.email || user.email || assignment?.email;
  const isAssigned = assignment?.status === 'Assigned';

  // ── header (shared by all states) ──
  const Header = () => (
    <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Details</Text>
        {driver ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('AddDriver', { editDriver: driver })}
          >
            <Icon name="pencil" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>
    </LinearGradient>
  );

  // ── loading ──
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
        <Header />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3477eb" />
          <Text style={styles.centerText}>Loading driver details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error ──
  if (error && !driver) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
        <Header />
        <View style={styles.centerBox}>
          <Icon name="alert-circle-outline" size={64} color="#CBD5E1" />
          <Text style={styles.errorTitle}>Could not load driver</Text>
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setLoading(true); fetchDriver(); }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── main ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3477eb']} tintColor="#3477eb" />
        }
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Icon name="account" size={44} color="#FFFFFF" />
          </View>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileRole}>{employee.designation || 'Driver'}</Text>

          {assignment && (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isAssigned ? '#4CAF50' : '#94A3B8' },
              ]}
            >
              <Text style={styles.statusText}>{assignment.status}</Text>
            </View>
          )}

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => phone && Linking.openURL(`tel:${phone}`)}
            >
              <Icon name="phone" size={20} color="#3477eb" />
              <Text style={styles.quickBtnText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => phone && Linking.openURL(`sms:${phone}`)}
            >
              <Icon name="message-outline" size={20} color="#3477eb" />
              <Text style={styles.quickBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => email && Linking.openURL(`mailto:${email}`)}
            >
              <Icon name="email-outline" size={20} color="#3477eb" />
              <Text style={styles.quickBtnText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal info */}
        <Section title="Personal Information" icon="account-details">
          <InfoRow icon="account-outline" label="Full Name" value={employee.name} />
          <InfoRow
            icon="phone-outline"
            label="Mobile Number"
            value={employee.mobile_number}
            onPress={phone ? () => Linking.openURL(`tel:${phone}`) : undefined}
          />
          <InfoRow
            icon="email-outline"
            label="Email"
            value={employee.email}
            onPress={email ? () => Linking.openURL(`mailto:${email}`) : undefined}
          />
          <InfoRow icon="briefcase-outline" label="Designation" value={employee.designation} />
        </Section>

        {/* License */}
        <Section title="License Details" icon="card-account-details-outline">
          <InfoRow icon="card-text-outline" label="License Number" value={driver?.driver_license} />
          <InfoRow icon="shield-car" label="License Type" value={driver?.license_type} />
        </Section>

        {/* Assignment (comes from the list screen's /api/driver/assignment data) */}
        {assignment && (
          <Section title="Vehicle Assignment" icon="car-side">
            <InfoRow icon="car" label="Vehicle" value={assignment.vehicle} />
            {!!assignment.vehicleModel && (
              <InfoRow icon="car-info" label="Make / Model" value={assignment.vehicleModel} />
            )}
            {!!assignment.fromDate && (
              <InfoRow
                icon="calendar-range"
                label="Assignment Period"
                value={`${assignment.fromDate}${assignment.toDate ? `  →  ${assignment.toDate}` : ''}`}
              />
            )}
          </Section>
        )}

        {/* Account */}
        <Section title="Account" icon="shield-account-outline">
          <InfoRow icon="at" label="Login Email" value={user.email} />
          <InfoRow icon="map-marker-radius-outline" label="Scope" value={user.scope || employee.scope} />
        </Section>

        {/* Record */}
        <Section title="Record Info" icon="clock-outline">
          <InfoRow icon="identifier" label="Driver ID" value={driver?._id} />
          <InfoRow icon="calendar-plus" label="Created On" value={formatDateTime(driver?.created_at)} />
        </Section>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 18, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { marginTop: 12, fontSize: 14, color: '#64748B', textAlign: 'center' },
  errorTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', color: '#1E293B' },
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3477eb', borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  profileCard: { backgroundColor: '#FFFFFF', margin: 20, marginBottom: 12, borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#3477eb', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  profileRole: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 2 },
  statusBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700', textTransform: 'uppercase' },

  quickActions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0F7FF', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#DBEAFE' },
  quickBtnText: { fontSize: 13, color: '#3477eb', fontWeight: '700' },

  section: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F7FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#1E293B', fontWeight: '600', marginTop: 2 },
  infoValueLink: { color: '#3477eb' },
});

export default DriverDetailScreen;