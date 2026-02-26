import React from 'react';
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

const AboutUsScreen = ({ navigation }) => {
  const features = [
    {
      id: 1,
      icon: 'map-marker-radius',
      title: 'Real-time Tracking',
      description: 'Track your entire fleet in real-time with GPS accuracy',
      color: '#3477eb',
    },
    {
      id: 2,
      icon: 'routes',
      title: 'Route Optimization',
      description: 'Find the most efficient routes to save time and fuel',
      color: '#10B981',
    },
    {
      id: 3,
      icon: 'chart-line',
      title: 'Analytics Dashboard',
      description: 'Get detailed insights and reports on fleet performance',
      color: '#F59E0B',
    },
    {
      id: 4,
      icon: 'shield-check',
      title: 'Safety Management',
      description: 'Monitor driver behavior and ensure safety compliance',
      color: '#8B5CF6',
    },
  ];

  const stats = [
    { id: 1, value: '500+', label: 'Happy Clients', icon: 'account-group' },
    { id: 2, value: '5000+', label: 'Vehicles Managed', icon: 'truck' },
    { id: 3, value: '50+', label: 'Cities Covered', icon: 'city' },
    { id: 4, value: '24/7', label: 'Support', icon: 'headset' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>About Us</Text>
            <Text style={styles.subtitle}>Know Our Story</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Company Info */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="information" size={48} color="#3477eb" />
            <Text style={styles.infoTitle}>Fleet Management System</Text>
            <Text style={styles.infoDescription}>
              We are a leading provider of comprehensive fleet management solutions, 
              helping businesses optimize their vehicle operations, reduce costs, and 
              improve efficiency through cutting-edge technology and real-time tracking.
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Impact</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.id} style={styles.statCard}>
                <Icon name={stat.icon} size={32} color="#3477eb" />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Offer</Text>
          {features.map((feature) => (
            <View key={feature.id} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: `${feature.color}15` }]}>
                <Icon name={feature.icon} size={28} color={feature.color} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Mission & Vision */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <View style={styles.missionCard}>
            <Icon name="target" size={32} color="#3477eb" />
            <Text style={styles.missionText}>
              To revolutionize fleet management by providing innovative, reliable, 
              and user-friendly solutions that empower businesses to achieve 
              operational excellence and sustainable growth.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Vision</Text>
          <View style={styles.missionCard}>
            <Icon name="eye" size={32} color="#10B981" />
            <Text style={styles.missionText}>
              To be the most trusted and preferred fleet management partner 
              globally, setting industry standards for innovation, customer 
              satisfaction, and environmental responsibility.
            </Text>
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
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 12,
  },
  infoDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3477eb',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 20,
  },
  missionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  missionText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    marginTop: 16,
  },
  bottomPadding: {
    height: 20,
  },
});

export default AboutUsScreen;