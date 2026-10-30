// src/screens/DriverAssignmentHistoryScreen.js
// Opens when "History" is tapped on a driver card (DriverScreen).
// Uses the SAME API as the Vehicle Assignment section of DriverLeaveScreen:
//   GET {{baseUrl}}/api/driverassignments/bydriver/:driver_id
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { apiGet, ENDPOINTS } from '../utils/Api';

const BLUE = '#3477eb';

// ---------- helpers (same logic as DriverLeaveScreen) ----------
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => {
  const d = v instanceof Date ? v : toDate(v);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};

// Fallback status when the API does not send one
const getAssignmentStatus = (a) => {
  const now = new Date();
  const from = toDate(a.from_datetime);
  const to = toDate(a.to_datetime);
  if (to && to < now) return 'Completed';
  if (from && from > now) return 'Upcoming';
  if (a.trip_id || a.route_id) return 'On Trip';
  return 'Parked / Idle';
};

// Status from the assignment API ("active" / "inactive"), capitalised
const getApiStatus = (a) => {
  const raw = a?.status ?? a?.assignment_status ?? a?.driver_assignment_status ?? '';
  const t = String(raw).trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};

const STATUS_STYLE = {
  Ongoing: { bg: '#FEF3C7', fg: '#92400E' },
  'On-Going': { bg: '#FEF3C7', fg: '#92400E' },
  'On Trip': { bg: '#DCFCE7', fg: '#166534' },
  'Parked / Idle': { bg: '#FEF3C7', fg: '#92400E' },
  Upcoming: { bg: '#DBEAFE', fg: '#1E40AF' },
  Completed: { bg: '#E2E8F0', fg: '#475569' },
  Active: { bg: '#DCFCE7', fg: '#166534' },
  Inactive: { bg: '#FEE2E2', fg: '#991B1B' },
};
const DEFAULT_STATUS_STYLE = { bg: '#E2E8F0', fg: '#475569' };

const normalizeAssignments = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.assignments)) return res.assignments;
  if (res?.data && typeof res.data === 'object') return [res.data];
  if (res?._id) return [res];
  return [];
};

const statusOf = (a) => getApiStatus(a) || getAssignmentStatus(a);

// ============================================
// Screen
// ============================================
const DriverAssignmentHistoryScreen = ({ navigation, route }) => {
  const driverId = route?.params?.driverId || route?.params?.driver?.id;
  const driver = route?.params?.driver || {};

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('All');

  // GET /api/driverassignments/bydriver/:driver_id
  const fetchHistory = useCallback(async () => {
    if (!driverId) {
      setError('Driver id is missing');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS_BY_DRIVER(driverId));
      const list = normalizeAssignments(res);
      // latest assignment first
      list.sort((x, y) => (toDate(y.from_datetime) || 0) - (toDate(x.from_datetime) || 0));
      setAssignments(list);
    } catch (err) {
      console.error('❌ Error fetching assignment history:', err);
      setAssignments([]);
      setError(err.message || 'Failed to load assignment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  // filter chips are built from the statuses that actually exist in the data
  const filters = useMemo(() => {
    const set = new Set(assignments.map(statusOf));
    return ['All', ...Array.from(set)];
  }, [assignments]);

  const counts = useMemo(() => {
    const c = { All: assignments.length };
    assignments.forEach((a) => {
      const s = statusOf(a);
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [assignments]);

  const filtered = useMemo(
    () => (selectedFilter === 'All' ? assignments : assignments.filter((a) => statusOf(a) === selectedFilter)),
    [assignments, selectedFilter]
  );

  // ---------- one assignment card ----------
  const renderCard = (a, idx) => {
    const v = a.vehicle_id && typeof a.vehicle_id === 'object' ? a.vehicle_id : {};
    const status = statusOf(a);
    const st = STATUS_STYLE[status] || DEFAULT_STATUS_STYLE;
    const makeModel = [v.make, v.model].filter(Boolean).join(' ');
    const routeName =
      a.route_id?.name ||
      (a.route_id?.place_from && a.route_id?.place_to
        ? `${a.route_id.place_from} → ${a.route_id.place_to}`
        : '');

    return (
      <View key={a._id || idx} style={styles.card}>
        <View style={[styles.accent, { backgroundColor: st.fg }]} />

        <View style={styles.cardTop}>
          <View style={styles.vIcon}>
            <Icon name="truck-outline" size={20} color={BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.regn} numberOfLines={1}>
              {v.registration_number || 'Vehicle'}
            </Text>
            {!!makeModel && <Text style={styles.model} numberOfLines={1}>{makeModel}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.fg }]}>{status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {!!fmtDate(a.from_datetime) && (
          <View style={styles.row}>
            <Icon name="calendar-start" size={16} color="#64748B" />
            <Text style={styles.label}>From</Text>
            <Text style={styles.value}>{fmtDate(a.from_datetime)}</Text>
          </View>
        )}

        {!!fmtDate(a.to_datetime) && (
          <View style={styles.row}>
            <Icon name="calendar-end" size={16} color="#64748B" />
            <Text style={styles.label}>To</Text>
            <Text style={styles.value}>{fmtDate(a.to_datetime)}</Text>
          </View>
        )}

        {!!routeName && (
          <View style={styles.row}>
            <Icon name="map-marker-path" size={16} color="#64748B" />
            <Text style={styles.label}>Trip</Text>
            <Text style={[styles.value, { color: BLUE }]} numberOfLines={1}>{routeName}</Text>
          </View>
        )}

        {!!a.instructions && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Instructions</Text>
            <Text style={styles.noteText}>{a.instructions}</Text>
          </View>
        )}
      </View>
    );
  };

  // ============================================
  // Render
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      <LinearGradient colors={[BLUE, '#5a94f5']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="arrow-left" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>Assignment History</Text>
            {!!driver.name && <Text style={styles.headerSub} numberOfLines={1}>{driver.name}</Text>}
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.centerText}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BLUE]} tintColor={BLUE} />
          }
        >
          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle-outline" size={20} color="#B91C1C" />
              <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
              <TouchableOpacity
                onPress={() => {
                  setLoading(true);
                  fetchHistory();
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Filter chips */}
          {assignments.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {filters.map((f) => {
                const active = selectedFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedFilter(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                    <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                      <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                        {counts[f] || 0}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* List */}
          {filtered.length > 0 ? (
            filtered.map(renderCard)
          ) : (
            !error && (
              <View style={styles.empty}>
                <Icon name="history" size={56} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No assignment history</Text>
                <Text style={styles.emptyText}>
                  {assignments.length === 0
                    ? 'This driver has no vehicle assignments yet.'
                    : 'No records match the selected filter.'}
                </Text>
              </View>
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { marginTop: 14, fontSize: 15, color: '#64748B', fontWeight: '500' },
  content: { padding: 16, paddingBottom: 40 },

  filterRow: { paddingBottom: 12, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  chipBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, minWidth: 22, alignItems: 'center' },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipBadgeText: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  chipBadgeTextActive: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BLUE,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBE7FB',
  },
  regn: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  model: { fontSize: 12, color: '#64748B', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  label: { fontSize: 12, color: '#64748B', fontWeight: '500', width: 44 },
  value: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1, textAlign: 'right' },

  noteBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginTop: 8 },
  noteLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 2 },
  noteText: { fontSize: 12.5, color: '#475569' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 12, color: '#991B1B' },
  retryText: { fontSize: 13, fontWeight: '700', color: BLUE },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginTop: 14 },
  emptyText: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
});

export default DriverAssignmentHistoryScreen;