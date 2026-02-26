import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { apiGet, ENDPOINTS } from '../utils/Api';

const TripHistoryVehiclesScreen = ({ navigation }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Hardcoded routes data
  const hardcodedRoutes = [
    {
      startLocation: 'Delhi',
      endLocation: 'Mumbai',
      distance: '1,424 km',
      duration: '24h 30m',
      date: '05 Feb 2026',
    },
    {
      startLocation: 'Bhiwandi',
      endLocation: 'Nashik',
      distance: '89 km',
      duration: '2h 15m',
      date: '04 Feb 2026',
    },
    {
      startLocation: 'Pune',
      endLocation: 'Bangalore',
      distance: '837 km',
      duration: '14h 20m',
      date: '03 Feb 2026',
    },
    {
      startLocation: 'Mumbai',
      endLocation: 'Goa',
      distance: '467 km',
      duration: '8h 45m',
      date: '02 Feb 2026',
    },
    {
      startLocation: 'Thane',
      endLocation: 'Surat',
      distance: '283 km',
      duration: '5h 30m',
      date: '01 Feb 2026',
    },
    {
      startLocation: 'Chennai',
      endLocation: 'Hyderabad',
      distance: '626 km',
      duration: '10h 15m',
      date: '31 Jan 2026',
    },
  ];

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📋 Fetching vehicles for trip history...');
      const data = await apiGet(ENDPOINTS.VEHICLES);

      console.log(`✅ Received ${data.length} vehicles`);

      // Transform and combine with hardcoded routes
      const transformedData = data.map((vehicle, index) => {
        // Cycle through hardcoded routes
        const route = hardcodedRoutes[index % hardcodedRoutes.length];
        
        return {
          id: vehicle._id,
          vehicle: vehicle.registration_number || `Vehicle ${index + 1}`,
          driver: vehicle.driver_name || 'Not Assigned',
          model: vehicle.model || 'Unknown Model',
          ...route, // Spread the hardcoded route data
        };
      });

      setVehicles(transformedData);
    } catch (err) {
      console.error('❌ Error fetching vehicles:', err);
      setError(err.message);

      Alert.alert(
        'Error Loading Trip History',
        `Could not fetch trip history from server.\n\nError: ${err.message}`,
        [
          { text: 'Retry', onPress: () => fetchVehicles() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVehicles();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip History - Vehicles</Text>
          <View style={styles.filterButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3477eb" />
          <Text style={styles.loadingText}>Loading trip history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History - Vehicles</Text>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => Alert.alert('Filter', 'Filter options coming soon')}
        >
          <Icon name="filter-variant" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#3477eb']} 
            tintColor="#3477eb" 
          />
        }
      >
        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon name="car-multiple" size={24} color="#3477eb" />
            <Text style={styles.statNumber}>{vehicles.length}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="road-variant" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>
              {vehicles.reduce((sum, v) => {
                const km = parseInt(v.distance.replace(/[^0-9]/g, ''));
                return sum + km;
              }, 0).toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total KM</Text>
          </View>
        </View>

        {/* Trip Cards */}
        {vehicles.length > 0 ? (
          vehicles.map((trip, index) => (
            <View key={`${trip.id}-${index}`} style={styles.tripCard}>
              <View style={styles.tripHeader}>
                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleIconCircle}>
                    <Icon name="car-side" size={24} color="#3477eb" />
                  </View>
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleName}>{trip.vehicle}</Text>
                    <View style={styles.driverRow}>
                      <Icon name="account" size={12} color="#64748B" />
                      <Text style={styles.driverName}>{trip.driver}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.date}>{trip.date}</Text>
              </View>

              {/* Model Badge */}
              <View style={styles.modelBadge}>
                <Icon name="information-outline" size={14} color="#3477eb" />
                <Text style={styles.modelText}>{trip.model}</Text>
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                  <View style={styles.markerCircle}>
                    <Icon name="map-marker" size={16} color="#4CAF50" />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>Start</Text>
                    <Text style={styles.locationText}>{trip.startLocation}</Text>
                  </View>
                </View>
                
                <View style={styles.routeLineContainer}>
                  <View style={styles.routeLine} />
                  <Icon name="arrow-down" size={16} color="#94A3B8" style={styles.arrowIcon} />
                </View>
                
                <View style={styles.routePoint}>
                  <View style={styles.markerCircle}>
                    <Icon name="map-marker" size={16} color="#F44336" />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>End</Text>
                    <Text style={styles.locationText}>{trip.endLocation}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tripStats}>
                <View style={styles.statItem}>
                  <Icon name="road-variant" size={18} color="#64748B" />
                  <Text style={styles.statText}>{trip.distance}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="clock-outline" size={18} color="#64748B" />
                  <Text style={styles.statText}>{trip.duration}</Text>
                </View>
              </View>

              {/* View Details Button */}
              <TouchableOpacity 
                style={styles.detailsButton}
                onPress={() => Alert.alert('Trip Details', `View details for ${trip.vehicle}`)}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
                <Icon name="chevron-right" size={18} color="#3477eb" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="history" size={64} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>No Trip History</Text>
            <Text style={styles.emptyStateText}>
              {error 
                ? 'Failed to load trip history from server' 
                : 'No trips found for your vehicles'}
            </Text>
            {error && (
              <TouchableOpacity style={styles.retryButton} onPress={fetchVehicles}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 30,
    backgroundColor: '#3477eb',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vehicleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleDetails: {
    gap: 4,
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverName: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modelText: {
    fontSize: 11,
    color: '#3477eb',
    fontWeight: '700',
  },
  routeContainer: {
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
  },
  routeLineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
    paddingVertical: 4,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  arrowIcon: {
    marginLeft: -9,
  },
  tripStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
  statText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    gap: 6,
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#3477eb',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3477eb',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});

export default TripHistoryVehiclesScreen;