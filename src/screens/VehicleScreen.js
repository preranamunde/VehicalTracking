import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  StatusBar, Platform, TextInput, ActivityIndicator, Alert, RefreshControl,
  Switch, Share, Linking, Modal, KeyboardAvoidingView, Animated, Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Sound from 'react-native-sound';
import { useFocusEffect } from '@react-navigation/native';
import { apiGet, apiPut, ENDPOINTS } from '../utils/Api';

const OVERSPEED_LIMIT = 80;

// ✅ Same URL as the working RoutePlayDetailScreen / web app
const WS_URL = 'wss://vlts.nutanteksolutions.cloud/ws';
const CARD_COLORS = ['#3477eb', '#7c3aed', '#0891b2', '#059669', '#dc2626'];

// ⚠️ Must match the name your AssignmentScreen is registered with in the navigator
const ASSIGNMENT_ROUTE = 'Assignments';

const BLUE   = '#3477eb';
const ORANGE = '#F59E0B';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const GREY   = '#94A3B8';

// Status value sent in the release body (same as AssignmentScreen / Postman)
const RELEASE_STATUS_VALUE = 'ACTIVE';

const normStatus = (state) => {
  if (!state) return 'Idle';
  const u = String(state).toUpperCase();
  if (u === 'MOVING') return 'Moving';
  if (u === 'PARKED') return 'Parked';
  return 'Idle';
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
};

const fmtDateObj = (d) =>
  d instanceof Date && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

// "2026/10/05" (same format as the release body in AssignmentScreen)
const formatSlashDate = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
};

const toDateSafe = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const unwrapApiArray = (raw) => {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (!raw || typeof raw !== 'object') return [];
  // 'assignments' added — API returns { success, count, assignments: [...] }
  for (const key of ['assignments', 'data', 'vehicles', 'result', 'results', 'items', 'records', 'list']) {
    if (Array.isArray(raw[key])) return raw[key];
    if (raw[key] && Array.isArray(raw[key]?.data)) return raw[key].data;
  }
  const firstArr = Object.values(raw).find(v => Array.isArray(v));
  if (firstArr) return firstArr;
  if (raw._id || raw.id || raw.vehicleId) return [raw];
  return [];
};

// Generic list unwrapper (drivers / assignments) – same as AssignmentScreen
const unwrapArray = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const keys = ['drivers', 'vehicles', 'assignments', 'data', 'result', 'results', 'items', 'records', 'list'];
  for (const key of keys) {
    const val = raw[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') {
      for (const innerKey of keys) {
        if (Array.isArray(val[innerKey])) return val[innerKey];
      }
    }
  }
  return [];
};

// API returns flat camelCase fields (driverName / driverMobile).
const getDriverName  = (d) =>
  d?.driverName || d?.employee_id?.name || d?.driver_name || d?.name || '';
const getDriverPhone = (d) =>
  d?.driverMobile || d?.employee_id?.mobile_number || d?.mobile_number || d?.phone || '';

// First finite number found among several possible field names
const pickNum = (d, keys) => {
  for (const k of keys) {
    const val = k.split('.').reduce((o, part) => (o == null ? o : o[part]), d);
    if (val != null && val !== '') {
      const n = parseFloat(val);
      if (!isNaN(n)) return n;
    }
  }
  return null;
};

// ✅ Fields sent by the websocket-gateway (updated payload):
//    speed, state, total_distance, max_speed, avg_speed, position_name,
//    overspeed_count, geofence_crossing_count, geofence_status (string),
//    run_time_minutes, idle_time_minutes, last_updated,
//    packet_data_type, main_power_status, emergency_status, tamper_alert
const SPEED_KEYS    = ['speed', 'current_speed', 'currentSpeed', 'speed_kmph', 'speed_kmh',
                       'speedKmph', 'velocity', 'gps_speed', 'gps.speed', 'properties.speed'];
const MAX_KEYS      = ['max_speed', 'maxSpeed'];
const AVG_KEYS      = ['avg_speed', 'avgSpeed', 'average_speed'];
const DIST_KEYS     = ['total_distance', 'totalDistance', 'distance', 'odometer'];
const OVERSPEED_KEYS = ['overspeed_count', 'overspeedCount'];
const GEOFENCE_KEYS  = ['geofence_crossing_count', 'geofenceCrossingCount'];
const RUNTIME_KEYS   = ['run_time_minutes', 'runTimeMinutes'];
const IDLETIME_KEYS  = ['idle_time_minutes', 'idleTimeMinutes'];

// minutes (number) -> "Xh Ym"
const fmtMinutes = (m) => {
  if (m == null) return null;
  const t = Math.round(m);
  return `${Math.floor(t / 60)}h ${t % 60}m`;
};

// "24102026" + "201545" (ddmmyyyy + hhmmss) -> "24 Oct 2026, 20:15:45"
const fmtPacketDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr || String(dateStr).length !== 8 || String(timeStr).length !== 6) return null;
  const ds = String(dateStr), ts = String(timeStr);
  const dt = new Date(
    Number(ds.slice(4, 8)), Number(ds.slice(2, 4)) - 1, Number(ds.slice(0, 2)),
    Number(ts.slice(0, 2)), Number(ts.slice(2, 4)), Number(ts.slice(4, 6))
  );
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
};

const getCoords = (d) => {
  const c = d.coordinates ?? d.location?.coordinates ??
    (d.lng !== undefined && d.lat !== undefined ? [d.lng, d.lat]
      : (d.longitude !== undefined && d.latitude !== undefined ? [d.longitude, d.latitude] : null));
  if (!Array.isArray(c) || c.length < 2) return null;
  const lon = parseFloat(c[0]), lat = parseFloat(c[1]);
  return isNaN(lat) || isNaN(lon) ? null : { lat, lon };
};

const haversineKm = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Normalise IDs so "MH-12 AB 1234", "mh12ab1234" and ObjectIds all compare equal
const normId = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');

// Every ID the server might use to identify a vehicle
// ✅ tripId added — web app also matches WS messages by trip_id
const getIds = (v) =>
  [v.apiId, v.id, v.deviceId, v.gpsDeviceId, v.imei, v.registrationNumber, v.name, v.tripId]
    .filter(Boolean).map(normId);

// ── Device status helpers ─────────────────────────────────────────────────────
// Clean a status string from the device: trims spaces ('Disconnected ' -> 'disconnected')
const cleanStr = (v) => (v == null ? null : String(v).trim().toLowerCase());

// Latest event shown on the card, decided by packet_data_type
//   (IN / IF = Ignition On/Off are NOT shown here - ignition is only the top-corner toggle)
//   BD = Battery Disconnected   BR = Battery Reconnected
//   TA = Tamper Alert     EA = Emergency Alert
const getEventInfo = (type, d) => {
  switch (type) {
    case 'BD': return { label: 'Battery Disconnected', icon: 'battery-off',  color: RED };
    case 'BR': return { label: 'Battery Reconnected',  icon: 'car-battery',  color: GREEN };
    case 'TA': {
      const open = cleanStr(d.tamper_alert) === 'opened';
      return open
        ? { label: 'Tamper Alert - Cover Opened', icon: 'shield-alert', color: RED }
        : { label: 'Tamper - Cover Closed',       icon: 'shield-check', color: GREEN };
    }
    case 'EA': {
      const on = cleanStr(d.emergency_status) === 'on';
      return on
        ? { label: 'Emergency Alert - ON', icon: 'alarm-light',         color: RED }
        : { label: 'Emergency - OFF',      icon: 'alarm-light-outline', color: GREEN };
    }
    default: return null;
  }
};

// ── WebSocket alert types (used by the alert popup) ───────────────────────────
//   sound = which alarm file to ring (null = popup only, no sound)
const ALERT_TYPES = {
  emergency: { label: 'Emergency Alert',         icon: 'alarm-light',  color: RED,    sound: 'emergency' },
  tamper:    { label: 'Tamper Alert',            icon: 'shield-alert', color: RED,    sound: 'tamper'    },
  power:     { label: 'Main Power Disconnected', icon: 'battery-off',  color: ORANGE, sound: null        },
};

// ── Alert sounds ──────────────────────────────────────────────────────────────
// Files: emergency_alert.wav + tamper_alert.wav
//   Android -> android/app/src/main/res/raw/
//   iOS     -> add to the Xcode project (Copy Bundle Resources)
Sound.setCategory('Playback');
const ALERT_FILES   = { emergency: 'emergency_alert.wav', tamper: 'tamper_alert.wav' };
const alertSounds   = {};

const preloadAlertSounds = () => {
  Object.keys(ALERT_FILES).forEach((key) => {
    if (alertSounds[key]) return;
    const snd = new Sound(ALERT_FILES[key], Sound.MAIN_BUNDLE, (err) => {
      if (err) {
        console.warn(`[Sound] ❌ could NOT load ${ALERT_FILES[key]} ->`, err?.message || err);
        alertSounds[key] = null;
        return;
      }
      snd.setVolume(1.0);
      console.log(`[Sound] ✅ loaded ${ALERT_FILES[key]} (${snd.getDuration().toFixed(1)}s)`);
    });
    alertSounds[key] = snd;
  });
};

const releaseAlertSounds = () => {
  Object.keys(alertSounds).forEach((key) => {
    try { alertSounds[key]?.stop(); alertSounds[key]?.release(); } catch (_) {}
    delete alertSounds[key];
  });
};

// ── Assignment helpers (same rules as AssignmentScreen) ───────────────────────
const getApiStatus = (a) => {
  const raw = a?.status ?? a?.assignment_status ?? a?.driver_assignment_status ?? '';
  const t = String(raw).trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};
const isActiveStatus = (a) => getApiStatus(a).toLowerCase() === 'active';
const idOfRef = (x) => (x && typeof x === 'object' ? (x._id || x.id) : x);

// ══════════════════════════════════════════════════════════════
// CENTERED POPUP (shared by Swap / Release / Alerts)
// ══════════════════════════════════════════════════════════════
const Popup = ({ visible, title, subtitle, onClose, children, headerColor }) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView
      style={styles.popupOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.popup}>
        <View style={[styles.popupHeader, headerColor && { backgroundColor: headerColor }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.popupTitle}>{title}</Text>
            {!!subtitle && <Text style={styles.popupSubtitle}>{subtitle}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.popupClose}>
            <Icon name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.popupBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const PopupInfo = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.popupInfo}>
      <Text style={styles.popupInfoLabel}>{label}</Text>
      <Text style={styles.popupInfoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════
// DEVICE STATUS CHIP – one small box: icon + label + value
// ══════════════════════════════════════════════════════════════
const StatusChip = ({ icon, label, value, color, active, pulse }) => {
  // pulse = true  -> red/orange ALERT: ring grows and fades again and again
  // active = true -> ring is coloured; false -> thin grey ring
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse) { anim.setValue(0); return undefined; }
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, anim]);

  const ringScale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  return (
    <View style={[
      styles.alertChip,
      active && { backgroundColor: color + '14', borderColor: color + '66' },
    ]}>
      <View style={styles.ringWrap}>
        {pulse && (
          <Animated.View
            style={[styles.ringPulse, {
              borderColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }],
            }]}
          />
        )}
        <View style={[
          styles.iconCircle,
          { borderColor: active ? color : '#CBD5E1', backgroundColor: active ? color + '22' : '#FFFFFF' },
        ]}>
          <Icon name={icon} size={16} color={color} />
        </View>
      </View>
      <Text style={styles.alertChipLbl}>{label}</Text>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════
// THREE-DOT MENU
// ══════════════════════════════════════════════════════════════
const ThreeDotMenu = React.memo(({ vehicle, navigation }) => {
  const [visible, setVisible] = useState(false);

  const menuItems = [
    {
      icon: 'shield-account-outline', label: 'KYC', color: '#6366f1',
      onPress: () => { setVisible(false); navigation.navigate('VehicleKYC', { vehicle }); },
    },
    {
      icon: 'pencil-outline', label: 'Edit Vehicle', color: '#3477eb',
      onPress: () => { setVisible(false); Alert.alert('Edit Vehicle', 'Coming soon!'); },
    },
    {
      icon: 'bell-outline', label: 'Alerts', color: '#f59e0b',
      onPress: () => { setVisible(false); Alert.alert('Alerts', 'No active alerts.'); },
    },
    {
      icon: 'trash-can-outline', label: 'Remove', color: '#ef4444',
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
                <Text style={[styles.menuItemLabel,
                  { color: item.color === '#ef4444' ? '#ef4444' : '#1e293b' }]}>
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
});

// ══════════════════════════════════════════════════════════════
// VEHICLE CARD
// ══════════════════════════════════════════════════════════════
const VehicleCard = React.memo(({
  vehicle, ignitionOn, onToggleIgnition, navigation,
  onSwapDriver, onReleaseDriver, onAssignDriver, busy,
}) => {
  const isOverspeed = (vehicle.maxSpeed ?? 0) > vehicle.overspeedLimit;
  const hasDriver   = !!vehicle.hasDriver;
  const onTrip      = !!vehicle.tripId;

  // ── Driver action button ──
  //  driver + trip      → Swap Driver
  //  driver + no trip   → Release Driver
  //  no driver          → Assign Driver (opens Assignment screen → Add tab)
  let driverAction;
  if (hasDriver && onTrip) {
    driverAction = {
      icon: 'swap-horizontal', label: 'Swap Driver', color: BLUE,
      style: styles.quickTripBtn, onPress: () => onSwapDriver(vehicle),
    };
  } else if (hasDriver) {
    driverAction = {
      icon: 'account-arrow-right', label: 'Release Driver', color: ORANGE,
      style: styles.quickReleaseBtn, onPress: () => onReleaseDriver(vehicle),
    };
  } else {
    driverAction = {
      icon: 'account-plus', label: 'Assign Driver', color: GREEN,
      style: styles.quickDriverBtn, onPress: () => onAssignDriver(vehicle),
    };
  }

  const statusPillBg =
    vehicle.status === 'Moving' ? 'rgba(22,163,74,0.85)'  :
    vehicle.status === 'Parked' ? 'rgba(217,119,6,0.85)'  :
                                  'rgba(99,102,241,0.85)';

  // ── Device status chips (Emergency / Tamper / Main Power) ──
  const mainPowerKnown        = vehicle.mainPower != null;
  const mainPowerDisconnected = mainPowerKnown && vehicle.mainPower.toLowerCase().startsWith('disconnect');
  const emergencyKnown        = vehicle.emergencyOn != null;
  const tamperKnown           = vehicle.tamperOpen != null;

  const statusChips = [
    {
      key: 'emg', label: 'Emergency',
      icon:   vehicle.emergencyOn ? 'alarm-light' : 'alarm-light-outline',
      value:  !emergencyKnown ? '—' : vehicle.emergencyOn ? 'ON' : 'OFF',
      color:  vehicle.emergencyOn ? RED : (emergencyKnown ? GREEN : GREY),
      active: !!vehicle.emergencyOn,
      pulse:  !!vehicle.emergencyOn,
    },
    {
      key: 'tmp', label: 'Tamper',
      icon:   vehicle.tamperOpen ? 'shield-alert' : 'shield-check-outline',
      value:  !tamperKnown ? '—' : vehicle.tamperOpen ? 'Opened' : 'Closed',
      color:  vehicle.tamperOpen ? RED : (tamperKnown ? GREEN : GREY),
      active: !!vehicle.tamperOpen,
      pulse:  !!vehicle.tamperOpen,
    },
    {
      key: 'pwr', label: 'Main Power',
      icon:   mainPowerDisconnected ? 'battery-off' : 'car-battery',
      value:  !mainPowerKnown ? '—' : mainPowerDisconnected ? 'Disconnected' : 'Connected',
      color:  mainPowerDisconnected ? RED : (mainPowerKnown ? GREEN : GREY),
      active: mainPowerDisconnected,
      pulse:  mainPowerDisconnected,
    },
  ];

  const handleWhatsApp = useCallback(() => {
    const phone = (vehicle.driverPhone || '').replace(/\D/g, '');
    if (!phone) { Alert.alert('No driver assigned', 'No phone number available.'); return; }
    Linking.openURL(`whatsapp://send?phone=91${phone}`)
      .catch(() => Alert.alert('WhatsApp not installed'));
  }, [vehicle.driverPhone]);

  const handleCall = useCallback(() => {
    if (!vehicle.driverPhone) { Alert.alert('No driver assigned', 'No phone number available.'); return; }
    Linking.openURL(`tel:${vehicle.driverPhone}`)
      .catch(() => Alert.alert('Error', 'Unable to make a call.'));
  }, [vehicle.driverPhone]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `🚗 ${vehicle.name} · ${vehicle.status}\n📍 ${vehicle.location}\nDriver: ${vehicle.driver}`,
        title: vehicle.name,
      });
    } catch (_) {}
  }, [vehicle.name, vehicle.status, vehicle.location, vehicle.driver]);

  return (
    <View style={styles.card}>

      {/* ── TOP BAND ── */}
      <LinearGradient
        colors={[vehicle.cardColor, vehicle.cardColor + 'cc']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.cardBand}
      >
        <View style={styles.bandLeft}>
          <View style={styles.truckIconWrap}>
            <Icon name="truck" size={19} color={vehicle.cardColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bandRegNo}>{vehicle.name}</Text>
            {/* ✅ Make + Model (both come from the vehicle data) */}
            <Text style={styles.bandModel} numberOfLines={1}>{vehicle.company}</Text>
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
            {/* ✅ Ignition toggle follows the device packet:
                packet_data_type 'IN' -> ON, 'IF' -> OFF.
                pointerEvents none = display only, so a manual tap
                can't fight the device value. */}
            <View pointerEvents="none" style={styles.ignSwitchWrap}>
              <Switch
                value={!!ignitionOn}
                trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#bbf7d0' }}
                thumbColor={ignitionOn ? '#16a34a' : 'rgba(255,255,255,0.7)'}
                ios_backgroundColor="rgba(255,255,255,0.25)"
                style={styles.ignSwitch}
              />
            </View>
            <Text style={styles.ignLabel}>Ignition</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── DEVICE STATUS STRIP (Emergency / Tamper / Main Power) ── */}
      <View style={styles.alertStrip}>
        {statusChips.map(c => (
          <StatusChip
            key={c.key}
            icon={c.icon}
            label={c.label}
            value={c.value}
            color={c.color}
            active={c.active}
            pulse={c.pulse}
          />
        ))}
      </View>

      {/* ── LAST EVENT (from packet_data_type) ── */}
      {!!vehicle.lastEvent && (
        <View style={[styles.eventRow, { backgroundColor: vehicle.lastEvent.color + '12' }]}>
          <Icon name={vehicle.lastEvent.icon} size={14} color={vehicle.lastEvent.color} />
          <Text style={[styles.eventTxt, { color: vehicle.lastEvent.color }]} numberOfLines={1}>
            {vehicle.lastEvent.label}
          </Text>
          <Text style={styles.eventTime}>{vehicle.lastEvent.time}</Text>
        </View>
      )}

      {/* ── BODY ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('PlayRoute', { vehicle })}
        style={styles.cardBody}
      >
        {/* Driver row */}
        <View style={styles.driverRow}>
          <View style={[styles.driverIconWrap, { backgroundColor: hasDriver ? '#eff6ff' : '#F1F5F9' }]}>
            <Icon name="account-tie" size={16} color={hasDriver ? '#3477eb' : '#94a3b8'} />
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, !hasDriver && styles.driverNameEmpty]}>
              {vehicle.driver}
            </Text>
            {hasDriver && !!vehicle.driverPhone && (
              <Text style={styles.driverPhone}>{vehicle.driverPhone}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }, !hasDriver && styles.contactBtnDisabled]}
            onPress={handleWhatsApp} activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="whatsapp" size={15} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', marginLeft: 5 }, !hasDriver && styles.contactBtnDisabled]}
            onPress={handleCall} activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="phone" size={15} color="#3477eb" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── PRIMARY STATS (5 cols) ── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="speedometer" size={13} color={vehicle.cardColor} />
            <Text style={styles.statVal}>{vehicle.currentSpeed ?? 0} km/h</Text>
            <Text style={styles.statLbl}>Current</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Icon name="speedometer-medium" size={13} color={isOverspeed ? '#ef4444' : vehicle.cardColor} />
            <View style={styles.maxSpeedRow}>
              <Text style={[styles.statVal, isOverspeed && { color: '#ef4444' }]}>
                {vehicle.maxSpeed ?? 0} km/h
              </Text>
              {isOverspeed && (
                <View style={styles.overspeedBadge}>
                  <Icon name="alert" size={7} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.statLbl, isOverspeed && { color: '#ef4444' }]}>Max Speed</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Icon name="gauge" size={13} color={vehicle.cardColor} />
            <Text style={styles.statVal}>{vehicle.avgSpeed ?? 0} km/h</Text>
            <Text style={styles.statLbl}>Avg Speed</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Icon name="car-speed-limiter" size={14}
              color={isOverspeed && vehicle.overspeedCount > 0 ? '#ef4444' : '#94a3b8'} />
            <View style={styles.countBadgeRow}>
              <Text style={[styles.statVal,
                { color: isOverspeed && vehicle.overspeedCount > 0 ? '#ef4444' : '#94a3b8' }]}>
                {vehicle.overspeedCount ?? 0}
              </Text>
              {isOverspeed && vehicle.overspeedCount > 0 && <View style={styles.redDotBadge} />}
            </View>
            <Text style={[styles.statLbl,
              { color: isOverspeed && vehicle.overspeedCount > 0 ? '#ef4444' : '#94a3b8' }]}>
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
              <Text style={[styles.statVal,
                { color: vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8' }]}>
                {vehicle.geofenceCount ?? 0}
              </Text>
              {vehicle.geofenceCount > 0 && <View style={styles.amberDotBadge} />}
            </View>
            <Text style={[styles.statLbl,
              { color: vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8' }]}>Geofence</Text>
            {vehicle.geofenceCount > 0 && (
              <View style={styles.geofencePill}>
                <Text style={styles.geofencePillTxt}>Alert</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── SECONDARY STATS (4 cols) ── */}
        <View style={styles.statsRowSecondary}>
          <View style={styles.secStatItem}>
            <Icon name="map-marker-distance" size={12} color={vehicle.cardColor} />
            <Text style={styles.secStatVal}>{vehicle.totalDistance ?? '0 km'}</Text>
            <Text style={styles.secStatLbl}>Distance</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.secStatItem}>
            <Icon name="compass-outline" size={12} color="#64748B" />
            <Text style={[styles.secStatVal, { color: '#64748B' }]}>
              {vehicle.direction != null ? `${vehicle.direction}°` : (vehicle.lastUpdate ?? '—')}
            </Text>
            <Text style={styles.secStatLbl}>
              {vehicle.direction != null ? 'Direction' : 'Last Update'}
            </Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.secStatItem}>
            <Icon name="clock-check-outline" size={12} color="#16a34a" />
            <Text style={[styles.secStatVal, { color: '#16a34a' }]}>{vehicle.runTime ?? '0h 0m'}</Text>
            <Text style={styles.secStatLbl}>Run Time</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.secStatItem}>
            <Icon name="clock-alert-outline" size={12} color="#f59e0b" />
            <Text style={[styles.secStatVal, { color: '#f59e0b' }]}>{vehicle.idleTime ?? '0h 0m'}</Text>
            <Text style={styles.secStatLbl}>Idle Time</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── AVAILABILITY ROW ── */}
        <View style={styles.availRow}>
          <View style={styles.availItem}>
            <Icon name="map-marker-check-outline" size={13} color="#3477eb" />
            <Text style={styles.availLbl}>Next Available At</Text>
            <Text style={styles.availVal} numberOfLines={1}>
              {vehicle.availabilityPlace || '—'}
            </Text>
          </View>
          <View style={styles.availDivider} />
          <View style={styles.availItem}>
            <Icon name="calendar-clock" size={13} color="#7c3aed" />
            <Text style={styles.availLbl}>Next Available</Text>
            <Text style={[styles.availVal, { color: '#7c3aed' }]} numberOfLines={1}>
              {fmtDate(vehicle.nextAvailableDate)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Location */}
        <View style={styles.locationRow}>
          <Icon name="map-marker-outline" size={12} color="#94a3b8" />
          <Text style={styles.locationTxt} numberOfLines={3}>
            {vehicle.location || vehicle.description || 'Location unavailable'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ── DRIVER ACTION (Swap / Release / Assign) | ADD TRIP ── */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickBtn, driverAction.style, busy && { opacity: 0.6 }]}
          onPress={driverAction.onPress}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator size="small" color={driverAction.color} />
          ) : (
            <Icon name={driverAction.icon} size={18} color={driverAction.color} />
          )}
          <Text style={[styles.quickLbl, { color: driverAction.color }]}>{driverAction.label}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickBtn, styles.quickTripBtn]}
          onPress={() => navigation.navigate('AddTrip', { vehicle })}
          activeOpacity={0.8}
        >
          <Icon name="map-marker-path" size={18} color="#3477eb" />
          <Text style={[styles.quickLbl, { color: '#3477eb' }]}>Add Trip</Text>
        </TouchableOpacity>
      </View>

      {/* ── ACTION BUTTONS ── */}
      <View style={styles.actionsRow}>
        {[
          { icon: 'play-circle-outline',   label: 'Play Route',    onPress: () => navigation.navigate('PlayRoute', { vehicle }) },
          { icon: 'map-clock-outline',     label: 'Route History', onPress: () => navigation.navigate('VehicleDetail', { vehicle }) },
          { icon: 'share-variant-outline', label: 'Share',         onPress: handleShare },
          { icon: 'file-chart-outline',    label: 'Reports',       onPress: () => navigation.navigate('VehicleReports', { vehicle }) },
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
});

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════
const VehicleScreen = ({ navigation }) => {
  const [searchQuery,    setSearchQuery]    = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [vehicles,       setVehicles]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState(null);
  const [ignitionMap,    setIgnitionMap]    = useState({});
  const [wsStatus,       setWsStatus]       = useState('Connecting');
  const [msgCount,       setMsgCount]       = useState(0);

  // ── NEW: WebSocket alert popup + alarm state ──
  // alerts = [{ key, vehicleId, type: 'emergency'|'tamper'|'power', time }]
  const [alerts,            setAlerts]            = useState([]);
  const [alertPopupVisible, setAlertPopupVisible] = useState(false);
  const [alarmRinging,      setAlarmRinging]      = useState(false);
  const [highlightId,       setHighlightId]       = useState(null);

  // ── Swap / Release state ──
  const [busyVehicleId,   setBusyVehicleId]   = useState(null); // card spinner while resolving assignment

  const [swapVisible,        setSwapVisible]        = useState(false);
  const [swapVehicle,        setSwapVehicle]        = useState(null);
  const [swapAssignment,     setSwapAssignment]     = useState(null);
  const [swapWindow,         setSwapWindow]         = useState({ from: null, to: null });
  const [swapDrivers,        setSwapDrivers]        = useState([]);
  const [swapLoading,        setSwapLoading]        = useState(false);
  const [swapError,          setSwapError]          = useState(null);
  const [selectedSwapDriver, setSelectedSwapDriver] = useState(null);
  const [swapDdOpen,         setSwapDdOpen]         = useState(false);
  const [swapping,           setSwapping]           = useState(false);

  const [releaseVisible,      setReleaseVisible]      = useState(false);
  const [releaseVehicle,      setReleaseVehicle]      = useState(null);
  const [releaseAssignment,   setReleaseAssignment]   = useState(null);
  const [releaseFrom,         setReleaseFrom]         = useState(new Date());
  const [releaseTo,           setReleaseTo]           = useState(new Date());
  const [releaseInstructions, setReleaseInstructions] = useState('');
  const [showReleaseFrom,     setShowReleaseFrom]     = useState(false);
  const [showReleaseTo,       setShowReleaseTo]       = useState(false);
  const [releasing,           setReleasing]           = useState(false);

  const vehiclesRef  = useRef([]);
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);   // ✅ reconnect timer
  const activeRef    = useRef(false);  // ✅ false after screen loses focus -> no reconnect loop
  const statsRef     = useRef({});     // ✅ client-side max/avg/overspeed: { [id]: { max, sum, count, over } }

  // ── NEW refs: alarm + scroll-to-card ──
  const scrollRef         = useRef(null);   // main ScrollView
  const listYRef          = useRef(0);      // y of the cards list inside the ScrollView
  const cardYRef          = useRef({});     // { [vehicleId]: y inside the list }
  const alarmKindRef      = useRef(null);   // which alarm is ringing now ('emergency' | 'tamper' | null)
  const alarmTimerRef     = useRef(null);   // safety auto-stop timer
  const highlightTimerRef = useRef(null);

  // Ignition is driven by the device (packet_data_type IN / IF) via handleWsMessage.
  const toggleIgnition = useCallback((vehicleId) => {
    setIgnitionMap(prev => ({ ...prev, [vehicleId]: !prev[vehicleId] }));
  }, []);

  // ── NEW: ALARM (rings until the user stops it) ────────────────
  const stopAlarm = useCallback(() => {
    clearTimeout(alarmTimerRef.current);
    const kind = alarmKindRef.current;
    alarmKindRef.current = null;
    if (kind && alertSounds[kind]) {
      try {
        alertSounds[kind].stop();
        alertSounds[kind].setNumberOfLoops(0);
      } catch (_) {}
    }
    setAlarmRinging(false);
  }, []);

  // Plays the alarm ONE time (the server sends the alert only once).
  // When the sound finishes the "Stop Alarm" button disappears by itself.
  // The user can still tap "Stop Alarm" (or ✕) to stop it before it ends.
  const startAlarm = useCallback((kind) => {
    if (!kind) return;
    if (alarmKindRef.current === kind) return;                          // already playing
    if (alarmKindRef.current === 'emergency' && kind === 'tamper') return; // emergency is more important
    stopAlarm();                                                        // switch to the new one

    const snd = alertSounds[kind];
    console.log(`[Sound] 🔔 alarm "${kind}" -> sound object:`, snd ? 'found' : 'MISSING');
    if (!snd) return;

    snd.setNumberOfLoops(0);    // play only ONE time
    snd.setVolume(1.0);
    alarmKindRef.current = kind;
    setAlarmRinging(true);
    snd.play((ok) => {
      console.log(`[Sound] alarm "${kind}" ended, success =`, ok);
      // finished on its own -> hide the Stop Alarm button
      if (alarmKindRef.current === kind) {
        alarmKindRef.current = null;
        setAlarmRinging(false);
      }
    });
  }, [stopAlarm]);

  // ── WebSocket ─────────────────────────────────────────────────
  const unmatchedLogs = useRef(0);

  const handleWsMessage = useCallback((raw) => {
    // Some servers wrap the payload: { type, data: {...} }
    const d = raw && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? { ...raw, ...raw.data } : raw;
    if (!d || typeof d !== 'object') return;

    if (d.error) { console.warn('[WS] server error:', d.error); return; }
    if (d.type === 'subscribed') { setWsStatus('Subscribed'); return; }

    const hasPayload =
      d.speed != null || d.coordinates || d.location || d.lat != null || d.lng != null;
    if (d.type !== 'live' && d.type !== 'replay' && !hasPayload) return;

    // ✅ Matching keys: vehicle_id, trip_id, gps_device_id, imei, registration_number
    const idOf = (x) => (x && typeof x === 'object' ? (x._id || x.id) : x);
    const incoming = [
      idOf(d.vehicle_id), idOf(d.vehicle), d.vehicleId,
      d.trip_id, d.tripId,
      d.device_id, d.deviceId, d.gps_device_id, d.imei,
      d.registration_number, d.registrationNumber, d.vehicle_number,
    ].filter(Boolean).map(normId);

    setWsStatus('Live');
    setMsgCount(c => c + 1);

    if (!incoming.length) return;

    const hit = vehiclesRef.current.some(v => getIds(v).some(id => incoming.includes(id)));
    if (!hit && unmatchedLogs.current < 5) {
      unmatchedLogs.current += 1;
      console.log('[WS] ⚠ no vehicle matched. incoming =', incoming,
        '| known =', vehiclesRef.current.map(getIds));
    }
    if (!hit) return;
    if (unmatchedLogs.current < 8) {
      unmatchedLogs.current += 1;
      console.log(
        `[WS] ✓ matched. type=${d.type} vehicle_id=${d.vehicle_id} trip_id=${d.trip_id}`,
        `speed=${d.speed} max=${d.max_speed} avg=${d.avg_speed} dist=${d.total_distance}`,
        `overspeed=${d.overspeed_count} geofence=${d.geofence_crossing_count} state=${d.state}`,
        `run=${d.run_time_minutes} idle=${d.idle_time_minutes}`,
        `pkt=${d.packet_data_type} power=${d.main_power_status} emg=${d.emergency_status} tamper=${d.tamper_alert}`
      );
    }

    // ✅ packet_data_type tells us what happened (IN, IF, BD, BR, TA, EA)
    const pktType = d.packet_data_type ? String(d.packet_data_type).trim().toUpperCase() : null;

    // ✅ Ignition from packet type. IN -> ON, IF -> OFF.
    //    (old payload.ignition is still used as a fallback, but payload is now null)
    let ignitionNow = null;
    if (pktType === 'IN') ignitionNow = true;
    else if (pktType === 'IF') ignitionNow = false;
    else if (typeof d.payload?.ignition === 'boolean') ignitionNow = d.payload.ignition;

    if (ignitionNow !== null) {
      const matched = vehiclesRef.current.find(v => getIds(v).some(id => incoming.includes(id)));
      if (matched) setIgnitionMap(p => ({ ...p, [matched.id]: ignitionNow }));
    }

    // ✅ NEW: ALERT POPUP + ALARM
    //    A "new alert" = the value changes into the alert state
    //    (Emergency -> ON, Tamper -> Opened, Main power -> Disconnected).
    //    Only a change triggers the popup + alarm, so the same alert never
    //    rings twice. When the device sends the normal state again
    //    (Emergency OFF / Tamper Closed / Power Connected) the alert is removed.
    {
      const prevV = vehiclesRef.current.find(v => getIds(v).some(id => incoming.includes(id)));
      if (prevV) {
        const emgNow = d.emergency_status  != null ? cleanStr(d.emergency_status) === 'on'     : null;
        const tmpNow = d.tamper_alert      != null ? cleanStr(d.tamper_alert)     === 'opened' : null;
        const powNow = d.main_power_status != null ? cleanStr(d.main_power_status).startsWith('disconnect') : null;
        const prevPow = prevV.mainPower != null && prevV.mainPower.toLowerCase().startsWith('disconnect');

        const newTypes = [];
        const clearedTypes = [];
        if (emgNow === true  && !prevV.emergencyOn) newTypes.push('emergency');
        if (emgNow === false &&  prevV.emergencyOn) clearedTypes.push('emergency');
        if (tmpNow === true  && !prevV.tamperOpen)  newTypes.push('tamper');
        if (tmpNow === false &&  prevV.tamperOpen)  clearedTypes.push('tamper');
        if (powNow === true  && !prevPow)           newTypes.push('power');
        if (powNow === false &&  prevPow)           clearedTypes.push('power');

        if (clearedTypes.length) {
          setAlerts(p => p.filter(a => !(a.vehicleId === prevV.id && clearedTypes.includes(a.type))));
        }

        if (newTypes.length) {
          const time = d.last_updated
            ? new Date(d.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          setAlerts(p => {
            const rest = p.filter(a => !(a.vehicleId === prevV.id && newTypes.includes(a.type)));
            const added = newTypes.map(type => ({ key: `${prevV.id}:${type}`, vehicleId: prevV.id, type, time }));
            return [...added, ...rest];
          });
          setAlertPopupVisible(true);

          const soundKind =
            newTypes.includes('emergency') ? 'emergency' :
            newTypes.includes('tamper')    ? 'tamper'    : null;
          if (soundKind) startAlarm(soundKind);
        }
      }
    }

    setVehicles(prev => {
      const updated = prev.map(v => {
        if (!getIds(v).some(id => incoming.includes(id))) return v;

        const st = statsRef.current[v.id] ||
          { max: 0, sum: 0, count: 0, over: 0, last: null };

        // 1) speed straight from the message (any known field name)
        let speed = pickNum(d, SPEED_KEYS);

        // 2) fallback: derive speed from two consecutive GPS points
        const pos = getCoords(d);
        const now = Date.now();
        if (speed == null && pos && st.last) {
          const hours = (now - st.last.ts) / 3600000;
          if (hours > 0.5 / 3600) {
            const kmh = haversineKm(st.last, pos) / hours;
            if (kmh < 200) speed = Math.round(kmh);
          }
        }
        if (pos) st.last = { ...pos, ts: now };

        const hasSpeed = speed != null;
        if (hasSpeed) {
          st.max    = Math.max(st.max, speed);
          st.sum   += speed;
          st.count += 1;
          if (speed > OVERSPEED_LIMIT) st.over += 1;
        }
        statsRef.current[v.id] = st;

        // ✅ Server values win
        const maxFromSrv       = pickNum(d, MAX_KEYS);
        const avgFromSrv       = pickNum(d, AVG_KEYS);
        const distFromSrv      = pickNum(d, DIST_KEYS);
        const overspeedFromSrv = pickNum(d, OVERSPEED_KEYS);
        const geofenceFromSrv  = pickNum(d, GEOFENCE_KEYS);
        const runMin           = pickNum(d, RUNTIME_KEYS);
        const idleMin          = pickNum(d, IDLETIME_KEYS);
        const curSpeed         = hasSpeed ? speed : v.currentSpeed;

        // Geofence count comes from geofence_crossing_count only.
        // (geofence_status is now a string like 'WITHIN', stored separately.)
        let geofenceCount = v.geofenceCount;
        if (geofenceFromSrv != null) geofenceCount = geofenceFromSrv;

        const pl = d.payload && typeof d.payload === 'object' ? d.payload : {};
        const lat = pos ? pos.lat : (pl.latitude != null ? parseFloat(pl.latitude) : v.lat);
        const lon = pos ? pos.lon : (pl.longitude != null ? parseFloat(pl.longitude) : v.lon);
        const timeOpts = { hour: '2-digit', minute: '2-digit' };
        const lastUpdate = d.last_updated
          ? new Date(d.last_updated).toLocaleTimeString([], timeOpts)
          : new Date().toLocaleTimeString([], timeOpts);

        // ✅ device status fields (each packet carries them)
        const mainPower   = d.main_power_status != null ? String(d.main_power_status).trim() : v.mainPower;
        const emergencyOn = d.emergency_status  != null ? cleanStr(d.emergency_status) === 'on'     : v.emergencyOn;
        const tamperOpen  = d.tamper_alert      != null ? cleanStr(d.tamper_alert)     === 'opened' : v.tamperOpen;

        // ✅ last event text + icon (only for known packet types)
        const evInfo    = getEventInfo(pktType, d);
        const lastEvent = evInfo ? { ...evInfo, code: pktType, time: lastUpdate } : v.lastEvent;

        // NOTE: `...v` keeps tripId (and every other fetched field) intact
        return {
          ...v,
          currentSpeed:   curSpeed,
          maxSpeed:       maxFromSrv != null ? maxFromSrv : Math.max(v.maxSpeed ?? 0, st.max),
          avgSpeed:       avgFromSrv != null
                            ? avgFromSrv
                            : (st.count ? Math.round(st.sum / st.count) : v.avgSpeed),
          overspeedCount: overspeedFromSrv != null
                            ? overspeedFromSrv
                            : Math.max(v.overspeedCount ?? 0, st.over),
          totalDistance:  distFromSrv != null
                            ? `${distFromSrv.toFixed(2)} km`
                            : v.totalDistance,
          runTime:        runMin  != null ? fmtMinutes(runMin)  : v.runTime,
          idleTime:       idleMin != null ? fmtMinutes(idleMin) : v.idleTime,
          location:       d.position_name || d.parked_location || v.location,
          direction:      d.direction != null ? d.direction : v.direction,
          // ✅ state → Moving / Parked / Idle (case-insensitive, same as normStatus)
          status:         d.state ? normStatus(d.state) : v.status,
          driver:         d.driver_name || v.driver,
          hasDriver:      d.driver_name ? true : v.hasDriver,
          geofenceCount,
          geofenceAlert:  geofenceCount > 0,
          geofenceStatus: d.geofence_status ?? v.geofenceStatus,
          lastUpdate,
          lastUpdateFull: d.last_updated
                            ? new Date(d.last_updated).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', hour: '2-digit',
                                minute: '2-digit', second: '2-digit', hour12: false })
                            : v.lastUpdateFull,

          // ✅ extra websocket fields
          lat, lon,
          packetType:      pktType ?? pl.packet_data_type ?? v.packetType,
          packetDateTime:  fmtPacketDateTime(pl.packet_date, pl.packet_time) ?? v.packetDateTime,
          operator:        pl.operator        ?? v.operator,
          vendor:          pl.vendor          ?? v.vendor,
          firmwareVersion: pl.firmware_version ?? v.firmwareVersion,
          deviceCode:      pl.device_id       ?? v.deviceCode,
          imei:            v.imei || d.imei || pl.imei || null,
          gpsDeviceId:     d.gps_device_id    ?? v.gpsDeviceId,
          sessionId:       d.session_id       ?? v.sessionId,
          tripId:          d.trip_id          ?? v.tripId,
          routeId:         d.route_id         ?? v.routeId,
          driverId:        d.driver_id        ?? v.driverId,
          ignition:        ignitionNow !== null ? ignitionNow : v.ignition,

          // ✅ fields for the status icons
          mainPower,
          emergencyOn,
          tamperOpen,
          lastEvent,
        };
      });
      vehiclesRef.current = updated;
      return updated;
    });
  }, [startAlarm]);

  const connectWebSocket = useCallback(() => {
    if (!activeRef.current) return;

    clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    console.log('[WS] Connecting to', WS_URL);
    setWsStatus('Connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] ✓ Connected');
      setWsStatus('Connected');
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };

    ws.onmessage = (event) => {
      let parsed;
      try { parsed = JSON.parse(event.data); }
      catch (e) { console.warn('[WS] Parse error:', e.message); return; }

      if (unmatchedLogs.current < 3) {
        console.log('[WS] raw:', String(event.data).substring(0, 300));
      }
      (Array.isArray(parsed) ? parsed : [parsed]).forEach(handleWsMessage);
    };

    ws.onerror = (e) => {
      console.warn('[WS] ✗ Error:', e?.message);
      setWsStatus('Error');
    };

    ws.onclose = (e) => {
      console.log('[WS] Closed code=', e?.code, 'reason=', e?.reason);
      setWsStatus('Disconnected');
      if (!activeRef.current) return;
      reconnectRef.current = setTimeout(connectWebSocket, 3000);
    };
  }, [handleWsMessage]);

  // ── Fetch vehicles ────────────────────────────────────────────
  //
  // Single API call:
  //   GET /api/assignments/gps-vehicle/client
  //
  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiGet(ENDPOINTS.GPS_VEHICLES_CLIENT);
      console.log('🚗 RAW RESPONSE:', JSON.stringify(response).substring(0, 800));

      const sourceList = unwrapApiArray(response);
      console.log(`🚗 Vehicles received: ${sourceList.length}`);

      // ✅ NEW: remember what the websocket already told us (alerts are sent only once,
      //    so a refresh must NOT wipe emergency / tamper / power / last event)
      const oldList = vehiclesRef.current;

      const transformed = sourceList.map((raw, index) => {
        // vehicle may be nested (vehicle_id / vehicle) or the item itself
        const vDoc =
          (raw.vehicle_id && typeof raw.vehicle_id === 'object' && raw.vehicle_id) ||
          (raw.vehicle    && typeof raw.vehicle    === 'object' && raw.vehicle)    ||
          raw;

        // driver may be nested (driver_id / driver) or flat (driverName / driverMobile)
        const dDoc =
          (raw.driver_id && typeof raw.driver_id === 'object' && raw.driver_id) ||
          (raw.driver    && typeof raw.driver    === 'object' && raw.driver)    ||
          raw;

        const apiId =
          vDoc?._id || raw.vehicleId || raw.vehicle_id?._id ||
          raw._id   || raw.id        || `generated-${index}`;

        const old = oldList.find(p => p.id === apiId);

        // Driver is assigned only when mapping is not NO-MAPPING and a name exists
        const mappingStatus = raw.driver_mapping_status || '';
        const rawDriverName = getDriverName(dDoc);
        const hasDriver     = mappingStatus !== 'NO-MAPPING' && !!rawDriverName;

        const driverName  = hasDriver ? rawDriverName : 'No Driver Assigned';
        const driverPhone = hasDriver ? getDriverPhone(dDoc) : '';

        const availabilityPlace =
          raw.place_of_availability || vDoc?.place_of_availability ||
          raw.availability?.place_of_availability || null;

        const nextAvailableDate =
          raw.next_available_date || vDoc?.next_available_date ||
          raw.availability?.next_available_date || null;

        const location =
          raw.last_location || raw.current_location || raw.location ||
          raw.position_name || vDoc?.location || null;

        const name =
          vDoc?.registration_number || raw.registration_number ||
          raw.name || `Vehicle ${index + 1}`;

        // ✅ NEW: Make and Model are both read from the vehicle data
        const make  = vDoc?.make  || raw.make  || null;
        const model = vDoc?.model || raw.model || null;
        const company =
          [make, model].filter(Boolean).join(' ') || raw.company || 'Unknown Model';

        // ✅ Initial live-fields from the API (same keys the WS sends),
        //    so the card is not blank before the first WS message arrives
        const initDist = pickNum(raw, DIST_KEYS);

        return {
          id:                apiId,
          apiId:             apiId,
          name,
          // ✅ extra IDs so incoming WS messages can be matched
          registrationNumber: name,
          deviceId:          vDoc?.device_id || raw.device_id || null,
          imei:              vDoc?.imei      || raw.imei      || null,
          make,
          model,
          company,
          driver:            driverName,
          driverPhone,
          driverId:          hasDriver ? (raw.driverId || null) : null,
          driverMappingStatus: mappingStatus,
          hasDriver,
          // ✅ best-effort ids for Swap / Release (the screen re-resolves the
          //    real assignment from /api/driverassignments/current before calling the API)
          assignmentId:      raw.assignmentId || raw.assignment_id || raw.driverAssignmentId || null,
          vehicleMongoId:    raw.vehicleId || raw.vehicle_id?._id || raw.vehicle?._id || null,
          assignmentFrom:    raw.from_datetime || null,
          assignmentTo:      raw.to_datetime   || null,
          routeId:           raw.routeId       || null,
          // ✅ trip linked to this driver assignment (null when no active trip).
          //    Used by RoutePlayDetailScreen → Arrival Entry → PUT /api/trip/{tripId}/status
          //    Also used to match WS messages by trip_id (same as web app)
          //    Also decides the card button: trip → Swap Driver, no trip → Release Driver
          tripId:            raw.tripId || null,
          status:            raw.state ? normStatus(raw.state) : 'Idle',
          location:          location || 'Location unavailable',
          availabilityPlace: availabilityPlace || '—',
          nextAvailableDate: nextAvailableDate || null,
          cardColor:         CARD_COLORS[index % CARD_COLORS.length],
          currentSpeed:      pickNum(raw, SPEED_KEYS) ?? 0,
          maxSpeed:          pickNum(raw, MAX_KEYS)   ?? 0,
          avgSpeed:          pickNum(raw, AVG_KEYS)   ?? 0,
          overspeedLimit:    OVERSPEED_LIMIT,
          overspeedCount:    pickNum(raw, OVERSPEED_KEYS) ?? vDoc?.overspeed_count ?? 0,
          geofenceCount:     pickNum(raw, GEOFENCE_KEYS) ?? raw.geofence_count ?? vDoc?.geofence_count ?? 0,
          geofenceAlert:     false,
          geofenceStatus:    raw.geofence_status ?? null,
          lastUpdateFull:    null,
          lat: null, lon: null,
          packetType: null, packetDateTime: null, operator: null, vendor: null,
          firmwareVersion: null, deviceCode: null, gpsDeviceId: null, sessionId: null,
          ignition: null,
          // Device status: API value first, otherwise keep what the websocket already told us
          mainPower:   raw.main_power_status != null ? String(raw.main_power_status).trim() : (old?.mainPower ?? null),
          emergencyOn: raw.emergency_status  != null ? cleanStr(raw.emergency_status) === 'on'     : (old?.emergencyOn ?? null),
          tamperOpen:  raw.tamper_alert      != null ? cleanStr(raw.tamper_alert)     === 'opened' : (old?.tamperOpen ?? null),
          lastEvent:   old?.lastEvent ?? null,
          totalDistance:     initDist != null ? `${initDist.toFixed(2)} km` : '0 km',
          lastUpdate:        '—',
          direction:         raw.direction ?? null,
          // ✅ real values from API/WS (run_time_minutes / idle_time_minutes), no more dummy data
          runTime:           fmtMinutes(pickNum(raw, RUNTIME_KEYS))  ?? '0h 0m',
          idleTime:          fmtMinutes(pickNum(raw, IDLETIME_KEYS)) ?? '0h 0m',
          description:       raw.description || [
            'Commercial delivery truck for inter-city freight and logistics operations.',
            'Passenger vehicle for executive travel and daily office commutes.',
            'Heavy-duty tanker for bulk liquid transportation across state routes.',
            'Light goods vehicle for last-mile delivery in urban zones.',
            'Long-haul trailer on national highway freight corridors.',
          ][index % 5],
        };
      });

      vehiclesRef.current = transformed;
      statsRef.current    = {}; // reset client-side stats on every fresh load
      setVehicles(transformed);

      // keep the ignition state the websocket already gave us
      setIgnitionMap(prev => {
        const init = {};
        transformed.forEach(v => { init[v.id] = prev[v.id] ?? false; });
        return init;
      });

      if (!wsRef.current || wsRef.current.readyState > 1) connectWebSocket();

    } catch (err) {
      console.error('❌ fetchVehicles error:', err.message);
      setError(err.message);
      Alert.alert(
        'Error Loading Vehicles',
        err.message,
        [
          { text: 'Retry',  onPress: () => fetchVehicles() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connectWebSocket]);

  // ✅ load alert sounds once, free them (and stop any alarm) when the screen closes
  useEffect(() => {
    preloadAlertSounds();
    return () => {
      stopAlarm();
      clearTimeout(highlightTimerRef.current);
      releaseAlertSounds();
    };
  }, [stopAlarm]);

  // ✅ NEW: when there are no more active alerts, close the popup and stop the alarm
  useEffect(() => {
    if (alerts.length === 0) {
      setAlertPopupVisible(false);
      stopAlarm();
    }
  }, [alerts.length, stopAlarm]);

  // ── Re-fetch every time screen comes into focus ───────────────
  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      unmatchedLogs.current = 0;
      connectWebSocket();   // open socket right away
      fetchVehicles();
      return () => {
        // ✅ fully clean up when the screen loses focus (no reconnect after leaving)
        activeRef.current = false;
        clearTimeout(reconnectRef.current);
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
          wsRef.current = null;
        }
        // an alarm must never keep ringing on another screen
        stopAlarm();
        setAlertPopupVisible(false);
      };
    }, [fetchVehicles, connectWebSocket, stopAlarm])
  );

  const onRefresh = () => { setRefreshing(true); fetchVehicles(); };

  // ══════════════════════════════════════════════════════════════
  // DRIVER ACTIONS  (Swap / Release / Assign)
  // ══════════════════════════════════════════════════════════════

  // Find the ACTIVE assignment that belongs to this vehicle
  // GET /api/driverassignments/current
  const resolveAssignment = useCallback(async (vehicle) => {
    const res  = await apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS_CURRENT);
    let list   = unwrapArray(res);
    if (list.length === 0 && res && typeof res === 'object' && !Array.isArray(res)) {
      const single = res.assignment || res.data;
      if (single && typeof single === 'object' && single._id) list = [single];
      else if (res._id) list = [res];
    }

    const vIds = [vehicle.vehicleMongoId, vehicle.apiId].filter(Boolean).map(normId);
    const regN = normId(vehicle.name);

    const matches = list.filter((a) => {
      if (vehicle.assignmentId && a._id === vehicle.assignmentId) return true;
      const aVid = idOfRef(a.vehicle_id);
      if (aVid && vIds.includes(normId(aVid))) return true;
      const reg = a.vehicle_id?.registration_number;
      return !!reg && normId(reg) === regN;
    });

    // prefer an ACTIVE one
    return matches.find(isActiveStatus) || matches[0] || null;
  }, []);

  // ── Assign Driver → Assignment screen, ADD tab (assign driver form) ──
  // Sends openTab: 'add' (+ the tapped vehicle). The Assignment screen reads
  // route.params.openTab to start on the Add tab.
  const handleAssignDriver = useCallback((vehicle) => {
    navigation.navigate(ASSIGNMENT_ROUTE, { openTab: 'add', vehicle });
  }, [navigation]);

  // ── SWAP ──────────────────────────────────────────────────────
  // GET /api/driver/unassigned?from_datetime=<now>&to_datetime=<assignment to>
  // PUT /api/driverassignments/swap/:assignment_id
  const loadSwapDrivers = useCallback(async (from, to, assignment) => {
    try {
      setSwapLoading(true);
      setSwapError(null);
      const res  = await apiGet(ENDPOINTS.DRIVERS_UNASSIGNED(from.toISOString(), to.toISOString()));
      const list = unwrapArray(res);
      const currentId = idOfRef(assignment?.driver_id);
      setSwapDrivers(
        list
          .filter((d) => (d?._id || d?.id) !== currentId)
          .map((d) => ({
            value: d?._id || d?.id,
            name:  getDriverName(d) || 'Unknown Driver',
            phone: getDriverPhone(d),
          }))
      );
    } catch (err) {
      setSwapDrivers([]);
      setSwapError(err.message || 'Failed to load available drivers');
    } finally {
      setSwapLoading(false);
    }
  }, []);

  const handleSwapDriver = useCallback(async (vehicle) => {
    try {
      setBusyVehicleId(vehicle.id);
      const assignment = await resolveAssignment(vehicle);
      if (!assignment) {
        Alert.alert('Swap not possible', 'No current assignment found for this vehicle.');
        return;
      }
      if (!isActiveStatus(assignment)) {
        Alert.alert('Swap not allowed', 'Only an active assignment can be swapped.');
        return;
      }
      const from = new Date();
      const to   = toDateSafe(assignment.to_datetime);
      if (!to || to <= from) {
        Alert.alert('Swap not possible', 'This assignment has already ended.');
        return;
      }
      setSwapVehicle(vehicle);
      setSwapAssignment(assignment);
      setSwapWindow({ from, to });
      setSelectedSwapDriver(null);
      setSwapDdOpen(false);
      setSwapVisible(true);
      loadSwapDrivers(from, to, assignment);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load the assignment.');
    } finally {
      setBusyVehicleId(null);
    }
  }, [resolveAssignment, loadSwapDrivers]);

  const closeSwap = () => { if (!swapping) setSwapVisible(false); };

  const submitSwap = async () => {
    if (!selectedSwapDriver) return Alert.alert('Missing field', 'Select a driver.');
    const oldDriverName = getDriverName(swapAssignment?.driver_id) || swapVehicle?.driver || '';
    try {
      setSwapping(true);
      const body = {
        old_driver_id: idOfRef(swapAssignment?.driver_id),
        new_driver_id: selectedSwapDriver.value,
        from_datetime: swapWindow.from.toISOString(),
        to_datetime:   swapWindow.to.toISOString(),
        instructions:  `Swapping driver ${oldDriverName} with ${selectedSwapDriver.name}`.trim(),
      };
      const url = ENDPOINTS.DRIVER_ASSIGNMENT_SWAP(swapAssignment._id);
      console.log('🔁 SWAP', url, JSON.stringify(body));
      await apiPut(url, body);
      setSwapVisible(false);
      Alert.alert('Success', `Driver swapped with ${selectedSwapDriver.name}.`);
      fetchVehicles(); // refresh cards
    } catch (err) {
      Alert.alert(
        'Error',
        `Could not swap driver.\n\n${err.message}\n\nPUT ${ENDPOINTS.DRIVER_ASSIGNMENT_SWAP(swapAssignment?._id)}`
      );
    } finally {
      setSwapping(false);
    }
  };

  // ── RELEASE ───────────────────────────────────────────────────
  // PUT /api/driverassignments/release/:assignment_id
  // Body: { driver_id, vehicle_id, from_datetime, to_datetime, instructions, status }
  const handleReleaseDriver = useCallback(async (vehicle) => {
    try {
      setBusyVehicleId(vehicle.id);
      const assignment = await resolveAssignment(vehicle);
      if (!assignment) {
        Alert.alert('Release not possible', 'No current assignment found for this vehicle.');
        return;
      }
      if (!isActiveStatus(assignment)) {
        Alert.alert('Release not allowed', 'Only an active assignment can be released.');
        return;
      }
      setReleaseVehicle(vehicle);
      setReleaseAssignment(assignment);
      setReleaseFrom(new Date());
      setReleaseTo(toDateSafe(assignment.to_datetime) || new Date());
      setReleaseInstructions('');
      setShowReleaseFrom(false);
      setShowReleaseTo(false);
      setReleaseVisible(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load the assignment.');
    } finally {
      setBusyVehicleId(null);
    }
  }, [resolveAssignment]);

  const closeRelease = () => {
    if (releasing) return;
    setShowReleaseFrom(false);
    setShowReleaseTo(false);
    setReleaseVisible(false);
  };

  const submitRelease = async () => {
    if (!releaseAssignment) return;
    if (releaseTo < releaseFrom) {
      return Alert.alert('Invalid dates', 'To date cannot be before From date.');
    }
    try {
      setReleasing(true);
      const body = {
        driver_id:     idOfRef(releaseAssignment.driver_id),
        vehicle_id:    idOfRef(releaseAssignment.vehicle_id),
        from_datetime: formatSlashDate(releaseFrom),
        to_datetime:   formatSlashDate(releaseTo),
        instructions:  releaseInstructions.trim(),
        status:        RELEASE_STATUS_VALUE,
      };
      const url = ENDPOINTS.DRIVER_ASSIGNMENT_RELEASE(releaseAssignment._id);
      console.log('🔓 RELEASE', url, JSON.stringify(body));
      await apiPut(url, body);
      setShowReleaseFrom(false);
      setShowReleaseTo(false);
      setReleaseVisible(false);
      Alert.alert('Success', 'Driver released from the assignment.');
      fetchVehicles(); // refresh cards → button flips to "Assign Driver"
    } catch (err) {
      Alert.alert(
        'Error',
        `Could not release driver.\n\n${err.message}\n\nPUT ${ENDPOINTS.DRIVER_ASSIGNMENT_RELEASE(releaseAssignment?._id)}`
      );
    } finally {
      setReleasing(false);
    }
  };

  const onReleaseFromChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowReleaseFrom(false);
    if (d) setReleaseFrom(d);
  };
  const onReleaseToChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowReleaseTo(false);
    if (d) setReleaseTo(d);
  };

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;
    if (selectedFilter !== 'All') filtered = filtered.filter(v => v.status === selectedFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        (v.name              || '').toLowerCase().includes(q) ||
        (v.driver            || '').toLowerCase().includes(q) ||
        (v.company           || '').toLowerCase().includes(q) ||
        (v.location          || '').toLowerCase().includes(q) ||
        (v.availabilityPlace || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [vehicles, searchQuery, selectedFilter]);

  // ══════════════════════════════════════════════════════════════
  // NEW: ALERT POPUP helpers
  // ══════════════════════════════════════════════════════════════

  // Join each alert with its vehicle (make, model, registration number)
  const alertRows = useMemo(
    () => alerts
      .map(a => {
        const v = vehicles.find(x => x.id === a.vehicleId);
        return v ? { ...a, vehicle: v } : null;
      })
      .filter(Boolean),
    [alerts, vehicles]
  );

  // ✕ icon / Stop Alarm: closing the popup also stops the alarm
  const closeAlertPopup = useCallback(() => {
    setAlertPopupVisible(false);
    stopAlarm();
  }, [stopAlarm]);

  // Tap a vehicle in the popup -> close popup, scroll to that vehicle's card and highlight it
  const handleAlertVehiclePress = useCallback((vehicleId) => {
    closeAlertPopup();

    const visible = filteredVehicles.some(v => v.id === vehicleId);
    if (!visible) {            // card is hidden by a filter / search -> show everything
      setSearchQuery('');
      setSelectedFilter('All');
    }

    setTimeout(() => {
      const y = listYRef.current + (cardYRef.current[vehicleId] ?? 0);
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
      setHighlightId(vehicleId);
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 3500);
    }, visible ? 350 : 700);
  }, [closeAlertPopup, filteredVehicles]);

  // 🔔 header bell: re-open the popup while alerts are still active
  const handleBellPress = useCallback(() => {
    if (alerts.length > 0) setAlertPopupVisible(true);
    else Alert.alert('Notifications', 'No active alerts');
  }, [alerts.length]);

  // ── Loading screen ────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
        <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
              <Icon name="menu" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Vehicles</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3477eb" />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Icon name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Vehicles</Text>
            <Text style={styles.headerSub}>{vehicles.length} registered · WS {wsStatus} ({msgCount})</Text>
          </View>
          <TouchableOpacity style={styles.menuButton} onPress={handleBellPress}>
            <Icon name={alarmRinging ? 'bell-ring' : 'bell-outline'} size={26} color="#fff" />
            {alerts.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeTxt}>{alerts.length > 9 ? '9+' : alerts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={19} color="rgba(255,255,255,0.8)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicles, drivers, location..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={19} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={['#3477eb']} tintColor="#3477eb" />
        }
      >
        {/* Filter pills */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {[
              { label: 'All',    dot: null      },
              { label: 'Moving', dot: '#16a34a' },
              { label: 'Parked', dot: '#d97706' },
              { label: 'Idle',   dot: '#6366f1' },
            ].map(f => (
              <TouchableOpacity key={f.label}
                style={[styles.filterBtn, selectedFilter === f.label && styles.filterBtnActive]}
                onPress={() => setSelectedFilter(f.label)} activeOpacity={0.7}>
                {f.dot && <View style={[styles.filterDot, { backgroundColor: f.dot }]} />}
                <Text style={[styles.filterTxt, selectedFilter === f.label && styles.filterTxtActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Cards */}
        <View
          style={styles.list}
          onLayout={(e) => { listYRef.current = e.nativeEvent.layout.y; }}
        >
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle, index) => (
              <View
                key={vehicle.id || index}
                // remember where each card sits so the alert popup can scroll to it
                onLayout={(e) => { cardYRef.current[vehicle.id] = e.nativeEvent.layout.y; }}
                style={[styles.cardWrap, highlightId === vehicle.id && styles.cardWrapHighlight]}
              >
                <VehicleCard
                  vehicle={vehicle}
                  ignitionOn={ignitionMap[vehicle.id] ?? false}
                  onToggleIgnition={toggleIgnition}
                  navigation={navigation}
                  onSwapDriver={handleSwapDriver}
                  onReleaseDriver={handleReleaseDriver}
                  onAssignDriver={handleAssignDriver}
                  busy={busyVehicleId === vehicle.id}
                />
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="car-off" size={60} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No vehicles found</Text>
              <Text style={styles.emptyText}>
                {error
                  ? `Error: ${error}`
                  : searchQuery
                  ? `No match for "${searchQuery}"`
                  : `No ${selectedFilter.toLowerCase()} vehicles`}
              </Text>
              <TouchableOpacity style={styles.clearBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedFilter('All');
                  if (error) fetchVehicles();
                }}>
                <Text style={styles.clearBtnTxt}>{error ? 'Retry' : 'Clear filters'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ---------- NEW: Vehicle Alerts popup (alerts coming from the WebSocket) ---------- */}
      <Popup
        visible={alertPopupVisible}
        title="Vehicle Alerts"
        subtitle={`${alertRows.length} active alert${alertRows.length === 1 ? '' : 's'}`}
        headerColor={RED}
        onClose={closeAlertPopup}
      >
        {alarmRinging && (
          <TouchableOpacity style={styles.stopAlarmBtn} onPress={stopAlarm} activeOpacity={0.85}>
            <Icon name="volume-off" size={18} color="#FFFFFF" />
            <Text style={styles.stopAlarmTxt}>Stop Alarm</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.alertHint}>Tap a vehicle to go to its card</Text>

        {alertRows.map((row) => {
          const t = ALERT_TYPES[row.type];
          const v = row.vehicle;
          return (
            <TouchableOpacity
              key={row.key}
              style={styles.alertRow}
              activeOpacity={0.75}
              onPress={() => handleAlertVehiclePress(v.id)}
            >
              <View style={[styles.alertIconWrap, { backgroundColor: t.color + '18' }]}>
                <Icon name={t.icon} size={22} color={t.color} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.alertRegNo} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.alertMakeModel} numberOfLines={1}>
                  Make: {v.make || '—'}   Model: {v.model || '—'}
                </Text>
                <View style={styles.alertMetaRow}>
                  <View style={[styles.alertTypePill, { backgroundColor: t.color + '18' }]}>
                    <Text style={[styles.alertTypeTxt, { color: t.color }]}>{t.label}</Text>
                  </View>
                  <Text style={styles.alertTime}>{row.time}</Text>
                </View>
              </View>

              <Icon name="chevron-right" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          );
        })}
      </Popup>

      {/* ---------- Swap Driver popup (driver assigned + vehicle on trip) ---------- */}
      <Popup
        visible={swapVisible}
        title="Swap Driver"
        subtitle="Assign another driver for the rest of this assignment"
        onClose={closeSwap}
      >
        <View style={styles.popupRow}>
          <PopupInfo
            label="Driver Name"
            value={getDriverName(swapAssignment?.driver_id) || swapVehicle?.driver}
          />
          <PopupInfo
            label="Vehicle"
            value={swapAssignment?.vehicle_id?.registration_number || swapVehicle?.name}
          />
        </View>

        <View style={styles.popupRow}>
          <PopupInfo label="Swap From (today)" value={fmtDateObj(swapWindow.from)} />
          <PopupInfo label="Swap To" value={fmtDateObj(swapWindow.to)} />
        </View>

        <Text style={styles.popupLabel}>Available Drivers</Text>
        <TouchableOpacity
          style={styles.field}
          activeOpacity={0.7}
          onPress={() => setSwapDdOpen(o => !o)}
          disabled={swapLoading}
        >
          <Text
            style={[styles.fieldText, !selectedSwapDriver && styles.fieldPlaceholder]}
            numberOfLines={1}
          >
            {swapLoading
              ? 'Loading drivers...'
              : selectedSwapDriver ? selectedSwapDriver.name : 'Select a driver'}
          </Text>
          {swapLoading ? (
            <ActivityIndicator size="small" color={BLUE} />
          ) : (
            <Icon name={swapDdOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#64748B" />
          )}
        </TouchableOpacity>

        {!!swapError && (
          <View style={[styles.errorContainer, { marginTop: 10 }]}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.errorText} numberOfLines={3}>{swapError}</Text>
            <TouchableOpacity
              onPress={() => loadSwapDrivers(swapWindow.from, swapWindow.to, swapAssignment)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {swapDdOpen && !swapLoading && (
          <View style={styles.ddList}>
            {swapDrivers.length === 0 ? (
              <Text style={styles.ddEmpty}>No drivers available for this period</Text>
            ) : (
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {swapDrivers.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.ddRow, selectedSwapDriver?.value === d.value && styles.ddRowActive]}
                    onPress={() => { setSelectedSwapDriver(d); setSwapDdOpen(false); }}
                  >
                    <Text style={styles.ddName}>{d.name}</Text>
                    {!!d.phone && <Text style={styles.ddPhone}>{d.phone}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.popupActions}>
          <TouchableOpacity
            style={[styles.ghostBtn, { flex: 1 }]}
            onPress={closeSwap}
            disabled={swapping}
          >
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1 }, (swapping || !selectedSwapDriver) && { opacity: 0.6 }]}
            onPress={submitSwap}
            disabled={swapping || !selectedSwapDriver}
          >
            {swapping ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Swap</Text>}
          </TouchableOpacity>
        </View>
      </Popup>

      {/* ---------- Release Driver popup (driver assigned + vehicle NOT on trip) ---------- */}
      <Popup
        visible={releaseVisible}
        title="Release Driver"
        subtitle="Release the driver from this assignment"
        onClose={closeRelease}
      >
        <View style={styles.popupRow}>
          <PopupInfo
            label="Driver"
            value={getDriverName(releaseAssignment?.driver_id) || releaseVehicle?.driver}
          />
          <PopupInfo
            label="Vehicle"
            value={releaseAssignment?.vehicle_id?.registration_number || releaseVehicle?.name}
          />
        </View>

        <Text style={styles.popupLabel}>From Date</Text>
        <TouchableOpacity style={styles.field} onPress={() => setShowReleaseFrom(true)}>
          <Icon name="calendar" size={18} color={BLUE} />
          <Text style={[styles.fieldText, { marginLeft: 8 }]}>{fmtDateObj(releaseFrom)}</Text>
        </TouchableOpacity>
        {showReleaseFrom && (
          <DateTimePicker
            value={releaseFrom}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onReleaseFromChange}
          />
        )}

        <Text style={[styles.popupLabel, { marginTop: 12 }]}>To Date</Text>
        <TouchableOpacity style={styles.field} onPress={() => setShowReleaseTo(true)}>
          <Icon name="calendar" size={18} color={BLUE} />
          <Text style={[styles.fieldText, { marginLeft: 8 }]}>{fmtDateObj(releaseTo)}</Text>
        </TouchableOpacity>
        {showReleaseTo && (
          <DateTimePicker
            value={releaseTo}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onReleaseToChange}
          />
        )}

        <Text style={[styles.popupLabel, { marginTop: 12 }]}>Instructions</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Reason / notes for releasing the driver…"
          placeholderTextColor="#94A3B8"
          value={releaseInstructions}
          onChangeText={setReleaseInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={[styles.popupLabel, { marginTop: 12 }]}>Status</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{RELEASE_STATUS_VALUE}</Text>
        </View>

        <View style={styles.popupActions}>
          <TouchableOpacity
            style={[styles.ghostBtn, { flex: 1 }]}
            onPress={closeRelease}
            disabled={releasing}
          >
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.releaseSubmitBtn, { flex: 1 }, releasing && { opacity: 0.6 }]}
            onPress={submitRelease}
            disabled={releasing}
          >
            {releasing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Release</Text>}
          </TouchableOpacity>
        </View>
      </Popup>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F1F5F9' },
  header:       { paddingTop: Platform.OS === 'ios' ? 50 : 38, paddingBottom: 16, paddingHorizontal: 18 },
  headerContent:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  menuButton:   { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  headerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 1 },

  // NEW: bell badge (number of active alerts)
  bellBadge: {
    position: 'absolute', top: 2, right: 0,
    minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: RED, borderWidth: 1.5, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  bellBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 11, paddingHorizontal: 13, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput:  { flex: 1, marginLeft: 8, fontSize: 14, color: '#fff', fontWeight: '500' },
  scrollView:   { flex: 1 },
  filterSection:{ paddingVertical: 10 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  filterBtnActive: { backgroundColor: '#3477eb', borderColor: '#3477eb' },
  filterDot:       { width: 7, height: 7, borderRadius: 3.5 },
  filterTxt:       { fontSize: 13, color: '#64748B', fontWeight: '600' },
  filterTxtActive: { color: '#fff' },
  list: { paddingHorizontal: 14, gap: 8, paddingBottom: 80 },

  // NEW: wrapper around every card (used for scroll position + red highlight)
  cardWrap: {
    borderWidth: 2, borderColor: 'transparent', borderRadius: 16, marginHorizontal: -2,
  },
  cardWrapHighlight: { borderColor: RED },

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
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  bandRegNo: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  bandModel: { fontSize: 10, color: 'rgba(255,255,255,0.78)', fontWeight: '500', marginTop: 1 },
  statusAndMenu: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 30,
  },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 16, width: '80%', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
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
  ignitionWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ignSwitchWrap:{ },
  ignSwitch:    { transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] },
  ignLabel:     { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: 'rgba(255,255,255,0.75)' },

  // ── device status strip (Emergency / Tamper / Main Power) ──
  alertStrip: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  alertChip: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 2, gap: 2,
    borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  alertChipLbl: {
    fontSize: 7.5, color: '#94a3b8', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  alertChipVal: { fontSize: 9.5, fontWeight: '800' },
  ringWrap:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  ringPulse: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2,
  },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  eventTxt:  { flex: 1, fontSize: 10.5, fontWeight: '700' },
  eventTime: { fontSize: 10, color: '#64748B', fontWeight: '500' },

  cardBody:     { paddingTop: 10, paddingHorizontal: 12 },
  driverRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  driverIconWrap: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  driverInfo:     { flex: 1 },
  driverName:     { fontSize: 12, color: '#1e293b', fontWeight: '700' },
  driverNameEmpty:{ color: '#94a3b8', fontWeight: '600', fontStyle: 'italic' },
  driverPhone:    { fontSize: 10.5, color: '#64748B', fontWeight: '500', marginTop: 1 },
  contactBtn: {
    width: 29, height: 29, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5,
  },
  contactBtnDisabled: { opacity: 0.4 },
  divider:     { height: 1, backgroundColor: '#F1F5F9', marginBottom: 10 },
  statsRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 44, backgroundColor: '#F1F5F9', alignSelf: 'center' },
  statVal:     { fontSize: 10, fontWeight: '800', color: '#0f172a' },
  statLbl:     { fontSize: 7.5, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  maxSpeedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  overspeedBadge: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
  },
  countBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  redDotBadge:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#ef4444' },
  amberDotBadge: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#f59e0b' },
  overLimitPill: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 7, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1,
  },
  overLimitTxt: { fontSize: 6.5, color: '#ef4444', fontWeight: '800' },
  geofencePill: {
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 7, paddingHorizontal: 3, paddingVertical: 1, marginTop: 1,
  },
  geofencePillTxt: { fontSize: 6.5, color: '#f59e0b', fontWeight: '800' },
  statsRowSecondary: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  secStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  secStatVal:  { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  secStatLbl:  { fontSize: 9.5, color: '#64748B', fontWeight: '500' },
  availRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1, borderColor: '#EEF2F7',
  },
  availItem:    { flex: 1, alignItems: 'center', gap: 3 },
  availDivider: { width: 1, height: 36, backgroundColor: '#E2E8F0', marginHorizontal: 8 },
  availLbl: {
    fontSize: 8, color: '#94a3b8', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1,
  },
  availVal: {
    fontSize: 11, fontWeight: '700', color: '#0f172a',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    backgroundColor: '#F8FAFC', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 6, marginBottom: 10,
  },
  locationTxt: { flex: 1, fontSize: 10.5, color: '#64748B', fontWeight: '500', lineHeight: 15 },

  // Driver action (Swap / Release / Assign) | Add Trip row
  quickRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 12, paddingBottom: 10,
  },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  quickDriverBtn:  { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  quickTripBtn:    { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  quickReleaseBtn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  quickLbl:        { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },

  actionsRow:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 3 },
  actionSep:   { width: 1, backgroundColor: '#F1F5F9', marginVertical: 7 },
  actionLbl:   { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  emptyState:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: '#64748B', marginTop: 14, marginBottom: 6 },
  emptyText:   { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  clearBtn:    { marginTop: 18, paddingHorizontal: 24, paddingVertical: 11, backgroundColor: '#3477eb', borderRadius: 12 },
  clearBtnTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:      { marginTop: 14, fontSize: 15, color: '#64748B', fontWeight: '500' },

  // ── Popup (shared: Alerts / Swap / Release) ───────────────────
  popupOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  popup:         { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', maxHeight: '88%' },
  popupHeader:   { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE, paddingHorizontal: 18, paddingVertical: 16 },
  popupTitle:    { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  popupSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  popupClose:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  popupBody:     { padding: 18, paddingBottom: 22 },
  popupRow:      { flexDirection: 'row', marginBottom: 12 },
  popupInfo:     { width: '50%', paddingRight: 8 },
  popupInfoLabel:{ fontSize: 11, color: '#64748B', fontWeight: '500', marginBottom: 2 },
  popupInfoValue:{ fontSize: 13, color: '#1E293B', fontWeight: '600' },
  popupLabel:    { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 4, marginBottom: 6 },
  popupActions:  { flexDirection: 'row', gap: 10, marginTop: 22 },

  // ── NEW: alert popup rows ──
  stopAlarmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 12, paddingVertical: 12, marginBottom: 12,
  },
  stopAlarmTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  alertHint:    { fontSize: 11.5, color: '#64748B', fontWeight: '500', marginBottom: 10 },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    padding: 12, marginBottom: 10,
  },
  alertIconWrap:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  alertRegNo:     { fontSize: 14.5, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  alertMakeModel: { fontSize: 11.5, color: '#64748B', fontWeight: '500', marginTop: 2 },
  alertMetaRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  alertTypePill:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  alertTypeTxt:   { fontSize: 10.5, fontWeight: '800' },
  alertTime:      { fontSize: 10.5, color: '#94A3B8', fontWeight: '600' },

  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  fieldText:        { fontSize: 13, color: '#1E293B', fontWeight: '500', flex: 1 },
  fieldPlaceholder: { color: '#94A3B8' },
  textArea: {
    minHeight: 80, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1E293B',
  },
  ddList:      { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: 6, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  ddRow:       { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ddRowActive: { backgroundColor: '#EFF6FF' },
  ddName:      { fontSize: 14, color: '#1E293B', fontWeight: '600' },
  ddPhone:     { fontSize: 11, color: '#64748B', marginTop: 1 },
  ddEmpty:     { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, gap: 8 },
  errorText:      { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },
  retryButton:    { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F44336', borderRadius: 6 },
  retryText:      { fontSize: 12, color: '#FFF', fontWeight: '600' },
  ghostBtn:       { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12 },
  ghostBtnText:   { color: '#475569', fontSize: 14, fontWeight: '700' },
  primaryBtn:     { alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, borderRadius: 12, paddingVertical: 12 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  releaseSubmitBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 12 },
  readOnlyField:  { backgroundColor: '#F1F5F9', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12 },
  readOnlyText:   { fontSize: 14, color: '#475569', fontWeight: '600' },
});

export default VehicleScreen;