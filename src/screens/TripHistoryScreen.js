import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ScrollView,
  Alert,
  Switch,
  Share,
  Linking,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiGet, ENDPOINTS } from '../utils/Api';

// ── Helper: config per delivery status
// 'early'   → arrived before ETA
// 'ontime'  → arrived within ±10 min of ETA
// 'delayed' → arrived late beyond threshold
const DELIVERY_STATUS_CONFIG = {
  early: {
    label: 'Early Arrival',
    icon: 'clock-fast',
    bg: '#F0FDF4',
    border: '#86EFAC',
    iconColor: '#16a34a',
    textColor: '#15803d',
    pillBg: '#dcfce7',
  },
  ontime: {
    label: 'On Time',
    icon: 'clock-check-outline',
    bg: '#EFF6FF',
    border: '#93C5FD',
    iconColor: '#3477eb',
    textColor: '#1d4ed8',
    pillBg: '#dbeafe',
  },
  delayed: {
    label: 'Delayed',
    icon: 'clock-alert-outline',
    bg: '#FFF7ED',
    border: '#FDB87A',
    iconColor: '#ea580c',
    textColor: '#c2410c',
    pillBg: '#ffedd5',
  },
};

const DATE_TABS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7',     label: 'Last 7 Days' },
  { key: 'custom',    label: 'Custom' },
];

// ══════════════════════════════════════════════════════════════
// DATE HELPERS
//   Today       → today 00:00:00      → today 23:59:59
//   Yesterday   → yesterday 00:00:00  → yesterday 23:59:59
//   Last 7 Days → (today - 6) 00:00:00 → today 23:59:59   (7 calendar days incl. today)
//   Custom      → picked from-date 00:00:00 → picked to-date 23:59:59
// ══════════════════════════════════════════════════════════════
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 0); return x; };
const addDays    = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const getRange = (tab, customStart, customEnd) => {
  const now = new Date();
  switch (tab) {
    case 'yesterday': { const y = addDays(now, -1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case 'last7':     return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
    case 'custom':    return { start: startOfDay(customStart), end: endOfDay(customEnd) };
    case 'today':
    default:          return { start: startOfDay(now), end: endOfDay(now) };
  }
};

// Sends the LOCAL date/time (not UTC), so "today 00:00" really means today's date
// on the server. (toISOString() converts to UTC → in India 00:00 IST becomes
// 18:30 of the PREVIOUS day, which made the API return the wrong day.)
// Output example: 2026-10-27T00:00:00
const pad2 = (n) => String(n).padStart(2, '0');
const toApiDate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
  `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

const fmtDay = (d) =>
  d instanceof Date && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const fmtTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// ══════════════════════════════════════════════════════════════
// API RESPONSE → VehicleCard shape
// (Web uses trip.route.name / trip.vehicle.registrationNumber / trip.driver.name;
//  the mobile /api/trip uses route_id / vehicle_id / driver_id — both are handled.)
// ══════════════════════════════════════════════════════════════
const unwrapArray = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const keys = ['data', 'trips', 'history', 'result', 'results', 'items', 'records', 'list'];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      for (const ik of keys) if (Array.isArray(v[ik])) return v[ik];
    }
  }
  return [];
};

const placeName = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.name || v.label || v.address || v.place_name || '';
  return '';
};

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const withUnit = (v, unit) => {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v)) ? `${v} ${unit}` : String(v);
};

const mapDeliveryStatus = (raw) => {
  const s = String(raw || '').toUpperCase();
  if (s === 'DELAYED' || s === 'LATE') return 'delayed';
  if (s === 'EARLY') return 'early';
  return 'ontime'; // INTIME / ONTIME / unknown
};

const CARD_COLORS = { early: '#16a34a', ontime: '#3477eb', delayed: '#ea580c' };

const mapTrip = (t, idx) => {
  const veh   = t?.vehicle  || t?.vehicle_id || {};
  const drv   = t?.driver   || t?.driver_id  || {};
  const route = t?.route    || t?.route_id   || {};

  const deliveryStatus = mapDeliveryStatus(t?.trip_arrival_status ?? t?.arrival_status ?? t?.deliveryStatus);

  const expectedRaw = t?.trip_expected_arrival_time ?? t?.expected_arrival_time ?? t?.trip_arrival_time ?? route?.expected_arrival_time;
  const actualRaw   = t?.trip_actual_arrival_time   ?? t?.actual_arrival_time;

  let delayMinutes = num(t?.delay_minutes ?? t?.delayMinutes, NaN);
  if (!Number.isFinite(delayMinutes)) {
    const e = expectedRaw ? new Date(expectedRaw).getTime() : NaN;
    const a = actualRaw   ? new Date(actualRaw).getTime()   : NaN;
    delayMinutes = Number.isFinite(e) && Number.isFinite(a) ? Math.round((a - e) / 60000) : 0;
  }

  const routeName = route?.name || t?.route_name || '';

  return {
    id: t?._id || t?.trip_id || String(idx),
    raw: t,

    // card header
    name:    veh?.registrationNumber || veh?.registration_number || t?.vehicle_number || 'No vehicle',
    company: [veh?.make, veh?.model].filter(Boolean).join(' ') || routeName || '—',
    status:  'Completed',
    cardColor: CARD_COLORS[deliveryStatus],

    // driver
    driver:      drv?.name || drv?.employee_id?.name || t?.driver_name || 'Unknown Driver',
    driverPhone: drv?.mobile_number || drv?.employee_id?.mobile_number || drv?.phone || '',

    // delivery banner
    deliveryStatus,
    delayMinutes,
    expectedArrival: fmtTime(expectedRaw),
    actualArrival:   fmtTime(actualRaw),

    // speed stats
    currentSpeed:   num(t?.current_speed ?? t?.currentSpeed),
    maxSpeed:       num(t?.max_speed ?? t?.maxSpeed),
    avgSpeed:       num(t?.avg_speed ?? t?.avgSpeed),
    overspeedLimit: num(t?.overspeed_limit ?? t?.overspeedLimit, 80),
    overspeedCount: num(t?.overspeed_count ?? t?.overspeedCount),
    geofenceCount:  num(t?.geofence_count ?? t?.geofenceCount),

    // secondary stats
    distance:  withUnit(t?.distance ?? t?.total_distance ?? route?.distance, 'km'),
    duration:  t?.duration ?? t?.trip_duration ?? route?.duration ?? '—',
    fuelUsed:  withUnit(t?.fuel_used ?? t?.fuelUsed, 'L'),
    startTime: fmtTime(t?.trip_actual_departure_time ?? t?.actual_departure_time ?? t?.trip_departure_time ?? t?.from_datetime),

    // route
    source:      { label: placeName(route?.place_from ?? route?.source_name ?? (Array.isArray(route?.source) ? null : route?.source) ?? t?.source) || 'Origin' },
    destination: { label: placeName(route?.place_to ?? route?.destination_name ?? (Array.isArray(route?.destination) ? null : route?.destination) ?? t?.destination) || 'Destination' },
    description: routeName || '—',
    location:    routeName || '—',
  };
};

// ══════════════════════════════════════════════════════════════
// DELIVERY TIME STATUS BANNER — placed inside the card
// ══════════════════════════════════════════════════════════════
const DeliveryTimeBanner = ({ vehicle }) => {
  const cfg = DELIVERY_STATUS_CONFIG[vehicle.deliveryStatus] ?? DELIVERY_STATUS_CONFIG.ontime;
  const delayAbs = Math.abs(vehicle.delayMinutes ?? 0);
  const delayLabel =
    vehicle.deliveryStatus === 'delayed' ? `+${delayAbs} min late` :
    vehicle.deliveryStatus === 'early'   ? `${delayAbs} min early` :
    'Arrived as scheduled';

  return (
    <View style={[deliveryStyles.banner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {/* Left: icon + status label */}
      <View style={deliveryStyles.bannerLeft}>
        <View style={[deliveryStyles.iconCircle, { backgroundColor: cfg.pillBg }]}>
          <Icon name={cfg.icon} size={15} color={cfg.iconColor} />
        </View>
        <View>
          <Text style={[deliveryStyles.statusLabel, { color: cfg.textColor }]}>{cfg.label}</Text>
          <Text style={deliveryStyles.delayNote}>{delayLabel}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={deliveryStyles.bannerDivider} />

      {/* Middle: Expected arrival */}
      <View style={deliveryStyles.timeBlock}>
        <Text style={deliveryStyles.timeBlockLabel}>Expected</Text>
        <View style={deliveryStyles.timeRow}>
          <Icon name="clock-outline" size={11} color="#94a3b8" />
          <Text style={deliveryStyles.timeBlockVal}>{vehicle.expectedArrival}</Text>
        </View>
      </View>

      {/* Arrow */}
      <Icon name="arrow-right" size={14} color="#cbd5e1" style={{ marginHorizontal: 2 }} />

      {/* Right: Actual arrival */}
      <View style={deliveryStyles.timeBlock}>
        <Text style={deliveryStyles.timeBlockLabel}>Actual</Text>
        <View style={deliveryStyles.timeRow}>
          <Icon name="clock-check-outline" size={11} color={cfg.iconColor} />
          <Text style={[deliveryStyles.timeBlockVal, { color: cfg.textColor, fontWeight: '800' }]}>
            {vehicle.actualArrival}
          </Text>
        </View>
      </View>
    </View>
  );
};

const deliveryStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statusLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  delayNote:   { fontSize: 9,  color: '#94a3b8', fontWeight: '500', marginTop: 1 },
  bannerDivider: { width: 1, height: 30, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
  timeBlock:   { alignItems: 'center', gap: 2 },
  timeBlockLabel: { fontSize: 8, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeBlockVal:   { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});

// ══════════════════════════════════════════════════════════════
// THREE-DOT MENU
// ══════════════════════════════════════════════════════════════
const ThreeDotMenu = ({ vehicle, navigation }) => {
  const [visible, setVisible] = useState(false);

  const menuItems = [
    {
      icon: 'shield-account-outline',
      label: 'KYC',
      color: '#6366f1',
      onPress: () => { setVisible(false); navigation?.navigate('VehicleKYC', { vehicle }); },
    },
    {
      icon: 'pencil-outline',
      label: 'Edit Vehicle',
      color: '#3477eb',
      onPress: () => { setVisible(false); Alert.alert('Edit Vehicle', 'Coming soon!'); },
    },
    {
      icon: 'bell-outline',
      label: 'Alerts',
      color: '#f59e0b',
      onPress: () => { setVisible(false); Alert.alert('Alerts', 'No active alerts.'); },
    },
    {
      icon: 'trash-can-outline',
      label: 'Remove',
      color: '#ef4444',
      onPress: () => {
        setVisible(false);
        Alert.alert('Remove Vehicle', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => {} },
        ]);
      },
    },
  ];

  return (
    <>
      <TouchableOpacity
        style={styles.threeDotBtn}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.7}
      >
        <Icon name="dots-vertical" size={18} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <Icon name="truck" size={19} color={vehicle.cardColor} />
              <Text style={[styles.menuVehicleName, { color: vehicle.cardColor }]}>{vehicle.name}</Text>
            </View>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, i === menuItems.length - 1 && styles.menuItemLast]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: item.color + '18' }]}>
                  <Icon name={item.icon} size={16} color={item.color} />
                </View>
                <Text style={[styles.menuItemLabel, { color: item.color === '#ef4444' ? '#ef4444' : '#1e293b' }]}>
                  {item.label}
                </Text>
                <Icon name="chevron-right" size={14} color="#cbd5e1" />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ══════════════════════════════════════════════════════════════
// VEHICLE CARD
// ══════════════════════════════════════════════════════════════
const VehicleCard = ({ vehicle, navigation }) => {
  const [ignitionOn, setIgnitionOn] = useState(vehicle.status === 'Moving');
  const isOverspeed = vehicle.maxSpeed > vehicle.overspeedLimit;

  const statusPillBg =
    vehicle.status === 'Moving'    ? 'rgba(22,163,74,0.85)' :
    vehicle.status === 'Parked'    ? 'rgba(217,119,6,0.85)' :
    vehicle.status === 'Completed' ? 'rgba(99,102,241,0.85)' :
                                     'rgba(99,102,241,0.85)';

  const handleWhatsApp = useCallback(() => {
    const phone = (vehicle.driverPhone || '').replace(/\D/g, '');
    if (!phone) { Alert.alert('No phone number', 'Driver phone number is not available.'); return; }
    Linking.openURL(`whatsapp://send?phone=91${phone}`).catch(() => Alert.alert('WhatsApp not installed'));
  }, [vehicle.driverPhone]);

  const handleCall = useCallback(() => {
    if (!vehicle.driverPhone) { Alert.alert('No phone number', 'Driver phone number is not available.'); return; }
    Linking.openURL(`tel:${vehicle.driverPhone}`).catch(() => Alert.alert('Error', 'Unable to make a call.'));
  }, [vehicle.driverPhone]);

  return (
    <View style={styles.card}>
      {/* ── Gradient Band ── */}
      <LinearGradient
        colors={[vehicle.cardColor, vehicle.cardColor + 'cc']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.cardBand}
      >
        <View style={styles.bandLeft}>
          <View style={styles.truckIconWrap}>
            <Icon name="truck" size={19} color={vehicle.cardColor} />
          </View>
          <View>
            <Text style={styles.bandRegNo}>{vehicle.name}</Text>
            <Text style={styles.bandModel}>{vehicle.company}</Text>
          </View>
        </View>

        <View style={styles.bandRight}>
          <View style={styles.statusAndMenu}>
            <View style={[styles.statusPill, { backgroundColor: statusPillBg }]}>
              <View style={styles.statusPillDot} />
              <Text style={styles.statusPillTxt}>{vehicle.status}</Text>
            </View>
            <ThreeDotMenu vehicle={vehicle} navigation={navigation} />
          </View>

          <View style={styles.ignitionWrap}>
            <Switch
              value={ignitionOn}
              onValueChange={() => setIgnitionOn(v => !v)}
              trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#bbf7d0' }}
              thumbColor={ignitionOn ? '#16a34a' : 'rgba(255,255,255,0.7)'}
              ios_backgroundColor="rgba(255,255,255,0.25)"
              style={styles.ignSwitch}
            />
            <Text style={styles.ignLabel}>Ignition</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Card Body ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation?.navigate('VehicleDetail', { vehicle })}
        style={styles.cardBody}
      >
        {/* Driver Row */}
        <View style={styles.driverRow}>
          <View style={[styles.driverIconWrap, { backgroundColor: '#eff6ff' }]}>
            <Icon name="account-tie" size={16} color="#3477eb" />
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{vehicle.driver}</Text>
          </View>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}
            onPress={handleWhatsApp} activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="whatsapp" size={15} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', marginLeft: 5 }]}
            onPress={handleCall} activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="phone" size={15} color="#3477eb" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── DELIVERY TIME STATUS BANNER ── */}
        <DeliveryTimeBanner vehicle={vehicle} />

        {/* Speed / Overspeed / Geofence Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="speedometer" size={13} color={vehicle.cardColor} />
            <Text style={styles.statVal}>{vehicle.currentSpeed} km/h</Text>
            <Text style={styles.statLbl}>Current</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="speedometer-medium" size={13} color={isOverspeed ? '#ef4444' : vehicle.cardColor} />
            <View style={styles.maxSpeedRow}>
              <Text style={[styles.statVal, isOverspeed && { color: '#ef4444' }]}>{vehicle.maxSpeed} km/h</Text>
              {isOverspeed && <View style={styles.overspeedBadge}><Icon name="alert" size={7} color="#fff" /></View>}
            </View>
            <Text style={[styles.statLbl, isOverspeed && { color: '#ef4444' }]}>Max Speed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="gauge" size={13} color={vehicle.cardColor} />
            <Text style={styles.statVal}>{vehicle.avgSpeed} km/h</Text>
            <Text style={styles.statLbl}>Avg Speed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="car-speed-limiter" size={14}
              color={isOverspeed && vehicle.overspeedCount > 0 ? '#ef4444' : '#94a3b8'} />
            <View style={styles.countBadgeRow}>
              <Text style={[styles.statVal,
                { color: isOverspeed && vehicle.overspeedCount > 0 ? '#ef4444' : '#94a3b8' }]}>
                {vehicle.overspeedCount}
              </Text>
              {isOverspeed && vehicle.overspeedCount > 0 && <View style={styles.redDotBadge} />}
            </View>
            <Text style={[styles.statLbl, { color: isOverspeed && vehicle.overspeedCount > 0 ? '#ef4444' : '#94a3b8' }]}>
              Overspeed
            </Text>
            {isOverspeed && vehicle.overspeedCount > 0 && (
              <View style={styles.overLimitPill}>
                <Text style={styles.overLimitTxt}>{'>'}{vehicle.overspeedLimit}</Text>
              </View>
            )}
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="map-marker-radius-outline" size={14}
              color={vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8'} />
            <View style={styles.countBadgeRow}>
              <Text style={[styles.statVal, { color: vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8' }]}>
                {vehicle.geofenceCount}
              </Text>
              {vehicle.geofenceCount > 0 && <View style={styles.amberDotBadge} />}
            </View>
            <Text style={[styles.statLbl, { color: vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8' }]}>Geofence</Text>
            {vehicle.geofenceCount > 0 && (
              <View style={styles.geofencePill}><Text style={styles.geofencePillTxt}>Alert</Text></View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Secondary stats: distance / duration / fuel / date */}
        <View style={styles.statsRowSecondary}>
          <View style={styles.secStatItem}>
            <Icon name="map-marker-distance" size={12} color={vehicle.cardColor} />
            <Text style={styles.secStatVal}>{vehicle.distance}</Text>
            <Text style={styles.secStatLbl}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.secStatItem}>
            <Icon name="timer-outline" size={12} color="#6366f1" />
            <Text style={[styles.secStatVal, { color: '#6366f1' }]}>{vehicle.duration}</Text>
            <Text style={styles.secStatLbl}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.secStatItem}>
            <Icon name="gas-station-outline" size={12} color="#FF9800" />
            <Text style={[styles.secStatVal, { color: '#FF9800' }]}>{vehicle.fuelUsed}</Text>
            <Text style={styles.secStatLbl}>Fuel Used</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.secStatItem}>
            <Icon name="clock-outline" size={12} color="#64748B" />
            <Text style={[styles.secStatVal, { color: '#64748B' }]}>{vehicle.startTime}</Text>
            <Text style={styles.secStatLbl}>Start Time</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Source → Destination */}
        <View style={styles.srcDestRow}>
          <View style={styles.srcDestPoint}>
            <View style={[styles.srcDestDot, { backgroundColor: '#16a34a' }]} />
            <Text style={styles.srcDestLabel} numberOfLines={1}>{vehicle.source?.label ?? 'Origin'}</Text>
          </View>
          <View style={styles.srcDestLine}>
            <View style={styles.srcDestDash} />
            <Icon name="truck-fast-outline" size={13} color={vehicle.cardColor} />
            <View style={styles.srcDestDash} />
          </View>
          <View style={styles.srcDestPoint}>
            <View style={[styles.srcDestDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.srcDestLabel} numberOfLines={1}>{vehicle.destination?.label ?? 'Destination'}</Text>
          </View>
        </View>

        {/* Description / location */}
        <View style={styles.locationRow}>
          <Icon name="map-marker-outline" size={12} color="#94a3b8" />
          <Text style={styles.locationTxt} numberOfLines={3}>{vehicle.description}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Action Buttons ── */}
      <View style={styles.actionsRow}>
        {[
          { icon: 'play-circle-outline',  label: 'Re-Play',       onPress: () => navigation?.navigate('PlayRoute', { vehicle }) },
          { icon: 'map-clock-outline',    label: 'Route History', onPress: () => navigation?.navigate('VehicleDetail', { vehicle }) },
          { icon: 'share-variant-outline',label: 'Share',         onPress: async () => {
              try { await Share.share({ message: `🚗 ${vehicle.name} · ${vehicle.status}\n📍 ${vehicle.location}\nDriver: ${vehicle.driver}`, title: vehicle.name }); } catch (_) {}
            },
          },
          { icon: 'file-chart-outline',   label: 'Reports',       onPress: () => navigation?.navigate('Reports', { vehicle }) },
        ].map((btn, i, arr) => (
          <React.Fragment key={btn.label}>
            <TouchableOpacity style={styles.actionBtn} onPress={btn.onPress} activeOpacity={0.7}>
              <Icon name={btn.icon} size={17} color={vehicle.cardColor} />
              <Text style={[styles.actionLbl, { color: vehicle.cardColor }]}>{btn.label}</Text>
            </TouchableOpacity>
            {i < arr.length - 1 && <View style={styles.actionSep} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════
// LOAD TRIP HISTORY
//  1) try each candidate history URL (remembers the one that worked)
//     startDate / endDate are built from the selected tab (Today / Yesterday / Last 7 / Custom)
//  2) if none works, use the existing /api/trip list and filter by date here
// ══════════════════════════════════════════════════════════════
let workingHistoryIdx = null;

const tripDateOf = (t) =>
  t?.trip_actual_arrival_time || t?.trip_actual_departure_time || t?.trip_departure_time ||
  t?.from_datetime || t?.updatedAt || t?.createdAt;

const isCompletedTrip = (t) =>
  !!t?.trip_actual_arrival_time ||
  (!!t?.trip_arrival_status && String(t.trip_arrival_status).toUpperCase() !== 'AWAITED');

// Reads every page of one candidate URL (server default limit is 10)
const fetchAllPages = async (build, s, e) => {
  const limit = 100;
  let page = 1;
  let totalPages = 1;
  let all = [];
  do {
    const res = await apiGet(build(s, e, page, limit));
    all = all.concat(unwrapArray(res));
    totalPages = Number(res?.totalPages) || 1;
    page += 1;
  } while (page <= totalPages && page <= 20);
  return all;
};

const loadTripHistory = async (start, end) => {
  // Local date-time strings, e.g. 2026-10-27T00:00:00 → 2026-10-27T23:59:59
  const s = toApiDate(start);
  const e = toApiDate(end);
  console.log('📅 Trip history range:', s, '→', e);

  const builders = ENDPOINTS.TRIP_HISTORY_CANDIDATES || [];
  const order = workingHistoryIdx !== null
    ? [workingHistoryIdx, ...builders.map((_, i) => i).filter(i => i !== workingHistoryIdx)]
    : builders.map((_, i) => i);

  let lastErr = null;
  for (const i of order) {
    try {
      console.log('🧾 Trip history try:', builders[i](s, e, 1, 100));
      const list = await fetchAllPages(builders[i], s, e);
      workingHistoryIdx = i;
      if (list[0]) console.log('🧾 sample trip:', JSON.stringify(list[0]).slice(0, 800));
      return list;
    } catch (err) {
      lastErr = err;
      console.log('↪️ history candidate failed:', err.message);
    }
  }

  // ── Fallback: existing trips list + local date filter ──
  console.log('↪️ using /api/trip fallback');
  try {
    const res  = await apiGet(ENDPOINTS.TRIPS_VIEW(1, 500));
    const all  = unwrapArray(res);
    const anyCompletionField = all.some(t => t?.trip_actual_arrival_time || t?.trip_arrival_status);
    return all.filter((t) => {
      if (anyCompletionField && !isCompletedTrip(t)) return false;
      const d = new Date(tripDateOf(t));
      return !isNaN(d.getTime()) && d >= start && d <= end;
    });
  } catch (err) {
    throw lastErr || err;
  }
};

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════
const TripHistoryScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('today');

  // ── Custom range: what the user is editing vs. what was applied (like web "Apply") ──
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd]     = useState(new Date());
  const [appliedCustom, setAppliedCustom] = useState({ start: new Date(), end: new Date() });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);

  // ── Data ──
  const [trips, setTrips]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const requestId = useRef(0); // ignore stale responses when the user switches tabs quickly

  // ─── GET trip history — dates are recalculated from the active tab every call ───
  const fetchTrips = useCallback(async (isRefresh = false) => {
    const myId = ++requestId.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const { start, end } = getRange(activeTab, appliedCustom.start, appliedCustom.end);
      const list = await loadTripHistory(start, end);
      if (myId !== requestId.current) return;
      setTrips(list.map(mapTrip));
    } catch (e) {
      if (myId !== requestId.current) return;
      setTrips([]);
      setError(e.message || 'Failed to fetch trip history');
    } finally {
      if (myId === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeTab, appliedCustom]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  // ─── Custom range handlers ─────────────────────────────────────────────────
  const onStartChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowStartPicker(false);
    if (!d) return;
    setCustomStart(d);
    if (d > customEnd) setCustomEnd(d); // keep end >= start
  };
  const onEndChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowEndPicker(false);
    if (!d) return;
    setCustomEnd(d);
  };
  const applyCustomDate = () => {
    setShowStartPicker(false);
    setShowEndPicker(false);
    if (customEnd < customStart) {
      Alert.alert('Invalid dates', 'To date cannot be before From date.');
      return;
    }
    setAppliedCustom({ start: customStart, end: customEnd });
  };

  // ─── Search (client-side, same idea as web: route / vehicle / driver) ──────
  const q = searchQuery.trim().toLowerCase();
  const filteredTrips = q
    ? trips.filter(t =>
        [t.name, t.driver, t.company, t.description].some(f => (f || '').toLowerCase().includes(q))
      )
    : trips;

  const range = getRange(activeTab, appliedCustom.start, appliedCustom.end);

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#2563eb']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by route, vehicle, driver..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Date Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {DATE_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                {isActive && <Icon name="check-circle" size={14} color="#FFFFFF" />}
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Custom date range */}
      {activeTab === 'custom' && (
        <View style={styles.customBox}>
          <View style={styles.customRow}>
            <TouchableOpacity style={styles.customDateBtn} onPress={() => setShowStartPicker(true)} activeOpacity={0.7}>
              <Icon name="calendar" size={16} color="#3477eb" />
              <Text style={styles.customDateTxt}>{fmtDay(customStart)}</Text>
            </TouchableOpacity>
            <Text style={styles.customTo}>to</Text>
            <TouchableOpacity style={styles.customDateBtn} onPress={() => setShowEndPicker(true)} activeOpacity={0.7}>
              <Icon name="calendar" size={16} color="#3477eb" />
              <Text style={styles.customDateTxt}>{fmtDay(customEnd)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={applyCustomDate} activeOpacity={0.8}>
              <Text style={styles.applyBtnTxt}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onStartChange}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          minimumDate={customStart}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onEndChange}
        />
      )}

      {/* Cards */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchTrips(true)} colors={['#3477eb']} tintColor="#3477eb" />
        }
      >
        <View style={styles.listWrapper}>

          {/* Error */}
          {!!error && !loading && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color="#F44336" />
              <Text style={styles.errorTxt} numberOfLines={4}>{error}</Text>
              <TouchableOpacity onPress={() => fetchTrips()} style={styles.retryBtn}>
                <Text style={styles.retryTxt}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#3477eb" />
              <Text style={styles.loadingTxt}>Loading trips…</Text>
            </View>
          ) : filteredTrips.length > 0 ? (
            <>
              <Text style={styles.resultCount}>
                {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'} found
                {'  ·  '}{fmtDay(range.start)}{activeTab === 'today' || activeTab === 'yesterday' ? '' : ` – ${fmtDay(range.end)}`}
              </Text>
              {filteredTrips.map((trip, idx) => (
                <VehicleCard key={trip.id ?? idx} vehicle={trip} navigation={navigation} />
              ))}
            </>
          ) : !error ? (
            <View style={styles.emptyState}>
              <Icon name="routes-clock" size={80} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No matching trips' : 'No trips found'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery ? 'Try a different search term' : 'Completed trips will appear here'}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  backButton:  { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },

  searchWrapper: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 2,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B' },

  tabsWrapper: { paddingTop: 14, paddingBottom: 6 },
  tabsScroll:  { paddingHorizontal: 16, gap: 10 },
  tabButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#3477eb', borderColor: '#3477eb',
    shadowColor: '#3477eb', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  tabText:       { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#FFFFFF' },

  // ── Custom range ──
  customBox: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 4,
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  customRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customDateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 8, paddingVertical: 9,
  },
  customDateTxt: { fontSize: 12, color: '#1E293B', fontWeight: '600' },
  customTo:      { fontSize: 12, color: '#64748B', fontWeight: '700' },
  applyBtn:      { backgroundColor: '#3477eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  applyBtnTxt:   { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // ── Loading / error ──
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  loadingTxt: { fontSize: 14, color: '#64748B' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12,
  },
  errorTxt:  { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },
  retryBtn:  { backgroundColor: '#F44336', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  retryTxt:  { fontSize: 12, color: '#FFF', fontWeight: '600' },

  scrollContent: { flex: 1, paddingHorizontal: 14 },
  scrollContentContainer: { paddingTop: 12, paddingBottom: 24 },
  listWrapper: { gap: 12 },
  resultCount: { fontSize: 13, color: '#64748B', fontWeight: '500', paddingHorizontal: 4 },

  emptyState:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyStateText:    { fontSize: 18, fontWeight: '600', color: '#64748B', marginTop: 8 },
  emptyStateSubtext: { fontSize: 14, color: '#94A3B8', marginTop: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardBand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  bandLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bandRight: { alignItems: 'flex-end', gap: 4 },
  truckIconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center',
  },
  bandRegNo: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  bandModel: { fontSize: 10, color: 'rgba(255,255,255,0.78)', fontWeight: '500', marginTop: 1 },
  statusAndMenu:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  statusPillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.85)' },
  statusPillTxt: { fontSize: 10, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
  threeDotBtn: {
    width: 26, height: 26, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 16, width: '80%', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  menuVehicleName: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  menuItemLast:  { borderBottomWidth: 0 },
  menuItemIcon:  { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  menuItemLabel: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  ignitionWrap:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ignSwitch:     { transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] },
  ignLabel:      { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: 'rgba(255,255,255,0.75)' },
  cardBody:       { paddingTop: 10, paddingHorizontal: 12 },
  driverRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  driverIconWrap: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  driverInfo:     { flex: 1 },
  driverName:     { fontSize: 12, color: '#1e293b', fontWeight: '700' },
  contactBtn:     { width: 29, height: 29, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  divider:        { height: 1, backgroundColor: '#F1F5F9', marginBottom: 10 },

  statsRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: '#F1F5F9', alignSelf: 'center' },
  statVal:     { fontSize: 10, fontWeight: '800', color: '#0f172a' },
  statLbl:     { fontSize: 7.5, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  maxSpeedRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  overspeedBadge: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  countBadgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  redDotBadge:    { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#ef4444' },
  amberDotBadge:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#f59e0b' },
  overLimitPill:  { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 7, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1 },
  overLimitTxt:   { fontSize: 6.5, color: '#ef4444', fontWeight: '800' },
  geofencePill:    { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 7, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1 },
  geofencePillTxt: { fontSize: 6.5, color: '#f59e0b', fontWeight: '800' },

  statsRowSecondary: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  secStatItem: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 },
  secStatVal:  { fontSize: 10, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  secStatLbl:  { fontSize: 7.5, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  srcDestRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  srcDestPoint: { flex: 1, alignItems: 'center', gap: 4 },
  srcDestDot:   { width: 8, height: 8, borderRadius: 4 },
  srcDestLabel: { fontSize: 10, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  srcDestLine:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  srcDestDash:  { flex: 1, height: 1, backgroundColor: '#cbd5e1' },

  locationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    backgroundColor: '#F8FAFC', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 6, marginBottom: 10,
  },
  locationTxt: { flex: 1, fontSize: 10.5, color: '#64748B', fontWeight: '500', lineHeight: 15 },

  actionsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 3 },
  actionSep:  { width: 1, backgroundColor: '#F1F5F9', marginVertical: 7 },
  actionLbl:  { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
});

export default TripHistoryScreen;