// VehicleDetailScreen.js — FINAL with redesigned expanded stats dashboard
// + Safe-area fix: bottom bar / date-picker footer now use real device insets
//   instead of a fixed verticalScale() guess, so the toggle no longer hides
//   under the system nav bar on devices with different inset heights.
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Alert, PermissionsAndroid, Platform, Animated,
  ScrollView, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // ✅ NEW
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.54;

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_TIMELINE = [
  { id: 1, type: 'running',  startTime: 'Today, 07:05 PM', endTime: '08:17 PM', duration: '1 hr 12 min',  distance: '38.8' },
  { id: 2, type: 'stoppage', startTime: 'Today, 06:21 PM', endTime: '07:05 PM', duration: '43 min', stopNumber: 8, location: '300 M From Banji Branch Post Office, Durukasmar, Mandu, Ramgarh District, Jharkhand' },
  { id: 3, type: 'running',  startTime: 'Today, 06:01 PM', endTime: '06:21 PM', duration: '20 min',  distance: '6.9' },
  { id: 4, type: 'stoppage', startTime: 'Today, 05:40 PM', endTime: '06:01 PM', duration: '21 min', stopNumber: 7, location: 'Near NH-33, Ramgarh, Jharkhand, 829122, India' },
  { id: 5, type: 'running',  startTime: 'Today, 04:55 PM', endTime: '05:40 PM', duration: '45 min',  distance: '22.3' },
];

const SAMPLE_STATS = {
  speed:       '0',
  driven:      '21.8',
  stoppages:   '8',
  runTime:     '2h 52m',
  stopTime:    '17h 24m',
  parkingTime: '4h 03m',
  tolls:       '3',
  tollCost:    '₹120',
  lastUpdate:  '5:04 PM',
  location:    '0.1 Km N of 98, Mahatma Gandhi Marg, Raj Bhavan Colony, Hazratganj, Lucknow',
};

const DATE_FILTERS = ['Today', 'Yesterday', 'Last 7 Days', 'Date Range'];
const WEEKDAYS     = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Date Range Picker ─────────────────────────────────────────────────────────
const DateRangePickerModal = ({ visible, onClose, onApply }) => {
  const insets = useSafeAreaInsets(); // ✅ NEW
  const today = new Date();
  const [fromDate, setFromDate] = useState(new Date(today));
  const [toDate,   setToDate]   = useState(new Date(today));
  const [fromTime, setFromTime] = useState({ h: 0,  m: 0  });
  const [toTime,   setToTime]   = useState({ h: 23, m: 59 });
  const [picking,  setPicking]  = useState(null);
  const [showTP,   setShowTP]   = useState(null);
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const slide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : SCREEN_HEIGHT,
      useNativeDriver: true, tension: 65, friction: 13,
    }).start();
  }, [visible]);

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDay    = (y, m) => new Date(y, m, 1).getDay();
  const fmtDate     = d => {
    if (!d) return '--';
    return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()].slice(0,3)}, ${String(d.getFullYear()).slice(2)}`;
  };
  const fmtTime = t => {
    const h = t.h % 12 === 0 ? 12 : t.h % 12;
    return `${h}:${String(t.m).padStart(2,'0')} ${t.h < 12 ? 'AM' : 'PM'}`;
  };
  const sameDay = (d1, d2) => d1 && d2 && d1.toDateString() === d2.toDateString();
  const inRange = day => {
    const d = new Date(calYear, calMonth, day);
    return d > fromDate && d < toDate;
  };

  const tapDay = day => {
    const sel = new Date(calYear, calMonth, day);
    if (!picking || picking === 'from') { setFromDate(sel); setPicking('to'); }
    else {
      if (sel < fromDate) { setToDate(fromDate); setFromDate(sel); }
      else { setToDate(sel); }
      setPicking(null);
    }
  };

  const prevM = () => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1);
  const nextM = () => calMonth === 11 ? (setCalMonth(0),  setCalYear(y => y + 1)) : setCalMonth(m => m + 1);

  const buildCells = () => {
    const dim = daysInMonth(calYear, calMonth);
    const fd  = firstDay(calYear, calMonth);
    const cells = [...Array(fd).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const TimeWheel = ({ label, time, onChange }) => (
    <View style={dp.twBox}>
      <Text style={dp.twLbl}>{label}</Text>
      <View style={dp.twRow}>
        {[['h', 24], ['m', 60]].map(([k, max], idx) => (
          <React.Fragment key={k}>
            {idx > 0 && <Text style={dp.twColon}>:</Text>}
            <View style={dp.twUnit}>
              <TouchableOpacity onPress={() => onChange({ ...time, [k]: (time[k] + 1) % max })}>
                <Icon name="chevron-up" size={18} color="#3477eb" />
              </TouchableOpacity>
              <Text style={dp.twVal}>
                {String(k === 'h' ? (time.h % 12 === 0 ? 12 : time.h % 12) : time[k]).padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={() => onChange({ ...time, [k]: (time[k] - 1 + max) % max })}>
                <Icon name="chevron-down" size={18} color="#3477eb" />
              </TouchableOpacity>
            </View>
          </React.Fragment>
        ))}
        <TouchableOpacity style={dp.ampm} onPress={() => onChange({ ...time, h: (time.h + 12) % 24 })}>
          <Text style={dp.ampmTxt}>{time.h < 12 ? 'AM' : 'PM'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  const rows = [
    { key: 'from', label: 'From', date: fromDate, time: fromTime, color: '#16a34a', setTime: setFromTime },
    { key: 'to',   label: 'To',   date: toDate,   time: toTime,   color: '#ef4444', setTime: setToTime   },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[dp.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={dp.handle} />
        <View style={dp.titleRow}>
          <Icon name="calendar-range" size={20} color="#3477eb" />
          <Text style={dp.title}>Select Date Range</Text>
          <TouchableOpacity style={dp.closeBtn} onPress={onClose}>
            <Icon name="close" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={dp.rangeCard}>
            {rows.map((row, i) => (
              <React.Fragment key={row.key}>
                {i > 0 && <View style={dp.rDiv} />}
                <TouchableOpacity
                  style={[dp.rRow, picking === row.key && dp.rRowActive]}
                  onPress={() => setPicking(row.key)}
                >
                  <View style={[dp.rBar, { backgroundColor: row.color }]} />
                  <Text style={dp.rLbl}>{row.label}</Text>
                  <TouchableOpacity style={dp.rField} onPress={() => setPicking(row.key)}>
                    <Text style={dp.rFieldTxt}>{fmtDate(row.date)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dp.rField, { marginLeft: 8, minWidth: 86 }]}
                    onPress={() => setShowTP(showTP === row.key ? null : row.key)}
                  >
                    <Text style={dp.rFieldTxt}>{fmtTime(row.time)}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                {showTP === row.key && (
                  <TimeWheel label={`${row.label} Time`} time={row.time} onChange={row.setTime} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Calendar */}
          <View style={dp.calWrap}>
            <View style={dp.calNav}>
              <TouchableOpacity style={dp.navBtn} onPress={prevM}>
                <Icon name="chevron-left" size={18} color="#3477eb" />
              </TouchableOpacity>
              <Text style={dp.calTitle}>{MONTHS[calMonth]} {calYear}</Text>
              <TouchableOpacity style={dp.navBtn} onPress={nextM}>
                <Icon name="chevron-right" size={18} color="#3477eb" />
              </TouchableOpacity>
            </View>
            <View style={dp.wdRow}>
              {WEEKDAYS.map(w => <Text key={w} style={dp.wd}>{w}</Text>)}
            </View>
            {buildCells().map((wk, wi) => (
              <View key={wi} style={dp.wdRow}>
                {wk.map((day, di) => {
                  if (!day) return <View key={di} style={dp.cell} />;
                  const d   = new Date(calYear, calMonth, day);
                  const sel = sameDay(d, fromDate) || sameDay(d, toDate);
                  const rng = inRange(day);
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[dp.cell, rng && dp.cellRange, sel && dp.cellSel]}
                      onPress={() => tapDay(day)}
                      activeOpacity={0.7}
                    >
                      <Text style={[dp.cellTxt, rng && dp.cellTxtRange, sel && dp.cellTxtSel]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* ✅ real device inset instead of fixed verticalScale(16) */}
        <View style={[dp.footer, { paddingBottom: 14 + insets.bottom }]}>
          <TouchableOpacity
            style={dp.applyBtn}
            onPress={() => { onApply({ fromDate, toDate, fromTime, toTime }); onClose(); }}
            activeOpacity={0.85}
          >
            <Icon name="check" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={dp.applyTxt}>Apply</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const VehicleDetailScreen = ({ route, navigation }) => {
  const { vehicle, initialTab } = route.params; // ✅ receive initialTab param
  const insets = useSafeAreaInsets(); // ✅ NEW — real safe-area insets for this device

  const WS_ID = vehicle.id || vehicle._id;

  const [vehicleLocation, setVehicleLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [userLocation,    setUserLocation]     = useState(null);
  const [speed,           setSpeed]            = useState('0');
  const [status,          setStatus]           = useState('Connecting...');
  const [isConnected,     setIsConnected]      = useState(false);
  const [hasLocPerm,      setHasLocPerm]       = useState(false);
  const [isGettingLoc,    setIsGettingLoc]     = useState(false);
  const [regNum,          setRegNum]           = useState(vehicle.registrationNumber || '--');
  const [isMoving,        setIsMoving]         = useState(false);
  const [vState,          setVState]           = useState('unknown');
  const [parkedLoc,       setParkedLoc]        = useState(null);
  const [parkedSince,     setParkedSince]      = useState(null);
  const [parkedDur,       setParkedDur]        = useState(null);
  const [parkedDriver,    setParkedDriver]     = useState(null);
  const [movingDriver,    setMovingDriver]     = useState(null);
  const [routeName,       setRouteName]        = useState(null);

  // ✅ Auto-set isExpanded and activeTab based on initialTab param
  const [isExpanded,      setIsExpanded]       = useState(initialTab === 'timeline' ? true : false);
  const [activeTab,       setActiveTab]        = useState(initialTab || 'stats');

  const [timeline,        setTimeline]         = useState(SAMPLE_TIMELINE);
  const [stats]                                = useState(SAMPLE_STATS);
  const [dateFilter,      setDateFilter]       = useState('Today');
  const [showDP,          setShowDP]           = useState(false);
  const [selRange,        setSelRange]         = useState(null);

  // ✅ Init panelAnim to 1 if opened from Route History so panel starts expanded
  const panelAnim   = useRef(new Animated.Value(initialTab === 'timeline' ? 1 : 0)).current;
  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const webViewRef  = useRef(null);
  const wsRef       = useRef(null);
  const reconnectTO = useRef(null);
  const prevLoc     = useRef(null);

  useEffect(() => {
    if (isMoving) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.setValue(0); }
  }, [isMoving]);

  const panelH  = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, PANEL_HEIGHT] });
  const chevRot = panelAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const togglePanel = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    Animated.spring(panelAnim, { toValue: next ? 1 : 0, useNativeDriver: false, tension: 60, friction: 12 }).start();
  };

  useEffect(() => {
    if (global.hasLocationPermission) { setHasLocPerm(true); setTimeout(getLocation, 1000); }
  }, []);

  useEffect(() => {
    connectWS();
    return () => { wsRef.current?.close(); clearTimeout(reconnectTO.current); };
  }, []);

  const requestLocPerm = async () => {
    setIsGettingLoc(true);
    try {
      if (Platform.OS === 'android') {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (r === PermissionsAndroid.RESULTS.GRANTED) { setHasLocPerm(true); global.hasLocationPermission = true; getLocation(); }
        else setIsGettingLoc(false);
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

  const injectUserMarker = (lat, lng) =>
    webViewRef.current?.injectJavaScript(`(function(){try{addUserLocationMarker(${lat},${lng});}catch(e){}})();`);

  const injectVehicle = loc =>
    webViewRef.current?.injectJavaScript(`(function(){try{updateVehicleMarker(${loc.latitude},${loc.longitude});}catch(e){}})();`);

  const calcSpeed = (lat1, lon1, lat2, lon2, dt) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / (dt / 3600000)).toFixed(1);
  };

  const connectWS = () => {
    try {
      const ws = new WebSocket('wss://vlts.nutanteksolutions.cloud/ws');
      ws.onopen = () => {
        setIsConnected(true);
        setStatus('Connected');
        ws.send(JSON.stringify({ type: 'subscribe', vehicle_id: WS_ID }));
      };
      ws.onmessage = ({ data: raw }) => {
        try {
          const d = JSON.parse(raw);
          if (d.error) { setStatus('Error'); return; }
          if (d.type === 'subscribed') { setStatus('Subscribed'); return; }
          if (d.vehicle_id && d.vehicle_id !== WS_ID) return;
          if (!Array.isArray(d.coordinates)) return;
          const lon = parseFloat(d.coordinates[0]), lat = parseFloat(d.coordinates[1]);
          if (isNaN(lat) || isNaN(lon)) return;
          const loc = { latitude: lat, longitude: lon };

          if (d.state === 'parked') {
            setVState('parked');
            setParkedLoc(d.parked_location || 'Unknown');
            setParkedSince(d.parked_since || '--');
            setParkedDur(d.parked_duration || '--');
            setParkedDriver(d.driver_name || null);
            setMovingDriver(null);
            setSpeed('0');
            setIsMoving(false);
            setRouteName(null);
            setVehicleLocation(loc);
            injectVehicle(loc);
            if (d.registration_number) setRegNum(d.registration_number);
            setStatus('Parked');
            setTimeline(prev => [{
              id: Date.now(), type: 'stoppage',
              startTime: d.parked_since || new Date().toLocaleTimeString(),
              endTime: '--', duration: d.parked_duration || '--',
              location: d.parked_location || 'Unknown',
              stopNumber: prev.filter(i => i.type === 'stoppage').length + 1,
            }, ...prev]);
          } else {
            setVState('moving');
            if (d.route_name) setRouteName(d.route_name);
            if (d.driver_name) setMovingDriver(d.driver_name);
            setParkedLoc(null);
            setIsMoving(true);
            setTimeout(() => setIsMoving(false), 3000);
            if (prevLoc.current) {
              const td = Date.now() - prevLoc.current.ts;
              if (td > 0) setSpeed(calcSpeed(prevLoc.current.latitude, prevLoc.current.longitude, lat, lon, td));
            }
            prevLoc.current = { latitude: lat, longitude: lon, ts: Date.now() };
            setVehicleLocation(loc);
            injectVehicle(loc);
            if (d.registration_number) setRegNum(d.registration_number);
            setStatus('Live Tracking');
          }
        } catch {}
      };
      ws.onerror  = () => { setIsConnected(false); setStatus('Error'); };
      ws.onclose  = () => {
        setIsConnected(false);
        setStatus('Disconnected');
        reconnectTO.current = setTimeout(connectWS, 3000);
      };
      wsRef.current = ws;
    } catch {
      setIsConnected(false);
      reconnectTO.current = setTimeout(connectWS, 5000);
    }
  };

  const handleMyLoc = () => {
    if (hasLocPerm && userLocation)
      webViewRef.current?.injectJavaScript(`(function(){try{centerMapOnUserLocation();}catch(e){}})();`);
    else if (hasLocPerm) getLocation();
    else requestLocPerm();
  };

  const mapHTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;}html,body,#map{width:100%;height:100%;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false}).setView([${vehicleLocation.latitude},${vehicleLocation.longitude}],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var vIcon=L.divIcon({html:'<div style="background:#3477eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(52,119,235,.5);"></div>',iconSize:[16,16],iconAnchor:[8,8],className:''});
var uIcon=L.divIcon({html:'<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(16,185,129,.5);"></div>',iconSize:[14,14],iconAnchor:[7,7],className:''});
var vm=L.marker([${vehicleLocation.latitude},${vehicleLocation.longitude}],{icon:vIcon}).addTo(map),um=null;
function updateVehicleMarker(lat,lng){vm.setLatLng([lat,lng]);map.panTo([lat,lng]);}
function addUserLocationMarker(lat,lng){um?um.setLatLng([lat,lng]):(um=L.marker([lat,lng],{icon:uIcon}).addTo(map));}
function centerMapOnUserLocation(){if(um)map.setView(um.getLatLng(),15);}
window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapLoaded'}));
</script></body></html>`;

  const onWebMsg = e => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'mapLoaded' && userLocation)
        setTimeout(() => injectUserMarker(userLocation.latitude, userLocation.longitude), 400);
    } catch {}
  };

  const driver = (vState === 'parked' ? parkedDriver : movingDriver) || vehicle.driver || 'N/A';
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  // ── Timeline item ──
  const TLItem = ({ item, isLast }) => {
    const isRun = item.type === 'running';
    return (
      <View style={tl.row}>
        <View style={tl.leftCol}>
          <View style={[tl.dot, isRun ? tl.dotGreen : tl.dotOrange]}>
            {isRun
              ? <Icon name="arrow-right-thin" size={14} color="#fff" />
              : <Text style={tl.stopNum}>{item.stopNumber}</Text>
            }
          </View>
          {!isLast && <View style={tl.line} />}
        </View>
        <View style={[tl.card, { borderLeftColor: isRun ? '#22c55e' : '#f97316' }]}>
          <View style={tl.cardHead}>
            <View style={[tl.badge, { backgroundColor: isRun ? '#dcfce7' : '#ffedd5' }]}>
              <Icon name={isRun ? 'car' : 'map-marker'} size={11} color={isRun ? '#16a34a' : '#f97316'} />
              <Text style={[tl.badgeTxt, { color: isRun ? '#16a34a' : '#f97316' }]}>
                {isRun ? 'Running' : 'Stop'}
              </Text>
            </View>
            <Text style={tl.dur}>{item.duration}</Text>
          </View>
          <Text style={tl.time}>
            {item.startTime}{item.endTime && item.endTime !== '--' ? ` → ${item.endTime}` : ''}
          </Text>
          {isRun  && <Text style={tl.info}>🛣  {item.distance} km covered</Text>}
          {!isRun && <Text style={tl.info} numberOfLines={2}>{item.location}</Text>}
          {!isRun && <Text style={tl.alertLink}>+ Set geofence alert</Text>}
        </View>
      </View>
    );
  };

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
                : '#f87171'
            }]} />
            <Text style={s.hStatusTxt}>
              {/* ✅ Show "Route History" label when opened from Route History button */}
              {initialTab === 'timeline'
                ? 'Route History'
                : isConnected
                  ? (vState === 'parked' ? 'Parked' : 'Live Tracking')
                  : status}
            </Text>
          </View>
        </View>
        <View style={s.hRight}>
          <Text style={s.regPill}>{regNum}</Text>
        </View>
      </View>

      {/* ── Date filter bar ── */}
      <View style={s.filterBar}>
        {DATE_FILTERS.map(f => {
          const active = dateFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[s.fBtn, active && s.fBtnActive]}
              onPress={() => { setDateFilter(f); if (f === 'Date Range') setShowDP(true); }}
              activeOpacity={0.75}
            >
              {f === 'Date Range' && (
                <Icon name="calendar-range" size={11} color={active ? '#fff' : '#3477eb'} style={{ marginRight: 2 }} />
              )}
              <Text style={[s.fTxt, active && s.fTxtActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Body ── */}
      <View style={{ flex: 1, backgroundColor: '#f0f4ff' }}>

        {/* MAP — flex:1 shrinks as panel expands */}
        <View style={{ flex: 1 }}>
          <WebView
            ref={webViewRef}
            source={{ html: mapHTML }}
            style={{ flex: 1 }}
            onMessage={onWebMsg}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
          />

          {/* Moving badge */}
          {isMoving && vState === 'moving' && (
            <Animated.View style={[s.badge, { backgroundColor: '#10b981', opacity: pulseOpacity }]}>
              <Icon name="car-speed-limiter" size={14} color="#fff" />
              <Text style={s.badgeTxt}>MOVING</Text>
            </Animated.View>
          )}

          {/* Parked badge */}
          {vState === 'parked' && (
            <View style={[s.badge, { backgroundColor: '#f59e0b' }]}>
              <Icon name="car-brake-parking" size={14} color="#fff" />
              <Text style={s.badgeTxt}>PARKED</Text>
            </View>
          )}

          {/* My location */}
          <TouchableOpacity style={s.locBtn} onPress={handleMyLoc} activeOpacity={0.85}>
            <Icon name={isGettingLoc ? 'loading' : 'crosshairs-gps'} size={20} color="#fff" />
          </TouchableOpacity>

          {/* Zoom controls */}
          <View style={s.zoomBtns}>
            <TouchableOpacity style={s.zoomBtn} activeOpacity={0.8}
              onPress={() => webViewRef.current?.injectJavaScript('(function(){try{map.zoomIn();}catch(e){}})()')}>
              <Icon name="plus" size={20} color="#3477eb" />
            </TouchableOpacity>
            <View style={s.zoomDiv} />
            <TouchableOpacity style={s.zoomBtn} activeOpacity={0.8}
              onPress={() => webViewRef.current?.injectJavaScript('(function(){try{map.zoomOut();}catch(e){}})()')}>
              <Icon name="minus" size={20} color="#3477eb" />
            </TouchableOpacity>
          </View>

          {/* Disconnected banner */}
          {!isConnected && (
            <TouchableOpacity
              style={s.discoBanner}
              onPress={() => { wsRef.current?.close(); connectWS(); }}
              activeOpacity={0.85}
            >
              <Icon name="wifi-off" size={15} color="#fff" />
              <Text style={s.discoTxt}>Reconnecting…</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── STATS / TIMELINE PANEL ── slides up between map and bottom bar */}
        <Animated.View style={[s.panel, { height: panelH }]}>
          {/* Tab switcher */}
          <View style={s.tabBar}>
            {[
              { id: 'stats',    icon: 'chart-bar',             lbl: 'Stats'    },
              { id: 'timeline', icon: 'timeline-clock-outline', lbl: 'Timeline' },
            ].map(t => (
              <TouchableOpacity
                key={t.id}
                style={[s.tab, activeTab === t.id && s.tabActive]}
                onPress={() => setActiveTab(t.id)}
                activeOpacity={0.8}
              >
                <Icon name={t.icon} size={14} color={activeTab === t.id ? '#3477eb' : '#94a3b8'} />
                <Text style={[s.tabTxt, activeTab === t.id && s.tabTxtActive]}>{t.lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── STATS TAB ── */}
            {activeTab === 'stats' && (
              <>
                {/* Location strip */}
                <View style={sc.locStrip}>
                  <Icon name="map-marker-radius" size={14} color="#3477eb" />
                  <Text style={sc.locTxt} numberOfLines={1}>{parkedLoc || stats.location}</Text>
                  <View style={sc.locTimePill}>
                    <Text style={sc.locTime}>{stats.lastUpdate}</Text>
                  </View>
                </View>

                {/* ── 4-box top row: Speed · Driven · Stops · Tolls ── */}
                <View style={sc.grid4}>
                  {[
                    { icon: 'speedometer',         label: 'Speed',   value: speed,          unit: 'km/h' },
                    { icon: 'road-variant',         label: 'Driven',  value: stats.driven,   unit: 'km'   },
                    { icon: 'map-marker-check',     label: 'Stops',   value: stats.stoppages,unit: ''     },
                    { icon: 'boom-gate-up',         label: 'Tolls',   value: stats.tolls,    unit: stats.tollCost },
                  ].map((m) => (
                    <View key={m.label} style={sc.box}>
                      <View style={sc.boxIcon}>
                        <Icon name={m.icon} size={18} color="#3477eb" />
                      </View>
                      <Text style={sc.boxVal}>{m.value}</Text>
                      <Text style={sc.boxUnit}>{m.unit}</Text>
                      <Text style={sc.boxLbl}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {/* ── 3-box middle row: Run Time · Stop Time · Parking ── */}
                <View style={sc.grid3}>
                  {[
                    { icon: 'play-circle-outline', label: 'Run Time',  value: stats.runTime    },
                    { icon: 'pause-circle-outline',label: 'Stop Time', value: stats.stopTime   },
                    { icon: 'parking',             label: 'Parking',   value: stats.parkingTime},
                  ].map((m) => (
                    <View key={m.label} style={sc.timeBox}>
                      <Icon name={m.icon} size={16} color="#3477eb" />
                      <Text style={sc.timeBoxVal}>{m.value}</Text>
                      <Text style={sc.timeBoxLbl}>{m.label}</Text>
                    </View>
                  ))}
                </View>

                {/* ── Driver card ── */}
                <View style={sc.driverCard}>
                  <View style={sc.driverAvaBig}>
                    <Icon name="account-tie" size={20} color="#3477eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sc.driverLbl}>DRIVER</Text>
                    <Text style={sc.driverName}>{driver}</Text>
                  </View>
                  {routeName ? (
                    <View style={sc.routePill}>
                      <Icon name="map-marker-path" size={11} color="#ca8a04" />
                      <Text style={sc.routePillTxt} numberOfLines={1}>{routeName}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={sc.callBtn}
                    onPress={() => Alert.alert('Call Driver', `Calling ${driver}...`)} activeOpacity={0.85}>
                    <Icon name="phone" size={14} color="#fff" />
                    <Text style={sc.callTxt}>Call</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── TIMELINE TAB ── */}
            {activeTab === 'timeline' && (
              <>
                <Text style={tl.sectionLbl}>TODAY'S ACTIVITY</Text>
                {timeline.map((item, i) => (
                  <TLItem key={item.id} item={item} isLast={i === timeline.length - 1} />
                ))}
              </>
            )}
          </ScrollView>
        </Animated.View>

        {/* ── BOTTOM BAR ── always fixed */}
        {/* ✅ paddingBottom now uses real device inset (insets.bottom) instead of verticalScale(34) */}
        <View style={[s.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
          {/* Mini stats row with icons */}
          <View style={s.miniStats}>
            <View style={s.miniItem}>
              <View style={s.miniIconRow}>
                <View style={s.miniIconWrap}>
                  <Icon name="account" size={13} color="#3477eb" />
                </View>
                <Text style={s.miniLbl}>Driver</Text>
              </View>
              <Text style={s.miniVal} numberOfLines={1}>{driver}</Text>
            </View>
            <View style={s.miniDiv} />
            <View style={s.miniItem}>
              <View style={s.miniIconRow}>
                <View style={s.miniIconWrap}>
                  <Icon name="speedometer" size={13} color="#3477eb" />
                </View>
                <Text style={s.miniLbl}>Speed</Text>
              </View>
              <Text style={s.miniVal}>{speed} km/h</Text>
            </View>
            <View style={s.miniDiv} />
            <View style={s.miniItem}>
              <View style={s.miniIconRow}>
                <View style={s.miniIconWrap}>
                  <Icon name="card-account-details" size={13} color="#3477eb" />
                </View>
                <Text style={s.miniLbl}>Reg No.</Text>
              </View>
              <Text style={s.miniVal} numberOfLines={1}>{regNum}</Text>
            </View>
          </View>

          {/* Parked info */}
          {vState === 'parked' && parkedLoc && (
            <View style={s.infoBox}>
              <Icon name="car-brake-parking" size={13} color="#92400e" />
              <Text style={s.infoTxt} numberOfLines={1}>
                {parkedLoc}  ·  {parkedDur}
              </Text>
            </View>
          )}

          {/* Route info */}
          {vState === 'moving' && routeName && (
            <View style={[s.infoBox, s.infoBlue]}>
              <Icon name="map-marker-path" size={13} color="#1d4ed8" />
              <Text style={[s.infoTxt, { color: '#1d4ed8' }]} numberOfLines={1}>{routeName}</Text>
            </View>
          )}

          {/* Toggle handle */}
          <TouchableOpacity style={s.toggleRow} onPress={togglePanel} activeOpacity={0.8}>
            <View style={s.handleBar} />
            <View style={s.toggleInner}>
              <Icon name="chart-timeline-variant" size={16} color="#3477eb" />
              <Text style={s.toggleLbl}>
                {isExpanded ? 'Hide Details' : 'View Stats & Timeline'}
              </Text>
              <Animated.View style={{ transform: [{ rotate: chevRot }] }}>
                <Icon name="chevron-up" size={22} color="#3477eb" />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Range Picker */}
      <DateRangePickerModal
        visible={showDP}
        onClose={() => {
          setShowDP(false);
          if (dateFilter === 'Date Range' && !selRange) setDateFilter('Today');
        }}
        onApply={r => setSelRange(r)}
      />
    </LinearGradient>
  );
};

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
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
  hRight:     { marginLeft: 8 },
  regPill:    {
    backgroundColor: 'rgba(255,255,255,.2)', color: '#fff',
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden',
  },

  filterBar:   {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.12)',
    paddingHorizontal: 10, paddingVertical: 7, gap: 6,
  },
  fBtn:        {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.15)',
  },
  fBtnActive:  { backgroundColor: '#fff' },
  fTxt:        { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,.9)' },
  fTxtActive:  { color: '#3477eb' },

  badge:    {
    position: 'absolute', top: 10, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, elevation: 5,
  },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  locBtn:   {
    position: 'absolute', top: 10, right: 12,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#3477eb', justifyContent: 'center', alignItems: 'center', elevation: 5,
  },
  discoBanner: {
    position: 'absolute', bottom: 10, left: 14, right: 14,
    backgroundColor: '#ef4444', borderRadius: 10, padding: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 8,
  },
  discoTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

  zoomBtns: {
    position: 'absolute', right: 12, bottom: 64,
    backgroundColor: '#fff', borderRadius: 12,
    elevation: 5, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  zoomDiv: {
    height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 8,
  },

  // Panel
  panel:       { backgroundColor: '#fff', overflow: 'hidden', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  tabBar:      {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    paddingHorizontal: 16, paddingTop: 12, gap: 4,
  },
  tab:         {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:   { borderBottomColor: '#3477eb' },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTxtActive:{ color: '#3477eb' },

  // Bottom bar
 bottomBar: {
  backgroundColor: '#fff', paddingHorizontal: 16,
  paddingTop: 10,
  // ✅ paddingBottom removed from here — now supplied inline via
  //    `10 + insets.bottom` (real safe-area inset) at the usage site above.
  borderTopWidth: 1, borderTopColor: '#f1f5f9',
  elevation: 12, shadowColor: '#000',
  shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 8,
},
  miniStats: {
    flexDirection: 'row', backgroundColor: '#f8fafc',
    borderRadius: 12, paddingVertical: 40, paddingHorizontal: 12, marginBottom: 8,
  },
  miniItem:    { flex: 1, alignItems: 'center', gap: 3 },
  miniDiv:     { width: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
  miniIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniIconWrap:{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  miniLbl:     { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  miniVal:     { fontSize: 12, color: '#1e293b', fontWeight: '700', textAlign: 'center' },

  infoBox:  {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#fef3c7', borderRadius: 10, padding: 9,
    marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
  infoBlue:  { backgroundColor: '#eff6ff', borderLeftColor: '#3477eb' },
  infoTxt:   { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '500' },

  toggleRow:   { alignItems: 'center', paddingTop: 6 },
  handleBar:   { width: 34, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 6 },
  toggleInner: { flexDirection: 'row', alignItems: 'center', gap: 7, width: '100%', paddingHorizontal: 2 },
  toggleLbl:   { flex: 1, fontSize: 14, color: '#3477eb', fontWeight: '700' },
});

// ── Stat card styles ──────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  // location strip
  locStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0',
  },
  locTxt:     { flex: 1, fontSize: 11, color: '#475569', fontWeight: '500' },
  locTimePill:{ backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  locTime:    { fontSize: 10, color: '#3477eb', fontWeight: '700' },

  // ── 4-box top row ──────────────────────────────────────
  grid4: {
    flexDirection: 'row', gap: 8, marginBottom: 8,
  },
  box: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  boxIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  boxVal:  { fontSize: 15, fontWeight: '900', color: '#0f172a', lineHeight: 18 },
  boxUnit: { fontSize: 9,  fontWeight: '600', color: '#3477eb', marginTop: 1 },
  boxLbl:  { fontSize: 9,  fontWeight: '600', color: '#94a3b8', marginTop: 3, textAlign: 'center' },

  // ── 3-box middle row ────────────────────────────────────
  grid3: {
    flexDirection: 'row', gap: 8, marginBottom: 8,
  },
  timeBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeBoxVal: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  timeBoxLbl: { fontSize: 9,  fontWeight: '600', color: '#94a3b8', letterSpacing: 0.3 },

  // ── Driver card ─────────────────────────────────────────
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#e2e8f0', marginTop: 2,
  },
  driverAvaBig: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  driverLbl:  { fontSize: 9, color: '#94a3b8', fontWeight: '700', letterSpacing: 0.5 },
  driverName: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 1 },
  routePill:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, maxWidth: 90,
  },
  routePillTxt: { fontSize: 10, color: '#78350f', fontWeight: '600', flex: 1 },
  callBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#16a34a', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10,
  },
  callTxt:    { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ── Timeline styles ───────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  sectionLbl:{ fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.3, marginBottom: 14 },
  row:       { flexDirection: 'row', marginBottom: 14 },
  leftCol:   { alignItems: 'center', width: 30, marginRight: 10 },
  dot:       { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dotGreen:  { backgroundColor: '#22c55e' },
  dotOrange: { backgroundColor: '#f97316' },
  stopNum:   { color: '#fff', fontSize: 10, fontWeight: '800' },
  line:      { width: 2, flex: 1, minHeight: 20, backgroundColor: '#e2e8f0', marginTop: 3 },
  card:      {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt:  { fontSize: 11, fontWeight: '700' },
  dur:       { fontSize: 12, fontWeight: '700', color: '#334155' },
  time:      { fontSize: 11, color: '#94a3b8', marginBottom: 5 },
  info:      { fontSize: 12, color: '#475569', lineHeight: 18 },
  alertLink: { fontSize: 12, color: '#3477eb', marginTop: 6, fontWeight: '600' },
});

// ── Date picker styles ────────────────────────────────────────────────────────
const dp = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.45)' },
  sheet:    {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9, elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 14,
  },
  handle:   { width: 38, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  title:    { flex: 1, fontSize: 16, fontWeight: '700', color: '#1e293b' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },

  rangeCard:  { margin: 14, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  rRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  rRowActive: { backgroundColor: '#eff6ff' },
  rBar:       { width: 4, height: 28, borderRadius: 2 },
  rLbl:       { fontSize: 12, fontWeight: '700', color: '#374151', width: 32 },
  rField:     { flex: 1, backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#dbeafe' },
  rFieldTxt:  { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  rDiv:       { height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 12 },

  twBox:   { backgroundColor: '#eff6ff', margin: 10, marginTop: 2, borderRadius: 12, padding: 12 },
  twLbl:   { fontSize: 10, fontWeight: '700', color: '#3477eb', marginBottom: 8, letterSpacing: 0.6, textTransform: 'uppercase' },
  twRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  twUnit:  { alignItems: 'center', gap: 2 },
  twColon: { fontSize: 22, fontWeight: '800', color: '#94a3b8' },
  twVal:   { fontSize: 22, fontWeight: '800', color: '#1e293b', width: 44, textAlign: 'center' },
  ampm:    { backgroundColor: '#3477eb', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, marginLeft: 4 },
  ampmTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  calWrap:  { paddingHorizontal: 14, paddingBottom: 8 },
  calNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  calTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  wdRow:    { flexDirection: 'row', marginBottom: 3 },
  wd:       { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94a3b8', paddingVertical: 3 },
  cell:     { flex: 1, height: 38, justifyContent: 'center', alignItems: 'center' },
  cellRange:   { backgroundColor: '#dbeafe' },
  cellSel:     { backgroundColor: '#3477eb', borderRadius: 10 },
  cellTxt:     { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  cellTxtRange:{ color: '#1d4ed8', fontWeight: '600' },
  cellTxtSel:  { color: '#fff', fontWeight: '700' },

  footer:   {
    padding: 14,
    // ✅ paddingBottom removed from here — now supplied inline via
    //    `14 + insets.bottom` (real safe-area inset) at the usage site above.
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  applyBtn: { backgroundColor: '#3477eb', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  applyTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default VehicleDetailScreen;