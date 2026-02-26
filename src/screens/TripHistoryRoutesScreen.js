import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TripHistoryRoutesScreen = ({ navigation }) => {
  const routes = [
    {
      id: 1,
      name: 'Mumbai - Pune Express',
      totalTrips: 24,
      avgDistance: '148 km',
      avgDuration: '3h 15m',
      lastUsed: '05 Feb 2026',
      status: 'Active',
    },
    {
      id: 2,
      name: 'Thane - Nashik Highway',
      totalTrips: 18,
      avgDistance: '92 km',
      avgDuration: '2h 10m',
      lastUsed: '04 Feb 2026',
      status: 'Active',
    },
    {
      id: 3,
      name: 'Mumbai - Goa Coastal',
      totalTrips: 12,
      avgDistance: '215 km',
      avgDuration: '4h 50m',
      lastUsed: '03 Feb 2026',
      status: 'Active',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History - Routes</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Icon name="filter-variant" size={24} color="#3477eb" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {routes.map((route) => (
          <View key={route.id} style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <View style={styles.routeIcon}>
                <Icon name="routes" size={28} color="#3477eb" />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeName}>{route.name}</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{route.status}</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Icon name="car-multiple" size={20} color="#3477eb" />
                <Text style={styles.statValue}>{route.totalTrips}</Text>
                <Text style={styles.statLabel}>Total Trips</Text>
              </View>
              <View style={styles.statBox}>
                <Icon name="road-variant" size={20} color="#FF9800" />
                <Text style={styles.statValue}>{route.avgDistance}</Text>
                <Text style={styles.statLabel}>Avg Distance</Text>
              </View>
              <View style={styles.statBox}>
                <Icon name="clock-outline" size={20} color="#4CAF50" />
                <Text style={styles.statValue}>{route.avgDuration}</Text>
                <Text style={styles.statLabel}>Avg Duration</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Icon name="calendar" size={16} color="#64748B" />
              <Text style={styles.lastUsed}>Last used: {route.lastUsed}</Text>
            </View>
          </View>
        ))}
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
    paddingTop:30,
    backgroundColor: '#3477eb',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  routeCard: {
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
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  routeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3477eb15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeInfo: {
    flex: 1,
    gap: 6,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  lastUsed: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
});

export default TripHistoryRoutesScreen;