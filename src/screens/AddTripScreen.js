import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, FlatList, Platform, Alert,
  ActivityIndicator, KeyboardAvoidingView, Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { WebView } from 'react-native-webview';
import { apiGet, apiPost, ENDPOINTS } from '../utils/Api';

const ROUTE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ─── Time slots ───────────────────────────────────────────────────────────────
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const min = m.toString().padStart(2, '0');
      const suffix = h < 12 ? 'AM' : 'PM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push({ label: `${displayHour.toString().padStart(2, '0')}:${min} ${suffix}`, hour: h, minute: m });
    }
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots();
const DROPDOWN_HEIGHT = 220;

// ─── Date helpers (vehicle availability) ──────────────────────────────────────
const startOfDayLocal = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtLong = (d) =>
  d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// VehicleScreen sends '—' when the API has no availability place
const isValidPlace = (p) => {
  const t = String(p || '').trim();
  return !!t && t !== '—' && t !== '-';
};

// ─────────────────────────────────────────────────────────────────────────────
// Locality helpers (same logic as the web CreateTrip)
// ─────────────────────────────────────────────────────────────────────────────
const GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

const INDIAN_STATES = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
  'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
  'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
  'odisha', 'orissa', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana',
  'tripura', 'uttar pradesh', 'uttarakhand', 'uttaranchal', 'west bengal',
  'delhi', 'nct of delhi', 'jammu and kashmir', 'ladakh', 'chandigarh', 'puducherry',
  'pondicherry', 'lakshadweep', 'andaman and nicobar islands',
  'dadra and nagar haveli and daman and diu', 'dadra and nagar haveli', 'daman and diu',
]);

const LOCALITY_MAP = {
  'north delhi': 'Delhi', 'south delhi': 'Delhi', 'east delhi': 'Delhi', 'west delhi': 'Delhi',
  'central delhi': 'Delhi', 'north east delhi': 'Delhi', 'north west delhi': 'Delhi',
  'south east delhi': 'Delhi', 'south west delhi': 'Delhi', 'new delhi': 'Delhi',
  'mumbai suburban': 'Mumbai', 'mumbai city': 'Mumbai', 'west mumbai': 'Mumbai', 'east mumbai': 'Mumbai',
  'bangalore urban': 'Bangalore', 'bangalore rural': 'Bangalore',
  'hyderabad urban': 'Hyderabad', 'hyderabad district': 'Hyderabad',
  'pune district': 'Pune',
  'ahmedabad district': 'Ahmedabad',
  'greater noida': 'Noida', 'noida': 'Noida', 'noida city': 'Noida',
  'gautam buddha nagar': 'Noida', 'gautam buddha nagar district': 'Noida',
};

const normalizeLocality = (locality) => {
  if (!locality) return '';
  const value = locality.trim().toLowerCase();
  return LOCALITY_MAP[value] || locality.trim();
};

const extractLocality = (address) => {
  if (!address) return '';
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^(IND|India)$/i.test(p) && !/\d/.test(p));
  if (!parts.length) return '';
  for (let i = parts.length - 1; i >= 0; i--) {
    if (INDIAN_STATES.has(parts[i].toLowerCase())) {
      return normalizeLocality(i > 0 ? parts[i - 1] : parts[i]);
    }
  }
  return normalizeLocality(parts[0]);
};

// ArcGIS REST (same geocoder the web uses)
const reverseGeocode = async (lng, lat) => {
  try {
    const res = await fetch(
      `${GEOCODE_URL}/reverseGeocode?f=json&location=${lng},${lat}`
    );
    const json = await res.json();
    return (
      json?.address?.Match_addr ||
      json?.address?.LongLabel ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

const forwardGeocode = async (query) => {
  try {
    const res = await fetch(
      `${GEOCODE_URL}/findAddressCandidates?f=json&maxLocations=1&SingleLine=${encodeURIComponent(query)}`
    );
    const json = await res.json();
    const loc = json?.candidates?.[0]?.location;
    return loc ? { lng: loc.x, lat: loc.y } : null;
  } catch {
    return null;
  }
};

// ─── TimeField ────────────────────────────────────────────────────────────────
const TimeField = ({ value, onChange }) => {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const openDropdown = () => {
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setDropPos({ top: y + height + 2, left: x, width });
      setOpen(true);
    });
  };
  return (
    <View>
      <TouchableOpacity ref={triggerRef} style={styles.timeField} onPress={openDropdown} activeOpacity={0.7}>
        <Icon name="clock-outline" size={16} color="#64748B" />
        <Text style={[styles.timeFieldText, !value && styles.placeholder]}>
          {value ? value.label : '--:-- --'}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.dropdownBox, { top: dropPos.top, left: dropPos.left, width: dropPos.width }]}>
          <FlatList
            data={TIME_SLOTS}
            keyExtractor={(item) => item.label}
            showsVerticalScrollIndicator
            style={{ maxHeight: DROPDOWN_HEIGHT }}
            getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
            initialNumToRender={8}
            renderItem={({ item }) => {
              const active = value?.label === item.label;
              return (
                <TouchableOpacity
                  style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                  onPress={() => { onChange(item); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{item.label}</Text>
                  {active && <Icon name="check" size={14} color="#3477eb" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
};

// ─── VehicleField ─────────────────────────────────────────────────────────────
const VehicleField = ({ vehicles, value, onChange, enabled, isLoading }) => {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const openDropdown = () => {
    if (!enabled || isLoading) return;
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setDropPos({ top: y + height + 2, left: x, width });
      setOpen(true);
    });
  };

  return (
    <View>
      <TouchableOpacity
        ref={triggerRef}
        style={[styles.vehicleField, !enabled && styles.vehicleFieldDisabled]}
        onPress={openDropdown}
        activeOpacity={enabled ? 0.7 : 1}
      >
        <Icon name="car-side" size={18} color={enabled ? '#3477eb' : '#94A3B8'} />
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#3477eb" style={{ marginLeft: 8 }} />
            <Text style={[styles.vehicleFieldText, styles.placeholder]}>Loading vehicles...</Text>
          </>
        ) : value ? (
          <View style={styles.vehicleSelectedInline}>
            <View style={styles.vehicleSelectedBadge}>
              <Icon name="car-side" size={14} color="#3477eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleSelectedReg} numberOfLines={1}>{value.registrationNo}</Text>
              <Text style={styles.vehicleSelectedModel} numberOfLines={1}>
                {value.make ? `${value.make}  ` : ''}{value.model || 'No model'}{!value.driverId && '  ⚠️'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.vehicleFieldText, styles.placeholder]}>-- Choose vehicle --</Text>
        )}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.dropdownBox, { top: dropPos.top, left: dropPos.left, width: dropPos.width }]}>
          {vehicles.length === 0 ? (
            <View style={styles.vehicleEmptyDropdown}>
              <Icon name="car-off" size={28} color="#CBD5E1" />
              <Text style={styles.vehicleEmptyText}>No available vehicles</Text>
            </View>
          ) : (
            <FlatList
              data={vehicles}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator
              style={{ maxHeight: DROPDOWN_HEIGHT }}
              getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
              initialNumToRender={8}
              renderItem={({ item }) => {
                const active = value?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.vehicleDropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => { onChange(item); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.vehicleDropdownLeft}>
                      <View style={[styles.vehicleIconCircle, active && styles.vehicleIconCircleActive]}>
                        <Icon name="car-side" size={18} color={active ? '#3477eb' : '#64748B'} />
                      </View>
                      <View style={styles.vehicleTextBlock}>
                        <Text style={[styles.vehicleRegNo, active && styles.dropdownItemTextActive]} numberOfLines={1}>
                          {item.registrationNo}
                        </Text>
                        <Text style={styles.vehicleModel} numberOfLines={1}>
                          {item.make ? `${item.make}  ` : ''}{item.model || 'No model info'}
                          {!item.driverId && '  ⚠️ No driver'}
                        </Text>
                      </View>
                    </View>
                    {active && <Icon name="check-circle" size={18} color="#3477eb" />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─── Location picker (Leaflet in WebView) ─────────────────────────────────────
const buildPickerHTML = (center, zoom, marker) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;}html,body,#map{width:100%;height:100%;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:true}).setView([${center[0]},${center[1]}],${zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
var icon=L.divIcon({html:'<div style="background:#4f46e5;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(79,70,229,.6);"></div>',iconSize:[18,18],iconAnchor:[9,9],className:''});
var mk=null;
function setMarker(lat,lng){ if(mk){mk.setLatLng([lat,lng]);}else{mk=L.marker([lat,lng],{icon:icon}).addTo(map);} }
${marker ? `setMarker(${marker.lat},${marker.lng});` : ''}
map.on('click',function(e){
  setMarker(e.latlng.lat,e.latlng.lng);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'pick',lng:e.latlng.lng,lat:e.latlng.lat}));
});
</script></body></html>`;

const LocationPickerModal = ({ visible, onSelect, onClose, initialQuery = '', initialCoords = null }) => {
  const [html, setHtml] = useState(null);
  const [picked, setPicked] = useState(null); // { lng, lat }
  const [address, setAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  const pickedLocality = extractLocality(address);

  const resolveAddress = useCallback(async (lng, lat) => {
    setPicked({ lng, lat });
    setIsGeocoding(true);
    setAddress('');
    const addr = await reverseGeocode(lng, lat);
    setAddress(addr);
    setIsGeocoding(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setHtml(null);
    setPicked(null);
    setAddress('');

    (async () => {
      let center = [20.5937, 78.9629];
      let zoom = 5;
      if (initialCoords) {
        center = [initialCoords.lat, initialCoords.lng];
        zoom = 14;
        resolveAddress(initialCoords.lng, initialCoords.lat);
      } else if (initialQuery?.trim()) {
        setIsZooming(true);
        const loc = await forwardGeocode(initialQuery.trim());
        if (loc) { center = [loc.lat, loc.lng]; zoom = 12; }
        if (active) setIsZooming(false);
      }
      if (active) setHtml(buildPickerHTML(center, zoom, initialCoords));
    })();

    return () => { active = false; };
  }, [visible]);

  const onWebMsg = (e) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'pick') resolveAddress(d.lng, d.lat);
    } catch {}
  };

  const handleConfirm = () => {
    // Only the locality (e.g. "Mumbai") goes to the input; fallback = full address
    if (address && picked) onSelect(pickedLocality || address, picked);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={ms.container}>
        <LinearGradient colors={['#3477eb', '#2563eb']} style={ms.header}>
          <TouchableOpacity onPress={onClose} style={ms.backBtn}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={ms.headerMid}>
            <Text style={ms.headerTitle}>Pick Location on Map</Text>
            <Text style={ms.headerSub}>Tap anywhere on the map to select</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <View style={ms.mapArea}>
          {!html || isZooming ? (
            <View style={ms.loaderBox}>
              <ActivityIndicator size="large" color="#3477eb" />
              <Text style={ms.loaderTxt}>{isZooming ? `Locating ${initialQuery}...` : 'Loading map...'}</Text>
            </View>
          ) : (
            <WebView
              source={{ html }}
              style={StyleSheet.absoluteFill}
              onMessage={onWebMsg}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
            />
          )}
        </View>

        <View style={ms.pickFooter}>
          <View style={{ flex: 1 }}>
            {isGeocoding ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#3477eb" />
                <Text style={ms.pickAddrLoading}>Getting address...</Text>
              </View>
            ) : address ? (
              <>
                <Text style={ms.pickAddr} numberOfLines={2}>{address}</Text>
                {!!pickedLocality && <Text style={ms.pickLocality}>Will use: {pickedLocality}</Text>}
              </>
            ) : (
              <Text style={ms.pickAddrEmpty}>No location selected yet</Text>
            )}
          </View>
          <TouchableOpacity
            style={[ms.pickConfirm, (!address || isGeocoding) && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={!address || isGeocoding}
            activeOpacity={0.85}
          >
            <Text style={ms.pickConfirmTxt}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Route map HTML (routes + numbered waypoint markers) ──────────────────────
const buildMapHTML = (routes, waypoints, initialSelectedIndex) => {
  const routeDataJS = routes.map((r, i) => ({
    coords: r.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [],
    color: ROUTE_COLORS[i % ROUTE_COLORS.length],
  }));
  const wpJS = (waypoints || [])
    .filter((w) => Array.isArray(w?.location))
    .map((w) => [w.location[1], w.location[0]]); // [lat, lng]

  let initLat = 20.5937, initLng = 78.9629, initZoom = 5;
  if (routeDataJS[0]?.coords?.length > 0) {
    initLat = routeDataJS[0].coords[0][0];
    initLng = routeDataJS[0].coords[0][1];
    initZoom = 7;
  }

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box;}html,body,#map{width:100%;height:100%;overflow:hidden;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false}).setView([${initLat},${initLng}],${initZoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
var routeData=${JSON.stringify(routeDataJS)};
var wps=${JSON.stringify(wpJS)};
var selectedIdx=${initialSelectedIndex !== null ? initialSelectedIndex : -1};
var polylines=[];
function notify(obj){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(obj));}
function drawRoutes(){
  polylines.forEach(function(p){map.removeLayer(p);});polylines=[];
  routeData.forEach(function(r,i){
    if(!r.coords||r.coords.length<2)return;
    var isSel=(i===selectedIdx);
    var p=L.polyline(r.coords,{color:isSel?r.color:'#9ca3af',weight:isSel?8:5,opacity:isSel?1:0.65,dashArray:isSel?null:'8 6',lineJoin:'round'}).addTo(map);
    p.on('click',function(){selectRoute(i);notify({type:'routeSelected',index:i});});
    polylines.push(p);
  });
}
function drawWaypoints(){
  wps.forEach(function(w,i){
    var color=i===0?'#4f46e5':(i===wps.length-1?'#22c55e':'#f59e0b');
    var icon=L.divIcon({html:'<div style="background:'+color+';color:#fff;width:26px;height:26px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:bold 11px sans-serif;">'+(i+1)+'</div>',iconSize:[26,26],iconAnchor:[13,13],className:''});
    L.marker(w,{icon:icon}).addTo(map);
  });
}
function selectRoute(idx){selectedIdx=idx;drawRoutes();
  if(routeData[idx]&&routeData[idx].coords.length>=2){try{map.fitBounds(L.latLngBounds(routeData[idx].coords).pad(0.15));}catch(e){}}
}
function fitAll(){var all=[];routeData.forEach(function(r){all=all.concat(r.coords);});all=all.concat(wps);
  if(all.length>1){try{map.fitBounds(L.latLngBounds(all).pad(0.12));}catch(e){}}
}
drawRoutes();drawWaypoints();fitAll();notify({type:'mapLoaded'});
</script></body></html>`;
};

// ─── Route Map Modal ──────────────────────────────────────────────────────────
const RouteMapModal = ({ visible, routes, waypoints, selectedIndex, onSelectRoute, onConfirm, onClose, routeLabel, isLoading }) => {
  const webViewRef = useRef(null);
  const injectJS = (code) => webViewRef.current?.injectJavaScript(`(function(){try{${code}}catch(e){}})();true;`);
  const onWebMsg = (e) => {
    try { const d = JSON.parse(e.nativeEvent.data); if (d.type === 'routeSelected') onSelectRoute(d.index); } catch {}
  };
  const handleCardTap = (idx) => { onSelectRoute(idx); injectJS(`selectRoute(${idx});`); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={ms.container}>
        <LinearGradient colors={['#3477eb', '#2563eb']} style={ms.header}>
          <TouchableOpacity onPress={onClose} style={ms.backBtn}><Icon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
          <View style={ms.headerMid}>
            <Text style={ms.headerTitle}>Select Route</Text>
            <Text style={ms.headerSub} numberOfLines={1}>{routeLabel}</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <View style={ms.mapArea}>
          {isLoading ? (
            <View style={ms.loaderBox}><ActivityIndicator size="large" color="#3477eb" /><Text style={ms.loaderTxt}>Finding best routes...</Text></View>
          ) : (
            <WebView ref={webViewRef} source={{ html: buildMapHTML(routes, waypoints, selectedIndex) }}
              style={StyleSheet.absoluteFill} onMessage={onWebMsg} javaScriptEnabled domStorageEnabled scrollEnabled={false} originWhitelist={['*']} />
          )}
          {!isLoading && (
            <View style={ms.statusChip}>
              <Icon name={selectedIndex !== null ? 'check-circle' : 'gesture-tap'} size={14} color={selectedIndex !== null ? '#3477eb' : '#64748B'} />
              <Text style={[ms.statusTxt, selectedIndex !== null && ms.statusTxtActive]}>
                {selectedIndex !== null ? `Route ${selectedIndex + 1} selected  ·  tap to change` : 'Tap a route line to select it'}
              </Text>
            </View>
          )}
        </View>

        {!isLoading && routes.length > 0 && (
          <View style={ms.cardsStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ms.cardsScroll}>
              {routes.map((r, i) => {
                const isSel = i === selectedIndex;
                const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                const dist = r.distance ? (r.distance / 1000).toFixed(1) : null;
                const dur = r.duration ? Math.round(r.duration / 60) : null;
                return (
                  <TouchableOpacity key={`route-card-${i}`} style={[ms.card, isSel && { borderColor: color, borderWidth: 2 }]}
                    onPress={() => handleCardTap(i)} activeOpacity={0.8}>
                    <View style={[ms.cardDot, { backgroundColor: color }]} />
                    <Text style={[ms.cardTitle, isSel && { color }]}>Route {i + 1}</Text>
                    {dist && <Text style={ms.cardMeta}>📏 {dist} km</Text>}
                    {dur && <Text style={ms.cardMeta}>⏱ ~{dur} min</Text>}
                    {isSel && <View style={[ms.cardCheck, { backgroundColor: color }]}><Icon name="check" size={10} color="#fff" /></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={ms.confirmRow}>
          <TouchableOpacity style={[ms.confirmBtn, selectedIndex === null && ms.confirmBtnDisabled]}
            onPress={onConfirm} disabled={selectedIndex === null} activeOpacity={0.85}>
            <LinearGradient colors={selectedIndex !== null ? ['#3477eb', '#5a94f5'] : ['#E2E8F0', '#E2E8F0']} style={ms.confirmGradient}>
              <Icon name="check" size={20} color={selectedIndex !== null ? '#fff' : '#94A3B8'} />
              <Text style={[ms.confirmTxt, selectedIndex === null && { color: '#94A3B8' }]}>
                {selectedIndex !== null ? `Confirm Route ${selectedIndex + 1}` : 'Select a Route First'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Location input with map-pin button ───────────────────────────────────────
const LocationInput = ({ label, value, placeholder, color, pinned, onChangeText, onPickMap, onRemove }) => (
  <View style={{ marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      {pinned && (
        <View style={styles.pinnedBadge}>
          <Icon name="map-marker-check" size={12} color="#16a34a" />
          <Text style={styles.pinnedText}>Pinned</Text>
        </View>
      )}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={[styles.inputContainer, { flex: 1, borderColor: pinned ? '#86efac' : '#E2E8F0' }]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity onPress={onPickMap} style={[styles.pinBtn, { backgroundColor: color }]} activeOpacity={0.8}>
          <Icon name="map-marker" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} activeOpacity={0.8}>
          <Icon name="close" size={16} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// ─── Add Trip Screen ──────────────────────────────────────────────────────────
const AddTripScreen = ({ navigation, route }) => {
  // Vehicle card (VehicleScreen) → navigation.navigate('AddTrip', { vehicle })
  const vehicleParam = route?.params?.vehicle || null;

  // ✅ Default FROM = vehicle's "Next Available At" place (user can still change it)
  const defaultSource = isValidPlace(vehicleParam?.availabilityPlace)
    ? String(vehicleParam.availabilityPlace).trim()
    : '';

  // ✅ Departure can be picked only from (Next Available date + 1 day)
  //    e.g. next available 30 Oct 2026 → departure enabled from 31 Oct 2026
  const nextAvailableDate = useMemo(() => {
    const raw = vehicleParam?.nextAvailableDate;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }, [vehicleParam?.nextAvailableDate]);

  const minDepartureDate = useMemo(() => {
    if (!nextAvailableDate) return null;
    const afterNext = addDays(nextAvailableDate, 1);
    const today = startOfDayLocal(new Date());
    return afterNext > today ? afterNext : today; // never earlier than today
  }, [nextAvailableDate]);

  const [source, setSource] = useState(defaultSource);
  const [sourceCoords, setSourceCoords] = useState(null);
  const [destination, setDestination] = useState('');
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [stops, setStops] = useState([]); // [{ id, name, coords }]
  const stopIdRef = useRef(0);
  const [geofenceRadius, setGeofenceRadius] = useState(500);

  const [departureDate, setDepartureDate] = useState(null);
  const [departureTime, setDepartureTime] = useState(null);
  const [showDepartureDatePicker, setShowDepartureDatePicker] = useState(false);
  const [arrivalDate, setArrivalDate] = useState(null);
  const [arrivalTime, setArrivalTime] = useState(null);
  const [showArrivalDatePicker, setShowArrivalDatePicker] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

  const [routes, setRoutes] = useState([]);
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [routesFound, setRoutesFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Location picker: null = closed, else { field: 'source' | 'destination' | stopId }
  const [locationPicker, setLocationPicker] = useState(null);

  const selectedRoute = selectedRouteIndex !== null ? routes[selectedRouteIndex] : null;

  // Combined date + time → Date objects / ISO strings (null until both chosen)
  const depDateObj = useMemo(() => {
    if (!departureDate || !departureTime) return null;
    const d = new Date(departureDate);
    d.setHours(departureTime.hour, departureTime.minute, 0, 0);
    return d;
  }, [departureDate, departureTime]);
  const arrDateObj = useMemo(() => {
    if (!arrivalDate || !arrivalTime) return null;
    const d = new Date(arrivalDate);
    d.setHours(arrivalTime.hour, arrivalTime.minute, 0, 0);
    return d;
  }, [arrivalDate, arrivalTime]);
  const depISO = depDateObj ? depDateObj.toISOString() : '';
  const arrISO = arrDateObj ? arrDateObj.toISOString() : '';

  const canSubmit = !isLoading && routesFound && !!selectedRoute && !!selectedVehicle && !!selectedVehicle.driverId;

  const formatDate = (d) => d
    ? d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : 'mm/dd/yyyy';

  const stopNames = stops.map((s) => s.name.trim()).filter(Boolean);
  const routeLabel = [source, ...stopNames, destination].filter(Boolean).join(' → ');

  // ── Departure date picked ──
  const handleDepartureDate = (date) => {
    setDepartureDate(date);
    // arrival can't be before the (new) departure date
    if (arrivalDate && startOfDayLocal(arrivalDate) < startOfDayLocal(date)) {
      setArrivalDate(null);
    }
  };

  // ── Location picker select ──
  const handleLocationSelect = (address, coords) => {
    if (!locationPicker) return;
    if (locationPicker.field === 'source') {
      setSource(address); setSourceCoords(coords || null);
    } else if (locationPicker.field === 'destination') {
      setDestination(address); setDestinationCoords(coords || null);
    } else {
      setStops((prev) => prev.map((s) =>
        s.id === locationPicker.field ? { ...s, name: address, coords: coords || null } : s));
    }
    setLocationPicker(null);
  };

  // ── Stop helpers ──
  const addStop = () => setStops((prev) => [...prev, { id: ++stopIdRef.current, name: '', coords: null }]);
  const removeStop = (id) => setStops((prev) => prev.filter((s) => s.id !== id));
  const updateStop = (id, name) => setStops((prev) => prev.map((s) => (s.id === id ? { ...s, name, coords: null } : s)));

  // Pinned → "lng,lat", otherwise the typed name (same as web)
  const routeValue = (name, coords) => (coords ? `${coords.lng},${coords.lat}` : name);

  const pickerInfo = (() => {
    if (!locationPicker) return { coords: null, name: '' };
    const f = locationPicker.field;
    if (f === 'source') return { coords: sourceCoords, name: source };
    if (f === 'destination') return { coords: destinationCoords, name: destination };
    const st = stops.find((s) => s.id === f);
    return { coords: st?.coords || null, name: st?.name || '' };
  })();

  // ── Load available vehicles (source + departure + arrival) ──
  useEffect(() => {
    if (!source.trim() || !depISO || !arrISO) {
      setVehicles([]);
      setSelectedVehicle(null);
      return;
    }

    let active = true;
    const loadVehicles = async () => {
      setIsLoadingVehicles(true);
      try {
        const endpoint = ENDPOINTS.VEHICLES_AVAILABLE(depISO, arrISO, source.trim());

        // Fallback: resolve drivers from active assignments if the vehicle has no driverId
        const [vehResponse, assignResponse] = await Promise.all([
          apiGet(endpoint),
          apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS).catch(() => []),
        ]);
        if (!active) return;

        const data = Array.isArray(vehResponse)
          ? vehResponse
          : Array.isArray(vehResponse?.data) ? vehResponse.data : (vehResponse?.data?.data || []);
        const assignRaw = Array.isArray(assignResponse)
          ? assignResponse
          : (assignResponse?.data || assignResponse?.assignments || []);

        const driverIdByVehicleId = {};
        assignRaw.forEach((a) => {
          if (a.status && a.status !== 'ACTIVE') return;
          const vid = typeof a.vehicle_id === 'object' ? a.vehicle_id?._id : a.vehicle_id;
          const did = typeof a.driver_id === 'object' ? a.driver_id?._id : a.driver_id;
          if (vid && did) driverIdByVehicleId[vid] = did;
        });

        setVehicles(data.map((v) => {
          const vid = v.vehicleId || v._id;
          return {
            id: vid,
            registrationNo: v.registration_number || v.registrationNo || 'Unknown',
            model: v.model || '',
            make: v.make || '',
            driverId: v.driverId || v.driver_id || driverIdByVehicleId[vid] || null,
          };
        }));
        setSelectedVehicle(null);
        if (data.length === 0) Alert.alert('No Vehicles', 'No vehicles available for the selected time and location.');
      } catch (error) {
        if (!active) return;
        Alert.alert('Error', 'Failed to load available vehicles: ' + error.message);
        setVehicles([]);
      } finally {
        if (active) setIsLoadingVehicles(false);
      }
    };

    loadVehicles();
    return () => { active = false; };
  }, [source, depISO, arrISO]);

  // ── Find Routes ───────────────────────────────────────────────────────────
  const handleFindRoutes = async () => {
    if (!source.trim() || !destination.trim()) { Alert.alert('Error', 'Please enter Source and Destination'); return; }
    if (!departureDate || !departureTime) { Alert.alert('Error', 'Please select Departure Date & Time'); return; }
    if (!arrivalDate || !arrivalTime) { Alert.alert('Error', 'Please select Arrival Date & Time'); return; }
    if (stopNames.length !== stops.length) { Alert.alert('Error', 'Please fill in all stop names or remove empty stops.'); return; }

    setIsLoadingRoutes(true);
    setMapVisible(true);
    setRoutes([]);
    setRouteWaypoints([]);
    setSelectedRouteIndex(null);
    setRoutesFound(false);
    setSelectedVehicle(null);

    try {
      const srcVal = routeValue(source.trim(), sourceCoords);
      const dstVal = routeValue(destination.trim(), destinationCoords);
      const stopVals = stops.map((s) => routeValue(s.name.trim(), s.coords));

      const endpoint = ENDPOINTS.ROUTES_MULTI_STOPS(srcVal, dstVal, stopVals);
      console.log('🗺️ Routes endpoint:', endpoint);
      const response = await apiGet(endpoint);

      // Backend returns { routes, waypoints } (may be wrapped in `data`)
      const body = Array.isArray(response) ? { routes: response } : (response?.routes ? response : response?.data || {});
      const routeList = Array.isArray(body) ? body : (body.routes || []);
      const wpList = body.waypoints || [];

      if (!routeList.length) {
        Alert.alert('No Routes', 'No routes found between these locations.');
        setMapVisible(false);
        return;
      }
      if (!routeList[0]?.geometry?.coordinates?.length) {
        Alert.alert('Data Error', 'Routes found but no geometry was returned.');
        setMapVisible(false);
        return;
      }

      setRoutes(routeList);
      setRouteWaypoints(wpList);
      setRoutesFound(true);
    } catch (error) {
      Alert.alert('Error fetching routes', error.message || 'Unknown error');
      setMapVisible(false);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // ── Submit Trip (same payload as web handleAssign) ────────────────────────
  const handleAddTrip = async () => {
    if (!selectedRoute || !selectedVehicle || !depDateObj || !arrDateObj) {
      Alert.alert('Validation', 'Please complete all required fields.');
      return;
    }
    if (!selectedVehicle.driverId) {
      Alert.alert('No Driver', 'First assign driver to the vehicle and then create trip');
      return;
    }
    if (minDepartureDate && startOfDayLocal(depDateObj) < minDepartureDate) {
      Alert.alert(
        'Validation',
        `Departure must be on or after ${fmtLong(minDepartureDate)} (vehicle is on a trip until ${fmtLong(nextAvailableDate)}).`
      );
      return;
    }
    if (arrDateObj <= depDateObj) { Alert.alert('Validation', 'Arrival must be after Departure'); return; }

    const payload = {
      route: {
        _id: selectedRoute._id,
        source,
        destination,
        stops: stopNames,
        geometry: selectedRoute.geometry,
      },
      geofenceRadius,
      departureTime: depISO,
      arrivalTime: arrISO,
      vehicleId: selectedVehicle.id,
      driverId: selectedVehicle.driverId,
    };

    console.log('📤 Trip payload:', JSON.stringify({ ...payload, route: { ...payload.route, geometry: '[geometry]' } }, null, 2));

    setIsLoading(true);
    try {
      const response = await apiPost(ENDPOINTS.TRIPS, payload);
      if (response?.success) {
        Alert.alert('✅ Success', response.message || 'Trip created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', response?.message || 'Failed to create trip');
      }
    } catch (error) {
      Alert.alert('Error', 'Error creating trip: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const vehicleEnabled = !!(source.trim() && depISO && arrISO);

  // Departure picker start value must not be before the minimum date
  const departurePickerValue = departureDate || minDepartureDate || new Date();
  const arrivalMinDate = departureDate || minDepartureDate || undefined;
  const arrivalPickerValue = arrivalDate || departureDate || minDepartureDate || new Date();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#3477eb', '#2563eb']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Trip</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>

            {/* ── Vehicle availability info (only when opened from a vehicle card) ── */}
            {!!vehicleParam && (!!defaultSource || !!minDepartureDate) && (
              <View style={styles.availBanner}>
                <Icon name="information-outline" size={18} color="#1D4ED8" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.availBannerTitle} numberOfLines={1}>
                    {vehicleParam.name || 'Vehicle'}
                  </Text>
                  {!!defaultSource && (
                    <Text style={styles.availBannerText}>
                      Next available at <Text style={styles.availBannerBold}>{defaultSource}</Text> (set as From — you can change it)
                    </Text>
                  )}
                  {!!minDepartureDate && !!nextAvailableDate && (
                    <Text style={styles.availBannerText}>
                      On a trip until <Text style={styles.availBannerBold}>{fmtLong(nextAvailableDate)}</Text>.
                      {' '}Departure can be selected from <Text style={styles.availBannerBold}>{fmtLong(minDepartureDate)}</Text>.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* ── From / Stops / To ── */}
            <View>
              <LocationInput
                label="FROM"
                color="#4f46e5"
                placeholder="e.g. Nagpur, Mumbai..."
                value={source}
                pinned={!!sourceCoords}
                onChangeText={(t) => { setSource(t); setSourceCoords(null); }}
                onPickMap={() => setLocationPicker({ field: 'source' })}
              />

              {stops.map((stop, idx) => (
                <LocationInput
                  key={stop.id}
                  label={`STOP ${idx + 1}`}
                  color="#f59e0b"
                  placeholder="e.g. Wardha, Amravati..."
                  value={stop.name}
                  pinned={!!stop.coords}
                  onChangeText={(t) => updateStop(stop.id, t)}
                  onPickMap={() => setLocationPicker({ field: stop.id })}
                  onRemove={() => removeStop(stop.id)}
                />
              ))}

              <TouchableOpacity style={styles.addStopBtn} onPress={addStop} activeOpacity={0.8}>
                <Icon name="plus-circle-outline" size={18} color="#4f46e5" />
                <Text style={styles.addStopText}>Add Stop</Text>
              </TouchableOpacity>

              <LocationInput
                label="TO"
                color="#22c55e"
                placeholder="e.g. Delhi, Jaipur..."
                value={destination}
                pinned={!!destinationCoords}
                onChangeText={(t) => { setDestination(t); setDestinationCoords(null); }}
                onPickMap={() => setLocationPicker({ field: 'destination' })}
              />

              {stops.length > 0 && (
                <View style={styles.badgeRow}>
                  {[source || 'Source', ...stops.map((s) => s.name || '…'), destination || 'Destination'].map((label, i, arr) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[
                        styles.badge,
                        i === 0 ? styles.badgeSrc : i === arr.length - 1 ? styles.badgeDst : styles.badgeStop,
                      ]}>{label}</Text>
                      {i < arr.length - 1 && <Text style={styles.badgeArrow}> → </Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Departure | Arrival ── */}
            <View style={styles.rowTwo}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Departure <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.dateField} onPress={() => setShowDepartureDatePicker(true)} activeOpacity={0.7}>
                  <Icon name="calendar" size={16} color="#64748B" />
                  <Text style={[styles.dateFieldText, !departureDate && styles.placeholder]}>{formatDate(departureDate)}</Text>
                </TouchableOpacity>
                <TimeField value={departureTime} onChange={setDepartureTime} />
                {!!minDepartureDate && (
                  <Text style={styles.dateHint}>From {fmtLong(minDepartureDate)}</Text>
                )}
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Arrival <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.dateField} onPress={() => setShowArrivalDatePicker(true)} activeOpacity={0.7}>
                  <Icon name="calendar" size={16} color="#64748B" />
                  <Text style={[styles.dateFieldText, !arrivalDate && styles.placeholder]}>{formatDate(arrivalDate)}</Text>
                </TouchableOpacity>
                <TimeField value={arrivalTime} onChange={setArrivalTime} />
              </View>
            </View>

            {/* ── Geofence radius ── */}
            <View>
              <Text style={styles.label}>Geofence Radius</Text>
              <Text style={styles.vehicleHint}>Allowed deviation corridor around the route</Text>
              <View style={styles.geoRow}>
                <TouchableOpacity style={styles.geoBtn} activeOpacity={0.7}
                  onPress={() => setGeofenceRadius((r) => Math.max(100, r - 100))}>
                  <Icon name="minus" size={20} color="#4f46e5" />
                </TouchableOpacity>
                <View style={styles.geoValue}>
                  <Text style={styles.geoValueText}>{geofenceRadius} m</Text>
                </View>
                <TouchableOpacity style={styles.geoBtn} activeOpacity={0.7}
                  onPress={() => setGeofenceRadius((r) => Math.min(5000, r + 100))}>
                  <Icon name="plus" size={20} color="#4f46e5" />
                </TouchableOpacity>
              </View>
              <View style={styles.geoChips}>
                {[200, 500, 1000, 2500, 5000].map((v) => (
                  <TouchableOpacity key={v} onPress={() => setGeofenceRadius(v)}
                    style={[styles.geoChip, geofenceRadius === v && styles.geoChipActive]}>
                    <Text style={[styles.geoChipText, geofenceRadius === v && styles.geoChipTextActive]}>{v}m</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.geoHint}>100m (tight) — 5000m (wide)</Text>
            </View>

            {/* ── Find Routes ── */}
            <TouchableOpacity style={[styles.findButton, isLoadingRoutes && { opacity: 0.7 }]}
              onPress={handleFindRoutes} activeOpacity={0.8} disabled={isLoadingRoutes}>
              <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.findButtonGradient}>
                {isLoadingRoutes ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="map-search" size={20} color="#FFFFFF" />}
                <Text style={styles.findButtonText}>{isLoadingRoutes ? 'Searching...' : 'Find Routes'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Route summary ── */}
            {routesFound && (
              <>
                {!selectedRoute && (
                  <View style={styles.routeWarningBanner}>
                    <Icon name="alert-circle-outline" size={16} color="#D97706" />
                    <Text style={styles.routeWarningText}>Tap below to open the map and select a route</Text>
                  </View>
                )}
                <TouchableOpacity style={[styles.routeSummaryBox, selectedRoute && styles.routeSummaryBoxSelected]}
                  onPress={() => setMapVisible(true)} activeOpacity={0.8}>
                  <View style={styles.routeSummaryLeft}>
                    <View style={[styles.routeSummaryIcon, selectedRoute && styles.routeSummaryIconSelected]}>
                      <Icon name={selectedRoute ? 'map-check' : 'map-marker-question'} size={20}
                        color={selectedRoute ? '#3477eb' : '#D97706'} />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.routeSummaryTitle, { color: selectedRoute ? '#1E293B' : '#D97706' }]}>
                        {selectedRoute ? `Route ${selectedRouteIndex + 1} Selected ✓` : '⚠️ No route selected — tap to choose'}
                      </Text>
                      <Text style={styles.routeSummaryMeta} numberOfLines={2}>
                        {selectedRoute
                          ? `${routeLabel}${selectedRoute.distance ? '  •  ' + (selectedRoute.distance / 1000).toFixed(1) + ' km' : ''}`
                          : 'Open map and tap a route line to select it'}
                      </Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={20} color="#64748B" />
                </TouchableOpacity>
              </>
            )}

            {/* ── Vehicle picker ── */}
            <View>
              <Text style={styles.label}>
                Choose Vehicle
                {isLoadingVehicles && <Text style={styles.optionalText}> (loading...)</Text>}
                {!isLoadingVehicles && !source.trim() && <Text style={styles.optionalText}> (enter source first)</Text>}
              </Text>
              <Text style={styles.vehicleHint}>
                {vehicleEnabled
                  ? `Available at ${source}  ·  ${formatDate(departureDate)} – ${formatDate(arrivalDate)}`
                  : 'Fill in source, departure & arrival date/time to load vehicles'}
              </Text>
              <VehicleField
                vehicles={vehicles}
                value={selectedVehicle}
                onChange={setSelectedVehicle}
                enabled={vehicleEnabled}
                isLoading={isLoadingVehicles}
              />
              {selectedVehicle && !selectedVehicle.driverId && (
                <View style={styles.driverWarning}>
                  <Icon name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.driverWarningText}>
                    No driver assigned. First assign driver to the vehicle and then create trip.
                  </Text>
                </View>
              )}
            </View>

            {/* ── Submit ── */}
            <TouchableOpacity style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleAddTrip} activeOpacity={0.8} disabled={!canSubmit}>
              <LinearGradient colors={canSubmit ? ['#4CAF50', '#66BB6A'] : ['#94A3B8', '#94A3B8']} style={styles.submitButtonGradient}>
                {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Icon name="check-circle-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>
                      {!routesFound ? 'Find Routes First'
                        : !selectedRoute ? 'Select a Route First'
                          : !selectedVehicle ? 'Select a Vehicle'
                            : !selectedVehicle.driverId ? 'Vehicle Has No Driver'
                              : 'Create Trip'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </ScrollView>

        {/* ✅ Dates before (next available + 1 day) are disabled via minimumDate */}
        {showDepartureDatePicker && (
          <DateTimePicker value={departurePickerValue} mode="date"
            minimumDate={minDepartureDate || undefined}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, date) => {
              setShowDepartureDatePicker(false);
              if (date) handleDepartureDate(date);
            }} />
        )}
        {showArrivalDatePicker && (
          <DateTimePicker value={arrivalPickerValue} mode="date"
            minimumDate={arrivalMinDate}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, date) => { setShowArrivalDatePicker(false); if (date) setArrivalDate(date); }} />
        )}
      </KeyboardAvoidingView>

      <RouteMapModal
        visible={mapVisible}
        routes={routes}
        waypoints={routeWaypoints}
        selectedIndex={selectedRouteIndex}
        onSelectRoute={setSelectedRouteIndex}
        onConfirm={() => setMapVisible(false)}
        onClose={() => setMapVisible(false)}
        routeLabel={routeLabel}
        isLoading={isLoadingRoutes}
      />

      <LocationPickerModal
        visible={!!locationPicker}
        onSelect={handleLocationSelect}
        onClose={() => setLocationPicker(null)}
        initialCoords={pickerInfo.coords}
        initialQuery={pickerInfo.coords ? '' : pickerInfo.name}
      />
    </SafeAreaView>
  );
};

// ─── Map / Picker Modal Styles ────────────────────────────────────────────────
const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, paddingTop: Platform.OS === 'ios' ? 50 : 38 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerMid: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  mapArea: { flex: 1, position: 'relative' },
  loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: '#F8FAFC' },
  loaderTxt: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  statusChip: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  statusTxt: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  statusTxtActive: { color: '#3477eb' },
  cardsStrip: { backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  cardsScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minWidth: 130, borderWidth: 1.5, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, position: 'relative' },
  cardDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 5 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 3 },
  cardMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },
  cardCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  confirmRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  confirmBtn: { borderRadius: 12, overflow: 'hidden', elevation: 3 },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // picker footer
  pickFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  pickAddr: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  pickLocality: { fontSize: 11, color: '#4f46e5', marginTop: 2, fontWeight: '600' },
  pickAddrLoading: { fontSize: 13, color: '#4f46e5' },
  pickAddrEmpty: { fontSize: 13, color: '#94A3B8' },
  pickConfirm: { backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  pickConfirmTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, paddingTop: Platform.OS === 'ios' ? 50 : 40 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  headerRight: { width: 40 },
  tabContent: { flex: 1, padding: 16 },
  scrollContent: { paddingBottom: 60 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  rowTwo: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 6 },
  required: { color: '#EF4444' },
  optionalText: { fontSize: 11, color: '#94A3B8', fontWeight: '400' },

  // vehicle availability banner + date hint
  availBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12 },
  availBannerTitle: { fontSize: 13, fontWeight: '800', color: '#1E3A8A', marginBottom: 2 },
  availBannerText: { fontSize: 12, color: '#1E40AF', lineHeight: 17, marginTop: 2 },
  availBannerBold: { fontWeight: '700' },
  dateHint: { fontSize: 11, color: '#1D4ED8', fontWeight: '600', marginTop: 6 },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingLeft: 12, paddingRight: 6, minHeight: 46 },
  input: { flex: 1, fontSize: 13, color: '#1E293B', paddingVertical: 10 },
  pinBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  removeBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  pinnedText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  addStopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, marginBottom: 12, alignSelf: 'flex-start' },
  addStopText: { fontSize: 13, fontWeight: '600', color: '#4f46e5' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  badge: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', fontWeight: '600' },
  badgeSrc: { backgroundColor: '#E0E7FF', color: '#4338ca' },
  badgeStop: { backgroundColor: '#FEF3C7', color: '#b45309' },
  badgeDst: { backgroundColor: '#DCFCE7', color: '#15803d' },
  badgeArrow: { fontSize: 11, color: '#9CA3AF' },
  geoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  geoBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', justifyContent: 'center', alignItems: 'center' },
  geoValue: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' },
  geoValueText: { fontSize: 15, fontWeight: '700', color: '#4338ca' },
  geoChips: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  geoChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  geoChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  geoChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  geoChipTextActive: { color: '#fff' },
  geoHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6 },
  dateFieldText: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },
  placeholder: { color: '#94A3B8' },
  timeField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 11 },
  timeFieldText: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },
  dropdownBox: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 20, overflow: 'hidden' },
  dropdownItem: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 14, color: '#000000', fontWeight: '500' },
  dropdownItemTextActive: { color: '#3477eb', fontWeight: '700' },
  vehicleField: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10, minHeight: 50 },
  vehicleFieldDisabled: { opacity: 0.45 },
  vehicleFieldText: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },
  vehicleSelectedInline: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleSelectedBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  vehicleSelectedReg: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  vehicleSelectedModel: { fontSize: 11, color: '#64748B', marginTop: 1 },
  vehicleDropdownItem: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  vehicleDropdownLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  vehicleIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  vehicleIconCircleActive: { backgroundColor: '#EFF6FF' },
  vehicleTextBlock: { marginLeft: 10, flex: 1 },
  vehicleRegNo: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  vehicleModel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  vehicleEmptyDropdown: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  vehicleEmptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  vehicleHint: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  driverWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', padding: 10, marginTop: 6 },
  driverWarningText: { flex: 1, fontSize: 12, color: '#DC2626', fontWeight: '500', lineHeight: 17 },
  findButton: { borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start', elevation: 3 },
  findButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, gap: 8 },
  findButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  routeWarningBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', padding: 10 },
  routeWarningText: { flex: 1, fontSize: 12, color: '#D97706', fontWeight: '500', lineHeight: 17 },
  routeSummaryBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 11 },
  routeSummaryBoxSelected: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  routeSummaryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  routeSummaryIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  routeSummaryIconSelected: { backgroundColor: '#DBEAFE' },
  routeSummaryTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  routeSummaryMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  submitButton: { borderRadius: 12, overflow: 'hidden', elevation: 4, marginTop: 4 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
});

export default AddTripScreen;