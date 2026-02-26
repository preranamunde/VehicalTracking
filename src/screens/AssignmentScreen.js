import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiGet, apiPost, apiDelete, ENDPOINTS } from '../utils/Api';

const AssignmentScreen = ({ navigation }) => {
  // Sub tab state (add or view) — default is 'add'
  const [activeSubTab, setActiveSubTab] = useState('add');

  // Driver -> Vehicle states
  const [selectedVehicle1, setSelectedVehicle1] = useState('');
  const [selectedVehicle1Id, setSelectedVehicle1Id] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Driver -> Vehicle date/time states
  const [fromDate1, setFromDate1] = useState(new Date());
  const [toDate1, setToDate1] = useState(new Date());
  const [showFromDatePicker1, setShowFromDatePicker1] = useState(false);
  const [showToDatePicker1, setShowToDatePicker1] = useState(false);
  const [showFromTimePicker1, setShowFromTimePicker1] = useState(false);
  const [showToTimePicker1, setShowToTimePicker1] = useState(false);
  const [remarks1, setRemarks1] = useState('');

  // Search states
  const [driverVehicleSearchQuery, setDriverVehicleSearchQuery] = useState('');

  // API data states
  const [vehicles, setVehicles] = useState([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [vehicleError, setVehicleError] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [driverError, setDriverError] = useState(null);

  const [driverVehicleAssignments, setDriverVehicleAssignments] = useState([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState(null);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fetch vehicles and drivers from API on mount
  useEffect(() => {
    fetchVehicles();
    fetchDrivers();
  }, []);

  // Fetch assignments when switching to view tab
  useEffect(() => {
    if (activeSubTab === 'view') {
      fetchDriverAssignments();
    }
  }, [activeSubTab]);

  const fetchVehicles = async () => {
    setIsLoadingVehicles(true);
    setVehicleError(null);

    try {
      const response = await apiGet(ENDPOINTS.VEHICLES);
      const data = Array.isArray(response) ? response : (response?.data || []);

      const transformedVehicles = data.map((vehicle) => ({
        id: vehicle._id,
        name: vehicle.registration_number,
        model: vehicle.model,
        driver_id: vehicle.driver_id,
      }));

      console.log('📋 Fetched vehicles:', transformedVehicles.length);
      setVehicles(transformedVehicles);
    } catch (error) {
      console.error('❌ Error fetching vehicles:', error);
      setVehicleError(error.message || 'Failed to load vehicles');
      setVehicles([]);
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const fetchDrivers = async () => {
    setIsLoadingDrivers(true);
    setDriverError(null);

    try {
      const response = await apiGet(ENDPOINTS.DRIVERS);
      const data = Array.isArray(response) ? response : (response?.data || []);

      const transformedDrivers = data.map((driver) => ({
        id: driver._id,
        name: driver.driver_name,
        mobile: driver.mobile_number,
        email: driver.email_id,
      }));

      console.log('📋 Fetched drivers:', transformedDrivers.length);
      setDrivers(transformedDrivers);
    } catch (error) {
      console.error('❌ Error fetching drivers:', error);
      setDriverError(error.message || 'Failed to load drivers');
      setDrivers([]);
    } finally {
      setIsLoadingDrivers(false);
    }
  };

  const fetchDriverAssignments = async () => {
    setIsLoadingAssignments(true);
    setAssignmentsError(null);

    try {
      const response = await apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS);
      const data = Array.isArray(response) ? response : (response?.data || []);

      const transformedAssignments = data.map((assignment) => ({
        id: assignment._id,
        vehicleName: assignment.vehicle_id?.registration_number || 'N/A',
        driverName: assignment.driver_id?.driver_name || 'N/A',
        assignedDate: new Date(assignment.created_at || assignment.assigned_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        status: assignment.status || 'Active',
      }));

      console.log('📋 Loaded driver assignments:', transformedAssignments.length);
      setDriverVehicleAssignments(transformedAssignments);
    } catch (error) {
      console.error('❌ Error fetching driver assignments:', error);
      setAssignmentsError(error.message || 'Failed to load assignments');
      setDriverVehicleAssignments([]);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedVehicle1Id || !selectedDriverId) {
      Alert.alert('Error', 'Please select both vehicle and driver');
      return;
    }

    setIsAssigning(true);

    try {
      const assignmentData = {
        vehicle_id: selectedVehicle1Id,
        driver_id: selectedDriverId,
        from_date: fromDate1.toISOString(),
        to_date: toDate1.toISOString(),
        remarks: remarks1,
      };

      console.log('📤 Assigning driver:', assignmentData);

      await apiPost(ENDPOINTS.DRIVER_ASSIGNMENTS, assignmentData);

      Alert.alert(
        'Success',
        `Driver assigned successfully!\nVehicle: ${selectedVehicle1}\nDriver: ${selectedDriver}\nFrom: ${formatDate(fromDate1)} ${formatTime(fromDate1)}\nTo: ${formatDate(toDate1)} ${formatTime(toDate1)}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedVehicle1('');
              setSelectedVehicle1Id('');
              setSelectedDriver('');
              setSelectedDriverId('');
              setFromDate1(new Date());
              setToDate1(new Date());
              setRemarks1('');

              fetchVehicles();
              if (activeSubTab === 'view') {
                fetchDriverAssignments();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error assigning driver:', error);
      Alert.alert('Error', error.message || 'Failed to assign driver');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteDriverVehicle = async (assignmentId) => {
    Alert.alert(
      'Confirm Delete',
      'Remove this driver → vehicle assignment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`${ENDPOINTS.DRIVER_ASSIGNMENTS}/${assignmentId}`);
              Alert.alert('Success', 'Assignment removed successfully');
              fetchDriverAssignments();
              fetchVehicles();
            } catch (error) {
              console.error('❌ Error deleting assignment:', error);
              Alert.alert('Error', error.message || 'Failed to remove assignment');
            }
          },
        },
      ]
    );
  };

  // Date/Time Picker Handlers for Driver -> Vehicle
  const onChangeFromDate1 = (event, selectedDate) => {
    setShowFromDatePicker1(false);
    if (selectedDate) {
      setFromDate1(selectedDate);
    }
  };

  const onChangeToDate1 = (event, selectedDate) => {
    setShowToDatePicker1(false);
    if (selectedDate) {
      setToDate1(selectedDate);
    }
  };

  const onChangeFromTime1 = (event, selectedTime) => {
    setShowFromTimePicker1(false);
    if (selectedTime) {
      setFromDate1(selectedTime);
    }
  };

  const onChangeToTime1 = (event, selectedTime) => {
    setShowToTimePicker1(false);
    if (selectedTime) {
      setToDate1(selectedTime);
    }
  };

  const renderDriverVehicleAdd = () => (
    <View style={styles.formContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Select Vehicle</Text>
        {vehicleError && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.errorText}>{vehicleError}</Text>
            <TouchableOpacity onPress={fetchVehicles} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.pickerContainer}>
          {isLoadingVehicles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3477eb" />
              <Text style={styles.loadingText}>Loading vehicles...</Text>
            </View>
          ) : (
            <Picker
              selectedValue={selectedVehicle1Id}
              onValueChange={(itemValue) => {
                setSelectedVehicle1Id(itemValue);
                const vehicle = vehicles.find(v => v.id === itemValue);
                setSelectedVehicle1(vehicle?.name || '');
              }}
              style={styles.picker}
              dropdownIconColor="#000000"
            >
              <Picker.Item label="Choose a vehicle..." value="" />
              {vehicles.map((vehicle) => (
                <Picker.Item
                  key={vehicle.id}
                  label={`${vehicle.name}${vehicle.model ? ` (${vehicle.model})` : ''}`}
                  value={vehicle.id}
                />
              ))}
            </Picker>
          )}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Select Driver</Text>
        {driverError && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.errorText}>{driverError}</Text>
            <TouchableOpacity onPress={fetchDrivers} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.pickerContainer}>
          {isLoadingDrivers ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3477eb" />
              <Text style={styles.loadingText}>Loading drivers...</Text>
            </View>
          ) : (
            <Picker
              selectedValue={selectedDriverId}
              onValueChange={(itemValue) => {
                setSelectedDriverId(itemValue);
                const driver = drivers.find(d => d.id === itemValue);
                setSelectedDriver(driver?.name || '');
              }}
              style={styles.picker}
              dropdownIconColor="#000000"
            >
              <Picker.Item label="Choose a driver..." value="" />
              {drivers.map((driver) => (
                <Picker.Item
                  key={driver.id}
                  label={driver.name}
                  value={driver.id}
                />
              ))}
            </Picker>
          )}
        </View>
      </View>

      {/* From Date & Time */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>From Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowFromDatePicker1(true)}
          >
            <Icon name="calendar" size={20} color="#3477eb" />
            <Text style={styles.dateTimeText}>{formatDate(fromDate1)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowFromTimePicker1(true)}
          >
            <Icon name="clock-outline" size={20} color="#3477eb" />
            <Text style={styles.dateTimeText}>{formatTime(fromDate1)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showFromDatePicker1 && (
        <DateTimePicker
          value={fromDate1}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeFromDate1}
        />
      )}

      {showFromTimePicker1 && (
        <DateTimePicker
          value={fromDate1}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeFromTime1}
        />
      )}

      {/* To Date & Time */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>To Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowToDatePicker1(true)}
          >
            <Icon name="calendar" size={20} color="#3477eb" />
            <Text style={styles.dateTimeText}>{formatDate(toDate1)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowToTimePicker1(true)}
          >
            <Icon name="clock-outline" size={20} color="#3477eb" />
            <Text style={styles.dateTimeText}>{formatTime(toDate1)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showToDatePicker1 && (
        <DateTimePicker
          value={toDate1}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeToDate1}
        />
      )}

      {showToTimePicker1 && (
        <DateTimePicker
          value={toDate1}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeToTime1}
        />
      )}

      {/* Remarks */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Remarks</Text>
        <TextInput
          style={styles.remarksInput}
          placeholder="Enter any remarks or notes..."
          value={remarks1}
          onChangeText={setRemarks1}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <TouchableOpacity
        style={[styles.assignButton, isAssigning && styles.assignButtonDisabled]}
        onPress={handleAssignDriver}
        activeOpacity={0.8}
        disabled={isAssigning || !selectedVehicle1Id || !selectedDriverId}
      >
        <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.buttonGradient}>
          {isAssigning ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.assignButtonText}>Assigning...</Text>
            </>
          ) : (
            <>
              <Icon name="check-circle" size={20} color="#FFFFFF" />
              <Text style={styles.assignButtonText}>Assign Driver</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderDriverVehicleView = () => {
    const filteredAssignments = driverVehicleAssignments.filter(
      (a) =>
        a.driverName?.toLowerCase().includes(driverVehicleSearchQuery.toLowerCase()) ||
        a.vehicleName?.toLowerCase().includes(driverVehicleSearchQuery.toLowerCase())
    );

    return (
      <View style={styles.viewContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by driver name or registration no..."
            value={driverVehicleSearchQuery}
            onChangeText={setDriverVehicleSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {driverVehicleSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setDriverVehicleSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {assignmentsError && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.errorText}>{assignmentsError}</Text>
            <TouchableOpacity onPress={fetchDriverAssignments} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoadingAssignments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3477eb" />
            <Text style={styles.loadingText}>Loading assignments...</Text>
          </View>
        ) : filteredAssignments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="clipboard-text-off" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              {driverVehicleSearchQuery ? 'No matching assignments' : 'No assignments yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {driverVehicleSearchQuery
                ? 'Try a different search term'
                : 'Assign drivers to vehicles to see them here'}
            </Text>
          </View>
        ) : (
          <>
            {driverVehicleSearchQuery.length > 0 && (
              <Text style={styles.resultCount}>
                Found {filteredAssignments.length} {filteredAssignments.length === 1 ? 'result' : 'results'}
              </Text>
            )}
            {filteredAssignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconCircle}>
                    <Icon name="car-side" size={24} color="#3477eb" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{assignment.vehicleName}</Text>
                    <View style={styles.cardRow}>
                      <Icon name="account" size={14} color="#64748B" />
                      <Text style={styles.cardSubtext}>{assignment.driverName}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.statusText}>{assignment.status}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <View style={styles.cardDetail}>
                    <Icon name="calendar" size={16} color="#64748B" />
                    <Text style={styles.cardDetailText}>{assignment.assignedDate}</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionIcon}
                      onPress={() => handleDeleteDriverVehicle(assignment.id)}
                    >
                      <Icon name="delete" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Assignments</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      {/* Sub Tabs (Add / View) */}
      <View style={styles.subTabsContainer}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'add' && styles.subTabActive]}
          onPress={() => setActiveSubTab('add')}
          activeOpacity={0.7}
        >
          <Icon name="plus-circle" size={18} color={activeSubTab === 'add' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.subTabText, activeSubTab === 'add' && styles.subTabTextActive]}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'view' && styles.subTabActive]}
          onPress={() => setActiveSubTab('view')}
          activeOpacity={0.7}
        >
          <Icon name="eye" size={18} color={activeSubTab === 'view' ? '#FFFFFF' : '#64748B'} />
          <Text style={[styles.subTabText, activeSubTab === 'view' && styles.subTabTextActive]}>View</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeSubTab === 'add' ? renderDriverVehicleAdd() : renderDriverVehicleView()}
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
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    paddingTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    paddingTop: 20,
  },
  headerRight: {
    width: 40,
  },
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  subTabActive: {
    backgroundColor: '#3477eb',
    borderColor: '#3477eb',
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minHeight: 50,
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    color: '#1E293B',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  remarksInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 80,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F44336',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assignButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  assignButtonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  assignButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewContainer: {
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  resultCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  assignmentCard: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardSubtext: {
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardDetailText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AssignmentScreen;