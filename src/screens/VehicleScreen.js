import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

// ============================================
// ✅ Centralized API — path points to src/utils/api.js
// ============================================
import { apiGet, ENDPOINTS } from '../utils/Api';

// 🔥 CRITICAL: Map API vehicle IDs to WebSocket vehicle IDs
// Your API returns these IDs, but WebSocket uses different IDs
const VEHICLE_ID_MAPPING = {
  // API ID → WebSocket ID
  '69784c421713b3caf557379b': '697b339edc566db4c1be577e',  // SONU12AK3144 → Parked Vehicle
  '697b339edc566db4c1be577e': '697b339edc566db4c1be577e',  // KA01KF4822 → Moving Vehicle (same)
  '6982e232e5eddb34fffd0978': '697b339edc566db4c1be577e',  // Third vehicle → Moving Vehicle
};

const VehicleScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [vehicles, setVehicles]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  // ============================================
  // Fetch vehicles — uses shared apiGet helper
  // ============================================
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiGet(ENDPOINTS.VEHICLES);

      console.log('📋 First vehicle sample:', data[0]);

      setVehicles(transformVehicleData(data));
    } catch (err) {
      console.error('❌ Error fetching vehicles:', err);
      setError(err.message);

      Alert.alert(
        'Error Loading Vehicles',
        `Could not fetch vehicles from server.\n\nError: ${err.message}`,
        [
          { text: 'Retry',  onPress: () => fetchVehicles() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ============================================
  // Transform API data → app format
  // 🔥 FIX: Map API vehicle IDs to correct WebSocket IDs
  // ============================================
  const transformVehicleData = (apiVehicles) => {
    const statuses      = ['Moving', 'Parked', 'Idle'];
    const statusColors  = { Moving: '#4CAF50', Parked: '#FF9800', Idle: '#64748B' };

    return apiVehicles.map((vehicle, index) => {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      // 🔥 Map API ID to WebSocket ID using our mapping
      const apiId = vehicle._id;
      const websocketId = VEHICLE_ID_MAPPING[apiId] || apiId;
      
      // Determine vehicle type based on registration or mapping
      let vehicleColor = '#64748B'; // Default gray
      let vehicleLabel = 'Unknown';
      
      // Check which WebSocket ID we got
      if (websocketId === '697b339edc566db4c1be577e') {
        vehicleColor = '#10b981'; // Green for moving
        vehicleLabel = 'Moving Vehicle';
      } else if (websocketId === '6982e232e5eddb34fffd0978') {
        vehicleColor = '#3477eb'; // Blue for parked
        vehicleLabel = 'Parked Vehicle';
      }

      console.log(`🔧 Transform [${index}]: ${vehicle.registration_number}`);
      console.log(`   API ID: ${apiId} → WebSocket ID: ${websocketId} (${vehicleLabel})`);

      return {
        id:                 websocketId,  // Use WebSocket ID for tracking
        name:               vehicle.registration_number || `Vehicle ${index + 1}`,
        company:            vehicle.model              || 'Unknown Model',
        driver:             vehicle.driver_name        || 'Not Assigned',
        status:             randomStatus,
        speed:              randomStatus === 'Moving'  ? `${Math.floor(Math.random() * 80)}km/h` : '0 km/h',
        location:           'Delhi NCR Area',
        statusColor:        statusColors[randomStatus],
        fuel:               `${Math.floor(Math.random() * 100)}%`,
        lastUpdate:         'Just now',
        registrationNumber: vehicle.registration_number,
        originalApiId:      apiId,
        originalData:       vehicle,
        cardColor:          vehicleColor,
        vehicleLabel:       vehicleLabel,
      };
    });
  };

  // ============================================
  // Pull-to-refresh
  // ============================================
  const onRefresh = () => {
    setRefreshing(true);
    fetchVehicles();
  };

  // ============================================
  // Filter + search
  // ============================================
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;

    if (selectedFilter !== 'All') {
      filtered = filtered.filter((v) => v.status === selectedFilter);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(q)     ||
          v.driver.toLowerCase().includes(q)   ||
          v.company.toLowerCase().includes(q)  ||
          v.location.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [vehicles, searchQuery, selectedFilter]);

  // ============================================
  // Vehicle Card
  // ============================================
  const VehicleCard = ({ vehicle }) => (
    <TouchableOpacity
      style={[styles.vehicleCard, { borderColor: vehicle.cardColor }]}
      activeOpacity={0.7}
      onPress={() => {
        console.log(`🚗 Opening "${vehicle.name}" (${vehicle.vehicleLabel})`);
        console.log(`   📡 WebSocket ID: ${vehicle.id}`);
        console.log(`   🆔 API ID: ${vehicle.originalApiId}`);
        navigation.navigate('VehicleDetail', { vehicle });
      }}
    >
      {/* Status badge - moved to top right corner */}
      <View style={[styles.statusBadge, { backgroundColor: vehicle.statusColor }]}>
        <Text style={styles.statusText}>{vehicle.status}</Text>
      </View>

      {/* Live badge with vehicle ID indicator */}
      <View style={[styles.wsIndicator, { backgroundColor: vehicle.cardColor === '#3477eb' ? '#EFF6FF' : '#DCFCE7', borderColor: vehicle.cardColor === '#3477eb' ? '#BFDBFE' : '#86EFAC' }]}>
        <View style={[styles.wsIndicatorDot, { backgroundColor: vehicle.cardColor }]} />
        <Text style={[styles.wsIndicatorText, { color: vehicle.cardColor === '#3477eb' ? '#1E40AF' : '#166534' }]}>
          {vehicle.vehicleLabel} • ID: {vehicle.id.slice(-6)}
        </Text>
      </View>

      {/* Company badge */}
      <View style={styles.companyBadge}>
        <Icon name="factory" size={14} color="#3477eb" />
        <Text style={styles.companyText}>{vehicle.company}</Text>
      </View>

      {/* Name + driver (status removed from here) */}
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleIconCircle}>
          <Icon name="car-side" size={28} color="#3477eb" />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{vehicle.name}</Text>
          <View style={styles.driverRow}>
            <Icon name="account" size={14} color="#64748B" />
            <Text style={styles.driverName}>{vehicle.driver}</Text>
          </View>
        </View>
      </View>

      {/* Speed + fuel */}
      <View style={styles.vehicleDetails}>
        <View style={styles.detailItem}>
          <Icon name="speedometer" size={16} color="#64748B" />
          <Text style={styles.detailText}>{vehicle.speed}</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="gas-station" size={16} color="#64748B" />
          <Text style={styles.detailText}>{vehicle.fuel}</Text>
        </View>
      </View>

      {/* Location + time */}
      <View style={styles.vehicleFooter}>
        <View style={styles.locationRow}>
          <Icon name="map-marker" size={14} color="#64748B" />
          <Text style={styles.locationText}>{vehicle.location}</Text>
        </View>
        <Text style={styles.timeText}>{vehicle.lastUpdate}</Text>
      </View>
    </TouchableOpacity>
  );

  // ============================================
  // Loading screen
  // ============================================
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
        <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
              <Icon name="menu" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Vehicles</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Icon name="bell-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3477eb" />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // Main render
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Icon name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Vehicles</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton} 
            onPress={() => {
              // You can navigate to a notifications screen or show a notification panel
              Alert.alert('Notifications', 'No new notifications');
              // Or navigate: navigation.navigate('Notifications');
            }}
          >
            <Icon name="bell-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#FFFFFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicles..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3477eb']} tintColor="#3477eb" />
        }
      >
        {/* Filter tabs */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {['All', 'Moving', 'Parked', 'Idle'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Icon name="information" size={20} color="#3477eb" />
          <Text style={styles.infoBannerText}>
            🟢 Moving: KA01KF4822 • 🔵 Parked: SONU12AK3144
          </Text>
        </View>

        {/* List */}
        <View style={styles.vehicleList}>
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle, index) => (
              <VehicleCard key={`${vehicle.id}-${index}`} vehicle={vehicle} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="car-off" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>No vehicles found</Text>
              <Text style={styles.emptyStateText}>
                {error
                  ? 'Failed to load vehicles from server'
                  : searchQuery !== ''
                    ? `No vehicles match "${searchQuery}"`
                    : `No ${selectedFilter.toLowerCase()} vehicles available`}
              </Text>
              {(searchQuery !== '' || selectedFilter !== 'All') && !error && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => { setSearchQuery(''); setSelectedFilter('All'); }}
                >
                  <Text style={styles.clearButtonText}>Clear filters</Text>
                </TouchableOpacity>
              )}
              {error && (
                <TouchableOpacity style={styles.clearButton} onPress={fetchVehicles}>
                  <Text style={styles.clearButtonText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F5F5F5' },
  header:           { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  menuButton:       { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter:     { flex: 1, marginLeft: 16 },
  headerTitle:      { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  notificationButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 3, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  searchInput:      { flex: 1, marginLeft: 8, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  scrollView:       { flex: 1 },
  filterSection:    { paddingVertical: 16 },
  filterContainer:  { paddingHorizontal: 20 },
  filterButton:     { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 },
  filterButtonActive: { backgroundColor: '#3477eb', borderColor: '#3477eb' },
  filterText:       { fontSize: 14, color: '#64748B', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },

  infoBanner:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', marginHorizontal: 20, marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE', gap: 8 },
  infoBannerText:   { flex: 1, fontSize: 12, color: '#1E40AF', fontWeight: '500', lineHeight: 16 },

  vehicleList:      { paddingHorizontal: 20, gap: 12 },
  vehicleCard:      { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderWidth: 2 },

  wsIndicator:      { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8, gap: 6, borderWidth: 1 },
  wsIndicatorDot:   { width: 8, height: 8, borderRadius: 4 },
  wsIndicatorText:  { fontSize: 11, fontWeight: '700' },

  companyBadge:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12, gap: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  companyText:      { fontSize: 12, color: '#3477eb', fontWeight: '700', letterSpacing: 0.5 },

  vehicleHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  vehicleIconCircle:{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#3477eb15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  vehicleInfo:      { flex: 1 },
  vehicleName:      { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  driverRow:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverName:       { fontSize: 13, color: '#64748B', fontWeight: '500' },
  statusBadge:      { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, zIndex: 10 },
  statusText:       { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },

  vehicleDetails:   { flexDirection: 'row', gap: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailItem:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText:       { fontSize: 13, color: '#64748B', fontWeight: '500' },

  vehicleFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  locationRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  locationText:     { fontSize: 12, color: '#64748B', fontWeight: '500' },
  timeText:         { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  emptyState:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyStateTitle:  { fontSize: 18, fontWeight: '700', color: '#64748B', marginTop: 16, marginBottom: 8 },
  emptyStateText:   { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  clearButton:      { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3477eb', borderRadius: 12 },
  clearButtonText:  { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  bottomPadding:    { height: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText:      { marginTop: 16, fontSize: 16, color: '#64748B', fontWeight: '500' },
});

export default VehicleScreen;