// RoutePlayDetailScreen.js
// When opened from a TripCard (Review tab), shows Approve + Reject buttons in the bottom bar.
// When opened from Approved tab, View tab, or the Vehicles list (vehicle has a tripId),
// shows an "Arrival Entry" button that expands a form (arrival status, actual arrival time,
// notes) and submits it to the trip status API: PUT /api/trip/{tripId}/status
//
// ✅ tripId now also comes from the Vehicles list API
//    (GET /api/assignments/gps-vehicle/client → "tripId") via vehicle.tripId
//
// ✅ WebSocket updated to match the working web (React JS) implementation:
//    - URL:  wss://vlts.nutanteksolutions.cloud/ws
//    - subscribe message has NO vehicle_id  ->  { type: 'subscribe' }
//    - only 'live' / 'replay' messages are handled
//    - messages are matched on vehicle_id / device_id / imei against all known vehicle IDs
//    - coordinates read from coordinates | location.coordinates | lng+lat
//    - no reconnect loop after unmount / manual retry
//
// ✅ KEYBOARD FIX (Arrival Entry form) — simple page scroller:
//    - the whole area under the header (map + bottom bar) is ONE ScrollView
//    - when the keyboard opens, bottom padding = keyboard height, so the page
//      scrolls up and the Notes field sits just above the keyboard
//    - the map is NOT collapsed / hidden (no jumping)
//    - the page scroller is only active while the Arrival form is open, so the
//      map can still be dragged normally the rest of the time

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Alert, PermissionsAndroid, Platform, Animated,
  Dimensions, Share, Linking, TextInput, ScrollView,
  LayoutAnimation, UIManager, ActivityIndicator,
  Keyboard,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { apiPut, ENDPOINTS } from '../utils/Api';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ✅ Same URL as the working web app
const SIMULATOR_WS_URL = 'wss://vlts.nutanteksolutions.cloud/ws';

// ── Arrival status options (values sent to the API) ──────────────────────────
const ARRIVAL_OPTIONS = [
  { value: 'INTIME',  label: 'In Time', icon: 'clock-check-outline',  color: '#16a34a', bg: '#f0fdf4' },
  { value: 'ONTIME',  label: 'On Time', icon: 'check-circle-outline', color: '#3477eb', bg: '#eff6ff' },
  { value: 'DELAYED', label: 'Delayed', icon: 'clock-alert-outline',  color: '#ef4444', bg: '#fef2f2' },
];

const pad2 = (n) => String(n).padStart(2, '0');
// Date → "YYYY-MM-DD HH:mm" (local time) for the text input
const formatLocalInput = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const RoutePlayDetailScreen = ({ route, navigation }) => {
  const { vehicle } = route.params;

  // ── Pre-loaded route from TripCard navigation ──────────────────────────
  const preloadedCoords = vehicle.preloadedRouteCoordinates ?? [];
  const preloadedName   = vehicle.preloadedRouteName        ?? null;
  const hasPreloaded    = preloadedCoords.length >= 2;

  // Initial map center
  const initLat  = hasPreloaded ? preloadedCoords[0].latitude  : 28.6139;
  const initLng  = hasPreloaded ? preloadedCoords[0].longitude : 77.2090;
  const initZoom = hasPreloaded ? 10 : 15;

  const WS_ID = vehicle.id || vehicle._id;

  // ✅ Every ID the server might use to identify this vehicle (same idea as the web's
  //    getVehicleCandidates). Incoming messages are matched against ALL of these.
  const vehicleIds = [
    vehicle._id,
    vehicle.id,
    vehicle.vehicle_id,
    vehicle.vehicleId,
    vehicle.device_id,
    vehicle.deviceId,
    vehicle.imei,
    vehicle.registrationNumber,
    vehicle.registration_number,
  ].filter(Boolean).map(String);

  // ── Review tab context ─────────────────────────────────────────────────
  const isReviewTab = vehicle.tripTab === 'review';
  const tripRoute   = vehicle.tripRoute ?? null;
  const [actionDone, setActionDone] = useState(false);

  // ── Arrival entry context ──────────────────────────────────────────────
  // Trip ID sources, in priority order:
  //  1. tripRoute (opened from a TripCard)
  //  2. vehicle.tripId (opened from the Vehicles list; comes from
  //     GET /api/assignments/gps-vehicle/client → "tripId")
  const tripId =
    tripRoute?._assignmentId ??
    tripRoute?._id ??
    tripRoute?.tripId ??
    vehicle.tripId ??
    vehicle.trip_id ??
    vehicle._assignmentId ??
    null;

  // Show Arrival Entry only outside the Review tab AND only when a trip exists.
  // Vehicles with no running trip (tripId: null) have nothing to mark as arrived.
  // (To always show the bar with a warning banner instead, use: const showArrival = !isReviewTab;)
  const showArrival = !isReviewTab && !!tripId;

  useEffect(() => {
    console.log('🏁 Arrival debug →', {
      tripTab: vehicle.tripTab, isReviewTab, hasPreloaded, tripId, showArrival,
      vehicleKeys: Object.keys(vehicle || {}),
      vehicleIds,
    });
  }, []);

  const [arrivalOpen,       setArrivalOpen]       = useState(false);
  const [arrivalStatus,     setArrivalStatus]     = useState('ONTIME');
  const [arrivalTime,       setArrivalTime]       = useState(formatLocalInput(new Date()));
  const [arrivalNotes,      setArrivalNotes]      = useState('');
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [arrivalDone,       setArrivalDone]       = useState(false);

  // ✅ Keyboard tracking — the page scroller gets bottom padding = keyboard height,
  //    so the content can always be scrolled up above the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const pageScrollRef  = useRef(null);
  const arrivalOpenRef = useRef(false);
  arrivalOpenRef.current = arrivalOpen;

  // Scroll the page to the very bottom (Notes field + buttons live there)
  const scrollPageToEnd = (delay = 120) => {
    setTimeout(() => pageScrollRef.current?.scrollToEnd({ animated: true }), delay);
  };

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
      if (arrivalOpenRef.current) scrollPageToEnd(250);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Map / tracking state ───────────────────────────────────────────────
  const [vehicleLocation, setVehicleLocation] = useState({ latitude: initLat, longitude: initLng });
  const [userLocation,    setUserLocation]     = useState(null);
  const [status,          setStatus]           = useState('Connecting...');
  const [isConnected,     setIsConnected]      = useState(false);
  const [hasLocPerm,      setHasLocPerm]       = useState(false);
  const [isGettingLoc,    setIsGettingLoc]     = useState(false);
  const [regNum,          setRegNum]           = useState(vehicle.registrationNumber || vehicle.name || '--');
  const [isMoving,        setIsMoving]         = useState(false);
  const [vState,          setVState]           = useState('unknown');
  const [parkedLoc,       setParkedLoc]        = useState(null);
  const [parkedDur,       setParkedDur]        = useState(null);
  const [movingDriver,    setMovingDriver]     = useState(null);
  const [parkedDriver,    setParkedDriver]     = useState(null);
  const [routeName,       setRouteName]        = useState(preloadedName);
  const [routePoints,     setRoutePoints]      = useState([]);
  const [mapType,         setMapType]          = useState('street');

  // ── Live values updated from WS (override vehicle snapshot) ──
  const [liveSpeed,      setLiveSpeed]      = useState(vehicle.currentSpeed ?? 0);
  const [liveDist,       setLiveDist]       = useState(vehicle.totalDistance ?? '0 km');
  const [lastUpdateTime, setLastUpdateTime] = useState('10:45 AM');

  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const webViewRef  = useRef(null);
  const wsRef       = useRef(null);
  const reconnectTO = useRef(null);
  const prevLoc     = useRef(null);
  const mapReadyRef = useRef(false);
  const unmounted   = useRef(false); // ✅ stops reconnect loop after leaving the screen

  // ── Approve handler ────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    Alert.alert(
      'Approve Trip',
      `Approve trip for ${vehicle.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              await apiPut(
                ENDPOINTS.TRIP_APPROVE(tripRoute?._assignmentId),
                { trip_approval_status: 'APPROVED' }
              );
              setActionDone(true);
              Alert.alert('Success', 'Trip approved successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Error', 'Could not approve trip: ' + err.message);
            }
          },
        },
      ]
    );
  }, [tripRoute, vehicle.name, navigation]);

  // ── Reject handler ─────────────────────────────────────────────────────
  const handleReject = useCallback(() => {
    Alert.alert(
      'Reject Trip',
      `Reject trip for ${vehicle.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiPut(
                ENDPOINTS.TRIP_REJECT(tripRoute?._assignmentId),
                { trip_approval_status: 'CANCELLED' }
              );
              setActionDone(true);
              Alert.alert('Done', 'Trip rejected.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Error', 'Could not reject trip: ' + err.message);
            }
          },
        },
      ]
    );
  }, [tripRoute, vehicle.name, navigation]);

  // ── Arrival: expand / collapse ─────────────────────────────────────────
  const toggleArrival = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!arrivalOpen) setArrivalTime(formatLocalInput(new Date())); // refresh "now" when opening
    setArrivalOpen((v) => !v);
  };

  // ── Arrival: submit ────────────────────────────────────────────────────
  const handleSubmitArrival = async () => {
    if (!tripId) {
      Alert.alert('Error', 'Trip ID not found. Please open this screen from a trip card.');
      return;
    }

    if (!arrivalStatus) {
      Alert.alert('Required', 'Please select an arrival status.');
      return;
    }

    // Parse "YYYY-MM-DD HH:mm" (local time) → ISO string
    const m = arrivalTime.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!m) {
      Alert.alert('Invalid time', 'Enter the arrival time as YYYY-MM-DD HH:mm\n(e.g. 2026-10-09 14:30)');
      return;
    }
    const dt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    if (isNaN(dt.getTime())) {
      Alert.alert('Invalid time', 'The arrival date/time is not valid.');
      return;
    }

    if (arrivalStatus === 'DELAYED' && !arrivalNotes.trim()) {
      Alert.alert('Notes required', 'Please add a note explaining the delay.');
      return;
    }

    Keyboard.dismiss();
    setArrivalSubmitting(true);
    try {
      console.log('🏁 Submitting arrival for tripId =', tripId);
      await apiPut(ENDPOINTS.TRIP_ARRIVE(String(tripId).trim()), {
        trip_arrival_status:      arrivalStatus,
        trip_actual_arrival_time: dt.toISOString(),
        trip_arrival_notes:       arrivalNotes.trim(),
      });
      setArrivalDone(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setArrivalOpen(false);
      Alert.alert('Success', 'Arrival entry saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Could not save arrival entry: ' + err.message);
    } finally {
      setArrivalSubmitting(false);
    }
  };

  // ── Pulse animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (isMoving) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.setValue(0); }
  }, [isMoving]);

  useEffect(() => {
    if (global.hasLocationPermission) { setHasLocPerm(true); setTimeout(getLocation, 1000); }
  }, []);

  // ✅ Connect on mount, fully clean up on unmount (no reconnect after leaving)
  useEffect(() => {
    unmounted.current = false;
    connectWS();
    return () => {
      unmounted.current = true;
      clearTimeout(reconnectTO.current);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────
  const injectJS = (code) =>
    webViewRef.current?.injectJavaScript(`(function(){try{${code}}catch(e){}})();`);

  const injectUserMarker    = (lat, lng) => injectJS(`addUserLocationMarker(${lat},${lng});`);

  const injectVehicleUpdate = (loc, pts) => {
    const ptsStr = JSON.stringify(pts.map(p => [p.latitude, p.longitude]));
    injectJS(`updateVehicleMarker(${loc.latitude},${loc.longitude},${ptsStr});`);
  };

  const injectPlannedRoute = () => {
    if (!hasPreloaded) return;
    const latlngs = JSON.stringify(preloadedCoords.map(p => [p.latitude, p.longitude]));
    injectJS(`drawPlannedRoute(${latlngs});`);
  };

  const requestLocPerm = async () => {
    setIsGettingLoc(true);
    try {
      if (Platform.OS === 'android') {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (r === PermissionsAndroid.RESULTS.GRANTED) {
          setHasLocPerm(true); global.hasLocationPermission = true; getLocation();
        } else setIsGettingLoc(false);
      } else { setHasLocPerm(true); global.hasLocationPermission = true; getLocation(); }
    } catch { setIsGettingLoc(false); }
  };

  const getLocation = () => {
    setIsGettingLoc(true);
    Geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setUserLocation({ latitude, longitude });
        setIsGettingLoc(false);
        injectUserMarker(latitude, longitude);
      },
      () => setIsGettingLoc(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ WebSocket — mirrors the working web implementation
  // ─────────────────────────────────────────────────────────────────────────
  const connectWS = () => {
    if (unmounted.current) return;
    try {
      console.log('[WS-URL] Connecting to', SIMULATOR_WS_URL);
      const ws = new WebSocket(SIMULATOR_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] ✓ Connected');
        setIsConnected(true);
        setStatus('Connected');
        // Same as web: subscribe to everything, filter on the client
        ws.send(JSON.stringify({ type: 'subscribe' }));
      };

      ws.onmessage = ({ data: raw }) => {
        try {
          const d = JSON.parse(raw);
          console.log('[WS] Message:', d.type, '| vehicle_id=', d.vehicle_id, '| device_id=', d.device_id, '| imei=', d.imei, '| speed=', d.speed);

          if (d.error) { setStatus('Error'); return; }
          if (d.type === 'subscribed') { setStatus('Subscribed'); return; }

          // Only live / replay messages carry position data
          if (d.type !== 'live' && d.type !== 'replay') return;

          // Match on vehicle_id / device_id / imei against all known IDs of this vehicle
          const incomingIds = [d.vehicle_id, d.device_id, d.imei]
            .filter(Boolean).map(String);
          if (!incomingIds.some((id) => vehicleIds.includes(id))) return;

          // Coordinates: [lng, lat] from any shape the server may use
          const c =
            d.coordinates ??
            d.location?.coordinates ??
            (d.lng !== undefined && d.lat !== undefined ? [d.lng, d.lat] : null);
          if (!Array.isArray(c) || c.length < 2) return;

          const lon = parseFloat(c[0]), lat = parseFloat(c[1]);
          if (isNaN(lat) || isNaN(lon)) return;
          const loc = { latitude: lat, longitude: lon };

          if (d.state === 'parked') {
            setVState('parked'); setParkedLoc(d.parked_location || d.position_name || 'Unknown');
            setParkedDur(d.parked_duration || '--'); setParkedDriver(d.driver_name || null);
            setMovingDriver(null); setIsMoving(false);
            setVehicleLocation(loc);
            if (d.registration_number) setRegNum(d.registration_number);
            if (d.speed          != null) setLiveSpeed(Number(d.speed));
            if (d.total_distance != null) setLiveDist(`${parseFloat(d.total_distance).toFixed(1)} km`);
            setLastUpdateTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            setStatus('Parked');
            setRoutePoints(prev => { const n = [...prev, loc]; injectVehicleUpdate(loc, n); return n; });
          } else {
            setVState('moving');
            if (d.route_name) setRouteName(d.route_name);
            if (d.driver_name) setMovingDriver(d.driver_name);
            setParkedLoc(null); setIsMoving(true);
            setTimeout(() => setIsMoving(false), 3000);
            prevLoc.current = { latitude: lat, longitude: lon, ts: Date.now() };
            setVehicleLocation(loc);
            if (d.registration_number) setRegNum(d.registration_number);
            if (d.speed         != null) setLiveSpeed(Number(d.speed));
            if (d.total_distance != null) setLiveDist(`${parseFloat(d.total_distance).toFixed(1)} km`);
            setLastUpdateTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            setStatus('Live Tracking');
            setRoutePoints(prev => { const n = [...prev, loc]; injectVehicleUpdate(loc, n); return n; });
          }
        } catch (err) {
          console.log('[WS] Parse error:', err.message);
        }
      };

      ws.onerror = (e) => {
        console.log('[WS] ✗ Error:', e?.message);
        setIsConnected(false);
        setStatus('Error');
      };

      ws.onclose = (e) => {
        console.log('[WS] Closed. code=', e?.code, 'reason=', e?.reason);
        setIsConnected(false);
        setStatus('Disconnected');
        // Reconnect only if this is still the active socket and the screen is still mounted
        if (!unmounted.current && wsRef.current === ws) {
          reconnectTO.current = setTimeout(connectWS, 3000);
        }
      };
    } catch (err) {
      console.log('[WS] Construct failed:', err.message);
      setIsConnected(false);
      if (!unmounted.current) reconnectTO.current = setTimeout(connectWS, 5000);
    }
  };

  // ✅ Manual retry: detach the old socket first so its onclose can't schedule a second reconnect
  const handleRetryWS = () => {
    clearTimeout(reconnectTO.current);
    const old = wsRef.current;
    wsRef.current = null;
    old?.close();
    setStatus('Connecting...');
    connectWS();
  };

  const handleWhatsApp = useCallback(() => {
    const phone = (vehicle.driverPhone || '').replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=91${phone}`)
      .catch(() => Alert.alert('WhatsApp not installed'));
  }, [vehicle.driverPhone]);

  const handleCall = useCallback(() => {
    Linking.openURL(`tel:${vehicle.driverPhone}`)
      .catch(() => Alert.alert('Error', 'Unable to make a call.'));
  }, [vehicle.driverPhone]);

  const handleShareVehicle = useCallback(async () => {
    try {
      await Share.share({
        message: `🚗 ${vehicle.name} · ${vehicle.status ?? ''}
📍 ${vehicle.location ?? ''}
Driver: ${vehicle.driver ?? ''}`,
        title: vehicle.name,
      });
    } catch (_) {}
  }, [vehicle]);

  const handleMyLoc = () => {
    if (hasLocPerm && userLocation) injectJS('centerMapOnUserLocation();');
    else if (hasLocPerm) getLocation();
    else requestLocPerm();
  };

  const toggleMapType = () => {
    const next = mapType === 'street' ? 'satellite' : 'street';
    setMapType(next);
    injectJS(`switchTileLayer('${next}');`);
  };

  const centerOnVehicle = () =>
    injectJS(`map.setView([${vehicleLocation.latitude},${vehicleLocation.longitude}],15);`);

  const fitPlannedRoute = () => injectJS(`fitPlannedRoute();`);

  const handleShareLocation = () => {
    Share.share({
      message: `📍 Vehicle: ${vehicle.name || 'Vehicle'} | Reg: ${regNum}\nRoute: ${routeName || 'N/A'}`,
      title: 'Share Vehicle Location',
    });
  };

  const onWebMsg = (e) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'mapLoaded') {
        mapReadyRef.current = true;
        setTimeout(() => {
          injectPlannedRoute();
          if (userLocation) injectUserMarker(userLocation.latitude, userLocation.longitude);
        }, 300);
      }
    } catch {}
  };

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const driver = (vState === 'parked' ? parkedDriver : movingDriver) || vehicle.driver || 'N/A';

  const preloadedCoordsLiteral = hasPreloaded
    ? JSON.stringify(preloadedCoords.map(p => [p.latitude, p.longitude]))
    : '[]';

  // ── Leaflet HTML ───────────────────────────────────────────────────────
  const mapHTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body,#map{width:100%;height:100%;}
  .pulse{width:20px;height:20px;border-radius:50%;background:rgba(52,119,235,0.3);
    animation:p 1.5s infinite;position:absolute;top:-2px;left:-2px;}
  @keyframes p{0%{transform:scale(1);opacity:.8;}100%{transform:scale(2.5);opacity:0;}}
</style>
</head><body><div id="map"></div><script>

var streetLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom:19, attribution:'© OSM' }
);
var satLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom:19, attribution:'© Esri' }
);
var map = L.map('map', { zoomControl:false })
            .setView([${initLat}, ${initLng}], ${initZoom});
streetLayer.addTo(map);
var currentLayer = 'street';

var vIcon = L.divIcon({
  html: '<div style="position:relative;width:22px;height:22px;">'
      + '<div class="pulse"></div>'
      + '<div style="background:#3477eb;width:18px;height:18px;border-radius:50%;'
      + 'border:3px solid #fff;box-shadow:0 2px 10px rgba(52,119,235,.6);'
      + 'position:relative;z-index:2;"></div></div>',
  iconSize:[22,22], iconAnchor:[11,11], className:''
});
var srcIcon = L.divIcon({
  html: '<div style="background:#16a34a;width:14px;height:14px;border-radius:50%;'
      + 'border:3px solid #fff;box-shadow:0 2px 8px rgba(22,163,74,.5);"></div>',
  iconSize:[14,14], iconAnchor:[7,7], className:''
});
var dstIcon = L.divIcon({
  html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;'
      + 'border:3px solid #fff;box-shadow:0 2px 8px rgba(239,68,68,.5);"></div>',
  iconSize:[14,14], iconAnchor:[7,7], className:''
});
var uIcon = L.divIcon({
  html: '<div style="background:#10b981;width:14px;height:14px;border-radius:50%;'
      + 'border:3px solid #fff;box-shadow:0 2px 8px rgba(16,185,129,.5);"></div>',
  iconSize:[14,14], iconAnchor:[7,7], className:''
});

var vm   = L.marker([${initLat},${initLng}], { icon:vIcon }).addTo(map);
var um   = null;
var srcM = null;
var dstM = null;

var liveLine = L.polyline([], {
  color:'#3477eb', weight:5, opacity:0.85, lineJoin:'round'
}).addTo(map);

var plannedLine = L.polyline([], {
  color:'#3477eb', weight:3, opacity:0.5,
  dashArray:'10 7', lineJoin:'round'
}).addTo(map);

function drawPlannedRoute(latlngs) {
  if (!latlngs || latlngs.length < 2) return;
  plannedLine.setLatLngs(latlngs);
  var first = latlngs[0];
  if (srcM) { srcM.setLatLng(first); }
  else       { srcM = L.marker(first, { icon:srcIcon }).addTo(map); }
  var last = latlngs[latlngs.length - 1];
  if (dstM) { dstM.setLatLng(last); }
  else       { dstM = L.marker(last, { icon:dstIcon }).addTo(map); }
  try { map.fitBounds(plannedLine.getBounds().pad(0.12)); } catch(e) {}
}

function fitPlannedRoute() {
  if (plannedLine.getLatLngs().length > 1) {
    try { map.fitBounds(plannedLine.getBounds().pad(0.12)); } catch(e) {}
  }
}

var _inlinedCoords = ${preloadedCoordsLiteral};
if (_inlinedCoords && _inlinedCoords.length >= 2) {
  drawPlannedRoute(_inlinedCoords);
}

function updateVehicleMarker(lat, lng, pts) {
  vm.setLatLng([lat, lng]);
  map.panTo([lat, lng], { animate:true, duration:0.8 });
  if (pts && pts.length > 1) { liveLine.setLatLngs(pts); }
}

function addUserLocationMarker(lat, lng) {
  um ? um.setLatLng([lat, lng])
     : (um = L.marker([lat, lng], { icon:uIcon }).addTo(map));
}
function centerMapOnUserLocation() {
  if (um) map.setView(um.getLatLng(), 15);
}

function switchTileLayer(type) {
  if (type === 'satellite' && currentLayer !== 'satellite') {
    map.removeLayer(streetLayer); satLayer.addTo(map); currentLayer = 'satellite';
  } else if (type === 'street' && currentLayer !== 'street') {
    map.removeLayer(satLayer); streetLayer.addTo(map); currentLayer = 'street';
  }
}

window.ReactNativeWebView &&
  window.ReactNativeWebView.postMessage(JSON.stringify({ type:'mapLoaded' }));
</script></body></html>`;

  return (
    <LinearGradient colors={['#3477eb', '#1a56c4']} style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.hBtn}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={s.hMid}>
          <Text style={s.hName}>{vehicle.name || 'Vehicle'}</Text>
          <View style={s.hStatus}>
            <View style={[s.hDot, {
              backgroundColor: isConnected
                ? (vState === 'parked' ? '#fbbf24' : '#34d399')
                : '#f87171',
            }]} />
            <Text style={s.hStatusTxt}>
              {isConnected ? (vState === 'parked' ? 'Parked' : 'Live Tracking') : status}
            </Text>
          </View>
        </View>
        <View style={s.hRight}>
          {isReviewTab && !actionDone && (
            <View style={s.reviewBadgePill}>
              <Icon name="clock-alert-outline" size={11} color="#f59e0b" />
              <Text style={s.reviewBadgeTxt}>Pending Review</Text>
            </View>
          )}
          {(!isReviewTab || actionDone) && (
            <Text style={s.regPill}>{regNum}</Text>
          )}
        </View>
      </View>

      {/* ── Stats Pills — speed & distance live from WS ── */}
      <View style={s.pillsRow}>
        <View style={[s.pill, { backgroundColor: '#fff' }]}>
          <Icon name="speedometer" size={11} color="#3477eb" />
          <Text style={[s.pillTxt, { color: '#3477eb' }]}>{liveSpeed} km/h</Text>
        </View>
        <View style={[s.pill, { backgroundColor: '#fff' }]}>
          <Icon name="map-marker-distance" size={11} color="#6366f1" />
          <Text style={[s.pillTxt, { color: '#6366f1' }]}>{liveDist}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: '#fff' }]}>
          <Icon name="clock-check-outline" size={11} color="#16a34a" />
          <Text style={[s.pillTxt, { color: '#16a34a' }]}>{vehicle.runTime ?? '0h 0m'}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: '#fff' }]}>
          <Icon name="clock-alert-outline" size={11} color="#f59e0b" />
          <Text style={[s.pillTxt, { color: '#f59e0b' }]}>{vehicle.idleTime ?? '0h 0m'}</Text>
        </View>
      </View>

      {/* ── PAGE SCROLLER: map + bottom bar ──
           paddingBottom = keyboard height → page scrolls up above the keyboard.
           scrollEnabled only while the Arrival form is open (map drags normally otherwise). */}
      <ScrollView
        ref={pageScrollRef}
        style={s.pageScroll}
        contentContainerStyle={[s.pageScrollContent, { paddingBottom: keyboardHeight }]}
        scrollEnabled={arrivalOpen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        nestedScrollEnabled
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View style={s.mapWrap}>
          <WebView
            ref={webViewRef}
            source={{ html: mapHTML }}
            style={{ flex: 1 }}
            onMessage={onWebMsg}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
          />

          {/* Map legend */}
          {hasPreloaded && (
            <View style={s.legendBox}>
              <View style={s.legendRow}>
                <View style={s.legendDash} />
                <Text style={s.legendTxt}>Planned Route</Text>
              </View>
              <View style={s.legendRow}>
                <View style={s.legendSolid} />
                <Text style={s.legendTxt}>Live Track</Text>
              </View>
            </View>
          )}

          {/* Moving badge */}
          {isMoving && vState === 'moving' && (
            <Animated.View style={[s.badge, { backgroundColor: '#10b981', opacity: pulseOpacity }]}>
              <Icon name="car-speed-limiter" size={14} color="#fff" />
              <Text style={s.badgeTxt}>MOVING</Text>
            </Animated.View>
          )}
          {vState === 'parked' && (
            <View style={[s.badge, { backgroundColor: '#f59e0b' }]}>
              <Icon name="car-brake-parking" size={14} color="#fff" />
              <Text style={s.badgeTxt}>PARKED</Text>
            </View>
          )}

          {/* Map controls */}
          <View style={s.mapControls}>
            <TouchableOpacity style={s.mapBtn} onPress={handleMyLoc} activeOpacity={0.85}>
              <Icon name={isGettingLoc ? 'loading' : 'crosshairs-gps'} size={18} color="#3477eb" />
            </TouchableOpacity>
            <TouchableOpacity style={s.mapBtn} onPress={centerOnVehicle} activeOpacity={0.85}>
              <Icon name="car-search" size={18} color="#3477eb" />
            </TouchableOpacity>
            {hasPreloaded && (
              <TouchableOpacity style={s.mapBtn} onPress={fitPlannedRoute} activeOpacity={0.85}>
                <Icon name="routes" size={18} color="#3477eb" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.mapBtn, mapType === 'satellite' && s.mapBtnActive]}
              onPress={toggleMapType} activeOpacity={0.85}
            >
              <Icon
                name={mapType === 'satellite' ? 'layers' : 'layers-outline'}
                size={18}
                color={mapType === 'satellite' ? '#fff' : '#3477eb'}
              />
            </TouchableOpacity>
            <View style={s.zoomGroup}>
              <TouchableOpacity style={s.zoomBtn} activeOpacity={0.8}
                onPress={() => injectJS('map.zoomIn();')}>
                <Icon name="plus" size={18} color="#3477eb" />
              </TouchableOpacity>
              <View style={s.zoomDiv} />
              <TouchableOpacity style={s.zoomBtn} activeOpacity={0.8}
                onPress={() => injectJS('map.zoomOut();')}>
                <Icon name="minus" size={18} color="#3477eb" />
              </TouchableOpacity>
            </View>
          </View>

          {!isConnected && (
            <TouchableOpacity
              style={s.discoBanner}
              onPress={handleRetryWS}
              activeOpacity={0.85}
            >
              <Icon name="wifi-off" size={15} color="#fff" />
              <Text style={s.discoTxt}>Reconnecting…  Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Bottom bar ── */}
        <View style={s.bottomBar}>

          {/* The info blocks are hidden while the arrival form is open, to give the form room */}
          {!arrivalOpen && (
            <>
              {/* ── Contact Pills ── */}
              <View style={s.contactPillsRow}>
                <TouchableOpacity style={[s.contactPill, { backgroundColor: '#F0FDF4' }]} onPress={handleWhatsApp} activeOpacity={0.75}>
                  <Icon name="whatsapp" size={11} color="#16a34a" />
                  <Text style={[s.contactPillTxt, { color: '#16a34a' }]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.contactPill, { backgroundColor: '#EFF6FF' }]} onPress={handleCall} activeOpacity={0.75}>
                  <Icon name="phone" size={11} color="#3477eb" />
                  <Text style={[s.contactPillTxt, { color: '#3477eb' }]}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.contactPill, { backgroundColor: '#F5F3FF' }]} onPress={handleShareVehicle} activeOpacity={0.75}>
                  <Icon name="share-variant-outline" size={11} color="#7c3aed" />
                  <Text style={[s.contactPillTxt, { color: '#7c3aed' }]}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Mini info: Reg | Last Update | Driver */}
              <View style={s.miniStats}>
                {[
                  { icon: 'card-account-details', lbl: 'Regn.',  val: regNum },
                  { icon: 'clock-outline',        lbl: 'Last Update', val: lastUpdateTime },
                  { icon: 'account',              lbl: 'Driver', val: driver },
                ].map((item, i, arr) => (
                  <React.Fragment key={item.lbl}>
                    <View style={s.miniItem}>
                      <View style={s.miniIconRow}>
                        <View style={s.miniIconWrap}>
                          <Icon name={item.icon} size={13} color="#3477eb" />
                        </View>
                        <Text style={s.miniLbl}>{item.lbl}</Text>
                      </View>
                      <Text style={s.miniVal} numberOfLines={1}>{item.val}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={s.miniDiv} />}
                  </React.Fragment>
                ))}
              </View>

              {/* Route info card */}
              {(routeName || vehicle.sourceLabel) && (
                <View style={s.locCard}>
                  <View style={s.locIconWrap}>
                    <Icon name={hasPreloaded ? 'routes' : 'map-marker'} size={20} color="#3477eb" />
                  </View>
                  <View style={s.locTextWrap}>
                    <Text style={s.locLine1} numberOfLines={1}>
                      {routeName || 'Route'}
                    </Text>
                    {vehicle.sourceLabel && vehicle.destLabel && (
                      <Text style={s.locLine2} numberOfLines={1}>
                        {vehicle.sourceLabel}  →  {vehicle.destLabel}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity style={s.shareIconWrap} onPress={handleShareLocation} activeOpacity={0.75}>
                    <Icon name="share-variant" size={16} color="#3477eb" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Parked info */}
              {vState === 'parked' && parkedLoc && (
                <View style={s.infoBox}>
                  <Icon name="car-brake-parking" size={13} color="#92400e" />
                  <Text style={s.infoTxt} numberOfLines={1}>{parkedLoc}  ·  {parkedDur}</Text>
                </View>
              )}

              {/* Moving route info */}
              {vState === 'moving' && routeName && (
                <View style={[s.infoBox, s.infoBlue]}>
                  <Icon name="map-marker-path" size={13} color="#1d4ed8" />
                  <Text style={[s.infoTxt, { color: '#1d4ed8' }]} numberOfLines={1}>{routeName}</Text>
                </View>
              )}
            </>
          )}

          {/* Approve / Reject — only for Review tab */}
          {isReviewTab && !actionDone && (
            <View style={s.reviewSection}>
              <View style={s.reviewLabelRow}>
                <View style={s.reviewLabelLeft}>
                  <Icon name="clipboard-check-outline" size={13} color="#f59e0b" />
                  <Text style={s.reviewLabelTxt}>Trip Pending Approval</Text>
                </View>
                <Text style={s.reviewSubLabelTxt}>Review & take action</Text>
              </View>
              <View style={s.reviewActions}>
                <TouchableOpacity style={s.approveBtn} onPress={handleApprove} activeOpacity={0.82}>
                  <Icon name="check-circle-outline" size={18} color="#fff" />
                  <Text style={s.approveBtnTxt}>Approve Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={handleReject} activeOpacity={0.82}>
                  <Icon name="close-circle-outline" size={18} color="#ef4444" />
                  <Text style={s.rejectBtnTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Arrival Entry — Approved / View tabs / Vehicles list (when a tripId exists) ── */}
          {showArrival && !arrivalDone && (
            <View style={s.arrivalSection}>
              {/* Toggle button */}
              <TouchableOpacity style={s.arrivalToggle} onPress={toggleArrival} activeOpacity={0.85}>
                <View style={s.arrivalToggleLeft}>
                  <View style={s.arrivalIconWrap}>
                    <Icon name="flag-checkered" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={s.arrivalToggleTitle}>Arrival Entry</Text>
                    <Text style={s.arrivalToggleSub}>
                      {arrivalOpen ? 'Fill the details below' : 'Tap to record trip arrival'}
                    </Text>
                  </View>
                </View>
                <Icon name={arrivalOpen ? 'chevron-down' : 'chevron-up'} size={22} color="#3477eb" />
              </TouchableOpacity>

              {/* Expanded form — plain View; the PAGE scroller above does the scrolling */}
              {arrivalOpen && (
                <View style={s.arrivalForm}>
                  {!tripId && (
                    <View style={s.noTripBanner}>
                      <Icon name="alert-outline" size={14} color="#92400e" />
                      <Text style={s.noTripTxt}>
                        No trip linked to this screen. Open it from a trip card (Approved / View tab) to submit.
                      </Text>
                    </View>
                  )}

                  {/* Status */}
                  <Text style={s.fieldLabel}>Arrival Status</Text>
                  <View style={s.statusRow}>
                    {ARRIVAL_OPTIONS.map((opt) => {
                      const selected = arrivalStatus === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            s.statusChip,
                            { backgroundColor: selected ? opt.color : opt.bg, borderColor: opt.color },
                          ]}
                          onPress={() => setArrivalStatus(opt.value)}
                          activeOpacity={0.8}
                        >
                          <Icon name={opt.icon} size={14} color={selected ? '#fff' : opt.color} />
                          <Text style={[s.statusChipTxt, { color: selected ? '#fff' : opt.color }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Actual arrival time */}
                  <Text style={s.fieldLabel}>Actual Arrival Time</Text>
                  <View style={s.timeRow}>
                    <View style={s.timeInputWrap}>
                      <Icon name="calendar-clock" size={18} color="#64748b" />
                      <TextInput
                        style={s.timeInput}
                        value={arrivalTime}
                        onChangeText={setArrivalTime}
                        placeholder="YYYY-MM-DD HH:mm"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numbers-and-punctuation"
                        maxLength={16}
                        onFocus={() => scrollPageToEnd(300)}
                      />
                    </View>
                    <TouchableOpacity
                      style={s.nowBtn}
                      onPress={() => setArrivalTime(formatLocalInput(new Date()))}
                      activeOpacity={0.8}
                    >
                      <Icon name="clock-fast" size={14} color="#3477eb" />
                      <Text style={s.nowBtnTxt}>Now</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Notes */}
                  <Text style={s.fieldLabel}>
                    Notes{arrivalStatus === 'DELAYED' ? ' *' : ' (optional)'}
                  </Text>
                  <TextInput
                    style={s.notesInput}
                    value={arrivalNotes}
                    onChangeText={setArrivalNotes}
                    onFocus={() => scrollPageToEnd(300)}
                    placeholder={
                      arrivalStatus === 'DELAYED'
                        ? 'Reason for delay...'
                        : 'Add any arrival notes...'
                    }
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  {/* Actions */}
                  <View style={s.arrivalActions}>
                    <TouchableOpacity
                      style={s.arrivalCancelBtn}
                      onPress={toggleArrival}
                      disabled={arrivalSubmitting}
                      activeOpacity={0.8}
                    >
                      <Text style={s.arrivalCancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.arrivalSubmitBtn, arrivalSubmitting && { opacity: 0.7 }]}
                      onPress={handleSubmitArrival}
                      disabled={arrivalSubmitting}
                      activeOpacity={0.85}
                    >
                      {arrivalSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Icon name="check-circle-outline" size={18} color="#fff" />
                          <Text style={s.arrivalSubmitTxt}>Submit Arrival</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Footer label */}
          <View style={s.playRow}>
              <View style={s.playInner}>
                <View style={s.playIconWrap}>
                  <Icon name="play-circle" size={18} color="#fff" />
                </View>
                <Text style={s.playLbl}>
                  {hasPreloaded ? 'Planned Route Play' : 'Live Route Play'}
                </Text>
                <View style={[s.playDot, { backgroundColor: isConnected ? '#34d399' : '#f87171' }]} />
                <Text style={s.playStatus}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
              </View>
            </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 38,
  },
  hBtn:       { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  hMid:       { flex: 1, marginLeft: 8 },
  hName:      { fontSize: 17, fontWeight: '700', color: '#fff' },
  hStatus:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  hDot:       { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  hStatusTxt: { fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: '500' },
  hRight:     { marginLeft: 8, alignItems: 'flex-end' },
  regPill: {
    backgroundColor: 'rgba(255,255,255,.2)', color: '#fff',
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden',
  },
  reviewBadgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)',
  },
  reviewBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#fef3c7' },

  // ── Stats Pills ─────────────────────────────────────────────────────────
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
  },
  pillTxt: {
    fontSize: 11, fontWeight: '700', color: '#fff',
  },
  // ────────────────────────────────────────────────────────────────────────

  // ── Page scroller ────────────────────────────────────────────────────────
  pageScroll:        { flex: 1, backgroundColor: '#f0f4ff' },
  // flexGrow: 1 → form closed: map fills the free space; form open: content grows & scrolls
  pageScrollContent: { flexGrow: 1 },
  mapWrap:           { flex: 1, minHeight: Math.round(SCREEN_HEIGHT * 0.3) },

  // ── Contact Pills ────────────────────────────────────────────────────────
  contactPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  contactPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 20,
  },
  contactPillTxt: {
    fontSize: 11,
    fontWeight: '700',
  },
  // ────────────────────────────────────────────────────────────────────────

  legendBox: {
    position: 'absolute', top: 10, left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, gap: 4, elevation: 5,
  },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDash: { width: 20, height: 2, borderWidth: 1, borderColor: 'rgba(52,119,235,0.5)', borderStyle: 'dashed' },
  legendSolid:{ width: 20, height: 3, backgroundColor: '#3477eb', borderRadius: 2 },
  legendTxt:  { fontSize: 10, color: '#475569', fontWeight: '600' },

  badge: {
    position: 'absolute', top: 76, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, elevation: 5,
  },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  mapControls: { position: 'absolute', right: 12, top: 10, gap: 8, alignItems: 'center' },
  mapBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 5,
  },
  mapBtnActive: { backgroundColor: '#3477eb' },
  zoomGroup: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 5,
  },
  zoomBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  zoomDiv: { height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 8 },

  discoBanner: {
    position: 'absolute', bottom: 10, left: 14, right: 14,
    backgroundColor: '#ef4444', borderRadius: 10, padding: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 8,
  },
  discoTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

  bottomBar: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10,
    paddingBottom: verticalScale(28),
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    elevation: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 8,
  },
  miniStats: {
    flexDirection: 'row', backgroundColor: '#f8fafc',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
  },
  miniItem:     { flex: 1, alignItems: 'center', gap: 3 },
  miniDiv:      { width: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
  miniIconRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniIconWrap: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center',
  },
  miniLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  miniVal: { fontSize: 12, color: '#1e293b', fontWeight: '700', textAlign: 'center' },

  locCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#dbeafe', gap: 10,
  },
  locIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center',
  },
  locTextWrap:   { flex: 1, gap: 2 },
  locLine1:      { fontSize: 12, color: '#1e293b', fontWeight: '700' },
  locLine2:      { fontSize: 11, color: '#64748b', fontWeight: '400' },
  shareIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center',
  },

  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#fef3c7', borderRadius: 10, padding: 9, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
  infoBlue: { backgroundColor: '#eff6ff', borderLeftColor: '#3477eb' },
  infoTxt:  { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '500' },

  reviewSection: {
    backgroundColor: '#fffbeb', borderRadius: 14,
    borderWidth: 1, borderColor: '#fde68a',
    padding: 12, marginBottom: 10, gap: 10,
  },
  reviewLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  reviewLabelLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewLabelTxt:  { fontSize: 12, fontWeight: '800', color: '#92400e', letterSpacing: 0.2 },
  reviewSubLabelTxt: { fontSize: 10.5, color: '#b45309', fontWeight: '500' },
  reviewActions: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14,
    elevation: 3, shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  approveBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#fecaca',
  },
  rejectBtnTxt: { color: '#ef4444', fontSize: 14, fontWeight: '800' },

  // ── Arrival Entry ────────────────────────────────────────────────────────
  arrivalSection: {
    backgroundColor: '#f8fbff', borderRadius: 14,
    borderWidth: 1, borderColor: '#dbeafe',
    marginBottom: 10, overflow: 'hidden',
  },
  arrivalToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 12,
  },
  arrivalToggleLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrivalIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#3477eb', justifyContent: 'center', alignItems: 'center',
  },
  arrivalToggleTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  arrivalToggleSub:   { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 1 },

  arrivalForm: {
    paddingHorizontal: 12, paddingBottom: 14,
  },
  noTripBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef3c7', borderRadius: 10, padding: 9, marginTop: 4,
    borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
  noTripTxt: { flex: 1, fontSize: 11, color: '#92400e', fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 6, marginBottom: 6 },

  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  statusChipTxt: { fontSize: 12, fontWeight: '800' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 10,
  },
  timeInput: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '600', paddingVertical: Platform.OS === 'ios' ? 11 : 8 },
  nowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', borderRadius: 10, borderWidth: 1, borderColor: '#dbeafe',
    paddingHorizontal: 12, paddingVertical: 11,
  },
  nowBtnTxt: { fontSize: 12, fontWeight: '800', color: '#3477eb' },

  notesInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 74,
    fontSize: 13, color: '#1e293b', fontWeight: '500',
  },

  arrivalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  arrivalCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 13,
  },
  arrivalCancelTxt: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  arrivalSubmitBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#3477eb', borderRadius: 12, paddingVertical: 13,
    elevation: 3, shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  arrivalSubmitTxt: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  // ────────────────────────────────────────────────────────────────────────

  playRow: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: verticalScale(16),
  },
  playInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', paddingHorizontal: 2,
  },
  playIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#3477eb', justifyContent: 'center', alignItems: 'center',
  },
  playLbl:    { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '700' },
  playDot:    { width: 8, height: 8, borderRadius: 4 },
  playStatus: { fontSize: 11, color: '#64748b', fontWeight: '700', letterSpacing: 0.8 },
});

export default RoutePlayDetailScreen;