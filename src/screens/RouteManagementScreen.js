import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiGet, apiPost, ENDPOINTS } from '../utils/Api';

// ─── Generate 30-min time slots ──────────────────────────────────────────────
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const min = m.toString().padStart(2, '0');
      const suffix = h < 12 ? 'AM' : 'PM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push({
        label: `${displayHour.toString().padStart(2, '0')}:${min} ${suffix}`,
        hour: h,
        minute: m,
      });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();
const DROPDOWN_HEIGHT = 220;

// ─── Time picker dropdown ─────────────────────────────────────────────────────
const TimeField = ({ value, onChange }) => {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const openDropdown = () => {
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setDropPos({ top: y + height + 2, left: x, width });
      setOpen(true);
    });
  };

  return (
    <View>
      <TouchableOpacity
        ref={triggerRef}
        style={styles.timeField}
        onPress={openDropdown}
        activeOpacity={0.7}
      >
        <Icon name="clock-outline" size={16} color="#64748B" />
        <Text style={[styles.timeFieldText, !value && styles.placeholder]}>
          {value ? value.label : '--:-- --'}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={[styles.dropdownBox, { top: dropPos.top, left: dropPos.left, width: dropPos.width }]}>
          <FlatList
            data={TIME_SLOTS}
            keyExtractor={(item) => item.label}
            showsVerticalScrollIndicator
            style={{ maxHeight: DROPDOWN_HEIGHT }}
            getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
            initialNumToRender={8}
            renderItem={({ item }) => {
              const active = value?.label === item.label;
              return (
                <TouchableOpacity
                  style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                  onPress={() => { onChange(item); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                    {item.label}
                  </Text>
                  {active && <Icon name="check" size={14} color="#3477eb" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
};

// ─── Vehicle picker dropdown ──────────────────────────────────────────────────
// Shows: registration_number (bold) + model (subtitle) from the same
// ENDPOINTS.VEHICLES API call used in VehicleScreen
// ─────────────────────────────────────────────────────────────────────────────
const VehicleField = ({ vehicles, value, onChange, enabled, isLoading }) => {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const openDropdown = () => {
    if (!enabled || isLoading) return;
    triggerRef.current.measureInWindow((x, y, width, height) => {
      setDropPos({ top: y + height + 2, left: x, width });
      setOpen(true);
    });
  };

  const selectedVehicle = vehicles.find((v) => v.id === value);

  return (
    <View>
      {/* ── Trigger button ── */}
      <TouchableOpacity
        ref={triggerRef}
        style={[styles.vehicleField, !enabled && styles.vehicleFieldDisabled]}
        onPress={openDropdown}
        activeOpacity={enabled ? 0.7 : 1}
      >
        <Icon name="car-side" size={18} color={enabled ? '#3477eb' : '#94A3B8'} />

        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#3477eb" style={{ marginLeft: 8 }} />
            <Text style={[styles.vehicleFieldText, styles.placeholder]}>
              Loading vehicles...
            </Text>
          </>
        ) : (
          <Text style={[styles.vehicleFieldText, !selectedVehicle && styles.placeholder]}>
            {selectedVehicle
              ? `${selectedVehicle.registrationNo}  •  ${selectedVehicle.model || 'No Model'}`
              : '-- Choose vehicle --'}
          </Text>
        )}

        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </TouchableOpacity>

      {/* ── Dropdown modal ── */}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />

        <View style={[styles.dropdownBox, { top: dropPos.top, left: dropPos.left, width: dropPos.width }]}>
          {vehicles.length === 0 ? (
            <View style={styles.vehicleEmptyDropdown}>
              <Icon name="car-off" size={28} color="#CBD5E1" />
              <Text style={styles.vehicleEmptyText}>No vehicles found</Text>
            </View>
          ) : (
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator
              style={{ maxHeight: DROPDOWN_HEIGHT }}
              getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
              initialNumToRender={8}
              renderItem={({ item }) => {
                const active = value === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.vehicleDropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => { onChange(item.id); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    {/* Left: icon circle + two-line text */}
                    <View style={styles.vehicleDropdownLeft}>
                      <View style={[
                        styles.vehicleIconCircle,
                        active && styles.vehicleIconCircleActive,
                      ]}>
                        <Icon name="car-side" size={18} color={active ? '#3477eb' : '#64748B'} />
                      </View>

                      <View style={styles.vehicleTextBlock}>
                        {/* Line 1 — Registration number */}
                        <Text
                          style={[styles.vehicleRegNo, active && styles.dropdownItemTextActive]}
                          numberOfLines={1}
                        >
                          {item.registrationNo}
                        </Text>
                        {/* Line 2 — Model */}
                        <Text style={styles.vehicleModel} numberOfLines={1}>
                          {item.model || 'No model info'}
                        </Text>
                      </View>
                    </View>

                    {/* Right: checkmark if selected */}
                    {active && <Icon name="check-circle" size={18} color="#3477eb" />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RouteManagementScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('add');

  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');

  const [departureDate, setDepartureDate] = useState(null);
  const [departureTime, setDepartureTime] = useState(null);
  const [showDepartureDatePicker, setShowDepartureDatePicker] = useState(false);

  const [arrivalDate, setArrivalDate] = useState(null);
  const [arrivalTime, setArrivalTime] = useState(null);
  const [showArrivalDatePicker, setShowArrivalDatePicker] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [routesFound, setRoutesFound] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeTab === 'view') fetchRoutes();
  }, [activeTab]);

  // ─── Fetch saved routes ───────────────────────────────────────────────────
  const fetchRoutes = async () => {
    setIsFetchingRoutes(true);
    try {
      const data = await apiGet(ENDPOINTS.ROUTES);
      setRoutes(
        data.map((route) => ({
          id: route._id,
          routeName: route.name,
          sourceLat: route.source[1].toString(),
          sourceLng: route.source[0].toString(),
          destLat: route.destination[1].toString(),
          destLng: route.destination[0].toString(),
          geofenceRadius: route.geofence_radius || 500,
        }))
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch routes: ' + error.message);
    } finally {
      setIsFetchingRoutes(false);
    }
  };

  // ─── Fetch vehicles ───────────────────────────────────────────────────────
  // Same ENDPOINTS.VEHICLES call as VehicleScreen — maps registration_number
  // and model so the dropdown shows both fields clearly
  // ─────────────────────────────────────────────────────────────────────────
  const fetchVehicles = async () => {
    setIsLoadingVehicles(true);
    try {
      const response = await apiGet(ENDPOINTS.VEHICLES);
      // API may return array directly or wrapped in { data: [...] }
      const data = Array.isArray(response) ? response : (response?.data || []);

      console.log('🚗 Raw vehicle from API:', JSON.stringify(data[0], null, 2));

      setVehicles(
        data.map((v) => ({
          id: v._id,
          // ✅ registration_number — shown bold as line 1
          registrationNo: v.registration_number || 'Unknown Reg',
          // ✅ model — shown as grey subtitle on line 2
          model: v.model || '',
          // ✅ make — extra info if needed
          make: v.make || '',
        }))
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to load vehicles: ' + error.message);
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  // ─── Find Routes ──────────────────────────────────────────────────────────
  const handleFindRoutes = () => {
    if (!source || !destination) {
      Alert.alert('Error', 'Please enter Source and Destination');
      return;
    }
    if (!departureDate || !departureTime) {
      Alert.alert('Error', 'Please select Departure Date & Time');
      return;
    }
    setRoutesFound(true);
    fetchVehicles(); // ← triggers vehicle API call
  };

  // ─── Submit Trip ──────────────────────────────────────────────────────────
  const handleAddTrip = async () => {
    if (!source || !destination) {
      Alert.alert('Error', 'Please enter Source and Destination');
      return;
    }
    if (!departureDate || !departureTime) {
      Alert.alert('Error', 'Please select Departure Date & Time');
      return;
    }
    if (!routesFound) {
      Alert.alert('Error', 'Please tap "Find Routes" first');
      return;
    }
    if (!selectedVehicleId) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    const depDate = new Date(departureDate);
    depDate.setHours(departureTime.hour, departureTime.minute, 0, 0);

    let arrDate = null;
    if (arrivalDate && arrivalTime) {
      arrDate = new Date(arrivalDate);
      arrDate.setHours(arrivalTime.hour, arrivalTime.minute, 0, 0);
    }

    setIsLoading(true);
    try {
      await apiPost(ENDPOINTS.ROUTES, {
        source,
        destination,
        vehicle_id: selectedVehicleId,
        departure_time: depDate.toISOString(),
        ...(arrDate && { arrival_time: arrDate.toISOString() }),
      });

      Alert.alert('Success', 'Trip added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setSource('');
            setDestination('');
            setDepartureDate(null);
            setDepartureTime(null);
            setArrivalDate(null);
            setArrivalTime(null);
            setSelectedVehicleId('');
            setRoutesFound(false);
            setActiveTab('view');
            fetchRoutes();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to add trip: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return 'mm/dd/yyyy';
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // ─── Add Tab ──────────────────────────────────────────────────────────────
  const renderAddTab = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>

          {/* ── Row 1: Source | Destination ── */}
          <View style={styles.rowTwo}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Source</Text>
              <View style={styles.inputContainer}>
                <Icon name="map-marker" size={18} color="#4CAF50" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Source address / place"
                  value={source}
                  onChangeText={setSource}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>Destination</Text>
              <View style={styles.inputContainer}>
                <Icon name="map-marker-check" size={18} color="#F44336" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Destination address / place"
                  value={destination}
                  onChangeText={setDestination}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>

          {/* ── Row 2: Departure | Arrival ── */}
          <View style={styles.rowTwo}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Departure Date & Time</Text>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => setShowDepartureDatePicker(true)}
                activeOpacity={0.7}
              >
                <Icon name="calendar" size={16} color="#64748B" />
                <Text style={[styles.dateFieldText, !departureDate && styles.placeholder]}>
                  {formatDate(departureDate)}
                </Text>
              </TouchableOpacity>
              <TimeField value={departureTime} onChange={setDepartureTime} />
            </View>

            <View style={styles.halfField}>
              <Text style={styles.label}>
                Arrival Date & Time{' '}
              </Text>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => setShowArrivalDatePicker(true)}
                activeOpacity={0.7}
              >
                <Icon name="calendar" size={16} color="#64748B" />
                <Text style={[styles.dateFieldText, !arrivalDate && styles.placeholder]}>
                  {formatDate(arrivalDate)}
                </Text>
              </TouchableOpacity>
              <TimeField value={arrivalTime} onChange={setArrivalTime} />
            </View>
          </View>

          {/* ── Find Routes button ── */}
          <TouchableOpacity
            style={styles.findButton}
            onPress={handleFindRoutes}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.findButtonGradient}>
              <Icon name="map-search" size={20} color="#FFFFFF" />
              <Text style={styles.findButtonText}>Find Routes</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Vehicle picker ── */}
          <View>
            <Text style={styles.label}>
              Choose Vehicle{' '}
              {!routesFound && (
                <Text style={styles.optionalText}>(tap Find Routes first)</Text>
              )}
            </Text>
            <Text style={styles.vehicleHint}>
              {routesFound
                ? 'Registration no. and model shown in dropdown'
                : 'Fill in details above and tap Find Routes to load vehicles'}
            </Text>
            <VehicleField
              vehicles={vehicles}
              value={selectedVehicleId}
              onChange={setSelectedVehicleId}
              enabled={routesFound}
              isLoading={isLoadingVehicles}
            />
          </View>

          {/* ── Submit Trip — always visible, validates on press ── */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleAddTrip}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.submitButtonGradient}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="check-circle-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submit Trip</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* ── Date pickers ── */}
      {showDepartureDatePicker && (
        <DateTimePicker
          value={departureDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, date) => {
            setShowDepartureDatePicker(false);
            if (date) setDepartureDate(date);
          }}
        />
      )}
      {showArrivalDatePicker && (
        <DateTimePicker
          value={arrivalDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, date) => {
            setShowArrivalDatePicker(false);
            if (date) setArrivalDate(date);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );

  // ─── View Tab ─────────────────────────────────────────────────────────────
  const renderViewTab = () => {
    const filteredRoutes = routes.filter((r) =>
      r.routeName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by route name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {isFetchingRoutes ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3477eb" />
            <Text style={styles.loadingText}>Loading routes...</Text>
          </View>
        ) : filteredRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="routes-clock" size={80} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No matching routes' : 'No trips available'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery ? 'Try a different search term' : 'Add a trip to get started'}
            </Text>
          </View>
        ) : (
          <>
            {searchQuery.length > 0 && (
              <Text style={styles.resultCount}>
                Found {filteredRoutes.length} {filteredRoutes.length === 1 ? 'result' : 'results'}
              </Text>
            )}
            {filteredRoutes.map((route) => (
              <View key={route.id} style={styles.routeCard}>
                <View style={styles.routeHeader}>
                  <View style={styles.routeIconCircle}>
                    <Icon name="routes" size={24} color="#3477eb" />
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeNameText}>{route.routeName}</Text>
                    <View style={styles.radiusRow}>
                      <Icon name="radius-outline" size={14} color="#FF9800" />
                      <Text style={styles.radiusText}>Geofence: {route.geofenceRadius}m</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.coordinatesSection}>
                  {[
                    { label: 'Source', lat: route.sourceLat, lng: route.sourceLng },
                    { label: 'Destination', lat: route.destLat, lng: route.destLng },
                  ].map((c) => (
                    <View key={c.label} style={styles.coordinateBlock}>
                      <Text style={styles.coordinateLabel}>{c.label} Coordinates</Text>
                      <View style={styles.coordinateValues}>
                        <View style={styles.coordinateItem}>
                          <Text style={styles.coordinateKey}>Lat:</Text>
                          <Text style={styles.coordinateValue}>{c.lat}</Text>
                        </View>
                        <View style={styles.coordinateItem}>
                          <Text style={styles.coordinateKey}>Lng:</Text>
                          <Text style={styles.coordinateValue}>{c.lng}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.routeActions}>
                  <TouchableOpacity style={styles.editButton}>
                    <Icon name="pencil" size={18} color="#3477eb" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton}>
                    <Icon name="delete" size={18} color="#F44336" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  // ─── Root ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#3477eb', '#2563eb']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
          <Icon name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trips</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => activeTab === 'view' && fetchRoutes()}
        >
          <Icon name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'add' && styles.activeTab]}
          onPress={() => setActiveTab('add')}
        >
          <Icon name="plus-circle-outline" size={20} color={activeTab === 'add' ? '#3477eb' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add Trip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'view' && styles.activeTab]}
          onPress={() => setActiveTab('view')}
        >
          <Icon name="format-list-bulleted" size={20} color={activeTab === 'view' ? '#3477eb' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>View Trips</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'add' ? renderAddTab() : renderViewTab()}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  menuButton:    { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  refreshButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab:     { borderBottomColor: '#3477eb' },
  tabText:       { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#3477eb' },

  // Form layout
  tabContent:    { flex: 1, padding: 16 },
  scrollContent: { paddingBottom: 60 },
  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  rowTwo:       { flexDirection: 'row', gap: 12 },
  halfField:    { flex: 1 },
  label:        { fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 6 },
  optionalText: { fontSize: 11, color: '#94A3B8', fontWeight: '400' },

  // Text inputs
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 10, minHeight: 46,
  },
  inputIcon: { marginRight: 6 },
  input:     { flex: 1, fontSize: 13, color: '#1E293B', paddingVertical: 10 },

  // Date field
  dateField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1,
    borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6,
  },
  dateFieldText: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },
  placeholder:   { color: '#94A3B8' },

  // Time field trigger
  timeField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1,
    borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 11,
  },
  timeFieldText: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },

  // Shared dropdown box (Time + Vehicle both use this)
  dropdownBox: {
    position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 20, overflow: 'hidden',
  },

  // Time dropdown items
  dropdownItem: {
    height: 44, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF',
  },
  dropdownItemActive:    { backgroundColor: '#EFF6FF' },
  dropdownItemText:      { fontSize: 14, color: '#000000', fontWeight: '500' },
  dropdownItemTextActive:{ color: '#3477eb', fontWeight: '700' },

  // Vehicle field trigger
  vehicleField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1,
    borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 13,
  },
  vehicleFieldDisabled: { opacity: 0.45 },
  vehicleFieldText:     { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500' },

  // Vehicle dropdown rows
  vehicleDropdownItem: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF',
  },
  vehicleDropdownLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  vehicleIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },
  vehicleIconCircleActive: { backgroundColor: '#EFF6FF' },
  vehicleTextBlock: { marginLeft: 10, flex: 1 },

  // ✅ Line 1 — registration number (bold)
  vehicleRegNo: { fontSize: 14, fontWeight: '700', color: '#1E293B' },

  // ✅ Line 2 — model (grey subtitle)
  vehicleModel: { fontSize: 12, color: '#64748B', marginTop: 2 },

  vehicleEmptyDropdown: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  vehicleEmptyText:     { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  vehicleHint:          { fontSize: 12, color: '#64748B', marginBottom: 6 },

  // Find Routes
  findButton:         { borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start', elevation: 3 },
  findButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, gap: 8 },
  findButtonText:     { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Submit
  submitButton:         { borderRadius: 12, overflow: 'hidden', elevation: 4, marginTop: 4 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  submitButtonText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  // View tab search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 2,
    marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0', gap: 8,
  },
  searchInput:  { flex: 1, fontSize: 14, color: '#1E293B' },
  resultCount:  { fontSize: 13, color: '#64748B', fontWeight: '500', marginBottom: 12, paddingHorizontal: 4 },

  // Loading / empty states
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText:      { fontSize: 16, color: '#64748B', marginTop: 16, fontWeight: '500' },
  emptyState:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText:   { fontSize: 18, fontWeight: '600', color: '#64748B', marginTop: 16 },
  emptyStateSubtext:{ fontSize: 14, color: '#94A3B8', marginTop: 8 },

  // Route cards
  routeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  routeHeader:     { flexDirection: 'row', marginBottom: 16 },
  routeIconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#3477eb15',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  routeInfo:     { flex: 1 },
  routeNameText: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  radiusRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radiusText:    { fontSize: 13, color: '#FF9800', fontWeight: '600' },

  coordinatesSection: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 12 },
  coordinateBlock:    { marginBottom: 12 },
  coordinateLabel:    { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  coordinateValues:   { flexDirection: 'row', gap: 16 },
  coordinateItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coordinateKey:      { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  coordinateValue:    {
    fontSize: 13, fontWeight: '700', color: '#3477eb',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  routeActions:    { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  editButton:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#3477eb15', borderRadius: 8, gap: 6 },
  editButtonText:  { fontSize: 14, fontWeight: '600', color: '#3477eb' },
  deleteButton:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#F4433615', borderRadius: 8, gap: 6 },
  deleteButtonText:{ fontSize: 14, fontWeight: '600', color: '#F44336' },
});

export default RouteManagementScreen;