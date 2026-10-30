import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

const { width } = Dimensions.get('window');

const LocateScreen = ({ navigation }) => {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const vehicles = [
    { 
      id: 1, 
      name: 'MH-12-AB-1234', 
      driver: 'John Doe', 
      status: 'Moving',
      location: 'Mumbai Highway',
      lat: '19.0760',
      lng: '72.8777',
      statusColor: '#4CAF50',
      distance: '12.5 km'
    },
    { 
      id: 2, 
      name: 'MH-12-CD-5678', 
      driver: 'Jane Smith', 
      status: 'Parked',
      location: 'Parking Area A',
      lat: '19.1136',
      lng: '72.8697',
      statusColor: '#FF9800',
      distance: '8.3 km'
    },
    { 
      id: 3, 
      name: 'MH-12-EF-9012', 
      driver: 'Mike Johnson', 
      status: 'Moving',
      location: 'Pune Road',
      lat: '18.5204',
      lng: '73.8567',
      statusColor: '#4CAF50',
      distance: '145 km'
    },
  ];

  const filters = ['All', 'Moving', 'Parked', 'Idle'];

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = vehicle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vehicle.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vehicle.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || vehicle.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const VehicleLocationCard = ({ vehicle }) => (
    <TouchableOpacity 
      style={[
        styles.locationCard,
        selectedVehicle?.id === vehicle.id && styles.locationCardSelected
      ]}
      activeOpacity={0.7}
      onPress={() => {
        setSelectedVehicle(vehicle);
        navigation.navigate('VehicleDetail', { vehicle });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: vehicle.statusColor }]} />
        <View style={styles.cardInfo}>
          <Text style={styles.vehicleName}>{vehicle.name}</Text>
          <Text style={styles.driverName}>{vehicle.driver}</Text>
        </View>
        <TouchableOpacity 
          style={styles.navigateButton}
          onPress={(e) => {
            e.stopPropagation();
            console.log('Navigate to:', vehicle.name);
          }}
        >
          <Icon name="navigation" size={20} color="#3477eb" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Icon name="map-marker" size={16} color="#64748B" />
          <Text style={styles.locationText}>{vehicle.location}</Text>
        </View>
        <View style={styles.infoRow}>
          <Icon name="map-marker-distance" size={16} color="#64748B" />
          <Text style={styles.distanceText}>{vehicle.distance} away</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.coordinates}>
          <Text style={styles.coordLabel}>Lat: {vehicle.lat}</Text>
          <Text style={styles.coordLabel}>Lng: {vehicle.lng}</Text>
        </View>
        <TouchableOpacity 
          style={styles.trackButton}
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('VehicleDetail', { vehicle });
          }}
        >
          <Text style={styles.trackButtonText}>Track Live</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.openDrawer()}
            style={styles.menuButton}
          >
            <Icon name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Locate Vehicles</Text>
          </View>
          <TouchableOpacity style={styles.mapButton}>
            <Icon name="map" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Search and Filter Section */}
        <View style={styles.searchFilterContainer}>
          {/* Search Input */}
          <View style={styles.searchInputContainer}>
            <Icon name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search vehicle, driver or location..."
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

          {/* Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipActive
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === filter && styles.filterChipTextActive
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Map Placeholder */}
        <View style={styles.mapPlaceholder}>
          <LinearGradient
            colors={['#EFF6FF', '#DBEAFE']}
            style={styles.mapGradient}
          >
            <Icon name="map-marker-radius" size={80} color="#3477eb" />
            <Text style={styles.mapText}>Map View</Text>
            <Text style={styles.mapSubtext}>Integration with Google Maps/Mapbox</Text>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            style={styles.statBox}
          >
            <View style={styles.statIconBox}>
              <Icon name="car-connected" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Active</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#EFF6FF', '#DBEAFE']}
            style={styles.statBox}
          >
            <View style={styles.statIconBox}>
              <Icon name="map-marker-check" size={24} color="#3477eb" />
            </View>
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Nearby</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#FEF2F2', '#FEE2E2']}
            style={styles.statBox}
          >
            <View style={styles.statIconBox}>
              <Icon name="map-marker-alert" size={24} color="#F44336" />
            </View>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </LinearGradient>
        </View>

        {/* Vehicle Location List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicle Locations</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredVehicles.length}</Text>
            </View>
          </View>
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle) => (
              <VehicleLocationCard key={vehicle.id} vehicle={vehicle} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="map-marker-off" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>No vehicles found</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <LinearGradient
          colors={['#3477eb', '#5a94f5']}
          style={styles.fabGradient}
        >
          <Icon name="crosshairs-gps" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  mapButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  // Search and Filter Styles
  searchFilterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 2, // Vertical padding of 2
    backgroundColor: '#F1F5F9',
    marginTop: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
    padding: 0,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: '#3477eb',
    borderColor: '#3477eb',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
  },
  // Map and Stats Styles
  mapPlaceholder: {
    height: 280,
    margin: 20,
    marginTop: 4,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  mapGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  mapText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 16,
    letterSpacing: 0.3,
  },
  mapSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  countBadge: {
    backgroundColor: '#3477eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationCardSelected: {
    borderColor: '#3477eb',
    backgroundColor: '#F0F7FF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cardInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  driverName: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  navigateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  cardBody: {
    gap: 10,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  locationText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
  },
  distanceText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  coordinates: {
    gap: 4,
  },
  coordLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  trackButton: {
    backgroundColor: '#3477eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  trackButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPadding: {
    height: 100,
  },
});

export default LocateScreen;