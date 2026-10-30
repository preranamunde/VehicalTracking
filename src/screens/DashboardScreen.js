// ============================================
// src/screens/DashboardScreen.js
// Same data as the web AnalyticsDashboard:
//   drivers      -> GET /api/driver                          (web: getAllDrivers)
//   vehicles     -> GET /api/assignments/gps-vehicle/client  (web: getAllVehicles -> data.assignments)
//   assignments  -> GET /api/trip                            (web: getAllAssignments -> data.data)
// ============================================
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
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { apiGet, ENDPOINTS } from '../utils/Api';

// ── theme ────────────────────────────────────────────────────────────────────
const C = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#0F172A',
  sub: '#64748B',
  muted: '#94A3B8',
  border: '#E8ECF3',
  green: '#059669',
  greenBg: '#ECFDF5',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  red: '#DC2626',
  redBg: '#FEF2F2',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  violet: '#7C3AED',
  violetBg: '#F5F3FF',
  slate: '#475569',
  slateBg: '#F1F5F9',
};

const H_PAD = 20;
const GAP = 12;
const CARD_W = (Dimensions.get('window').width - H_PAD * 2 - GAP) / 2;

// ── helpers ──────────────────────────────────────────────────────────────────
// Server replies differ a little per endpoint ({data:[]}, {assignments:[]}, [] ...)
// so pull the array out safely.
const toArray = (res, keys = []) => {
  if (Array.isArray(res)) return res;
  if (!res) return [];
  for (const k of keys) {
    if (Array.isArray(res[k])) return res[k];
  }
  if (Array.isArray(res.data)) return res.data;
  if (res.data) {
    for (const k of keys) {
      if (Array.isArray(res.data[k])) return res.data[k];
    }
  }
  return [];
};

const idOf = (v) => (v && typeof v === 'object' ? v._id : v);

const STATUS_CFG = {
  ACTIVE: { label: 'Active', color: C.green, bg: C.greenBg },
  IDLE: { label: 'Idle', color: C.amber, bg: C.amberBg },
  COMPLETED: { label: 'Completed', color: C.slate, bg: C.slateBg },
  INACTIVE: { label: 'Stopped', color: C.red, bg: C.redBg },
};

const formatToday = () =>
  new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const DashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripsTotal, setTripsTotal] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [dRes, vRes, aRes] = await Promise.allSettled([
        apiGet(ENDPOINTS.DASHBOARD_DRIVERS),
        apiGet(ENDPOINTS.DASHBOARD_VEHICLES),
        apiGet(ENDPOINTS.DASHBOARD_ASSIGNMENTS),
      ]);

      if (dRes.status === 'fulfilled') setDrivers(toArray(dRes.value, ['drivers']));
      if (vRes.status === 'fulfilled') setVehicles(toArray(vRes.value, ['assignments', 'vehicles']));
      if (aRes.status === 'fulfilled') {
        const list = toArray(aRes.value, ['trips']);
        setTrips(list);
        // /api/trip is paged ({ page, limit, total, data }) -> use server total when present
        setTripsTotal(Number(aRes.value?.total) || list.length);
      }

      if ([dRes, vRes, aRes].every((r) => r.status === 'rejected')) {
        setError(dRes.reason?.message || 'Failed to load dashboard');
      }
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── derived stats (same logic as web) ──────────────────────────────────────
  const stats = useMemo(() => {
    const activeTrips = trips.filter((t) => t.status === 'ACTIVE');
    const idleTrips = trips.filter((t) => t.status === 'IDLE');
    const stoppedTrips = trips.filter((t) => t.status === 'INACTIVE');
    const alertTrips = trips.filter(
      (t) => (t.overspeed_count || 0) > 0 || (t.geofence_crossing_count || 0) > 0
    );

    const activeDriverIds = new Set(activeTrips.map((t) => idOf(t.driver_id)).filter(Boolean));
    const activeVehicleIds = new Set(activeTrips.map((t) => idOf(t.vehicle_id)).filter(Boolean));

    return {
      totalDrivers: drivers.length,
      activeDrivers: activeDriverIds.size,
      totalVehicles: vehicles.length,
      activeVehicles: activeVehicleIds.size,
      totalTrips: tripsTotal || trips.length,
      activeTrips: activeTrips.length,
      idleTrips: idleTrips.length,
      stoppedTrips: stoppedTrips.length,
      alertsCount: alertTrips.length,
      overspeedTotal: alertTrips.reduce((s, t) => s + (t.overspeed_count || 0), 0),
      geofenceTotal: alertTrips.reduce((s, t) => s + (t.geofence_crossing_count || 0), 0),
      alertTrips,
    };
  }, [drivers, vehicles, trips, tripsTotal]);

  const kpiCards = [
    {
      id: 'vehicles',
      title: 'Vehicles',
      value: stats.totalVehicles,
      foot: `${stats.activeVehicles} on road`,
      icon: 'truck-outline',
      color: C.primary,
      bg: C.blueBg,
      route: 'Vehicles',
    },
    {
      id: 'drivers',
      title: 'Drivers',
      value: stats.totalDrivers,
      foot: `${stats.activeDrivers} on duty`,
      icon: 'account-group-outline',
      color: C.primary,
      bg: C.blueBg,
      route: 'Drivers',
    },
    {
      id: 'trips',
      title: 'Trips',
      value: stats.totalTrips,
      foot: `${stats.activeTrips} active`,
      icon: 'map-marker-path',
      color: C.primary,
      bg: C.blueBg,
      route: 'RouteManagement',
    },
    {
      id: 'alerts',
      title: 'Alerts',
      value: stats.alertsCount,
      foot: `${stats.overspeedTotal} overspeed · ${stats.geofenceTotal} geofence`,
      icon: 'bell-alert-outline',
      color: C.primary,
      bg: C.blueBg,
      route: 'TripHistoryVehicles',
    },
  ];

  const quickActions = [
    { id: 1, title: 'Add Vehicle', icon: 'truck-plus-outline', color: C.primary, bg: C.blueBg, route: 'Vehicles' },
    { id: 2, title: 'Add Driver', icon: 'account-plus-outline', color: C.primary, bg: C.blueBg, route: 'AddDriver' },
    { id: 3, title: 'Assign', icon: 'clipboard-check-outline', color: C.primary, bg: C.blueBg, route: 'Assignments' },
    { id: 4, title: 'History', icon: 'history', color: C.primary, bg: C.blueBg, route: 'TripHistoryVehicles' },
  ];

  const fleetStatus = [
    { label: 'On road', value: stats.activeTrips, color: C.primaryDark },
    { label: 'Idle', value: stats.idleTrips, color: C.primary },
    { label: 'Stopped', value: stats.stoppedTrips, color: '#93C5FD' },
  ];
  const fleetTotal = fleetStatus.reduce((s, f) => s + f.value, 0);

  const recentTrips = trips.slice(0, 6).map((t) => ({
    id: t._id || `${idOf(t.vehicle_id)}-${t.status}`,
    route: `${t.route_id?.place_from || '—'} → ${t.route_id?.place_to || '—'}`,
    driver: t.driver_id?.driver_name || 'N/A',
    reg: t.vehicle_id?.registration_number || 'N/A',
    status: t.status || 'IDLE',
  }));

  const alertItems = stats.alertTrips.slice(0, 5).map((t) => {
    const over = t.overspeed_count || 0;
    const geo = t.geofence_crossing_count || 0;
    const parts = [];
    if (over) parts.push(`${over} overspeed`);
    if (geo) parts.push(`${geo} geofence`);
    return {
      id: t._id || `${idOf(t.vehicle_id)}-alert`,
      title: t.vehicle_id?.registration_number || 'Vehicle',
      sub: `${parts.join(' · ')}  ·  ${t.route_id?.place_from || '—'} → ${t.route_id?.place_to || '—'}`,
      icon: over ? 'speedometer' : 'map-marker-radius-outline',
      color: C.primary,
      bg: C.blueBg,
    };
  });

  // ── small components ───────────────────────────────────────────────────────
  const KpiCard = ({ card }) => (
    <TouchableOpacity
      style={styles.kpiCard}
      activeOpacity={0.75}
      onPress={() => navigation.navigate(card.route)}
    >
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: card.bg }]}>
          <Icon name={card.icon} size={22} color={card.color} />
        </View>
        <Icon name="chevron-right" size={20} color={C.muted} />
      </View>
      <Text style={styles.kpiValue}>{card.value}</Text>
      <Text style={styles.kpiTitle}>{card.title}</Text>
      <Text style={styles.kpiFoot} numberOfLines={1}>
        {card.foot}
      </Text>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title, onPressAll }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPressAll && (
        <TouchableOpacity onPress={onPressAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.seeAll}>View all</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const TripItem = ({ trip, last }) => {
    const c = STATUS_CFG[trip.status] || STATUS_CFG.IDLE;
    return (
      <View style={[styles.row, !last && styles.rowBorder]}>
        <View style={[styles.rowIcon, { backgroundColor: C.blueBg }]}>
          <Icon name="truck-fast-outline" size={18} color={C.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>{trip.route}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {trip.driver} · {trip.reg}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: c.bg }]}>
          <Text style={[styles.pillText, { color: c.color }]}>{c.label}</Text>
        </View>
      </View>
    );
  };

  const AlertItem = ({ item, last }) => (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: item.bg }]}>
        <Icon name={item.icon} size={18} color={item.color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{item.sub}</Text>
      </View>
    </View>
  );

  const EmptyState = ({ icon, text }) => (
    <View style={styles.empty}>
      <Icon name={icon} size={28} color={C.muted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSub}>{formatToday()}</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <Icon name="refresh" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />
          }
        >
          {!!error && (
            <TouchableOpacity style={styles.errorBox} onPress={onRefresh}>
              <Icon name="alert-circle-outline" size={20} color={C.red} />
              <Text style={styles.errorText} numberOfLines={2}>{error} — tap to retry</Text>
            </TouchableOpacity>
          )}

          {/* KPI cards */}
          <View style={styles.kpiGrid}>
            {kpiCards.map((card) => (
              <KpiCard key={card.id} card={card} />
            ))}
          </View>

          {/* Fleet status */}
          <View style={styles.section}>
            <SectionHeader title="Fleet Status" />
            <View style={styles.card}>
              <View style={styles.fleetBar}>
                {fleetTotal === 0 ? (
                  <View style={{ flex: 1, backgroundColor: C.border }} />
                ) : (
                  fleetStatus.map((f) =>
                    f.value > 0 ? (
                      <View key={f.label} style={{ flex: f.value, backgroundColor: f.color }} />
                    ) : null
                  )
                )}
              </View>
              <View style={styles.fleetLegend}>
                {fleetStatus.map((f) => (
                  <View key={f.label} style={styles.fleetItem}>
                    <View style={styles.fleetLabelRow}>
                      <View style={[styles.dot, { backgroundColor: f.color }]} />
                      <Text style={styles.fleetLabel}>{f.label}</Text>
                    </View>
                    <Text style={styles.fleetValue}>{f.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.section}>
            <SectionHeader title="Quick Actions" />
            <View style={styles.quickRow}>
              {quickActions.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.quickItem}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate(a.route)}
                >
                  <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                    <Icon name={a.icon} size={24} color={a.color} />
                  </View>
                  <Text style={styles.quickTitle} numberOfLines={1}>{a.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Trips */}
          <View style={styles.section}>
            <SectionHeader title="Active Trips" onPressAll={() => navigation.navigate('RouteManagement')} />
            <View style={styles.card}>
              {recentTrips.length === 0 ? (
                <EmptyState icon="map-marker-off-outline" text="No trips found" />
              ) : (
                recentTrips.map((t, i) => (
                  <TripItem key={`${t.id}-${i}`} trip={t} last={i === recentTrips.length - 1} />
                ))
              )}
            </View>
          </View>

          {/* Alerts */}
          <View style={styles.section}>
            <SectionHeader title="Recent Alerts" />
            <View style={styles.card}>
              {alertItems.length === 0 ? (
                <EmptyState icon="shield-check-outline" text="No alerts — all clear" />
              ) : (
                alertItems.map((a, i) => (
                  <AlertItem key={`${a.id}-${i}`} item={a} last={i === alertItems.length - 1} />
                ))
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const shadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // header
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 18,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 20, paddingBottom: 32 },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: C.sub, fontWeight: '500' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: C.redBg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { flex: 1, fontSize: 13, color: C.red, fontWeight: '500' },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  kpiCard: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow,
  },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 28, fontWeight: '800', color: C.text, marginTop: 12 },
  kpiTitle: { fontSize: 13, fontWeight: '600', color: C.sub, marginTop: 2 },
  kpiFoot: { fontSize: 12, fontWeight: '500', color: C.sub, marginTop: 8 },

  // sections
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: C.primary },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow,
  },

  // fleet
  fleetBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: C.border,
    marginTop: 14,
    gap: 2,
  },
  fleetLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  fleetItem: { flex: 1 },
  fleetLabelRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  fleetLabel: { fontSize: 12, color: C.sub, fontWeight: '500' },
  fleetValue: { fontSize: 20, fontWeight: '700', color: C.text, marginTop: 4 },

  // quick actions
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', width: (CARD_W * 2 + GAP) / 4 - 4 },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickTitle: { fontSize: 12, fontWeight: '600', color: C.text, textAlign: 'center' },

  // list rows
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  rowSub: { fontSize: 12, color: C.sub, marginTop: 3, fontWeight: '500' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, fontSize: 13, color: C.muted, fontWeight: '500' },
});

export default DashboardScreen;