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
  useWindowDimensions,
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

const AboutUsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const styles = React.useMemo(() => createStyles(width), [width]);

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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="arrow-left" size={moderateScale(24)} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>About Us</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Know Our Story</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Company Info */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Icon name="information" size={moderateScale(48)} color="#3477eb" />
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
                <Icon name={stat.icon} size={moderateScale(32)} color="#3477eb" />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel} numberOfLines={2}>{stat.label}</Text>
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
                <Icon name={feature.icon} size={moderateScale(28)} color={feature.color} />
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
            <Icon name="target" size={moderateScale(32)} color="#3477eb" />
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
            <Icon name="eye" size={moderateScale(32)} color="#10B981" />
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

// ============================================
// Styles generated per current window width so every value
// re-scales on rotation, foldables, tablets, split-screen, etc.
// ============================================
const createStyles = (width) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F5F5F5',
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? verticalScale(50) : verticalScale(40),
      paddingBottom: verticalScale(20),
      paddingHorizontal: scale(20),
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backButton: {
      width: scale(40),
      height: scale(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    placeholder: {
      width: scale(40),
    },
    headerTitle: {
      fontSize: normalizeFont(24),
      fontWeight: '700',
      color: '#FFFFFF',
    },
    subtitle: {
      fontSize: normalizeFont(14),
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '500',
      marginTop: verticalScale(2),
    },
    scrollView: {
      flex: 1,
    },
    section: {
      paddingHorizontal: scale(20),
      marginTop: verticalScale(20),
      // caps content width on tablets so it doesn't stretch edge-to-edge
      maxWidth: isTablet ? 700 : '100%',
      width: '100%',
      alignSelf: 'center',
    },
    sectionTitle: {
      fontSize: normalizeFont(18),
      fontWeight: '700',
      color: '#1E293B',
      marginBottom: verticalScale(16),
    },
    infoCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(24),
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    infoTitle: {
      fontSize: normalizeFont(20),
      fontWeight: '700',
      color: '#1E293B',
      marginTop: verticalScale(16),
      marginBottom: verticalScale(12),
      textAlign: 'center',
    },
    infoDescription: {
      fontSize: normalizeFont(14),
      color: '#64748B',
      textAlign: 'center',
      lineHeight: verticalScale(22),
      fontWeight: '500',
    },
    // flex-based grid: wraps to 1 column on very small phones,
    // stays 2 columns everywhere else, instead of a fixed '48%'
    // that can crowd text on narrow screens.
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(12),
    },
    statCard: {
      width: isSmallDevice ? '100%' : '48%',
      backgroundColor: '#FFFFFF',
      borderRadius: scale(12),
      paddingVertical: verticalScale(20),
      paddingHorizontal: scale(12),
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    statValue: {
      fontSize: normalizeFont(24),
      fontWeight: '700',
      color: '#3477eb',
      marginTop: verticalScale(12),
    },
    statLabel: {
      fontSize: normalizeFont(12),
      color: '#64748B',
      fontWeight: '500',
      marginTop: verticalScale(4),
      textAlign: 'center',
    },
    featureCard: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(16),
      marginBottom: verticalScale(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    featureIcon: {
      width: scale(56),
      height: scale(56),
      borderRadius: scale(28),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(16),
      flexShrink: 0,
    },
    featureContent: {
      flex: 1,
      justifyContent: 'center',
    },
    featureTitle: {
      fontSize: normalizeFont(16),
      fontWeight: '700',
      color: '#1E293B',
      marginBottom: verticalScale(4),
    },
    featureDescription: {
      fontSize: normalizeFont(13),
      color: '#64748B',
      fontWeight: '500',
      lineHeight: verticalScale(20),
    },
    missionCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: scale(12),
      padding: scale(20),
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    missionText: {
      fontSize: normalizeFont(14),
      color: '#64748B',
      textAlign: 'center',
      lineHeight: verticalScale(22),
      fontWeight: '500',
      marginTop: verticalScale(16),
    },
    bottomPadding: {
      height: verticalScale(20),
    },
  });

export default AboutUsScreen;