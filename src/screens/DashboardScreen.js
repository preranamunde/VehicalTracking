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
import LinearGradient from 'react-native-linear-gradient';

const DashboardScreen = ({ navigation }) => {
  // Hardcoded stats data
  const stats = {
    totalVehicles: 24,
    activeVehicles: 18,
    totalDrivers: 32,
    activeDrivers: 28,
    totalRoutes: 15,
    activeRoutes: 12,
    totalTrips: 156,
    completedTrips: 142,
  };

  // Dashboard cards configuration
  const dashboardCards = [
    {
      id: 1,
      title: 'Vehicles',
      total: stats.totalVehicles,
      active: stats.activeVehicles,
      icon: 'truck',
      color: '#3477eb',
      gradient: ['#3477eb', '#5a94f5'],
      route: 'Vehicles',
    },
    {
      id: 2,
      title: 'Drivers',
      total: stats.totalDrivers,
      active: stats.activeDrivers,
      icon: 'account-group',
      color: '#10B981',
      gradient: ['#10B981', '#34D399'],
      route: 'Drivers',
    },
    {
      id: 3,
      title: 'Routes',
      total: stats.totalRoutes,
      active: stats.activeRoutes,
      icon: 'routes',
      color: '#F59E0B',
      gradient: ['#F59E0B', '#FBBF24'],
      route: 'RouteManagement',
    },
    {
      id: 4,
      title: 'Trips',
      total: stats.totalTrips,
      active: stats.completedTrips,
      icon: 'map-marker-path',
      color: '#8B5CF6',
      gradient: ['#8B5CF6', '#A78BFA'],
      route: 'TripHistoryVehicles',
    },
  ];

  // Quick action cards
  const quickActions = [
    {
      id: 1,
      title: 'Add Vehicle',
      icon: 'truck-plus',
      color: '#3477eb',
      route: 'Vehicles',
    },
    {
      id: 2,
      title: 'Add Driver',
      icon: 'account-multiple-plus',
      color: '#10B981',
      route: 'AddDriver',
    },
    {
      id: 3,
      title: 'Assignments',
      icon: 'clipboard-check',
      color: '#F59E0B',
      route: 'Assignments',
    },
    {
      id: 4,
      title: 'Trip History',
      icon: 'history',
      color: '#8B5CF6',
      route: 'TripHistoryVehicles',
    },
  ];

  // Recent activities (hardcoded)
  const recentActivities = [
    {
      id: 1,
      title: 'Vehicle MH-01-AB-1234 assigned',
      time: '10 mins ago',
      icon: 'truck-check',
      color: '#10B981',
    },
    {
      id: 2,
      title: 'New driver John Doe added',
      time: '1 hour ago',
      icon: 'account-plus',
      color: '#3477eb',
    },
    {
      id: 3,
      title: 'Route Mumbai-Pune completed',
      time: '2 hours ago',
      icon: 'map-marker-check',
      color: '#8B5CF6',
    },
    {
      id: 4,
      title: 'Vehicle MH-02-CD-5678 maintenance due',
      time: '3 hours ago',
      icon: 'wrench',
      color: '#F59E0B',
    },
  ];

  const StatCard = ({ card }) => (
    <TouchableOpacity
      style={styles.statCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate(card.route)}
    >
      <LinearGradient
        colors={card.gradient}
        style={styles.statCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.statCardHeader}>
          <View style={styles.statIconContainer}>
            <Icon name={card.icon} size={32} color="#FFFFFF" />
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
        </View>

        <Text style={styles.statCardTitle}>{card.title}</Text>

        <View style={styles.statCardStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{card.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{card.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const QuickActionCard = ({ action }) => (
    <TouchableOpacity
      style={styles.quickActionCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate(action.route)}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
        <Icon name={action.icon} size={28} color={action.color} />
      </View>
      <Text style={styles.quickActionTitle}>{action.title}</Text>
    </TouchableOpacity>
  );

  const ActivityItem = ({ activity }) => (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: `${activity.color}15` }]}>
        <Icon name={activity.icon} size={20} color={activity.color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activityTime}>{activity.time}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header - With back button */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {dashboardCards.map((card) => (
            <StatCard key={card.id} card={card} />
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <QuickActionCard key={action.id} action={action} />
            ))}
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activitiesContainer}>
            {recentActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </View>
        </View>

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
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  statCard: {
    width: '47%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  statCardGradient: {
    padding: 16,
    minHeight: 160,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  seeAllText: {
    fontSize: 14,
    color: '#3477eb',
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  activitiesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});

export default DashboardScreen;