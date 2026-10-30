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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

const HomeScreen = ({ navigation }) => {
  const [selectedFilter, setSelectedFilter] = useState('All');

  // Sample data
  const stats = [
    { icon: 'car-multiple', label: 'Total Vehicles', value: '24', color: '#3477eb' },
    { icon: 'car-connected', label: 'Active', value: '18', color: '#4CAF50' },
    { icon: 'car-off', label: 'Inactive', value: '6', color: '#F44336' },
    { icon: 'speedometer', label: 'Avg Speed', value: '45 km/h', color: '#FF9800' },
  ];

  const vehicles = [
    { id: 1, name: 'MH-12-AB-1234', driver: 'John Doe', status: 'Moving', speed: '60 km/h', location: 'Mumbai Highway', statusColor: '#4CAF50' },
    { id: 2, name: 'MH-12-CD-5678', driver: 'Jane Smith', status: 'Parked', speed: '0 km/h', location: 'Parking Area A', statusColor: '#FF9800' },
    { id: 3, name: 'MH-12-EF-9012', driver: 'Mike Johnson', status: 'Moving', speed: '55 km/h', location: 'Pune Road', statusColor: '#4CAF50' },
    { id: 4, name: 'MH-12-GH-3456', driver: 'Sarah Wilson', status: 'Idle', speed: '0 km/h', location: 'Service Center', statusColor: '#64748B' },
  ];

  const quickActions = [
    { icon: 'plus-circle', label: 'Add Vehicle', color: '#3477eb', action: 'AddVehicle' },
    { icon: 'map-marker-radius', label: 'Track Live', color: '#4CAF50', action: 'LiveTracking' },
    { icon: 'history', label: 'History', color: '#FF9800', action: 'History' },
    { icon: 'bell', label: 'Alerts', color: '#F44336', action: 'Alerts' },
  ];

  const StatCard = ({ icon, label, value, color }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        <Icon name={icon} size={28} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const VehicleCard = ({ vehicle }) => (
    <TouchableOpacity 
      style={styles.vehicleCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('VehicleDetail', { vehicle })}
    >
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleIconCircle}>
          <Icon name="car-side" size={24} color="#3477eb" />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{vehicle.name}</Text>
          <View style={styles.driverRow}>
            <Icon name="account" size={14} color="#64748B" />
            <Text style={styles.driverName}>{vehicle.driver}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: vehicle.statusColor }]}>
          <Text style={styles.statusText}>{vehicle.status}</Text>
        </View>
      </View>
      
      <View style={styles.vehicleDetails}>
        <View style={styles.detailItem}>
          <Icon name="speedometer" size={16} color="#64748B" />
          <Text style={styles.detailText}>{vehicle.speed}</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="map-marker" size={16} color="#64748B" />
          <Text style={styles.detailText}>{vehicle.location}</Text>
        </View>
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
      <Text style={styles.greeting}>Hello, Admin</Text>
      <Text style={styles.subtitle}>Monitor your fleet</Text>
    </View>
    <TouchableOpacity style={styles.profileButton}>
      <Icon name="bell-outline" size={28} color="#FFFFFF" />
    </TouchableOpacity>
  </View>
</LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.actionButton}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}15` }]}>
                  <Icon name={action.icon} size={28} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicles</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterContainer}>
            {['All', 'Moving', 'Parked', 'Idle'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterButton,
                  selectedFilter === filter && styles.filterButtonActive
                ]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterText,
                  selectedFilter === filter && styles.filterTextActive
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Vehicle List */}
        <View style={styles.vehicleList}>
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <LinearGradient
          colors={['#3477eb', '#5a94f5']}
          style={styles.fabGradient}
        >
          <Icon name="plus" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  profileButton: {
    width: 40,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#3477eb',
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonActive: {
    backgroundColor: '#3477eb',
    borderColor: '#3477eb',
  },
  filterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  vehicleList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3477eb15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  vehicleDetails: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
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
  header: {
  paddingTop: Platform.OS === 'ios' ? 20 : 16,
  paddingBottom: 24,
  paddingHorizontal: 20,
},
headerContent: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
menuButton: {
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
},
headerCenter: {
  flex: 1,
  marginLeft: 16,
},
greeting: {
  fontSize: 24,
  fontWeight: '700',
  color: '#FFFFFF',
  marginBottom: 4,
},
subtitle: {
  fontSize: 14,
  color: 'rgba(255, 255, 255, 0.9)',
  fontWeight: '500',
},
profileButton: {
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
},
});

export default HomeScreen;