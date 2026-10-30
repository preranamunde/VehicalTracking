import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  StatusBar, Platform, ActivityIndicator, RefreshControl, ScrollView, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiGet, ENDPOINTS } from '../utils/Api';

const BLUE = '#3477eb';
const RED = '#EF4444';
const GREEN = '#10B981';
const ORANGE = '#F59E0B';
const GREY = '#94A3B8';
const PAGE_SIZE = 20;

const DATE_FILTERS = [
  { value: 'today',        label: 'Today' },
  { value: 'yesterday',    label: 'Yesterday' },
  { value: 'this week',    label: 'This Week' },
  { value: 'last week',    label: 'Last Week' },
  { value: 'this month',   label: 'This Month' },
  { value: 'last month',   label: 'Last Month' },
  { value: 'custom range', label: 'Custom Range' },
];

const REPORT_TYPES = [
  { value: 'all',          label: 'All',          icon: 'format-list-bulleted' },
  { value: 'overspeed',    label: 'Overspeed',    icon: 'speedometer' },
  { value: 'geofence',     label: 'Geofence',     icon: 'map-marker-radius-outline' },
  { value: 'tamper_alert', label: 'Tamper Alert', icon: 'shield-alert-outline' },
];

// packet_data_type -> readable event
const PACKET_INFO = {
  NR: { label: 'Normal Reading',        icon: 'crosshairs-gps',      color: BLUE },
  HP: { label: 'Health Packet',         icon: 'heart-pulse',         color: GREEN },
  IN: { label: 'Ignition ON',           icon: 'key',                 color: GREEN },
  IF: { label: 'Ignition OFF',          icon: 'key-remove',          color: GREY },
  BD: { label: 'Battery Disconnected',  icon: 'battery-off',         color: RED },
  BR: { label: 'Battery Reconnected',   icon: 'car-battery',         color: GREEN },
  TA: { label: 'Tamper Alert',          icon: 'shield-alert',        color: RED },
  EA: { label: 'Emergency Alert',       icon: 'alarm-light',         color: RED },
};

// YYYY-MM-DD (local time)
const toApiDate = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtDisplayDate = (d) =>
  d instanceof Date && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Select date';

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
};

const fmtMinutes = (m) => {
  if (m == null || isNaN(Number(m))) return '—';
  const t = Math.round(Number(m));
  return `${Math.floor(t / 60)}h ${t % 60}m`;
};

const statusColor = (s) => {
  const u = String(s || '').toUpperCase();
  if (u === 'MOVING') return '#16a34a';
  if (u === 'PARKED') return '#d97706';
  return '#6366f1';
};

// ── One report row ───────────────────────────────────────────────
const ReportItem = React.memo(({ item }) => {
  const info = PACKET_INFO[item.packet_data_type] || {
    label: item.packet_data_type || 'Event', icon: 'information-outline', color: GREY,
  };
  const speed = item.speed ?? 0;
  const isOver = speed > (item.max_speed ?? Infinity) || (item.overspeed_count ?? 0) > 0;
  const outside = String(item.geofence_status || '').toUpperCase() === 'OUTSIDE';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.evIcon, { backgroundColor: info.color + '18' }]}>
          <Icon name={info.icon} size={18} color={info.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.evLabel}>{info.label}</Text>
          <Text style={styles.evTime}>{fmtDateTime(item.last_updated || item.timestamp)}</Text>
        </View>
        <View style={[styles.statePill, { backgroundColor: statusColor(item.state) + '22' }]}>
          <Text style={[styles.stateTxt, { color: statusColor(item.state) }]}>
            {String(item.state || '—').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.regRow}>
        <Icon name="truck" size={13} color={BLUE} />
        <Text style={styles.regTxt}>{item.registration_number || '—'}</Text>
      </View>

      <View style={styles.locRow}>
        <Icon name="map-marker-outline" size={13} color={GREY} />
        <Text style={styles.locTxt} numberOfLines={2}>{item.position_name || 'Location unavailable'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statVal, isOver && { color: RED }]}>{speed} km/h</Text>
          <Text style={styles.statLbl}>Speed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{item.max_speed ?? 0} km/h</Text>
          <Text style={styles.statLbl}>Max</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{item.avg_speed ?? 0} km/h</Text>
          <Text style={styles.statLbl}>Avg</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, (item.overspeed_count ?? 0) > 0 && { color: RED }]}>
            {item.overspeed_count ?? 0}
          </Text>
          <Text style={styles.statLbl}>Overspeed</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>
            {item.total_distance != null ? `${Number(item.total_distance).toFixed(1)} km` : '—'}
          </Text>
          <Text style={styles.statLbl}>Distance</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: '#16a34a' }]}>{fmtMinutes(item.run_time_minutes)}</Text>
          <Text style={styles.statLbl}>Run</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: ORANGE }]}>{fmtMinutes(item.idle_time_minutes)}</Text>
          <Text style={styles.statLbl}>Idle</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, (item.geofence_crossing_count ?? 0) > 0 && { color: ORANGE }]}>
            {item.geofence_crossing_count ?? 0}
          </Text>
          <Text style={styles.statLbl}>Geofence</Text>
        </View>
      </View>

      {!!item.geofence_status && (
        <View style={[styles.geoPill, { backgroundColor: (outside ? ORANGE : GREEN) + '18' }]}>
          <Icon name="map-marker-radius-outline" size={12} color={outside ? ORANGE : GREEN} />
          <Text style={[styles.geoTxt, { color: outside ? ORANGE : GREEN }]}>
            Geofence: {item.geofence_status}
          </Text>
        </View>
      )}
    </View>
  );
});

// ── Screen ───────────────────────────────────────────────────────
const VehicleReportsScreen = ({ navigation, route }) => {
  const vehicle = route?.params?.vehicle || null;
  const vehicleId = vehicle?.vehicleMongoId || vehicle?.apiId || vehicle?.id || '';

  const [dateFilter, setDateFilter] = useState('today');
  const [reportType, setReportType] = useState('all');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const reqId = useRef(0); // ignore stale responses when filters change quickly

  const isCustom = dateFilter === 'custom range';
  const customReady = !isCustom || (!!startDate && !!endDate);

  const loadReports = useCallback(async (page = 1, mode = 'replace') => {
    if (!customReady) {
      setRecords([]); setPagination(null); setError(null); setLoading(false); setRefreshing(false);
      return;
    }
    const myReq = ++reqId.current;
    try {
      if (mode === 'more') setLoadingMore(true);
      else if (mode === 'replace') setLoading(true);
      setError(null);

      const url = ENDPOINTS.REPORTS({
        dateFilter, reportType, vehicleId,
        startDate: isCustom ? toApiDate(startDate) : '',
        endDate:   isCustom ? toApiDate(endDate)   : '',
        page, limit: PAGE_SIZE,
      });
      const res = await apiGet(url);
      if (myReq !== reqId.current) return;

      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setRecords(prev => (mode === 'more' ? [...prev, ...list] : list));
      setPagination(res?.pagination || null);
    } catch (err) {
      if (myReq !== reqId.current) return;
      setError(err.message || 'Failed to load reports');
      if (mode !== 'more') setRecords([]);
    } finally {
      if (myReq === reqId.current) {
        setLoading(false); setLoadingMore(false); setRefreshing(false);
      }
    }
  }, [dateFilter, reportType, vehicleId, startDate, endDate, isCustom, customReady]);

  // reload from page 1 whenever a filter changes
  useEffect(() => { loadReports(1, 'replace'); }, [loadReports]);

  const onRefresh = () => { setRefreshing(true); loadReports(1, 'refresh'); };

  const onEndReached = () => {
    if (loading || loadingMore || !pagination?.hasNextPage) return;
    loadReports((pagination.currentPage || 1) + 1, 'more');
  };

  const onStartChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowStart(false);
    if (!d) return;
    setStartDate(d);
    if (endDate && endDate < d) setEndDate(d);
  };
  const onEndChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowEnd(false);
    if (!d) return;
    if (startDate && d < startDate) {
      Alert.alert('Invalid dates', 'End date cannot be before start date.');
      return;
    }
    setEndDate(d);
  };

  const emptyMessage = () => {
    if (isCustom && !customReady) return 'Select both a start date and an end date.';
    if (error) return error;
    return 'No records found for the selected filters.';
  };

  const renderHeader = () => (
    <View>
      {/* Date filter chips */}
      <Text style={styles.sectionLbl}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DATE_FILTERS.map(f => {
          const active = dateFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setDateFilter(f.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Custom range pickers */}
      {isCustom && (
        <View style={styles.customBox}>
          <View style={styles.customRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLbl}>Start Date *</Text>
              <TouchableOpacity style={styles.field} onPress={() => setShowStart(true)}>
                <Icon name="calendar" size={16} color={BLUE} />
                <Text style={[styles.fieldTxt, !startDate && { color: GREY }]}>{fmtDisplayDate(startDate)}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLbl}>End Date *</Text>
              <TouchableOpacity style={styles.field} onPress={() => setShowEnd(true)}>
                <Icon name="calendar" size={16} color={BLUE} />
                <Text style={[styles.fieldTxt, !endDate && { color: GREY }]}>{fmtDisplayDate(endDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showStart && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartChange}
            />
          )}
          {showEnd && (
            <DateTimePicker
              value={endDate || startDate || new Date()}
              mode="date"
              minimumDate={startDate || undefined}
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onEndChange}
            />
          )}
        </View>
      )}

      {/* Report type chips */}
      <Text style={styles.sectionLbl}>Report Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {REPORT_TYPES.map(t => {
          const active = reportType === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setReportType(t.value)}
              activeOpacity={0.7}
            >
              <Icon name={t.icon} size={14} color={active ? '#fff' : '#64748B'} />
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!!pagination && customReady && (
        <Text style={styles.countTxt}>
          {pagination.totalRecords} record{pagination.totalRecords === 1 ? '' : 's'} · showing {records.length}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.headerTitle}>Reports</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {vehicle?.name ? `${vehicle.name}${vehicle.company ? ' · ' + vehicle.company : ''}` : 'All vehicles'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={records}
        keyExtractor={(item, i) => item._id || String(i)}
        renderItem={({ item }) => <ReportItem item={item} />}
       ListHeaderComponent={renderHeader()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BLUE]} tintColor={BLUE} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={BLUE} />
              <Text style={styles.centerTxt}>Loading reports...</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Icon name={error ? 'alert-circle-outline' : 'file-search-outline'} size={56}
                color={error ? RED : '#CBD5E1'} />
              <Text style={[styles.centerTxt, error && { color: RED }]}>{emptyMessage()}</Text>
              {!!error && customReady && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => loadReports(1, 'replace')}>
                  <Text style={styles.retryTxt}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={BLUE} /> : <View style={{ height: 20 }} />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 38, paddingBottom: 14, paddingHorizontal: 14 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  listContent: { paddingHorizontal: 14, paddingBottom: 30 },
  sectionLbl: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTxtActive: { color: '#fff' },

  customBox: { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  customRow: { flexDirection: 'row' },
  fieldLbl: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
  },
  fieldTxt: { fontSize: 13, color: '#1E293B', fontWeight: '500' },

  countTxt: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 14, marginBottom: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  evIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  evLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  evTime: { fontSize: 11, color: '#64748B', marginTop: 1 },
  statePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stateTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  regRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  regTxt: { fontSize: 12, fontWeight: '700', color: BLUE },
  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8 },
  locTxt: { flex: 1, fontSize: 11.5, color: '#64748B', fontWeight: '500', lineHeight: 16 },
  statsRow: { flexDirection: 'row', marginTop: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  statLbl: { fontSize: 9.5, color: '#94A3B8', fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  geoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  geoTxt: { fontSize: 11, fontWeight: '700' },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  centerTxt: { marginTop: 12, fontSize: 14, color: '#64748B', textAlign: 'center', fontWeight: '500' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: BLUE, borderRadius: 10 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default VehicleReportsScreen;