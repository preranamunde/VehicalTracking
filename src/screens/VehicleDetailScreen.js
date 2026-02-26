// VehicleDetailScreen.js - CORRECTED VERSION
// ✅ Handles type: 'live' payloads
// ✅ Handles type: 'update' with state: 'parked' payloads
// ✅ Handles type: 'update' with state: 'moving' payloads
// ✅ Displays parked_location, parked_since, parked_duration for parked vehicles

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Alert,
  PermissionsAndroid,
  Platform,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const VehicleDetailScreen = ({ route, navigation }) => {
  const { vehicle } = route.params;

  // Use the vehicle ID from the vehicle list
  const WEBSOCKET_VEHICLE_ID = vehicle.id || vehicle._id;

  // State management
  const [vehicleLocation, setVehicleLocation] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
  });
  const [userLocation, setUserLocation] = useState(null);
  const [speed, setSpeed] = useState('-- km/h');
  const [status, setStatus] = useState('Connecting...');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('--');
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState(vehicle.registrationNumber || '--');
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Movement indicators
  const [isMoving, setIsMoving] = useState(false);
  
  // Vehicle state
  const [vehicleState, setVehicleState] = useState('unknown'); // 'parked', 'moving', or 'unknown'
  
  // PARKED STATE DATA
  const [parkedLocation, setParkedLocation] = useState(null);
  const [parkedSince, setParkedSince] = useState(null);
  const [parkedDuration, setParkedDuration] = useState(null);
  const [parkedDriverId, setParkedDriverId] = useState(null);
  const [parkedDriverName, setParkedDriverName] = useState(null);
  
  // MOVING STATE DATA
  const [routeName, setRouteName] = useState(null);
  const [routeId, setRouteId] = useState(null);
  const [movingDriverId, setMovingDriverId] = useState(null);
  const [movingDriverName, setMovingDriverName] = useState(null);
  
  const movingAnimation = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const previousLocation = useRef(null);

  // Animate the "MOVING" indicator
  useEffect(() => {
    if (isMoving) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(movingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(movingAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      movingAnimation.setValue(0);
    }
  }, [isMoving]);

  // Check if permission was granted at app launch
  useEffect(() => {
    if (global.hasLocationPermission) {
      setHasLocationPermission(true);
      setTimeout(() => {
        getCurrentLocation();
      }, 1000);
    }
  }, []);

  // Connect to WebSocket when screen loads
  useEffect(() => {
    console.log('Component mounted, connecting to WebSocket...');
    console.log(`🎯 Tracking vehicle ID: ${WEBSOCKET_VEHICLE_ID}`);
    connectWebSocket();
    return () => {
      console.log('Component unmounting, cleaning up...');
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, []);

  // Request Location Permission
  const requestLocationPermission = async () => {
    try {
      setIsGettingLocation(true);
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasLocationPermission(true);
          global.hasLocationPermission = true;
          getCurrentLocation();
        } else {
          setIsGettingLocation(false);
          Alert.alert('Permission Denied', 'Location permission is required.');
        }
      } else {
        setHasLocationPermission(true);
        global.hasLocationPermission = true;
        getCurrentLocation();
      }
    } catch (err) {
      console.warn('Error requesting location:', err);
      setIsGettingLocation(false);
    }
  };

  // Get current user location
  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`✅ User location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setUserLocation({ latitude, longitude });
        setIsGettingLocation(false);
        updateMapWithUserLocation(latitude, longitude);
      },
      (error) => {
        console.error(`❌ Error getting location: ${error.message}`);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // Update map with user location
  const updateMapWithUserLocation = (lat, lng) => {
    if (webViewRef.current && mapLoaded) {
      const script = `
        (function() {
          try {
            if (typeof addUserLocationMarker === 'function') {
              addUserLocationMarker(${lat}, ${lng});
              return 'User marker updated';
            } else {
              return 'Function not found';
            }
          } catch(e) {
            return 'Error: ' + e.message;
          }
        })();
      `;
      webViewRef.current.injectJavaScript(script);
    }
  };

  // Calculate speed between two points
  const calculateSpeed = (lat1, lon1, lat2, lon2, timeDiff) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const speed = (distance / (timeDiff / 3600000));
    return speed.toFixed(1);
  };

  // WebSocket Connection
  const connectWebSocket = () => {
    try {
      console.log('🔌 Initializing WebSocket connection...');
      console.log(`🎯 Target vehicle ID: ${WEBSOCKET_VEHICLE_ID}`);

      const ws = new WebSocket('wss://vlts-server.nutanteksolutions.cloud');

      ws.onopen = () => {
        console.log('✅ WebSocket CONNECTED!');
        setIsConnected(true);
        setStatus('Connected');

        // Subscribe to specific vehicle updates
        const subscribeMessage = {
          type: 'subscribe',
          vehicle_id: WEBSOCKET_VEHICLE_ID,
        };
        console.log(`📤 Subscribing to vehicle: ${WEBSOCKET_VEHICLE_ID}`);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          console.log('📨 ========== WEBSOCKET MESSAGE RECEIVED ==========');
          console.log(JSON.stringify(data, null, 2));
          console.log('==================================================');
          
          // Handle errors
          if (data.error) {
            console.error(`❌ WebSocket Error: ${data.error}`);
            setStatus('Error: ' + data.error);
            return;
          }

          // Handle subscription confirmation
          if (data.type === 'subscribed') {
            console.log('✅ Subscription CONFIRMED for vehicle:', data.vehicle_id);
            setStatus('Subscribed - Waiting for updates...');
            return;
          }

          // ========== VEHICLE ID VALIDATION ==========
          if (data.vehicle_id) {
            console.log(`🔍 Vehicle ID Check: "${data.vehicle_id}" vs Expected: "${WEBSOCKET_VEHICLE_ID}"`);
            
            // Check if this message is for our tracked vehicle
            if (data.vehicle_id !== WEBSOCKET_VEHICLE_ID) {
              console.warn(`⚠️ IGNORING - Update is for different vehicle: ${data.vehicle_id}`);
              return;
            }
            
            console.log(`✅ MATCH! Processing message for our vehicle...`);
          }

          // ========== COORDINATE VALIDATION ==========
          if (!data.coordinates || !Array.isArray(data.coordinates)) {
            console.error(`❌ NO COORDINATES FOUND in message!`);
            return;
          }

          const longitude = parseFloat(data.coordinates[0]);
          const latitude = parseFloat(data.coordinates[1]);

          console.log(`📍 Coordinates: [${longitude}, ${latitude}]`);

          // Validate coordinate values
          if (isNaN(latitude) || isNaN(longitude)) {
            console.error('❌ Invalid coordinates - NaN detected');
            return;
          }

          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            console.error('❌ Invalid coordinates - out of valid range');
            return;
          }

          const newLocation = { latitude, longitude };

          // ========== HANDLE PARKED STATE (type: update, state: parked) ========== 
          if (data.type === 'update' && data.state === 'parked') {
            console.log('🅿️  ========== PARSING PARKED PAYLOAD ==========');
            
            // Parse PARKED payload fields
            const parkedLocationValue = data.parked_location || 'Unknown Location';
            const parkedSinceValue = data.parked_since || '--';
            const parkedDurationValue = data.parked_duration || '--';
            const driverIdValue = data.driver_id || null;
            const driverNameValue = data.driver_name || null;
            const registrationNumberValue = data.registration_number || registrationNumber;
            
            console.log(`📊 PARKED VEHICLE DATA:`);
            console.log(`   🆔 vehicle_id: ${data.vehicle_id}`);
            console.log(`   📍 parked_location: ${parkedLocationValue}`);
            console.log(`   🕐 parked_since: ${parkedSinceValue}`);
            console.log(`   ⏱️  parked_duration: ${parkedDurationValue}`);
            console.log(`   👤 driver_id: ${driverIdValue}`);
            console.log(`   👤 driver_name: ${driverNameValue}`);
            console.log(`   🚗 registration_number: ${registrationNumberValue}`);
            console.log(`   📌 coordinates: [${longitude}, ${latitude}]`);
            
            // Update PARKED state
            setVehicleState('parked');
            setParkedLocation(parkedLocationValue);
            setParkedSince(parkedSinceValue);
            setParkedDuration(parkedDurationValue);
            setParkedDriverId(driverIdValue);
            setParkedDriverName(driverNameValue);
            setSpeed('0 km/h');
            setIsMoving(false);
            
            // Clear MOVING state data
            setRouteName(null);
            setRouteId(null);
            setMovingDriverId(null);
            setMovingDriverName(null);

            // Update location on map
            setVehicleLocation(newLocation);
            updateMapLocation(newLocation);

            if (registrationNumberValue) {
              setRegistrationNumber(registrationNumberValue);
            }

            setStatus('Parked');
            setLastUpdate(new Date().toLocaleTimeString());

            console.log(`✅ ========== PARKED STATE UPDATED ==========`);
          }
          
          // ========== HANDLE MOVING STATE (type: update, state: moving) ==========
          else if (data.type === 'update' && data.state === 'moving') {
            console.log('🚗 ========== PARSING MOVING PAYLOAD ==========');
            
            // Parse MOVING payload fields
            const routeIdValue = data.route_id || null;
            const routeNameValue = data.route_name || 'Unknown Route';
            const driverIdValue = data.driver_id || null;
            const driverNameValue = data.driver_name || null;
            const registrationNumberValue = data.registration_number || registrationNumber;
            
            console.log(`📊 MOVING VEHICLE DATA:`);
            console.log(`   🆔 vehicle_id: ${data.vehicle_id}`);
            console.log(`   🛣️  route_id: ${routeIdValue}`);
            console.log(`   📍 route_name: ${routeNameValue}`);
            console.log(`   👤 driver_id: ${driverIdValue}`);
            console.log(`   👤 driver_name: ${driverNameValue}`);
            console.log(`   🚗 registration_number: ${registrationNumberValue}`);
            console.log(`   📌 coordinates: [${longitude}, ${latitude}]`);
            
            // Update MOVING state
            setVehicleState('moving');
            setRouteId(routeIdValue);
            setRouteName(routeNameValue);
            setMovingDriverId(driverIdValue);
            setMovingDriverName(driverNameValue);
            
            // Clear PARKED state data
            setParkedLocation(null);
            setParkedSince(null);
            setParkedDuration(null);
            setParkedDriverId(null);
            setParkedDriverName(null);
            
            // Show "MOVING" indicator
            setIsMoving(true);
            setTimeout(() => setIsMoving(false), 3000);

            // Calculate speed
            if (previousLocation.current) {
              const timeDiff = Date.now() - previousLocation.current.timestamp;
              if (timeDiff > 0) {
                const calculatedSpeed = calculateSpeed(
                  previousLocation.current.latitude,
                  previousLocation.current.longitude,
                  latitude,
                  longitude,
                  timeDiff
                );
                setSpeed(`${calculatedSpeed} km/h`);
                console.log(`💨 Speed: ${calculatedSpeed} km/h`);
              }
            }

            previousLocation.current = {
              latitude,
              longitude,
              timestamp: Date.now()
            };

            // Update location on map
            setVehicleLocation(newLocation);
            updateMapLocation(newLocation);

            if (registrationNumberValue) {
              setRegistrationNumber(registrationNumberValue);
            }

            setStatus('Live Tracking');
            setLastUpdate(new Date().toLocaleTimeString());

            console.log(`✅ ========== MOVING STATE UPDATED ==========`);
          }
          
          // ========== HANDLE LIVE MESSAGES (Fallback - treats as moving) ==========
          else if (data.type === 'live') {
            console.log(`📡 LIVE UPDATE received (treating as moving)`);
            
            // Treat live updates as moving vehicles
            setVehicleState('moving');
            
            // Update route/driver info if provided
            if (data.route_name) {
              setRouteName(data.route_name);
            }
            if (data.route_id) {
              setRouteId(data.route_id);
            }
            if (data.driver_id) {
              setMovingDriverId(data.driver_id);
            }
            if (data.driver_name) {
              setMovingDriverName(data.driver_name);
            }
            
            // Clear parked state when receiving live updates
            setParkedLocation(null);
            setParkedSince(null);
            setParkedDuration(null);
            setParkedDriverId(null);
            setParkedDriverName(null);
            
            // Show "MOVING" indicator
            setIsMoving(true);
            setTimeout(() => setIsMoving(false), 3000);

            // Calculate speed
            if (previousLocation.current) {
              const timeDiff = Date.now() - previousLocation.current.timestamp;
              if (timeDiff > 0) {
                const calculatedSpeed = calculateSpeed(
                  previousLocation.current.latitude,
                  previousLocation.current.longitude,
                  latitude,
                  longitude,
                  timeDiff
                );
                setSpeed(`${calculatedSpeed} km/h`);
              }
            }

            previousLocation.current = {
              latitude,
              longitude,
              timestamp: Date.now()
            };

            // Update location on map
            setVehicleLocation(newLocation);
            updateMapLocation(newLocation);

            if (data.registration_number) {
              setRegistrationNumber(data.registration_number);
            }

            setStatus('Live Tracking');
            setLastUpdate(new Date().toLocaleTimeString());
          }
        } catch (error) {
          console.error(`❌ Error parsing message: ${error.message}`);
          console.error(`   Stack:`, error.stack);
        }
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error occurred`);
        setIsConnected(false);
        setStatus('Connection Error');
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed (Code: ${event.code})`);
        setIsConnected(false);
        setStatus('Disconnected');

        // Auto-reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error(`❌ Failed to connect: ${error.message}`);
      setIsConnected(false);
      setStatus('Failed to Connect');
      reconnectTimeout.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  };

  // Update map location
  const updateMapLocation = (location) => {
    if (webViewRef.current && mapLoaded) {
      const script = `
        (function() {
          try {
            if (typeof updateVehicleMarker === 'function') {
              updateVehicleMarker(${location.latitude}, ${location.longitude});
              return 'Map updated successfully';
            } else {
              return 'ERROR: updateVehicleMarker function not found';
            }
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })();
      `;
      
      webViewRef.current.injectJavaScript(script);
    }
  };

  // Manual reconnect
  const handleReconnect = () => {
    console.log('🔄 Manual reconnect triggered');
    if (wsRef.current) {
      wsRef.current.close();
    }
    setStatus('Reconnecting...');
    connectWebSocket();
  };

  // Center map on vehicle
  const centerOnVehicle = () => {
    if (webViewRef.current && mapLoaded) {
      const script = `
        (function() {
          try {
            if (typeof centerMapOnVehicle === 'function') {
              centerMapOnVehicle();
              return 'Centered on vehicle';
            }
            return 'Function not found';
          } catch(e) {
            return 'Error: ' + e.message;
          }
        })();
      `;
      webViewRef.current.injectJavaScript(script);
    }
  };

  // Handle "My Location" button
  const handleMyLocation = () => {
    if (hasLocationPermission && userLocation) {
      if (webViewRef.current && mapLoaded) {
        const script = `
          (function() {
            try {
              if (typeof centerMapOnUserLocation === 'function') {
                centerMapOnUserLocation();
                return 'Centered on user';
              }
              return 'Function not found';
            } catch(e) {
              return 'Error: ' + e.message;
            }
          })();
        `;
        webViewRef.current.injectJavaScript(script);
      }
    } else if (hasLocationPermission && !userLocation) {
      getCurrentLocation();
    } else {
      requestLocationPermission();
    }
  };

  // Show route
  const showRoute = () => {
    if (routeName && routeId) {
      Alert.alert('Route Information', `Route: ${routeName}\nRoute ID: ${routeId}`);
    } else if (routeName) {
      Alert.alert('Route', `Current route: ${routeName}`);
    } else {
      Alert.alert('Route', 'Route planning feature coming soon');
    }
  };

  // Call driver
  const callDriver = () => {
    const driverId = vehicleState === 'parked' ? parkedDriverId : movingDriverId;
    const driverName = vehicleState === 'parked' ? parkedDriverName : movingDriverName;
    const displayName = driverName || vehicle.driver || (driverId ? `Driver (ID: ${driverId})` : 'driver');
    Alert.alert('Call Driver', `Calling ${displayName}...`);
  };

  // DEBUG: Show vehicle state info
  const showDebugInfo = () => {
    const currentDriverId = vehicleState === 'parked' ? parkedDriverId : movingDriverId;
    const currentDriverName = vehicleState === 'parked' ? parkedDriverName : movingDriverName;
    
    const debugInfo = `
🎯 Vehicle State: ${vehicleState}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${vehicleState === 'parked' ? `
🅿️ PARKED INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 parked_location: ${parkedLocation || 'N/A'}
🕐 parked_since: ${parkedSince || 'N/A'}
⏱️  parked_duration: ${parkedDuration || 'N/A'}
👤 driver_id: ${parkedDriverId || 'N/A'}
👤 driver_name: ${parkedDriverName || 'N/A'}
` : vehicleState === 'moving' ? `
🚗 MOVING INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛣️  route_name: ${routeName || 'N/A'}
🆔 route_id: ${routeId || 'N/A'}
👤 driver_id: ${movingDriverId || 'N/A'}
👤 driver_name: ${movingDriverName || 'N/A'}
💨 speed: ${speed}
` : `
⚠️ State: Unknown or Not Yet Received
`}

📊 CURRENT DATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Vehicle Location: 
   Lat: ${vehicleLocation.latitude.toFixed(6)}
   Lng: ${vehicleLocation.longitude.toFixed(6)}

🔌 Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}
📶 Status: ${status}
🕒 Last Update: ${lastUpdate}
🆔 Vehicle ID: ${WEBSOCKET_VEHICLE_ID}
🚗 Registration: ${registrationNumber}
    `.trim();

    Alert.alert('🔍 Debug Info', debugInfo, [{ text: 'OK' }]);
  };

  // Generate HTML for OpenStreetMap
  const generateMapHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let map, vehicleMarker, userMarker, vehicleIcon, userIcon, pathLine;
          let pathCoordinates = [];

          console.log('🗺️ Initializing map...');

          map = L.map('map', {
            center: [${vehicleLocation.latitude}, ${vehicleLocation.longitude}],
            zoom: 15,
            zoomControl: true
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 3
          }).addTo(map);

          vehicleIcon = L.divIcon({
            html: \`
              <div style="position: relative;">
                <div style="
                  background-color: #3477eb; 
                  width: 24px; 
                  height: 24px; 
                  border-radius: 50%; 
                  border: 4px solid white; 
                  box-shadow: 0 0 10px rgba(52, 119, 235, 0.6);
                  position: relative;
                  z-index: 1000;
                "></div>
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background-color: rgba(52, 119, 235, 0.3);
                  animation: pulse 2s infinite;
                "></div>
              </div>
              <style>
                @keyframes pulse {
                  0% { transform: scale(1); opacity: 1; }
                  100% { transform: scale(2.5); opacity: 0; }
                }
              </style>
            \`,
            className: 'vehicle-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          userIcon = L.divIcon({
            html: \`
              <div style="
                background-color: #10b981; 
                width: 18px; 
                height: 18px; 
                border-radius: 50%; 
                border: 3px solid white; 
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
              "></div>
            \`,
            className: 'user-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          vehicleMarker = L.marker([${vehicleLocation.latitude}, ${vehicleLocation.longitude}], {
            icon: vehicleIcon
          }).addTo(map);
          
          vehicleMarker.bindPopup('<b>Vehicle Location</b><br>Tracking...');

          pathCoordinates.push([${vehicleLocation.latitude}, ${vehicleLocation.longitude}]);
          pathLine = L.polyline(pathCoordinates, {
            color: '#3477eb',
            weight: 3,
            opacity: 0.6,
            smoothFactor: 1
          }).addTo(map);

          console.log('✅ Map initialized');

          function updateVehicleMarker(lat, lng) {
            console.log('🚗 updateVehicleMarker called with:', lat, lng);
            
            if (!vehicleMarker) {
              vehicleMarker = L.marker([lat, lng], { icon: vehicleIcon }).addTo(map);
              vehicleMarker.bindPopup('<b>Vehicle Location</b><br>Live Tracking');
            } else {
              vehicleMarker.setLatLng([lat, lng]);
            }

            pathCoordinates.push([lat, lng]);
            if (pathCoordinates.length > 100) {
              pathCoordinates.shift();
            }
            
            if (pathLine) {
              pathLine.setLatLngs(pathCoordinates);
            }

            vehicleMarker.setPopupContent(\`<b>Vehicle Location</b><br>Lat: \${lat.toFixed(6)}<br>Lng: \${lng.toFixed(6)}\`);
            
            map.setView([lat, lng], map.getZoom());
          }

          function addUserLocationMarker(lat, lng) {
            console.log('👤 addUserLocationMarker called with:', lat, lng);
            if (!userMarker) {
              userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
              userMarker.bindPopup('<b>Your Location</b>');
            } else {
              userMarker.setLatLng([lat, lng]);
            }
          }

          function centerMapOnVehicle() {
            if (vehicleMarker) {
              const latLng = vehicleMarker.getLatLng();
              map.setView(latLng, 15, { animate: true, duration: 1 });
            }
          }

          function centerMapOnUserLocation() {
            if (userMarker) {
              const latLng = userMarker.getLatLng();
              map.setView(latLng, 15, { animate: true, duration: 1 });
            }
          }

          map.whenReady(function() {
            console.log('✅ Map is ready');
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'mapLoaded',
              initialPosition: { lat: ${vehicleLocation.latitude}, lng: ${vehicleLocation.longitude} }
            }));
          });
        </script>
      </body>
      </html>
    `;
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapLoaded') {
        console.log('🗺️ Map fully loaded and ready!');
        setMapLoaded(true);
        
        if (vehicleLocation.latitude !== 28.6139 || vehicleLocation.longitude !== 77.2090) {
          setTimeout(() => updateMapLocation(vehicleLocation), 500);
        }
        
        if (userLocation) {
          setTimeout(() => updateMapWithUserLocation(userLocation.latitude, userLocation.longitude), 500);
        }
      }
    } catch (error) {
      console.error(`❌ Error parsing WebView message: ${error.message}`);
    }
  };

  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error(`❌ WebView error: ${nativeEvent.description}`);
  };

  const movingOpacity = movingAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.3],
  });

  // Get current driver info based on vehicle state
  const currentDriverId = vehicleState === 'parked' ? parkedDriverId : movingDriverId;
  const currentDriverName = vehicleState === 'parked' ? parkedDriverName : movingDriverName;
  const displayDriverName = currentDriverName || vehicle.driver || (currentDriverId ? `ID: ${currentDriverId.substring(0, 8)}...` : 'N/A');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#2563eb']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{vehicle.name || 'Vehicle'}</Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.connectionText}>
              {isConnected ? (vehicleState === 'parked' ? 'Parked' : 'Live Tracking') : status}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleReconnect} style={styles.headerButton}>
          <Icon name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Map */}
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleWebViewMessage}
        onError={handleWebViewError}
        originWhitelist={['*']}
      />

      {/* MOVING Indicator */}
      {isMoving && vehicleState === 'moving' && (
        <Animated.View style={[styles.movingIndicator, { opacity: movingOpacity }]}>
          <Icon name="car-speed-limiter" size={20} color="#FFFFFF" />
          <Text style={styles.movingText}>MOVING</Text>
        </Animated.View>
      )}

      {/* PARKED Indicator */}
      {vehicleState === 'parked' && (
        <View style={styles.parkedIndicator}>
          <Icon name="parking" size={20} color="#FFFFFF" />
          <Text style={styles.parkedText}>PARKED</Text>
        </View>
      )}

      {/* DEBUG BUTTON */}
      <TouchableOpacity style={styles.debugButton} onPress={showDebugInfo}>
        <Icon name="information" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* My Location Button */}
      <TouchableOpacity style={styles.myLocationButton} onPress={handleMyLocation}>
        <Icon name={isGettingLocation ? "loading" : "crosshairs-gps"} size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Vehicle Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Icon name="account" size={20} color="#3477eb" />
            <Text style={styles.infoLabel}>Driver</Text>
            <Text style={styles.infoValue}>{displayDriverName}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="speedometer" size={20} color="#3477eb" />
            <Text style={styles.infoLabel}>Speed</Text>
            <Text style={styles.infoValue}>{speed}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="card-text" size={20} color="#3477eb" />
            <Text style={styles.infoLabel}>Reg. No.</Text>
            <Text style={styles.infoValue}>{registrationNumber}</Text>
          </View>
        </View>

        {/* Vehicle ID Display */}
        <View style={styles.vehicleIdRow}>
          <Icon name="identifier" size={16} color="#64748B" />
          <Text style={styles.vehicleIdLabel}>Vehicle ID:</Text>
          <Text style={styles.vehicleIdValue}>{WEBSOCKET_VEHICLE_ID}</Text>
        </View>

        {/* Parked Information */}
        {vehicleState === 'parked' && (
          <View style={styles.parkedInfo}>
            <View style={styles.parkedInfoHeader}>
              <Icon name="parking" size={18} color="#92400E" />
              <Text style={styles.parkedInfoTitle}>Vehicle Parked</Text>
            </View>
            <View style={styles.parkedInfoRow}>
              <Icon name="map-marker" size={16} color="#92400E" />
              <Text style={styles.parkedInfoLabel}>Location:</Text>
              <Text style={styles.parkedInfoText}>{parkedLocation || 'Loading...'}</Text>
            </View>
            <View style={styles.parkedInfoRow}>
              <Icon name="clock-outline" size={16} color="#92400E" />
              <Text style={styles.parkedInfoLabel}>Since:</Text>
              <Text style={styles.parkedInfoText}>{parkedSince || 'Loading...'}</Text>
            </View>
            <View style={styles.parkedInfoRow}>
              <Icon name="timer-outline" size={16} color="#92400E" />
              <Text style={styles.parkedInfoLabel}>Duration:</Text>
              <Text style={styles.parkedInfoText}>{parkedDuration || 'Loading...'}</Text>
            </View>
          </View>
        )}

        {/* Route Information */}
        {vehicleState === 'moving' && routeName && (
          <View style={styles.routeInfo}>
            <Icon name="map-marker-path" size={16} color="#1E40AF" />
            <Text style={styles.routeInfoText}>Route: {routeName}</Text>
          </View>
        )}

        <View style={styles.statusContainer}>
          <LinearGradient
            colors={
              vehicleState === 'parked' 
                ? ['#f59e0b', '#d97706'] 
                : isConnected 
                  ? ['#10b981', '#059669'] 
                  : ['#ef4444', '#dc2626']
            }
            style={styles.statusBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon 
              name={
                vehicleState === 'parked' 
                  ? "parking" 
                  : isConnected 
                    ? "check-circle" 
                    : "alert-circle"
              } 
              size={14} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusText}>
              {vehicleState === 'parked' ? 'Parked' : status}
            </Text>
          </LinearGradient>
          <Text style={styles.locationText}>🕒 {lastUpdate}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={centerOnVehicle}>
          <Icon name="car" size={18} color="#3477eb" />
          <Text style={styles.actionButtonText}>Center</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={showRoute}>
          <Icon name="map-marker-path" size={18} color="#3477eb" />
          <Text style={styles.actionButtonText}>Route</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={callDriver}>
          <Icon name="phone" size={18} color="#3477eb" />
          <Text style={styles.actionButtonText}>Call</Text>
        </TouchableOpacity>
      </View>

      {/* Disconnected Banner */}
      {!isConnected && (
        <View style={styles.disconnectedBanner}>
          <Icon name="wifi-off" size={18} color="#FFFFFF" />
          <Text style={styles.disconnectedText}>Reconnecting to server...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
  movingIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100,
    left: 20,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  movingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  parkedIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100,
    left: 20,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  parkedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  debugButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 170 : 160,
    left: 20,
    backgroundColor: '#8b5cf6',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  myLocationButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100,
    right: 20,
    backgroundColor: '#3477eb',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoCard: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '700',
    marginTop: 2,
  },
  vehicleIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  vehicleIdLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  vehicleIdValue: {
    fontSize: 11,
    color: '#3477eb',
    fontWeight: '700',
    fontFamily: 'monospace',
    flex: 1,
  },
  parkedInfo: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  parkedInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  parkedInfoTitle: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '700',
  },
  parkedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  parkedInfoLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
    minWidth: 70,
  },
  parkedInfoText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  routeInfo: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3477eb',
  },
  routeInfoText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '700',
  },
  disconnectedBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 90,
    left: 20,
    right: 20,
    backgroundColor: '#F44336',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  disconnectedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default VehicleDetailScreen;