import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput,
  ScrollView, Platform, Alert, ActivityIndicator, Switch, Share,
  Linking, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet, apiPut, ENDPOINTS } from '../utils/Api';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

const OVERSPEED_LIMIT = 80;
const WS_URL = 'wss://vlts-server.nutanteksolutions.cloud';

// ✅ View tab uses ENDPOINTS.TRIPS_VIEW  →  GET /api/trip?page=1&limit=100
//    (paged: { page, limit, total, totalPages, data: [...] })
//    Big page size so every trip shows up on the View tab.
const VIEW_TRIPS_ENDPOINT = ENDPOINTS.TRIPS_VIEW(1, 100);

// ✅ Status values sent to the API from the Approved tab buttons.
//    Change ARRIVED_STATUS here if your backend uses a different value.
const DEPARTED_STATUS = 'DEPARTED';
const ARRIVED_STATUS  = 'ARRIVED';

// ✅ Extra breathing room kept between the last card and the bottom tab bar
const LIST_BOTTOM_GAP = 24;

const normStatus = (state) => {
  if (!state) return 'Idle';
  const u = state.toUpperCase();
  if (u === 'MOVING') return 'Moving';
  if (u === 'PARKED') return 'Parked';
  return 'Idle';
};

// ✅ Turns any API response into readable text for the result dialog
const formatApiResponse = (res) => {
  if (res === null || res === undefined) return 'Done';
  if (typeof res === 'string') return res;
  const msg = res.message || res.msg || res.data?.message;
  if (msg) return String(msg);
  try {
    return JSON.stringify(res, null, 2).slice(0, 700);
  } catch {
    return 'Done';
  }
};

// Same pattern proven across VehicleScreen/AssignmentScreen: real driver
// name/phone live under employee_id, not flat top-level fields.
const getDriverName  = (d) => d?.employee_id?.name          || d?.driver_name    || d?.name  || 'Unknown Driver';
const getDriverPhone = (d) => d?.employee_id?.mobile_number || d?.driver_mobile  || d?.mobile_number || d?.phone || '';

// Cross-reference against the full driver list by _id, same pattern that
// works correctly in AssignmentScreen.js. Handles cases where the trip
// endpoint only returns a driver ID/stub instead of a populated object.
const resolveDriver = (driverField, driverById) => {
  if (!driverField) return null;
  const id = typeof driverField === 'object' ? driverField._id : driverField;
  return driverById[id] || (typeof driverField === 'object' ? driverField : null);
};

const mapApiTripToCard = (item, driverById = {}) => {
  // Some endpoints return { route, assignment, vehicle, driver } (nested wrapper),
  // others return the assignment record directly with vehicle_id/driver_id/route_id
  // (same flat shape as /driverassignments). Normalize both into one shape.
  const assignment = item.assignment ?? item;
  const vehicle     = item.vehicle   ?? item.vehicle_id;
  const driver = item.driver ?? resolveDriver(item.driver_id ?? item.assignment?.driver_id, driverById);
  const route       = item.route     ?? item.route_id;

  const approvalStatus = assignment?.trip_approval_status ?? item?.trip_approval_status ?? 'AWAITED';
  const depStatus      = assignment?.trip_dep_status      ?? item?.trip_dep_status      ?? 'AWAITED';
  const approvalColor  =
    approvalStatus === 'APPROVED'  ? '#4CAF50' :
    approvalStatus === 'CANCELLED' ? '#ef4444' : '#f59e0b';
  const depColor =
    depStatus === 'DEPARTED'  ? '#16a34a' :
    depStatus === 'CANCELLED' ? '#ef4444' : '#3477eb';
  const fmtTime = (iso) => {
    if (!iso) return '--';
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
    catch { return '--'; }
  };
  const fmtDate = (iso) => {
    if (!iso) return '--';
    try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '--'; }
  };
  const rawCoords        = route?.geometry?.coordinates ?? [];
  const routeCoordinates = rawCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  const sourceLat = route?.source?.[1]      ?? routeCoordinates[0]?.latitude                            ?? null;
  const sourceLng = route?.source?.[0]      ?? routeCoordinates[0]?.longitude                           ?? null;
  const destLat   = route?.destination?.[1] ?? routeCoordinates[routeCoordinates.length - 1]?.latitude  ?? null;
  const destLng   = route?.destination?.[0] ?? routeCoordinates[routeCoordinates.length - 1]?.longitude ?? null;

  return {
    id:                   assignment?._id ?? item?._id ?? Math.random().toString(),
    vehicleRegNo:         vehicle?.registration_number ?? '--',
    vehicleMake:          `${vehicle?.make ?? ''} ${vehicle?.model ?? ''}`.trim() || '--',
    driverName:           getDriverName(driver),
    driverPhone:          getDriverPhone(driver),
    routeName:            route?.name ?? `${route?.place_from ?? ''} → ${route?.place_to ?? ''}`,
    sourceLabel:          route?.place_from ?? 'Source',
    destLabel:            route?.place_to   ?? 'Destination',
    sourceLat:            sourceLat?.toString() ?? '',
    sourceLng:            sourceLng?.toString() ?? '',
    destLat:              destLat?.toString()   ?? '',
    destLng:              destLng?.toString()   ?? '',
    geofenceRadius:       route?.geofence_radius ?? 500,
    approvalStatus,
    approvalStatusColor:  approvalColor,
    departureStatus:      depStatus === 'DEPARTED' ? 'Departed' : depStatus === 'CANCELLED' ? 'Cancelled' : 'Awaited',
    departureStatusColor: depColor,
    departureTime:        fmtTime(assignment?.departure_time ?? assignment?.from_datetime),
    departureDate:        fmtDate(assignment?.departure_time ?? assignment?.from_datetime),
    arrivalTime:          fmtTime(assignment?.arrival_time ?? assignment?.to_datetime),
    arrivalDate:          fmtDate(assignment?.arrival_time ?? assignment?.to_datetime),
    assignedDate:         fmtDate(assignment?.assigned_at ?? assignment?.createdAt),
    assignedTime:         fmtTime(assignment?.assigned_at ?? assignment?.createdAt),
    submittedBy:          getDriverName(driver),
    approvedBy:           'Admin',
    approvedOn:           fmtDate(assignment?.assigned_at ?? assignment?.createdAt),
    _assignmentId:        assignment?._id ?? item?._id,
    routeCoordinates,
    vehicleId:            vehicle?.id ?? vehicle?._id ?? null,
  };
};

// ─────────────────────────────────────────────────────────────
// ✅ View tab: maps one item of GET /api/trip  →  VehicleCard shape
//
//   Response item (from Postman):
//   { trip_id, vehicle_id: null | {..}, route_id: { _id, name, place_from,
//     place_to, source:[..], ... }, driver_id?, trip_approval_status?, ... }
//
//   Every field is read defensively because vehicle_id can be null
//   (trip created but no vehicle assigned yet).
// ─────────────────────────────────────────────────────────────
const mapTripToViewVehicle = (item, driverById = {}) => {
  const tripId = item.trip_id ?? item._id ?? null;

  const vehicleRaw = item.vehicle_id ?? item.vehicle ?? null;
  const vehicleDoc = vehicleRaw && typeof vehicleRaw === 'object' ? vehicleRaw : null;
  const vehicleId  =
    vehicleDoc?._id ?? vehicleDoc?.id ??
    (typeof vehicleRaw === 'string' ? vehicleRaw : null);

  const routeRaw = item.route_id ?? item.route ?? null;
  const route    = routeRaw && typeof routeRaw === 'object' ? routeRaw : null;

  const driver    = resolveDriver(item.driver_id ?? item.driver, driverById);
  const hasDriver = !!driver;

  const rawCoords        = route?.geometry?.coordinates ?? [];
  const routeCoordinates = rawCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

  const regNo =
    vehicleDoc?.registration_number ?? item.registration_number ?? null;
  const makeModel =
    `${vehicleDoc?.make ?? ''} ${vehicleDoc?.model ?? ''}`.trim();

  return {
    // card key / navigation id (vehicle id when known, otherwise the trip id)
    id:                 vehicleId ?? tripId ?? Math.random().toString(),
    apiId:              vehicleId ?? '',
    tripId,             // ✅ passed on to PlayRoute → Arrival Entry
    name:               regNo ?? 'Vehicle not assigned',
    registrationNumber: regNo ?? '',
    company:            makeModel || route?.name || 'Unknown Model',
    driver:             hasDriver ? getDriverName(driver) : 'No Driver Assigned',
    driverPhone:        hasDriver ? getDriverPhone(driver) : '',
    hasDriver,
    source:      { lat: '', lng: '', label: route?.place_from ?? 'Source' },
    destination: { lat: '', lng: '', label: route?.place_to   ?? 'Destination' },
    status:        'Idle',
    location:      vehicleDoc?.last_location ?? route?.name ?? '—',
    cardColor:     '#3477eb',
    statusColor:   '#6366f1',
    currentSpeed:  0,
    maxSpeed:      0,
    avgSpeed:      0,
    overspeedLimit: OVERSPEED_LIMIT,
    overspeedCount: 0,
    geofenceCount:  0,
    geofenceAlert:  false,
    totalDistance:  '0 km',
    direction:      null,
    lastUpdate:     '—',
    description:    '',
    // used by PlayRoute to draw the planned route
    preloadedRouteCoordinates: routeCoordinates,
    preloadedRouteName:        route?.name ?? null,
    sourceLabel:               route?.place_from ?? 'Source',
    destLabel:                 route?.place_to   ?? 'Destination',
  };
};

// ══════════════════════════════════════════════════════════════
// THREE-DOT MENU
// ══════════════════════════════════════════════════════════════
const ThreeDotMenu = ({ vehicle, navigation }) => {
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
      <TouchableOpacity style={styles.threeDotBtn} onPress={() => setVisible(true)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} activeOpacity={0.7}>
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
              <TouchableOpacity key={item.label}
                style={[styles.menuItem, i === menuItems.length - 1 && styles.menuItemLast]}
                onPress={item.onPress} activeOpacity={0.7}>
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
  const hasDriver   = !!vehicle.hasDriver;
  const statusPillBg =
    vehicle.status === 'Moving' ? 'rgba(22,163,74,0.85)' :
    vehicle.status === 'Parked' ? 'rgba(217,119,6,0.85)' :
                                  'rgba(99,102,241,0.85)';
  const handleWhatsApp = useCallback(() => {
    const phone = (vehicle.driverPhone || '').replace(/\D/g, '');
    if (!phone) { Alert.alert('No driver assigned', 'No phone number available.'); return; }
    Linking.openURL(`whatsapp://send?phone=91${phone}`).catch(() => Alert.alert('WhatsApp not installed'));
  }, [vehicle.driverPhone]);
  const handleCall = useCallback(() => {
    if (!vehicle.driverPhone) { Alert.alert('No driver assigned', 'No phone number available.'); return; }
    Linking.openURL(`tel:${vehicle.driverPhone}`).catch(() => Alert.alert('Error', 'Unable to make a call.'));
  }, [vehicle.driverPhone]);

  return (
    <View style={styles.card}>
      {/* ── TOP BAND ── */}
      <LinearGradient colors={[vehicle.cardColor, vehicle.cardColor + 'cc']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardBand}>
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
            <Switch value={ignitionOn} onValueChange={() => setIgnitionOn(v => !v)}
              trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#bbf7d0' }}
              thumbColor={ignitionOn ? '#16a34a' : 'rgba(255,255,255,0.7)'}
              ios_backgroundColor="rgba(255,255,255,0.25)" style={styles.ignSwitch} />
            <Text style={styles.ignLabel}>Ignition</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── BODY ── */}
      <TouchableOpacity activeOpacity={0.7}
        onPress={() => navigation.navigate('VehicleDetail', { vehicle })} style={styles.cardBody}>

        {/* Driver row */}
        <View style={styles.driverRow}>
          <View style={[styles.driverIconWrap, { backgroundColor: hasDriver ? '#eff6ff' : '#F1F5F9' }]}>
            <Icon name="account-tie" size={16} color={hasDriver ? '#3477eb' : '#94a3b8'} />
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, !hasDriver && styles.driverNameEmpty]}>{vehicle.driver}</Text>
          </View>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }, !hasDriver && styles.contactBtnDisabled]}
            onPress={handleWhatsApp} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="whatsapp" size={15} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', marginLeft: 5 }, !hasDriver && styles.contactBtnDisabled]}
            onPress={handleCall} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Icon name="phone" size={15} color="#3477eb" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── STATS ROW (5 columns) ── */}
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
              <Text style={[styles.statVal, { color: vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8' }]}>
                {vehicle.geofenceCount}
              </Text>
              {vehicle.geofenceCount > 0 && <View style={styles.amberDotBadge} />}
            </View>
            <Text style={[styles.statLbl, { color: vehicle.geofenceCount > 0 ? '#f59e0b' : '#94a3b8' }]}>
              Geofence
            </Text>
            {vehicle.geofenceCount > 0 && (
              <View style={styles.geofencePill}><Text style={styles.geofencePillTxt}>Alert</Text></View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── SECONDARY STATS ── */}
        <View style={styles.statsRowSecondary}>
          <View style={styles.secStatItem}>
            <Icon name="map-marker-distance" size={12} color={vehicle.cardColor} />
            <Text style={styles.secStatVal}>{vehicle.totalDistance ?? '0 km'}</Text>
            <Text style={styles.secStatLbl}>Today's Distance</Text>
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
        </View>

        <View style={styles.divider} />

        {/* Source / Destination */}
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

        {/* Location */}
        <View style={styles.locationRow}>
          <Icon name="map-marker-outline" size={12} color="#94a3b8" />
          <Text style={styles.locationTxt} numberOfLines={3}>{vehicle.location || '—'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── ACTION BUTTONS ── */}
      <View style={styles.actionsRow}>
        {[
          { icon: 'play-circle-outline',  label: 'Play Route',    onPress: () => navigation.navigate('PlayRoute', { vehicle }) },
          { icon: 'map-clock-outline',     label: 'Route History', onPress: () => navigation.navigate('VehicleDetail', { vehicle }) },
          { icon: 'share-variant-outline', label: 'Share',
            onPress: async () => {
              try { await Share.share({ message: `🚗 ${vehicle.name} · ${vehicle.status}\n📍 ${vehicle.location}\nDriver: ${vehicle.driver}`, title: vehicle.name }); } catch (_) {}
            },
          },
          { icon: 'file-chart-outline', label: 'Reports', onPress: () => navigation.navigate('Reports', { vehicle }) },
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
// TRIP CARD
// ══════════════════════════════════════════════════════════════
const TripCard = ({ route, tab, onApprove, onReject, onDepart, onArrive, busy, navigation }) => {
  const handleCall = useCallback(() => {
    Linking.openURL(`tel:${route.driverPhone}`).catch(() => {});
  }, [route.driverPhone]);
  const handleWhatsApp = useCallback(() => {
    const phone = (route.driverPhone || '').replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=91${phone}`).catch(() => {});
  }, [route.driverPhone]);
  const handleCardPress = useCallback(() => {
    const vehiclePayload = {
      id:                        route.vehicleId ?? route._assignmentId,
      _id:                       route.vehicleId ?? route._assignmentId,
      name:                      route.vehicleRegNo,
      registrationNumber:        route.vehicleRegNo,
      company:                   route.vehicleMake,
      driver:                    route.driverName,
      driverPhone:               route.driverPhone,
      status:                    route.departureStatus,
      cardColor:                 '#3477eb',
      preloadedRouteCoordinates: route.routeCoordinates ?? [],
      preloadedRouteName:        route.routeName,
      sourceLabel:               route.sourceLabel,
      destLabel:                 route.destLabel,
      tripTab:                   tab,
      tripRoute:                 route,
    };
    navigation.navigate('PlayRoute', { vehicle: vehiclePayload });
  }, [route, navigation, tab]);

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={handleCardPress}>
      <View style={styles.tripCard}>
        {/* ── TOP BAND ── */}
        <LinearGradient colors={['#3477eb', '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.tripBand}>
          <View style={styles.tripBandLeft}>
            <View style={styles.tripTruckWrap}>
              <Icon name="truck" size={16} color="#3477eb" />
            </View>
            <View>
              <Text style={styles.tripRegNo}>{route.vehicleRegNo}</Text>
              <Text style={styles.tripMake}>{route.vehicleMake}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.viewRoutePill}>
              <Icon name="map-marker-path" size={10} color="rgba(255,255,255,0.9)" />
              <Text style={styles.viewRouteTxt}>View Route</Text>
            </View>
            <View style={[styles.tripApprovalPill, {
              backgroundColor: route.approvalStatusColor + '25',
              borderColor:     route.approvalStatusColor + '60',
            }]}>
              <View style={[styles.tripApprovalDot, { backgroundColor: route.approvalStatusColor }]} />
              <Text style={[styles.tripApprovalTxt, { color: '#fff' }]}>{route.approvalStatus}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.tripBody}>
          {/* Driver row */}
          <View style={styles.tripDriverRow}>
            <View style={styles.tripDriverIconWrap}>
              <Icon name="account-tie" size={13} color="#3477eb" />
            </View>
            <Text style={styles.tripDriverName}>{route.driverName}</Text>
            <TouchableOpacity style={[styles.tripContactBtn, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}
              onPress={handleWhatsApp} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="whatsapp" size={12} color="#16a34a" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tripContactBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', marginLeft: 4 }]}
              onPress={handleCall} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="phone" size={12} color="#3477eb" />
            </TouchableOpacity>
          </View>
          <View style={styles.tripDivider} />

          {/* Route name */}
          <View style={styles.tripRouteRow}>
            <View style={styles.tripRouteIconWrap}>
              <Icon name="routes" size={12} color="#3477eb" />
            </View>
            <Text style={styles.tripRouteName}>{route.routeName}</Text>
            <View style={styles.tripGeofencePill}>
              <Icon name="radius-outline" size={9} color="#f59e0b" />
              <Text style={styles.tripGeofenceTxt}>{route.geofenceRadius}m</Text>
            </View>
          </View>
          <View style={styles.tripDivider} />

          {/* Source / Destination */}
          <View style={styles.tripSrcDestRow}>
            <View style={styles.tripSrcDestPoint}>
              <View style={[styles.tripSrcDestDot, { backgroundColor: '#16a34a' }]} />
              <Text style={styles.tripSrcDestLabel} numberOfLines={2}>{route.sourceLabel}</Text>
            </View>
            <View style={styles.tripSrcDestLine}>
              <View style={styles.tripSrcDash} />
              <Icon name="truck-fast-outline" size={13} color="#3477eb" />
              <View style={styles.tripSrcDash} />
            </View>
            <View style={styles.tripSrcDestPoint}>
              <View style={[styles.tripSrcDestDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.tripSrcDestLabel} numberOfLines={2}>{route.destLabel}</Text>
            </View>
          </View>
          <View style={styles.tripDivider} />

          {/* Status pills */}
          <View style={styles.tripStatusRow}>
            <View style={[styles.tripStatusChip, {
              backgroundColor: route.approvalStatusColor + '15',
              borderColor:     route.approvalStatusColor + '40',
            }]}>
              <Icon name="shield-check-outline" size={11} color={route.approvalStatusColor} />
              <View>
                <Text style={styles.tripStatusChipLbl}>Approval</Text>
                <Text style={[styles.tripStatusChipVal, { color: route.approvalStatusColor }]}>{route.approvalStatus}</Text>
              </View>
            </View>
            <View style={[styles.tripStatusChip, {
              backgroundColor: route.departureStatusColor + '15',
              borderColor:     route.departureStatusColor + '40',
            }]}>
              <Icon name="bus-clock" size={11} color={route.departureStatusColor} />
              <View>
                <Text style={styles.tripStatusChipLbl}>Departure</Text>
                <Text style={[styles.tripStatusChipVal, { color: route.departureStatusColor }]}>{route.departureStatus}</Text>
              </View>
            </View>
          </View>
          <View style={styles.tripDivider} />

          {/* Times grid */}
          <View style={styles.tripTimesGrid}>
            <View style={styles.tripTimeBlock}>
              <View style={styles.tripTimeHeader}>
                <Icon name="map-marker-check-outline" size={11} color="#16a34a" />
                <Text style={styles.tripTimeTitle}>Departure</Text>
              </View>
              <Text style={styles.tripTimeVal}>{route.departureTime}</Text>
              <View style={styles.tripTimeDateRow}>
                <Icon name="calendar-outline" size={9} color="#94a3b8" />
                <Text style={styles.tripTimeDate}>{route.departureDate}</Text>
              </View>
            </View>
            <View style={styles.tripTimesDivider} />
            <View style={styles.tripTimeBlock}>
              <View style={styles.tripTimeHeader}>
                <Icon name="map-marker-outline" size={11} color="#ef4444" />
                <Text style={styles.tripTimeTitle}>Arrival</Text>
              </View>
              <Text style={styles.tripTimeVal}>{route.arrivalTime}</Text>
              <View style={styles.tripTimeDateRow}>
                <Icon name="calendar-outline" size={9} color="#94a3b8" />
                <Text style={styles.tripTimeDate}>{route.arrivalDate}</Text>
              </View>
            </View>
            <View style={styles.tripTimesDivider} />
            <View style={styles.tripTimeBlock}>
              <View style={styles.tripTimeHeader}>
                <Icon name="clipboard-check-outline" size={11} color="#6366f1" />
                <Text style={styles.tripTimeTitle}>Assigned</Text>
              </View>
              <Text style={styles.tripTimeVal}>{route.assignedTime}</Text>
              <View style={styles.tripTimeDateRow}>
                <Icon name="calendar-outline" size={9} color="#94a3b8" />
                <Text style={styles.tripTimeDate}>{route.assignedDate}</Text>
              </View>
            </View>
          </View>
          <View style={styles.tripDivider} />

          {tab === 'review' && route.submittedBy && (
            <View style={styles.tripMetaRow}>
              <Icon name="account-outline" size={11} color="#64748B" />
              <Text style={styles.tripMetaTxt}>
                Submitted by <Text style={styles.tripMetaBold}>{route.submittedBy}</Text>
              </Text>
            </View>
          )}
          {tab === 'approved' && route.approvedBy && (
            <View style={styles.tripMetaRow}>
              <Icon name="shield-check-outline" size={11} color="#4CAF50" />
              <Text style={styles.tripMetaTxt}>
                Approved by <Text style={styles.tripMetaBold}>{route.approvedBy}</Text>
              </Text>
              <Text style={styles.tripMetaDot}>•</Text>
              <Icon name="calendar-check-outline" size={11} color="#64748B" />
              <Text style={styles.tripMetaTxt}>{route.approvedOn}</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.tripActions}>
          {tab === 'review' && (
            <>
              <TouchableOpacity style={styles.tripApproveBtn} activeOpacity={0.8}
                onPress={() => onApprove && onApprove(route)}>
                <Icon name="check-circle-outline" size={14} color="#4CAF50" />
                <Text style={styles.tripApproveTxt}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tripRejectBtn} activeOpacity={0.8}
                onPress={() => onReject && onReject(route)}>
                <Icon name="close-circle-outline" size={14} color="#F44336" />
                <Text style={styles.tripRejectTxt}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {/* ✅ Approved tab: Departure + Arrival (replaces Approve + Archive) */}
          {tab === 'approved' && (
            <>
              <TouchableOpacity
                style={[styles.tripApproveBtn, busy && styles.tripBtnBusy]}
                activeOpacity={0.8}
                disabled={busy}
                onPress={() => onDepart && onDepart(route)}
              >
                {busy
                  ? <ActivityIndicator size="small" color="#4CAF50" />
                  : <Icon name="truck-fast-outline" size={14} color="#4CAF50" />}
                <Text style={styles.tripApproveTxt}>Departure</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tripArrivalBtn, busy && styles.tripBtnBusy]}
                activeOpacity={0.8}
                disabled={busy}
                onPress={() => onArrive && onArrive(route)}
              >
                <Icon name="map-marker-check-outline" size={14} color="#3477eb" />
                <Text style={styles.tripArrivalTxt}>Arrival</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════
const RouteManagementScreen = ({ navigation }) => {
  const [activeTab,        setActiveTab]        = useState('view');
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
  const [apiViewVehicles,  setApiViewVehicles]  = useState([]);
  const [tripItems,        setTripItems]        = useState([]);
  const [isFetchingTrips,  setIsFetchingTrips]  = useState(false);
  const [reviewBadge,      setReviewBadge]      = useState('');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [busyTripId,       setBusyTripId]       = useState(null);   // ✅ trip currently being updated

  // ✅ The bottom tab bar is `position: 'absolute'`, so it floats OVER the screen.
  //    Read its real height (already includes the safe-area inset) and use it as
  //    bottom padding so the last card can scroll fully above the tab bar.
  //    Falls back to a safe estimate if this screen is ever rendered outside tabs.
  const insets          = useSafeAreaInsets();
  const tabBarHeight    = useContext(BottomTabBarHeightContext);
  const bottomSpacing   = (tabBarHeight ?? (Platform.OS === 'ios' ? 55 : 65) + insets.bottom) + LIST_BOTTOM_GAP;

  const apiViewVehiclesRef = useRef([]);
  const wsRef              = useRef(null);

  // ── WebSocket ────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS RouteManagement] Connected');
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'live' || data.type === 'replay' || data.speed !== undefined) {
          // ✅ ignore messages without a vehicle id (and trips with no vehicle yet)
          if (!data.vehicle_id) return;

          const applyUpdate = (vehicle) => {
            const matched =
              (!!vehicle.apiId && vehicle.apiId === data.vehicle_id) ||
              (!!vehicle.id    && vehicle.id    === data.vehicle_id);
            if (!matched) return vehicle;
            return {
              ...vehicle,
              currentSpeed:  data.speed         != null ? Number(data.speed)                      : vehicle.currentSpeed,
              maxSpeed:      data.max_speed      != null ? Number(data.max_speed)                  : vehicle.maxSpeed,
              avgSpeed:      data.avg_speed      != null ? Number(data.avg_speed)                  : vehicle.avgSpeed,
              totalDistance: data.total_distance != null
                               ? `${parseFloat(data.total_distance).toFixed(1)} km`
                               : vehicle.totalDistance,
              location:      data.position_name  ?? vehicle.location,
              direction:     data.direction      != null ? data.direction                           : vehicle.direction,
              status:        data.state          ? normStatus(data.state)                          : vehicle.status,
              geofenceCount: data.geofence_status != null ? (data.geofence_status ? 1 : 0)         : vehicle.geofenceCount,
              geofenceAlert: data.geofence_status != null ? !!data.geofence_status                 : vehicle.geofenceAlert,
              lastUpdate:    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          };

          const updatedApiVehicles = apiViewVehiclesRef.current.map(applyUpdate);
          const changed = updatedApiVehicles.some((v, i) => v !== apiViewVehiclesRef.current[i]);
          if (changed) {
            apiViewVehiclesRef.current = updatedApiVehicles;
            setApiViewVehicles(updatedApiVehicles);
          }
        }
      } catch (e) {
        console.warn('[WS RouteManagement] Parse error:', e.message);
      }
    };

    ws.onerror = (e) => console.warn('[WS RouteManagement] Error:', e.message);
    ws.onclose = () => {
      console.log('[WS RouteManagement] Closed — reconnecting in 4s');
      setTimeout(() => connectWebSocket(), 4000);
    };
  }, []);

  // ── Fetch trips for the View tab ──────────────────────────────
  //   ✅ GET /api/trip?page=1&limit=100
  //      Response: { page, limit, total, totalPages, data: [ { trip_id, vehicle_id,
  //                  route_id: {...}, ... } ] }
  const fetchRoutes = useCallback(async () => {
    setIsFetchingRoutes(true);
    try {
      const [data, driversData] = await Promise.all([
        apiGet(VIEW_TRIPS_ENDPOINT),
        // drivers are only used to resolve names — never fail the whole tab because of them
        apiGet(ENDPOINTS.DRIVERS).catch((e) => {
          console.warn('Drivers fetch failed (non-fatal):', e.message);
          return [];
        }),
      ]);

      const list = Array.isArray(data) ? data : (data?.data ?? data?.trips ?? []);
      const driversList = Array.isArray(driversData)
        ? driversData
        : (driversData?.drivers ?? driversData?.data ?? []);

      const driverById = {};
      driversList.forEach((d) => { if (d?._id) driverById[d._id] = d; });

      console.log(`🧭 View tab: ${list.length} trips (total on server: ${data?.total ?? '?'})`);

      const viewVehicles = list.map((item) => mapTripToViewVehicle(item, driverById));

      apiViewVehiclesRef.current = viewVehicles;
      setApiViewVehicles(viewVehicles);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch trips: ' + error.message);
    } finally {
      setIsFetchingRoutes(false);
    }
  }, []);

  // ── Fetch trips (Review / Approved tabs) ─────────────────────
  const fetchTrips = useCallback(async (tab) => {
    if (tab === 'view') return;
    setIsFetchingTrips(true);
    setTripItems([]);
    try {
      // ✅ Approved tab now shows only trips that are APPROVED and not yet departed:
      //    /api/trip/status?trip_approval_status=APPROVED&trip_dep_status=AWAITED
      const endpoint = tab === 'review' ? ENDPOINTS.TRIPS_PENDING : ENDPOINTS.TRIPS_APPROVED_AWAITED;
      const [data, driversData] = await Promise.all([
        apiGet(endpoint),
        apiGet(ENDPOINTS.DRIVERS),
      ]);
      const list        = Array.isArray(data) ? data : (data?.data ?? []);
      const driversList = Array.isArray(driversData) ? driversData : (driversData?.drivers ?? driversData?.data ?? []);

      const driverById = {};
      driversList.forEach((d) => { if (d?._id) driverById[d._id] = d; });

      const mapped = list.map((item) => mapApiTripToCard(item, driverById));
      setTripItems(mapped);
      // ✅ badge shows the real number of pending trips (no dummy +1)
      if (tab === 'review') setReviewBadge(mapped.length > 0 ? String(mapped.length) : '');
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch trips: ' + error.message);
    } finally {
      setIsFetchingTrips(false);
    }
  }, []);

  // ── Review tab: Approve ──────────────────────────────────────
  const handleApprove = useCallback((route) => {
    Alert.alert('Approve Trip', `Approve trip for ${route.vehicleRegNo}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', style: 'default',
        onPress: async () => {
          try {
            await apiPut(ENDPOINTS.TRIP_APPROVE(route._assignmentId), { trip_approval_status: 'APPROVED' });
            Alert.alert('Success', 'Trip approved successfully!');
            fetchTrips('review');
          } catch (err) {
            Alert.alert('Error', 'Could not update trip: ' + err.message);
          }
        },
      },
    ]);
  }, [fetchTrips]);

  // ── Review tab: Reject ───────────────────────────────────────
  const handleReject = useCallback((route) => {
    Alert.alert('Reject Trip', `Reject trip for ${route.vehicleRegNo}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          try {
            await apiPut(ENDPOINTS.TRIP_REJECT(route._assignmentId), { trip_approval_status: 'CANCELLED' });
            Alert.alert('Done', 'Trip rejected.');
            fetchTrips('review');
          } catch (err) {
            Alert.alert('Error', 'Could not reject trip: ' + err.message);
          }
        },
      },
    ]);
  }, [fetchTrips]);

  // ─────────────────────────────────────────────────────────────
  // ✅ Approved tab: shared helper — calls the API, then shows the
  //    API's response message in a dialog and refreshes the list.
  // ─────────────────────────────────────────────────────────────
  const runTripStatusUpdate = useCallback(async (route, endpoint, body, successTitle) => {
    setBusyTripId(route.id);
    try {
      const response = await apiPut(endpoint, body);
      console.log('✅ Trip status response:', JSON.stringify(response, null, 2));
      Alert.alert(successTitle, formatApiResponse(response));
      fetchTrips('approved');
    } catch (err) {
      Alert.alert('Error', 'Could not update trip: ' + err.message);
    } finally {
      setBusyTripId(null);
    }
  }, [fetchTrips]);

  // ✅ Departure button -> confirm dialog -> Yes -> API -> show response
  const handleDepart = useCallback((route) => {
    Alert.alert(
      'Mark as Departed',
      `Has the vehicle ${route.vehicleRegNo} departed?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () =>
            runTripStatusUpdate(
              route,
              ENDPOINTS.TRIP_DEPART(route._assignmentId),
              { trip_dep_status: DEPARTED_STATUS },
              'Departure Updated',
            ),
        },
      ],
    );
  }, [runTripStatusUpdate]);

  // ✅ Arrival button -> confirm dialog -> Yes -> API -> show response
  const handleArrive = useCallback((route) => {
    Alert.alert(
      'Mark as Arrived',
      `Has the vehicle ${route.vehicleRegNo} arrived at ${route.destLabel}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () =>
            runTripStatusUpdate(
              route,
              ENDPOINTS.TRIP_ARRIVE(route._assignmentId),
              { trip_dep_status: ARRIVED_STATUS },
              'Arrival Updated',
            ),
        },
      ],
    );
  }, [runTripStatusUpdate]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    if (tab === 'view') fetchRoutes();
    else fetchTrips(tab);
  }, [fetchRoutes, fetchTrips]);

  // ── Mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetchRoutes();
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (activeTab === 'view') fetchRoutes();
      else fetchTrips(activeTab);
    });
    return unsubscribe;
  }, [navigation, activeTab, fetchRoutes, fetchTrips]);

  // ── Filtering ────────────────────────────────────────────────
  const filteredApiViewVehicles = apiViewVehicles.filter(v =>
    v.name?.toLowerCase().includes(searchQuery.toLowerCase())           ||
    v.driver?.toLowerCase().includes(searchQuery.toLowerCase())         ||
    v.company?.toLowerCase().includes(searchQuery.toLowerCase())        ||
    v.source?.label?.toLowerCase().includes(searchQuery.toLowerCase())  ||
    v.destination?.label?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTripItems = tripItems.filter(r =>
    r.routeName?.toLowerCase().includes(searchQuery.toLowerCase())    ||
    r.vehicleRegNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.driverName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TABS = [
    { key: 'view',     label: 'Active Trips' },
    { key: 'review',   label: 'Review', badge: reviewBadge },
    { key: 'approved', label: 'Approved' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#3477eb', '#2563eb']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
          <Icon name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trips</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddTrip')}>
         <Icon name="map-marker-plus-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#64748B" />
          <TextInput style={styles.searchInput} placeholder="Search by route, vehicle, driver..."
            value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8" />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.pillTabsWrapper}>
        <View style={styles.pillTabsTrack}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key}
                style={[styles.pillTab, isActive && styles.pillTabActive]}
                onPress={() => handleTabChange(tab.key)} activeOpacity={0.75}>
                <Text style={[styles.pillTabText, isActive && styles.pillTabTextActive]}>{tab.label}</Text>
                {tab.badge ? (
                  <View style={[styles.pillBadge, isActive && styles.pillBadgeActive]}>
                    <Text style={[styles.pillBadgeText, isActive && styles.pillBadgeTextActive]}>{tab.badge}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ✅ paddingBottom = tab bar height + gap, so the last card clears the bottom tabs
           in ALL three tabs (Active Trips / Review / Approved) */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: bottomSpacing }]}
        showsVerticalScrollIndicator={false}>

        {/* ── VIEW TAB  (GET /api/trip) ── */}
        {activeTab === 'view' && (
          isFetchingRoutes ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3477eb" />
              <Text style={styles.loadingText}>Loading trips...</Text>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {filteredApiViewVehicles.length > 0 ? (
                filteredApiViewVehicles.map((vehicle, idx) => (
                  <VehicleCard
                    key={vehicle.tripId ?? `${vehicle.id}-${idx}`}
                    vehicle={vehicle}
                    navigation={navigation}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Icon name="routes-clock" size={80} color="#CBD5E1" />
                  <Text style={styles.emptyStateText}>
                    {searchQuery ? 'No matching trips' : 'No trips available'}
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {searchQuery ? 'Try a different search term' : 'Tap + to add a trip'}
                  </Text>
                </View>
              )}
            </View>
          )
        )}

        {/* ── REVIEW / APPROVED TABS ── */}
        {activeTab !== 'view' && (
          isFetchingTrips ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3477eb" />
              <Text style={styles.loadingText}>
                {activeTab === 'review' ? 'Loading pending trips...' : 'Loading approved trips...'}
              </Text>
            </View>
          ) : filteredTripItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name={activeTab === 'review' ? 'clipboard-clock-outline' : 'shield-off-outline'}
                size={80} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No matching routes'
                  : activeTab === 'review' ? 'No trips pending review' : 'No approved trips yet'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery ? 'Try a different search term' : 'Tap + to add a trip'}
              </Text>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {filteredTripItems.map(route => (
                <TripCard key={route.id} route={route} tab={activeTab}
                  onApprove={handleApprove} onReject={handleReject}
                  onDepart={handleDepart} onArrive={handleArrive}
                  busy={busyTripId === route.id}
                  navigation={navigation} />
              ))}
            </View>
          )
        )}
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
  menuButton:  { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  addButton:   { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchWrapper:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 2,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 8,
  },
  searchInput:     { flex: 1, fontSize: 14, color: '#1E293B' },
  pillTabsWrapper: { paddingHorizontal: 16, paddingVertical: 12 },
  pillTabsTrack:   { flexDirection: 'row', backgroundColor: '#DDE3ED', borderRadius: 30, padding: 4 },
  pillTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 26, gap: 6,
  },
  pillTabActive: {
    backgroundColor: '#3477eb',
    shadowColor: '#3477eb', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 5,
  },
  pillTabText:         { fontSize: 13, fontWeight: '600', color: '#64748B' },
  pillTabTextActive:   { color: '#FFFFFF' },
  pillBadge: {
    backgroundColor: '#FF9800', borderRadius: 8,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  pillBadgeActive:     { backgroundColor: '#FFFFFF' },
  pillBadgeText:       { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  pillBadgeTextActive: { color: '#3477eb' },
  scrollContent:          { flex: 1, paddingHorizontal: 14 },
  // paddingBottom is applied dynamically (tab bar height + gap) in the component
  scrollContentContainer: { paddingTop: 4 },
  listWrapper:   { gap: 12 },
  loadingContainer:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText:       { fontSize: 16, color: '#64748B', marginTop: 16, fontWeight: '500' },
  emptyState:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyStateText:    { fontSize: 18, fontWeight: '600', color: '#64748B', marginTop: 8 },
  emptyStateSubtext: { fontSize: 14, color: '#94A3B8', marginTop: 4 },

  // ── Vehicle card ──
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
  ignSwitch:    { transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] },
  ignLabel:     { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: 'rgba(255,255,255,0.75)' },
  cardBody:       { paddingTop: 10, paddingHorizontal: 12 },
  driverRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  driverIconWrap: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  driverInfo:     { flex: 1 },
  driverName:     { fontSize: 12, color: '#1e293b', fontWeight: '700' },
  driverNameEmpty:{ color: '#94a3b8', fontWeight: '600', fontStyle: 'italic' },
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
  geofencePillTxt:   { fontSize: 6.5, color: '#f59e0b', fontWeight: '800' },
  statsRowSecondary: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  secStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  secStatVal:  { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  secStatLbl:  { fontSize: 9.5, color: '#64748B', fontWeight: '500' },
  locationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    backgroundColor: '#F8FAFC', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 6, marginBottom: 10,
  },
  locationTxt: { flex: 1, fontSize: 10.5, color: '#64748B', fontWeight: '500', lineHeight: 15 },
  srcDestRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  srcDestPoint: { flex: 1, alignItems: 'center', gap: 4 },
  srcDestDot:   { width: 8, height: 8, borderRadius: 4 },
  srcDestLabel: { fontSize: 10, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  srcDestLine:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  srcDestDash:  { flex: 1, height: 1, backgroundColor: '#cbd5e1' },
  actionsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 3 },
  actionSep:  { width: 1, backgroundColor: '#F1F5F9', marginVertical: 7 },
  actionLbl:  { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },

  // ── Trip card ──
  tripCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  tripBand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 11, paddingVertical: 7,
  },
  tripBandLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  tripTruckWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center',
  },
  tripRegNo: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  tripMake:  { fontSize: 9.5, color: 'rgba(255,255,255,0.78)', fontWeight: '500' },
  viewRoutePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  viewRouteTxt:     { fontSize: 9, color: 'rgba(255,255,255,0.95)', fontWeight: '700' },
  tripApprovalPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  tripApprovalDot: { width: 5, height: 5, borderRadius: 2.5 },
  tripApprovalTxt: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.2 },
  tripBody:        { paddingHorizontal: 11, paddingTop: 8 },
  tripDivider:     { height: 1, backgroundColor: '#F1F5F9', marginBottom: 7 },
  tripDriverRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  tripDriverIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  tripDriverName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1e293b' },
  tripContactBtn: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  tripRouteRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  tripRouteIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  tripRouteName:  { flex: 1, fontSize: 12, fontWeight: '700', color: '#1e293b' },
  tripGeofencePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  tripGeofenceTxt:  { fontSize: 9.5, color: '#f59e0b', fontWeight: '700' },
  tripSrcDestRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 7,
  },
  tripSrcDestPoint: { flex: 1, alignItems: 'center', gap: 3 },
  tripSrcDestDot:   { width: 7, height: 7, borderRadius: 3.5 },
  tripSrcDestLabel: { fontSize: 9.5, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  tripSrcDestLine:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  tripSrcDash:      { flex: 1, height: 1, backgroundColor: '#cbd5e1' },
  tripStatusRow: { flexDirection: 'row', gap: 7, marginBottom: 7 },
  tripStatusChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1,
  },
  tripStatusChipLbl: { fontSize: 8.5, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2 },
  tripStatusChipVal: { fontSize: 11, fontWeight: '800' },
  tripTimesGrid: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: '#F8FAFC', borderRadius: 8, paddingVertical: 7, marginBottom: 7,
  },
  tripTimeBlock:    { flex: 1, alignItems: 'center', gap: 2 },
  tripTimesDivider: { width: 1, backgroundColor: '#E2E8F0', marginVertical: 3 },
  tripTimeHeader:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tripTimeTitle:    { fontSize: 8.5, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 },
  tripTimeVal:      { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  tripTimeDateRow:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tripTimeDate:     { fontSize: 8.5, color: '#94a3b8', fontWeight: '500' },
  tripMetaRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4,
    backgroundColor: '#F8FAFC', borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8,
  },
  tripMetaTxt:  { fontSize: 10.5, color: '#64748B' },
  tripMetaBold: { fontWeight: '700', color: '#1e293b' },
  tripMetaDot:  { color: '#CBD5E1', marginHorizontal: 2 },
  tripActions:    { flexDirection: 'row', gap: 0, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  tripApproveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, backgroundColor: '#4CAF5012', gap: 5 },
  tripApproveTxt: { fontSize: 12, fontWeight: '700', color: '#4CAF50' },
  tripRejectBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, backgroundColor: '#F4433612', gap: 5, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  tripRejectTxt:  { fontSize: 12, fontWeight: '700', color: '#F44336' },
  // ✅ Arrival button (Approved tab)
  tripArrivalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, backgroundColor: '#3477eb12', gap: 5, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  tripArrivalTxt: { fontSize: 12, fontWeight: '700', color: '#3477eb' },
  tripBtnBusy:    { opacity: 0.55 },
});

export default RouteManagementScreen;