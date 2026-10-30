import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
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

const FEATURES = [
  {
    id: 1,
    title: 'Real-Time Tracking',
    subtitle: 'Know where your vehicles are at all times',
    icon: 'map-marker-radius-outline',
    description:
      'Monitor all your vehicles on a live map with real-time GPS updates. Track location, speed, direction and route from anywhere, anytime.',
    steps: ['Open the Vehicles tab', 'Tap any vehicle card', 'View live location on map'],
  },
  {
    id: 2,
    title: 'Live Updates',
    subtitle: 'Instant status feed for every vehicle',
    icon: 'broadcast',
    description:
      'Get a live activity feed showing ignition status, driver behaviour, speed changes and movement events as they happen in real time.',
    steps: ['Go to Dashboard', 'Check the Live Feed section', 'Tap any event for details'],
  },
  {
    id: 3,
    title: 'Raise Feedback',
    subtitle: 'Report issues or share suggestions',
    icon: 'message-alert-outline',
    description:
      'Submit complaints, feedback or suggestions directly to the support team. Attach photos and choose the category for faster resolution.',
    steps: ['Go to Help Desk', 'Tap Raise a Ticket', 'Fill in the form and submit'],
  },
  {
    id: 4,
    title: 'Trip History',
    subtitle: 'Review every journey in detail',
    icon: 'history',
    description:
      'Access complete trip logs for every vehicle. See start and end points, total distance, duration, stops and route replays.',
    steps: ['Open Trip History from the drawer', 'Select a vehicle or route', 'Tap a trip to view details'],
  },
  {
    id: 5,
    title: 'Reports',
    subtitle: 'Data-driven insights at a glance',
    icon: 'file-chart-outline',
    description:
      'Generate reports on fuel usage, mileage, idle time and driver performance. Export as PDF or share directly from the app.',
    steps: ['Tap Reports on the vehicle card', 'Choose date range and type', 'Generate and share report'],
  },
  {
    id: 6,
    title: 'Smart Alerts',
    subtitle: 'Stay notified about critical events',
    icon: 'bell-ring-outline',
    description:
      'Receive instant push notifications for over-speeding, geofence breaches, ignition events, long idle periods and more.',
    steps: ['Go to Settings', 'Enable Alert Preferences', 'Customize thresholds per vehicle'],
  },
];

const LearnScreen = ({ navigation }) => {
  const [selected, setSelected] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* ── Header ── */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Learn Features</Text>
          <Text style={styles.headerSub}>{FEATURES.length} features available</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* ── Hero Banner ── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroIconWrap}>
          <Icon name="lightbulb-on-outline" size={22} color="#3477eb" />
        </View>
        <Text style={styles.heroText}>
          Explore each feature to get the most out of your fleet management app.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>

        {FEATURES.map((feature, index) => (
          <TouchableOpacity
            key={feature.id}
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => setSelected(feature)}
          >
            {/* Left: number + icon */}
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Icon name={feature.icon} size={22} color="#3477eb" />
              </View>
              {/* Connector line (not on last item) */}
              {index < FEATURES.length - 1 && <View style={styles.connector} />}
            </View>

            {/* Right: text content */}
            <View style={styles.rowContent}>
              <View style={styles.rowTop}>
                <View style={styles.rowTexts}>
                  <Text style={styles.rowTitle}>{feature.title}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{feature.subtitle}</Text>
                </View>
                <View style={styles.rowArrow}>
                  <Icon name="chevron-right" size={20} color="#3477eb" />
                </View>
              </View>

              {/* Step pills preview */}
              <View style={styles.stepPills}>
                {feature.steps.map((step, i) => (
                  <View key={i} style={styles.stepPill}>
                    <Text style={styles.stepPillNum}>{i + 1}</Text>
                    <Text style={styles.stepPillTxt} numberOfLines={1}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selected && (
              <>
                {/* Drag handle */}
                <View style={styles.handle} />

                {/* Icon + Title */}
                <View style={styles.sheetHeader}>
                  <LinearGradient
                    colors={['#3477eb', '#5a94f5']}
                    style={styles.sheetIconWrap}
                  >
                    <Icon name={selected.icon} size={26} color="#fff" />
                  </LinearGradient>
                  <View style={styles.sheetTitles}>
                    <Text style={styles.sheetTitle}>{selected.title}</Text>
                    <Text style={styles.sheetSub}>{selected.subtitle}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} style={styles.sheetClose}>
                    <Icon name="close" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={styles.sheetDivider} />

                {/* Description */}
                <Text style={styles.sheetDesc}>{selected.description}</Text>

                {/* How to use */}
                <Text style={styles.howTitle}>HOW TO USE</Text>
                {selected.steps.map((step, i) => (
                  <View key={i} style={styles.howRow}>
                    <LinearGradient
                      colors={['#3477eb', '#5a94f5']}
                      style={styles.howNum}
                    >
                      <Text style={styles.howNumTxt}>{i + 1}</Text>
                    </LinearGradient>
                    <Text style={styles.howStep}>{step}</Text>
                  </View>
                ))}

                {/* Close button */}
                <TouchableOpacity
                  style={styles.sheetBtn}
                  onPress={() => setSelected(null)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#3477eb', '#5a94f5']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.sheetBtnGrad}
                  >
                    <Icon name="check-circle-outline" size={18} color="#fff" />
                    <Text style={styles.sheetBtnTxt}>Got it</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 10 : 38,
    paddingBottom: 18, paddingHorizontal: 16,
  },
  backBtn:      { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 1 },

  // Hero Banner
  heroBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  heroIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center',
  },
  heroText: { flex: 1, fontSize: 12, color: '#1d4ed8', fontWeight: '500', lineHeight: 18 },

  // List
  list: { paddingTop: 20, paddingHorizontal: 16 },

  // Row item
  row: {
    flexDirection: 'row',
    marginBottom: 0,
  },

  // Left column: icon + connector
  rowLeft: {
    alignItems: 'center',
    width: 52,
    marginRight: 14,
  },
  iconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#DBEAFE',
    shadowColor: '#3477eb', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  connector: {
    width: 2, flex: 1,
    backgroundColor: '#DBEAFE',
    marginVertical: 4,
    minHeight: 20,
  },

  // Right column
  rowContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  rowTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 10,
  },
  rowTexts: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  rowSub:   { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  rowArrow: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },

  // Step pills
  stepPills: { gap: 5 },
  stepPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#F8FAFC', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  stepPillNum: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#3477eb',
    color: '#fff', fontSize: 9, fontWeight: '800',
    textAlign: 'center', lineHeight: 16,
  },
  stepPillTxt: { flex: 1, fontSize: 11, color: '#475569', fontWeight: '500' },

  // Modal bottom sheet
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center', marginBottom: 16,
  },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  sheetIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  sheetTitles: { flex: 1 },
  sheetTitle:  { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sheetSub:    { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  sheetClose: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },

  sheetDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 },

  sheetDesc: {
    fontSize: 14, color: '#475569', lineHeight: 22,
    fontWeight: '500', marginBottom: 18,
  },

  howTitle: {
    fontSize: 10, color: '#94a3b8', fontWeight: '800',
    letterSpacing: 1, marginBottom: 10,
  },
  howRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  howNum: {
    width: 24, height: 24, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  howNumTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  howStep:   { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },

  sheetBtn: { marginTop: 8 },
  sheetBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
  },
  sheetBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

export default LearnScreen;