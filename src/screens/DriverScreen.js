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
  Modal,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

// ============================================
// ✅ Centralized API
// ============================================
import { apiGet, apiDelete, ENDPOINTS } from '../utils/Api';

const STATUS_COLORS = {
  Assigned: '#4CAF50',
  Unassigned: '#94A3B8',
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DriverScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [currentDriverId, setCurrentDriverId] = useState(null);

  // Fetch on mount
  useEffect(() => {
    fetchDrivers();
  }, []);

  // Re-fetch every time this screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDrivers();
    });
    return unsubscribe;
  }, [navigation]);

  // ============================================
  // Fetch drivers  →  GET /api/driver/assignment
  // Response: { success, count, assignedCount, unassignedCount, data: [...] }
  // ============================================
  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiGet(ENDPOINTS.DRIVERS_ASSIGNMENT);

      const driverList = Array.isArray(res) ? res : (res?.data || []);

      console.log('✅ Drivers (with assignment) fetched:', driverList.length);
      setDrivers(transformDriverData(driverList));
    } catch (err) {
      console.error('❌ Error fetching drivers:', err);
      setError(err.message);

      Alert.alert(
        'Error Loading Drivers',
        `Could not fetch drivers from server.\n\nError: ${err.message}`,
        [
          { text: 'Retry', onPress: () => fetchDrivers() },
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
  // ✅ API now sends lowercase keys (vehicleRegnNumber, assignmentFromDate, ...)
  //    Old capitalized keys are kept as a fallback.
  // ============================================
  const transformDriverData = (apiDrivers) => {
    return apiDrivers.map((d) => {
      const isAssigned = d.assignmentStatus === 'ACTIVE';
      const status = isAssigned ? 'Assigned' : 'Unassigned';

      const regNo = d.vehicleRegnNumber || d.VehicleRegnNumber;
      const hasVehicle = !!regNo;
      const vehicleModelText = [d.vehicleMake, d.vehicleModel].filter(Boolean).join(' ');

      return {
        id: d.driverId,
        name: d.driverName || 'Unknown Driver',
        phone: d.driverMobile || 'N/A',
        email: d.driverEmail || 'N/A',
        licenseNo: d.driverLicense || 'N/A',
        licenseType: d.driverLicenseType || 'N/A',
        rating: d.driverRating,
        status,
        statusColor: STATUS_COLORS[status],
        vehicle: hasVehicle ? regNo : 'Not Assigned',
        vehicleModel: vehicleModelText,
        vehicleId: d.vehicleId || null,
        tripId: d.assignmentTripId || null,
        fromDate: formatDate(d.assignmentFromDate || d.AssignmentFromDate),
        toDate: formatDate(d.assignmentToDate || d.AssignmentToDate),
        originalData: d,
      };
    });
  };

  // ============================================
  // Pull-to-refresh
  // ============================================
  const onRefresh = () => {
    setRefreshing(true);
    fetchDrivers();
  };

  // ============================================
  // Edit
  // ============================================
  const handleEditDriver = async (driver) => {
    try {
      const res = await apiGet(ENDPOINTS.DRIVER_BY_ID(driver.id));
      const full = res?.driver || res?.data || res;
      navigation.navigate('AddDriver', { editDriver: full });
    } catch (err) {
      console.error('❌ Error loading driver for edit:', err);
      Alert.alert('Error', `Could not load driver details.\n\nError: ${err.message}`);
    }
  };

  // ============================================
  // Leave & Assignment info icon → DriverLeave screen
  // (that screen calls: GET /api/driver/:id,
  //  GET /api/driverassignments/bydriver/:id, GET /api/driverleaves/driver/:id)
  // ============================================
  const handleLeaveInfo = (driver) => {
    navigation.navigate('DriverLeave', {
      driverId: driver.id,
      driver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        licenseNo: driver.licenseNo,
        licenseType: driver.licenseType,
        rating: driver.rating,
      },
    });
  };

  // ============================================
  // Delete driver with confirmation
  // ============================================
  const handleDeleteDriver = (driver) => {
    setDropdownVisible(false);

    Alert.alert(
      'Delete Driver',
      `Are you sure you want to delete ${driver.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️  Deleting driver:', driver.id);
              await apiDelete(`${ENDPOINTS.DRIVERS}/${driver.id}`);
              Alert.alert('Success', 'Driver deleted successfully!');
              fetchDrivers();
            } catch (err) {
              console.error('❌ Error deleting driver:', err);
              Alert.alert('Error', `Failed to delete driver.\n\nError: ${err.message}`, [{ text: 'OK' }]);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ============================================
  // Filter + search
  // ============================================
  const filteredDrivers = useMemo(() => {
    let filtered = drivers;

    if (selectedFilter !== 'All') {
      filtered = filtered.filter((d) => d.status === selectedFilter);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          d.vehicle.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          d.licenseNo.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [drivers, searchQuery, selectedFilter]);

  // ============================================
  // Counts
  // ============================================
  const assignedCount = drivers.filter((d) => d.status === 'Assigned').length;
  const unassignedCount = drivers.filter((d) => d.status === 'Unassigned').length;

  // ============================================
  // Driver Card
  // ============================================
  const DriverCard = ({ driver }) => {
    const handleMenuPress = (event) => {
      const { pageX, pageY } = event.nativeEvent;
      setDropdownPosition({ x: pageX - 120, y: pageY + 10 });
      setCurrentDriverId(driver.id);
      setDropdownVisible(true);
    };

    const handleCall = () => {
      if (driver.phone && driver.phone !== 'N/A') Linking.openURL(`tel:${driver.phone}`);
    };

    const handleMessage = () => {
      if (driver.phone && driver.phone !== 'N/A') Linking.openURL(`sms:${driver.phone}`);
    };

    // History -> DriverAssignmentHistory screen
    // (calls GET /api/driverassignments/bydriver/:id, same as DriverLeaveScreen)
    const handleHistory = () => {
      navigation.navigate('DriverAssignmentHistory', {
        driverId: driver.id,
        driver: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
        },
      });
    };

    return (
      <TouchableOpacity
        style={styles.driverCard}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate('DriverDetail', {
            driverId: driver.id,
            assignment: driver,
          })
        }
      >
        {/* Driver Leave & Assignment Info icon */}
        <TouchableOpacity
          style={styles.leaveButton}
          activeOpacity={0.6}
          onPress={() => handleLeaveInfo(driver)}
        >
          <View style={styles.menuButtonInner}>
            <Icon name="information-outline" size={20} color="#F59E0B" />
          </View>
        </TouchableOpacity>

        {/* three-dot menu */}
        <TouchableOpacity style={styles.menuButton} activeOpacity={0.6} onPress={handleMenuPress}>
          <View style={styles.menuButtonInner}>
            <Icon name="dots-vertical" size={20} color="#3477eb" />
          </View>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.driverHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Icon name="account" size={32} color="#FFFFFF" />
            </View>
            <View style={[styles.statusIndicator, { backgroundColor: driver.statusColor }]} />
          </View>

          <View style={styles.driverInfo}>
            <View style={styles.nameStatusRow}>
              <Text style={styles.driverName} numberOfLines={1}>{driver.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: driver.statusColor }]}>
                <Text style={styles.statusText}>{driver.status}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Icon name="phone" size={14} color="#64748B" />
              <Text style={styles.phoneText}>{driver.phone}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Details */}
        <View style={styles.driverDetails}>
          <View style={styles.detailItem}>
            <Icon name="card-account-details-outline" size={16} color="#64748B" />
            <Text style={styles.detailLabel}>License</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {driver.licenseNo} ({driver.licenseType})
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Icon name="car-side" size={16} color="#64748B" />
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {driver.vehicle}
              {driver.vehicleModel ? `  •  ${driver.vehicleModel}` : ''}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Icon name="email-outline" size={16} color="#64748B" />
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{driver.email}</Text>
          </View>

          {driver.fromDate !== '' && (
            <View style={styles.detailItem}>
              <Icon name="calendar-range" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>Period</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {driver.fromDate}{driver.toDate ? `  →  ${driver.toDate}` : ''}
              </Text>
            </View>
          )}

          {driver.rating !== null && driver.rating !== undefined && (
            <View style={styles.detailItem}>
              <Icon name="star" size={16} color="#F59E0B" />
              <Text style={styles.detailLabel}>Rating</Text>
              <Text style={styles.detailValue}>{driver.rating}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Icon name="phone" size={18} color="#3477eb" />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
            <Icon name="message-outline" size={18} color="#3477eb" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleHistory} activeOpacity={0.7}>
            <Icon name="history" size={18} color="#3477eb" />
            <Text style={styles.actionButtonText}>History</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================
  // Loading screen
  // ============================================
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
        <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButtonTop}>
              <Icon name="menu" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Drivers</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddDriver')}>
              <Icon name="account-multiple-plus" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3477eb" />
          <Text style={styles.loadingText}>Loading drivers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // Three Dot Menu Modal
  // ============================================
  const ThreeDotMenu = () => {
    if (!dropdownVisible || !currentDriverId) return null;

    const currentDriver = drivers.find((d) => d.id === currentDriverId);
    if (!currentDriver) return null;

    return (
      <Modal
        transparent
        visible={dropdownVisible}
        animationType="none"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={[styles.dropdownMenu, { top: dropdownPosition.y, left: dropdownPosition.x }]}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setDropdownVisible(false);
                setTimeout(() => handleEditDriver(currentDriver), 100);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownItemIcon}>✏️</Text>
              <Text style={styles.dropdownItemText}>Edit</Text>
            </TouchableOpacity>

            <View style={styles.dropdownSeparator} />

            <TouchableOpacity
              style={[styles.dropdownItem, styles.dropdownDeleteItem]}
              onPress={() => {
                setDropdownVisible(false);
                handleDeleteDriver(currentDriver);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownItemIcon}>🗑️</Text>
              <Text style={[styles.dropdownItemText, styles.dropdownDeleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ============================================
  // Main render
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      <ThreeDotMenu />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButtonTop}>
            <Icon name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Drivers</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddDriver')}>
            <Icon name="account-multiple-plus" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#FFFFFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drivers..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
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
        {/* Stats row */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon name="account-check" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{assignedCount}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="account-off" size={24} color="#94A3B8" />
            <Text style={styles.statValue}>{unassignedCount}</Text>
            <Text style={styles.statLabel}>Unassigned</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="account-group" size={24} color="#3477eb" />
            <Text style={styles.statValue}>{drivers.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {['All', 'Assigned', 'Unassigned'].map((filter) => {
              const count =
                filter === 'All' ? drivers.length : filter === 'Assigned' ? assignedCount : unassignedCount;
              const isActive = selectedFilter === filter;

              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterButton, isActive && styles.filterButtonActive]}
                  onPress={() => setSelectedFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter}</Text>
                  <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* List */}
        <View style={styles.driverList}>
          {filteredDrivers.length > 0 ? (
            filteredDrivers.map((driver) => <DriverCard key={driver.id} driver={driver} />)
          ) : (
            <View style={styles.emptyState}>
              <Icon name="account-off" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No drivers found</Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Failed to load drivers from server'
                  : searchQuery
                    ? 'Try adjusting your search'
                    : 'No drivers match the selected filter'}
              </Text>
              {(searchQuery || selectedFilter !== 'All') && !error && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => { setSearchQuery(''); setSelectedFilter('All'); }}
                >
                  <Text style={styles.clearButtonText}>Clear filters</Text>
                </TouchableOpacity>
              )}
              {error && (
                <TouchableOpacity style={styles.clearButton} onPress={fetchDrivers}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  menuButtonTop: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, marginLeft: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  addButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 3, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  scrollView: { flex: 1 },

  statsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 4 },

  filterSection: { paddingVertical: 16 },
  filterContainer: { paddingHorizontal: 20 },
  filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8, gap: 8 },
  filterButtonActive: { backgroundColor: '#3477eb', borderColor: '#3477eb' },
  filterText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  filterBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, minWidth: 24, alignItems: 'center' },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  filterBadgeTextActive: { color: '#FFFFFF' },

  driverList: { paddingHorizontal: 20 },
  driverCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  driverHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3477eb', justifyContent: 'center', alignItems: 'center' },
  statusIndicator: { width: 16, height: 16, borderRadius: 8, position: 'absolute', bottom: 0, right: 0, borderWidth: 3, borderColor: '#FFFFFF' },
  // paddingRight increased so name/status don't overlap the two icons (leave + menu)
  driverInfo: { flex: 1, paddingRight: 80 },
  nameStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  driverName: { fontSize: 17, fontWeight: '700', color: '#1E293B', flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexShrink: 0 },
  statusText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700', textTransform: 'uppercase' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },

  driverDetails: { gap: 10, marginBottom: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '500', width: 60 },
  detailValue: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1 },

  actionButtons: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0F7FF', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#DBEAFE' },
  actionButtonText: { fontSize: 13, color: '#3477eb', fontWeight: '700' },

  menuButton: { position: 'absolute', top: 16, right: 16, zIndex: 1000 },
  leaveButton: { position: 'absolute', top: 16, right: 54, zIndex: 1000 },
  menuButtonInner: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },

  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  dropdownMenu: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 8, minWidth: 150, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  dropdownItemIcon: { fontSize: 18 },
  dropdownItemText: { fontSize: 14, color: '#1E293B', fontWeight: '600' },
  dropdownDeleteItem: {},
  dropdownDeleteText: { color: '#EF4444' },
  dropdownSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', paddingHorizontal: 40 },
  clearButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3477eb', borderRadius: 12 },
  clearButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  bottomPadding: { height: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#64748B', fontWeight: '500' },
});

export default DriverScreen;