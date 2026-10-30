import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, StatusBar, Platform, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiGet, apiPost, apiPut, apiDelete, ENDPOINTS } from '../utils/Api';

const BLUE = '#3477eb';
const ORANGE = '#F59E0B';

// Status value sent in the release body (same as the Postman request)
const RELEASE_STATUS_VALUE = 'ACTIVE';

// ✅ shared unwrapper — backend wraps lists as { drivers: [...] },
// { vehicles: [...] }, sometimes doubly-nested as { data: { data: [...] } }.
const unwrapArray = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  const keys = ['drivers', 'vehicles', 'assignments', 'data', 'result', 'results', 'items', 'records', 'list'];
  for (const key of keys) {
    const val = raw[key];
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') {
      for (const innerKey of keys) {
        if (Array.isArray(val[innerKey])) return val[innerKey];
      }
    }
  }
  return [];
};

// ✅ driver's real name/phone live under employee_id (nested object).
const getDriverName  = (d) => d?.employee_id?.name          || d?.driver_name    || d?.name  || 'Unknown Driver';
const getDriverPhone = (d) => d?.employee_id?.mobile_number || d?.mobile_number  || d?.phone || '';
const getDriverId    = (d) => d?._id || d?.id;

// ✅ normalize reg numbers (strip spaces/hyphens, uppercase) before comparing
const normReg = (s) => (s || '').toString().replace(/[\s-]/g, '').toUpperCase();

// ✅ Swap helpers (same rules as DriverLeaveScreen)
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
// Status coming from the assignment API (e.g. "active" / "EXPIRED"), nicely capitalised.
const getApiStatus = (a) => {
  const raw = a?.status ?? a?.assignment_status ?? a?.driver_assignment_status ?? '';
  const t = String(raw).trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};
// Swap / Release is allowed ONLY when the API status is "active"
const isActiveStatus = (a) => getApiStatus(a).toLowerCase() === 'active';

// ✅ trip_id comes as null when no trip is attached to this assignment
const hasTripId = (a) => {
  const t = a?.trip_id;
  if (t === null || t === undefined || t === '') return false;
  if (typeof t === 'object') return !!(t._id || t.id || Object.keys(t).length);
  return true;
};

const STATUS_STYLE = {
  Active:   { bg: '#DCFCE7', fg: '#166534' },
  Inactive: { bg: '#FEE2E2', fg: '#991B1B' },
  Released: { bg: '#FEF3C7', fg: '#92400E' },
  Expired:  { bg: '#FFEDD5', fg: '#9A3412' },
};
const DEFAULT_STATUS_STYLE = { bg: '#E2E8F0', fg: '#475569' };

// "2026/10/05" (same format as the Postman release body)
const formatSlashDate = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
};

// ─── Centered popup ───────────────────────────────────────────────────────────
const Popup = ({ visible, title, subtitle, onClose, children }) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView
      style={styles.popupOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.popup}>
        <View style={styles.popupHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.popupTitle}>{title}</Text>
            {!!subtitle && <Text style={styles.popupSubtitle}>{subtitle}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.popupClose}>
            <Icon name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.popupBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const PopupInfo = ({ label, value }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.popupInfo}>
      <Text style={styles.popupInfoLabel}>{label}</Text>
      <Text style={styles.popupInfoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

// ─── Inline Dropdown ──────────────────────────────────────────────────────────
const CustomDropdown = ({ label, value, placeholder, items, onSelect, loading, disabled }) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');

  const filtered = items.filter(i =>
    i.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = () => {
    if (disabled) return;
    if (!open) setSearch('');
    setOpen(v => !v);
  };

  const handleSelect = (item) => {
    onSelect(item);
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={{ zIndex: open ? 100 : 1 }}>
      {/* ── Trigger ── */}
      <TouchableOpacity
        style={[
          styles.ddButton,
          disabled && styles.ddDisabled,
          open     && styles.ddButtonOpen,
        ]}
        onPress={handleToggle}
        activeOpacity={disabled ? 1 : 0.75}
      >
        {loading ? (
          <View style={styles.ddLoadingRow}>
            <ActivityIndicator size="small" color="#3477eb" />
            <Text style={styles.ddLoadingText}>Loading {label.toLowerCase()}s…</Text>
          </View>
        ) : (
          <>
            <Text
              style={[styles.ddText, !value && styles.ddPlaceholder]}
              numberOfLines={1}
            >
              {value || placeholder}
            </Text>
            <Icon
              name={open ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={disabled ? '#CBD5E1' : '#3477eb'}
            />
          </>
        )}
      </TouchableOpacity>

      {/* ── Inline panel ── */}
      {open && (
        <View style={styles.ddPanel}>
          <View style={styles.ddSearchRow}>
            <Icon name="magnify" size={16} color="#64748B" />
            <TextInput
              style={styles.ddSearchInput}
              placeholder={`Search ${label.toLowerCase()}…`}
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Icon name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.ddList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtered.length === 0 ? (
              <View style={styles.ddEmpty}>
                <Text style={styles.ddEmptyText}>
                  {items.length === 0
                    ? `No ${label.toLowerCase()}s available for selected dates`
                    : 'No results found'}
                </Text>
              </View>
            ) : (
              filtered.map(item => {
                const selected = item.label === value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.ddItem, selected && styles.ddItemSelected]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text
                      style={[styles.ddItemText, selected && styles.ddItemTextSelected]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {selected && <Icon name="check" size={16} color="#3477eb" />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const AssignmentScreen = ({ navigation, route }) => {
  // ✅ Params sent from VehicleScreen → "Assign Driver" button
  //    navigation.navigate('Assignment', { vehicle, openTab: 'add' })
  const presetVehicle = route?.params?.vehicle || null;
  const presetRegNo   = presetVehicle?.name || presetVehicle?.registrationNumber || '';
  const openTabParam  = route?.params?.openTab;

  // ✅ Opens on the ADD tab when coming from the vehicle card, otherwise View
  const [activeSubTab, setActiveSubTab] = useState(openTabParam === 'add' ? 'add' : 'view');

  // inside the View tab → "active" (default, /current API) | "history" (/history API)
  const [viewTab, setViewTab] = useState('active');

  // ── Form state ──
  const [fromDateTime, setFromDateTime] = useState(new Date());
  const [toDateTime, setToDateTime]     = useState(new Date());
  const [vehicleId, setVehicleId]       = useState('');
  const [vehicleName, setVehicleName]   = useState('');
  const [driverId, setDriverId]         = useState('');
  const [driverName, setDriverName]     = useState('');
  const [instructions, setInstructions] = useState('');

  // ✅ shown when the vehicle opened from the card is not in the available list
  const [presetNotice, setPresetNotice] = useState('');

  // ── Date/time picker visibility ──
  const [showFromDate, setShowFromDate] = useState(false);
  const [showFromTime, setShowFromTime] = useState(false);
  const [showToDate, setShowToDate]     = useState(false);
  const [showToTime, setShowToTime]     = useState(false);

  // ── Available vehicles & drivers ──
  const [vehicles, setVehicles]               = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [drivers, setDrivers]                 = useState([]);
  const [driversLoading, setDriversLoading]   = useState(false);

  // ── Active assignments list ──
  const [assignments, setAssignments]                   = useState([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError]         = useState(null);
  const [searchQuery, setSearchQuery]                   = useState('');

  // ── History assignments list ──
  const [history, setHistory]                   = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError]         = useState(null);

  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage]         = useState({ type: '', text: '' });

  // ── Swap popup ──
  const [swapVisible, setSwapVisible]           = useState(false);
  const [swapAssignment, setSwapAssignment]     = useState(null);
  const [swapWindow, setSwapWindow]             = useState({ from: null, to: null });
  const [swapDrivers, setSwapDrivers]           = useState([]);
  const [swapLoading, setSwapLoading]           = useState(false);
  const [swapError, setSwapError]               = useState(null);
  const [selectedSwapDriver, setSelectedSwapDriver] = useState(null);
  const [swapping, setSwapping]                 = useState(false);

  // ── Release popup (used when trip_id is null) ──
  const [releaseVisible, setReleaseVisible]         = useState(false);
  const [releaseAssignment, setReleaseAssignment]   = useState(null);
  const [releaseFrom, setReleaseFrom]               = useState(new Date());
  const [releaseTo, setReleaseTo]                   = useState(new Date());
  const [releaseInstructions, setReleaseInstructions] = useState('');
  const [showReleaseFrom, setShowReleaseFrom]       = useState(false);
  const [showReleaseTo, setShowReleaseTo]           = useState(false);
  const [releasing, setReleasing]                   = useState(false);

  // ── Derived ──
  const datesSelected = !!(fromDateTime && toDateTime);
  const canSubmit     = datesSelected && !!vehicleId && !!driverId && !isAssigning;

  // ✅ If this screen is already mounted (drawer) and VehicleScreen navigates again,
  //    jump to the Add tab every time.
  useEffect(() => {
    if (openTabParam === 'add') setActiveSubTab('add');
  }, [openTabParam, presetRegNo]);

  // ── Helpers ──
  const formatDate = d => d instanceof Date
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const formatTime = d => d instanceof Date
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const formatAssignmentDate = (iso) => {
    if (!iso) return '—';
    try {
      const d    = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const day  = String(d.getDate()).padStart(2, '0');
      const mon  = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      let h      = d.getHours();
      const m    = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h          = h % 12 || 12;
      return `${day}/${mon}/${year} ${h}:${m} ${ampm}`;
    } catch { return '—'; }
  };

  // ─── Fetch ACTIVE assignments (View → Active tab) → /api/driverassignments/current ──
  const fetchAssignments = async () => {
    setIsLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      // The driver list is only used to resolve names/phones, so a failure
      // there must not break the assignments list.
      const [assignRes, driversRes] = await Promise.all([
        apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS_CURRENT),
        apiGet(ENDPOINTS.DRIVERS).catch(() => null),
      ]);

      // If /current returns a single object instead of a list, wrap it in an array.
      let rawAssignments = unwrapArray(assignRes);
      if (
        rawAssignments.length === 0 &&
        assignRes && typeof assignRes === 'object' && !Array.isArray(assignRes)
      ) {
        const single = assignRes.assignment || assignRes.data;
        if (single && typeof single === 'object' && single._id) rawAssignments = [single];
        else if (assignRes._id) rawAssignments = [assignRes];
      }

      const allDrivers = unwrapArray(driversRes);

      // driverMongoId -> full driver object (has employee_id.name / mobile_number)
      const driverById = {};
      allDrivers.forEach((d) => {
        if (d?._id) driverById[d._id] = d;
      });

      // Replace stub driver_id ({ _id }) with the full driver object when available
      const enriched = rawAssignments.map((a) => {
        const stubId = typeof a.driver_id === 'object' ? a.driver_id?._id : a.driver_id;
        const fullDriver = driverById[stubId];
        return fullDriver ? { ...a, driver_id: fullDriver } : a;
      });

      setAssignments(enriched);
    } catch (e) {
      setAssignmentsError(e.message || 'Failed to load assignments');
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  // ─── Fetch HISTORY assignments (View → History tab) → /api/driverassignments/history ──
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res  = await apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS_HISTORY);
      const list = unwrapArray(res);

      // newest assignment first
      const sorted = [...list].sort((a, b) => {
        const ta = toDate(a?.from_datetime)?.getTime() || 0;
        const tb = toDate(b?.from_datetime)?.getTime() || 0;
        return tb - ta;
      });
      setHistory(sorted);
    } catch (e) {
      setHistoryError(e.message || 'Failed to load assignment history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load the right list whenever the View tab is opened or the Active/History sub-tab changes
  useEffect(() => {
    if (activeSubTab !== 'view') return;
    if (viewTab === 'active') fetchAssignments();
    else fetchHistory();
  }, [activeSubTab, viewTab]);

  // ─── Fetch AVAILABLE VEHICLES ─────────────────────────────────────────────
  // Cross-reference availability list with full vehicle list to get correct _id.
  // ✅ If a vehicle was passed from the vehicle card, it is auto-selected once the list loads.
  useEffect(() => {
    if (!datesSelected) {
      setVehicles([]); setVehicleId(''); setVehicleName(''); return;
    }
    const timer = setTimeout(async () => {
      setVehiclesLoading(true);
      setVehicleId(''); setVehicleName('');
      setPresetNotice('');

      const from_date = fromDateTime.toISOString().slice(0, 16);
      const to_date   = toDateTime.toISOString().slice(0, 16);

      try {
        const [availRes, allRes] = await Promise.all([
          apiGet(`/api/checkavailability/vehicles?from_date=${encodeURIComponent(from_date)}&to_date=${encodeURIComponent(to_date)}`),
          apiGet(ENDPOINTS.VEHICLES),
        ]);

        const availData = unwrapArray(availRes);
        const allData   = unwrapArray(allRes);

        const merged = availData.map(avail => {
          const match = allData.find(
            v => normReg(v.registration_number) === normReg(avail.registration_number)
          );

          if (!match) {
            console.warn('⚠️ No vehicle match found for', avail.registration_number);
          }

          // fall back through possible id field names, not just _id
          const matchedId = match?._id || match?.id || match?.vehicleId;

          if (match && !matchedId) {
            console.warn('⚠️ Matched vehicle has no usable id field:', JSON.stringify(match));
          }

          return matchedId ? { ...avail, _id: matchedId } : avail;
        });

        setVehicles(merged);

        // ✅ Pre-select the vehicle that was tapped on the vehicle card
        if (presetRegNo) {
          const found = merged.find(
            v => normReg(v.registration_number) === normReg(presetRegNo)
          );
          if (found && found._id) {
            setVehicleId(found._id);
            setVehicleName(`${found.registration_number}${found.model ? ' • ' + found.model : ''}`);
          } else {
            setPresetNotice(
              `${presetRegNo} is not available for the selected dates. Change the dates or pick another vehicle.`
            );
          }
        }
      } catch (e) {
        console.error('❌ Vehicle availability error:', e.message, '— fallback to all');
        try {
          const res = await apiGet(ENDPOINTS.VEHICLES);
          const all = unwrapArray(res);
          setVehicles(all);

          if (presetRegNo) {
            const found = all.find(
              v => normReg(v.registration_number) === normReg(presetRegNo)
            );
            if (found && found._id) {
              setVehicleId(found._id);
              setVehicleName(`${found.registration_number}${found.model ? ' • ' + found.model : ''}`);
            }
          }
        } catch { setVehicles([]); }
      } finally {
        setVehiclesLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fromDateTime, toDateTime, presetRegNo]);

  // ─── Fetch UNASSIGNED DRIVERS ─────────────────────────────────────────────
  // GET /api/driver/unassigned?from_datetime=...&to_datetime=...
  useEffect(() => {
    if (!datesSelected) {
      setDrivers([]); setDriverId(''); setDriverName(''); return;
    }
    const timer = setTimeout(async () => {
      setDriversLoading(true);
      setDriverId(''); setDriverName('');

      const from_datetime = fromDateTime.toISOString();
      const to_datetime   = toDateTime.toISOString();
      console.log('👤 Unassigned drivers:', from_datetime, '→', to_datetime);

      try {
        const res  = await apiGet(ENDPOINTS.DRIVERS_UNASSIGNED(from_datetime, to_datetime));
        const list = unwrapArray(res);
        console.log('✅ Unassigned drivers:', list.length, '| server count:', res?.count);
        setDrivers(list);
      } catch (e) {
        console.error('❌ Unassigned drivers error:', e.message);
        // Do NOT fall back to all drivers — that could show drivers who are already assigned.
        setDrivers([]);
      } finally {
        setDriversLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fromDateTime, toDateTime]);

  // ─── Dropdown items ───────────────────────────────────────────────────────
  const vehicleItems = vehicles.map(v => ({
    value: v._id,
    label: `${v.registration_number}${v.model ? ' • ' + v.model : ''}`,
  }));

  const driverItems = drivers.map(d => ({
    value: getDriverId(d),
    label: `${getDriverName(d)}${getDriverPhone(d) ? ' • ' + getDriverPhone(d) : ''}`,
  }));

  // ─── Submit assignment ────────────────────────────────────────────────────
  // .slice(0, 16) → "2026-06-05T08:00" format (server rejects full ISO .000Z)
  // No client_id — server derives it from JWT token automatically
  const handleAssign = useCallback(async () => {
    if (!canSubmit) return;

    const body = {
      vehicle_id:    vehicleId,
      driver_id:     driverId,
      from_datetime: fromDateTime.toISOString().slice(0, 16),
      to_datetime:   toDateTime.toISOString().slice(0, 16),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    };
    console.log('📤 POST', ENDPOINTS.DRIVER_ASSIGNMENTS, JSON.stringify(body, null, 2));

    setIsAssigning(true);
    setMessage({});
    try {
      await apiPost(ENDPOINTS.DRIVER_ASSIGNMENTS, body);
      setMessage({ type: 'success', text: 'Assignment created successfully! ✓' });
      // Reset form
      setFromDateTime(new Date());
      setToDateTime(new Date());
      setVehicleId(''); setVehicleName('');
      setDriverId(''); setDriverName('');
      setInstructions('');
      fetchAssignments();

      // ✅ Came from the vehicle card → go back so the card refreshes
      //    (its button flips from "Assign Driver" to Swap / Release).
      if (presetVehicle) {
        navigation.setParams({ vehicle: undefined, openTab: undefined });
        setTimeout(() => navigation.goBack(), 1200);
      }
    } catch (e) {
      console.error('❌ POST error:', e.message);
      setMessage({ type: 'error', text: e.message || 'Assignment failed' });
    } finally {
      setIsAssigning(false);
    }
  }, [vehicleId, driverId, fromDateTime, toDateTime, instructions, canSubmit, presetVehicle, navigation]);

  // Auto-clear message after 5.6 s
  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({}), 5600);
    return () => clearTimeout(t);
  }, [message]);

  // ─── Swap driver (same API flow as DriverLeaveScreen) ─────────────────────
  // GET /api/driver/unassigned?from_datetime=<now>&to_datetime=<assignment to date>
  // PUT /api/driverassignments/swap/:assignment_id
  const currentDriverIdOf = (a) =>
    typeof a?.driver_id === 'object' ? a.driver_id?._id : a?.driver_id;

  const currentVehicleIdOf = (a) =>
    typeof a?.vehicle_id === 'object' ? a.vehicle_id?._id : a?.vehicle_id;

  const loadSwapDrivers = async (from, to, assignment) => {
    try {
      setSwapLoading(true);
      setSwapError(null);
      const res  = await apiGet(ENDPOINTS.DRIVERS_UNASSIGNED(from.toISOString(), to.toISOString()));
      const list = unwrapArray(res);
      const currentId = currentDriverIdOf(assignment);
      setSwapDrivers(
        list
          .filter((d) => getDriverId(d) !== currentId)
          .map((d) => ({
            value: getDriverId(d),
            label: `${getDriverName(d)}${getDriverPhone(d) ? ' • ' + getDriverPhone(d) : ''}`,
            name:  getDriverName(d),
          }))
      );
    } catch (err) {
      setSwapDrivers([]);
      setSwapError(err.message || 'Failed to load available drivers');
    } finally {
      setSwapLoading(false);
    }
  };

  const openSwap = (assignment) => {
    if (!isActiveStatus(assignment)) {
      Alert.alert('Swap not allowed', 'Only an active assignment can be swapped.');
      return;
    }
    const from = new Date();
    const to   = toDate(assignment.to_datetime);
    if (!to || to <= from) {
      Alert.alert('Swap not possible', 'This assignment has already ended.');
      return;
    }
    setSwapAssignment(assignment);
    setSwapWindow({ from, to });
    setSelectedSwapDriver(null);
    setSwapVisible(true);
    loadSwapDrivers(from, to, assignment);
  };

  const submitSwap = async () => {
    if (!selectedSwapDriver) return Alert.alert('Missing field', 'Select a driver.');
    try {
      setSwapping(true);
      const body = {
        old_driver_id: currentDriverIdOf(swapAssignment),
        new_driver_id: selectedSwapDriver.value,
        from_datetime: swapWindow.from.toISOString(),
        to_datetime:   swapWindow.to.toISOString(),
        instructions:  `Swapping driver ${getDriverName(swapAssignment.driver_id)} with ${selectedSwapDriver.name}`.trim(),
      };
      console.log('🔁 SWAP', ENDPOINTS.DRIVER_ASSIGNMENT_SWAP(swapAssignment._id), JSON.stringify(body));
      await apiPut(ENDPOINTS.DRIVER_ASSIGNMENT_SWAP(swapAssignment._id), body);
      setSwapVisible(false);
      Alert.alert('Success', `Driver swapped with ${selectedSwapDriver.name}.`);
      fetchAssignments(); // refresh assignment cards
    } catch (err) {
      Alert.alert(
        'Error',
        `Could not swap driver.\n\n${err.message}\n\nPUT ${ENDPOINTS.DRIVER_ASSIGNMENT_SWAP(swapAssignment?._id)}`
      );
    } finally {
      setSwapping(false);
    }
  };

  // ─── Release driver from current assignment (trip_id is null) ─────────────
  // PUT /api/driverassignments/release/:assignment_id
  // Body: { driver_id, vehicle_id, from_datetime, to_datetime, instructions, status }
  const openRelease = (assignment) => {
    if (!isActiveStatus(assignment)) {
      Alert.alert('Release not allowed', 'Only an active assignment can be released.');
      return;
    }
    const from = new Date();
    const to   = toDate(assignment.to_datetime) || new Date();
    setReleaseAssignment(assignment);
    setReleaseFrom(from);
    setReleaseTo(to);
    setReleaseInstructions('');
    setShowReleaseFrom(false);
    setShowReleaseTo(false);
    setReleaseVisible(true);
  };

  const closeRelease = () => {
    if (releasing) return;
    setShowReleaseFrom(false);
    setShowReleaseTo(false);
    setReleaseVisible(false);
  };

  const submitRelease = async () => {
    if (!releaseAssignment) return;
    if (releaseTo < releaseFrom) {
      return Alert.alert('Invalid dates', 'To date cannot be before From date.');
    }
    try {
      setReleasing(true);
      const body = {
        driver_id:     currentDriverIdOf(releaseAssignment),
        vehicle_id:    currentVehicleIdOf(releaseAssignment),
        from_datetime: formatSlashDate(releaseFrom),
        to_datetime:   formatSlashDate(releaseTo),
        instructions:  releaseInstructions.trim(),
        status:        RELEASE_STATUS_VALUE,
      };
      const url = ENDPOINTS.DRIVER_ASSIGNMENT_RELEASE(releaseAssignment._id);
      console.log('🔓 RELEASE', url, JSON.stringify(body));
      await apiPut(url, body);
      setShowReleaseFrom(false);
      setShowReleaseTo(false);
      setReleaseVisible(false);
      Alert.alert('Success', 'Driver released from the assignment.');
      fetchAssignments();
    } catch (err) {
      Alert.alert(
        'Error',
        `Could not release driver.\n\n${err.message}\n\nPUT ${ENDPOINTS.DRIVER_ASSIGNMENT_RELEASE(releaseAssignment?._id)}`
      );
    } finally {
      setReleasing(false);
    }
  };

  const onReleaseFromChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowReleaseFrom(false);
    if (d) setReleaseFrom(d);
  };
  const onReleaseToChange = (_, d) => {
    if (Platform.OS !== 'ios') setShowReleaseTo(false);
    if (d) setReleaseTo(d);
  };

  // ── Date/time picker handlers ──
  const onFromDateChange = (_, d) => {
    setShowFromDate(false);
    if (!d) return;
    const u = new Date(fromDateTime); u.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setFromDateTime(u);
  };
  const onFromTimeChange = (_, d) => {
    setShowFromTime(false);
    if (!d) return;
    const u = new Date(fromDateTime); u.setHours(d.getHours(), d.getMinutes());
    setFromDateTime(u);
  };
  const onToDateChange = (_, d) => {
    setShowToDate(false);
    if (!d) return;
    const u = new Date(toDateTime); u.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setToDateTime(u);
  };
  const onToTimeChange = (_, d) => {
    setShowToTime(false);
    if (!d) return;
    const u = new Date(toDateTime); u.setHours(d.getHours(), d.getMinutes());
    setToDateTime(u);
  };

  // ── Search (shared by Active + History) ──
  const matchesSearch = (a) => {
    const q = searchQuery.toLowerCase();
    return (
      (a?.vehicle_id?.registration_number || '').toLowerCase().includes(q) ||
      (getDriverName(a?.driver_id) || '').toLowerCase().includes(q) ||
      (a?.instructions || '').toLowerCase().includes(q)
    );
  };
  const filteredAssignments = assignments.filter(matchesSearch);
  const filteredHistory     = history.filter(matchesSearch);

  // ── View-tab derived values (depend on Active / History sub-tab) ──
  const isActiveView = viewTab === 'active';
  const listLoading  = isActiveView ? isLoadingAssignments : isLoadingHistory;
  const listError    = isActiveView ? assignmentsError : historyError;
  const listRetry    = isActiveView ? fetchAssignments : fetchHistory;
  const visibleList  = isActiveView ? filteredAssignments : filteredHistory;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignments</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Sub-tabs  (View first, then Add) */}
      <View style={styles.subTabsContainer}>
        {['view', 'add'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTab, activeSubTab === tab && styles.subTabActive]}
            onPress={() => setActiveSubTab(tab)}
            activeOpacity={0.7}
          >
            <Icon
              name={tab === 'add' ? 'plus-circle' : 'eye'}
              size={18}
              color={activeSubTab === tab ? '#FFF' : '#64748B'}
            />
            <Text style={[styles.subTabText, activeSubTab === tab && styles.subTabTextActive]}>
              {tab === 'add' ? 'Add' : 'View'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {/* ══════════ VIEW TAB ══════════ */}
        {activeSubTab === 'view' && (
          <View style={styles.viewContainer}>

            {/* ── Active / History switch (Active is default) ── */}
            <View style={styles.innerTabs}>
              {[
                { key: 'active',  label: 'Active',  icon: 'check-circle-outline' },
                { key: 'history', label: 'History', icon: 'history' },
              ].map(t => {
                const on = viewTab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.innerTab, on && styles.innerTabActive]}
                    onPress={() => setViewTab(t.key)}
                    activeOpacity={0.8}
                  >
                    <Icon name={t.icon} size={16} color={on ? '#FFF' : '#64748B'} />
                    <Text style={[styles.innerTabText, on && styles.innerTabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.searchContainer}>
              <Icon name="magnify" size={20} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vehicle • driver • notes…"
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {!!listError && (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={16} color="#F44336" />
                <Text style={styles.errorText}>{listError}</Text>
                <TouchableOpacity onPress={listRetry} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {listLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3477eb" />
                <Text style={styles.loadingText}>
                  {isActiveView ? 'Loading assignments…' : 'Loading history…'}
                </Text>
              </View>
            ) : visibleList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📪</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'No matching assignments'
                    : isActiveView ? 'No assignments yet' : 'No assignment history yet'}
                </Text>
              </View>
            ) : isActiveView ? (
              /* ───────────── ACTIVE cards (/current) ───────────── */
              filteredAssignments.map(a => {
                const apiStatus = getApiStatus(a);
                const st        = STATUS_STYLE[apiStatus] || DEFAULT_STATUS_STYLE;
                const isActive  = isActiveStatus(a);
                // trip_id null  → Release icon ; trip_id present → Swap icon
                const tripAttached = hasTripId(a);

                return (
                  <View key={a._id} style={styles.assignmentCard}>
                    {/* Vehicle row + swap / release icon */}
                    <View style={styles.cardEntityRow}>
                      <View style={[styles.cardEntityIcon, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={styles.cardEntityEmoji}>🚚</Text>
                      </View>
                      <View style={styles.cardEntityInfo}>
                        <Text style={styles.cardEntityName}>{a.vehicle_id?.registration_number || '—'}</Text>
                        <Text style={styles.cardEntitySub}>{a.vehicle_id?.model || '—'}</Text>
                      </View>
                      {!!apiStatus && (
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: st.fg }]}>{apiStatus}</Text>
                        </View>
                      )}

                      {tripAttached ? (
                        <TouchableOpacity
                          style={[styles.swapBtn, !isActive && styles.swapBtnDisabled]}
                          activeOpacity={0.7}
                          disabled={!isActive}
                          onPress={() => openSwap(a)}
                        >
                          <Icon name="swap-horizontal" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.releaseBtn, !isActive && styles.swapBtnDisabled]}
                          activeOpacity={0.7}
                          disabled={!isActive}
                          onPress={() => openRelease(a)}
                        >
                          <Icon name="account-arrow-right" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Driver row */}
                    <View style={styles.cardEntityRow}>
                      <View style={[styles.cardEntityIcon, { backgroundColor: '#DBEAFE' }]}>
                        <Text style={styles.cardEntityEmoji}>👤</Text>
                      </View>
                      <View style={styles.cardEntityInfo}>
                        <Text style={styles.cardEntityName}>{getDriverName(a.driver_id)}</Text>
                        <Text style={styles.cardEntitySub}>{getDriverPhone(a.driver_id) || '—'}</Text>
                      </View>
                    </View>

                    <View style={styles.cardDateGrid}>
                      <View style={styles.cardDateCell}>
                        <Text style={styles.cardDateLabel}>From</Text>
                        <Text style={styles.cardDateValue}>{formatAssignmentDate(a.from_datetime)}</Text>
                      </View>
                      <View style={styles.cardDateCell}>
                        <Text style={[styles.cardDateLabel, { color: '#D97706' }]}>To</Text>
                        <Text style={styles.cardDateValue}>{formatAssignmentDate(a.to_datetime)}</Text>
                      </View>
                    </View>

                    {!!a.instructions && (
                      <View style={styles.instructionsRow}>
                        <Icon name="text-box-outline" size={14} color="#92400E" />
                        <Text style={styles.instructionsText}>{a.instructions}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() =>
                        Alert.alert('Remove Assignment', 'Remove this assignment?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove', style: 'destructive', onPress: async () => {
                              try {
                                await apiDelete(`${ENDPOINTS.DRIVER_ASSIGNMENTS}/${a._id}`);
                                fetchAssignments();
                              } catch (err) { Alert.alert('Error', err.message); }
                            },
                          },
                        ])
                      }
                    >
                      <Text style={styles.deleteButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              /* ───────────── HISTORY cards (/history) — read-only ───────────── */
              filteredHistory.map(a => {
                const apiStatus = getApiStatus(a);
                const st        = STATUS_STYLE[apiStatus] || DEFAULT_STATUS_STYLE;
                const hasVehicle = !!a.vehicle_id;

                return (
                  <View key={a._id} style={styles.assignmentCard}>
                    {/* Vehicle row + status badge */}
                    <View style={styles.cardEntityRow}>
                      <View style={[styles.cardEntityIcon, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={styles.cardEntityEmoji}>🚚</Text>
                      </View>
                      <View style={styles.cardEntityInfo}>
                        <Text style={styles.cardEntityName}>
                          {hasVehicle ? (a.vehicle_id?.registration_number || '—') : 'No vehicle assigned'}
                        </Text>
                        <Text style={styles.cardEntitySub}>
                          {hasVehicle
                            ? [a.vehicle_id?.make, a.vehicle_id?.model].filter(Boolean).join(' ') || '—'
                            : '—'}
                        </Text>
                      </View>
                      {!!apiStatus && (
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: st.fg }]}>{apiStatus}</Text>
                        </View>
                      )}
                    </View>

                    {/* Driver row */}
                    <View style={styles.cardEntityRow}>
                      <View style={[styles.cardEntityIcon, { backgroundColor: '#DBEAFE' }]}>
                        <Text style={styles.cardEntityEmoji}>👤</Text>
                      </View>
                      <View style={styles.cardEntityInfo}>
                        <Text style={styles.cardEntityName}>{getDriverName(a.driver_id)}</Text>
                        <Text style={styles.cardEntitySub}>{getDriverPhone(a.driver_id) || '—'}</Text>
                      </View>
                    </View>

                    <View style={styles.cardDateGrid}>
                      <View style={styles.cardDateCell}>
                        <Text style={styles.cardDateLabel}>From</Text>
                        <Text style={styles.cardDateValue}>{formatAssignmentDate(a.from_datetime)}</Text>
                      </View>
                      <View style={styles.cardDateCell}>
                        <Text style={[styles.cardDateLabel, { color: '#D97706' }]}>To</Text>
                        <Text style={styles.cardDateValue}>{formatAssignmentDate(a.to_datetime)}</Text>
                      </View>
                    </View>

                    {!!a.instructions && (
                      <View style={styles.instructionsRow}>
                        <Icon name="text-box-outline" size={14} color="#92400E" />
                        <Text style={styles.instructionsText}>{a.instructions}</Text>
                      </View>
                    )}

                    {!!a.archived_at && (
                      <View style={styles.archivedRow}>
                        <Icon name="archive-outline" size={14} color="#64748B" />
                        <Text style={styles.archivedText}>
                          Archived on {formatAssignmentDate(a.archived_at)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ══════════ ADD TAB ══════════ */}
        {activeSubTab === 'add' && (
          <View style={styles.formContainer}>

            {!!message.text && (
              <View style={[
                styles.messageBanner,
                message.type === 'success' ? styles.messageBannerSuccess : styles.messageBannerError,
              ]}>
                <Icon
                  name={message.type === 'success' ? 'check-circle' : 'alert-circle'}
                  size={18}
                  color={message.type === 'success' ? '#065F46' : '#991B1B'}
                />
                <Text style={[styles.messageText, { color: message.type === 'success' ? '#065F46' : '#991B1B' }]}>
                  {message.text}
                </Text>
              </View>
            )}

            {/* ✅ Vehicle that was tapped on the vehicle card */}
            {!!presetRegNo && (
              <View style={styles.presetBanner}>
                <Icon name="truck" size={18} color={BLUE} />
                <Text style={styles.presetBannerText} numberOfLines={2}>
                  Assigning a driver to <Text style={{ fontWeight: '800' }}>{presetRegNo}</Text>
                </Text>
              </View>
            )}

            {!!presetNotice && (
              <View style={styles.presetWarn}>
                <Icon name="alert-outline" size={16} color="#92400E" />
                <Text style={styles.presetWarnText}>{presetNotice}</Text>
              </View>
            )}

            {/* STEP 1 — Date & Time Range */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                <Text style={styles.stepTitle}>Select Date & Time Range</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>From <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowFromDate(true)}>
                    <Icon name="calendar" size={18} color="#3477eb" />
                    <Text style={styles.dateTimeText}>{formatDate(fromDateTime)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowFromTime(true)}>
                    <Icon name="clock-outline" size={18} color="#3477eb" />
                    <Text style={styles.dateTimeText}>{formatTime(fromDateTime)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>To <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowToDate(true)}>
                    <Icon name="calendar" size={18} color="#3477eb" />
                    <Text style={styles.dateTimeText}>{formatDate(toDateTime)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowToTime(true)}>
                    <Icon name="clock-outline" size={18} color="#3477eb" />
                    <Text style={styles.dateTimeText}>{formatTime(toDateTime)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {datesSelected && (
                <View style={styles.dateRangeConfirm}>
                  <Icon name="check-circle" size={14} color="#059669" />
                  <Text style={styles.dateRangeConfirmText}>
                    {formatDate(fromDateTime)} {formatTime(fromDateTime)} → {formatDate(toDateTime)} {formatTime(toDateTime)}
                  </Text>
                </View>
              )}
            </View>

            {/* STEP 2 — Vehicle */}
            <View style={[styles.stepCard, { overflow: 'visible' }, !datesSelected && styles.stepCardDisabled]}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepBadge, !datesSelected && styles.stepBadgeDisabled]}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={[styles.stepTitle, !datesSelected && styles.stepTitleDisabled]}>Select Vehicle</Text>
                {vehiclesLoading && <ActivityIndicator size="small" color="#3477eb" style={{ marginLeft: 8 }} />}
              </View>

              {!datesSelected ? (
                <View style={styles.hintRow}>
                  <Icon name="arrow-up-circle" size={14} color="#D97706" />
                  <Text style={styles.hintText}>Select From and To date first</Text>
                </View>
              ) : (
                <CustomDropdown
                  label="Vehicle"
                  value={vehicleName}
                  placeholder={vehiclesLoading ? 'Loading vehicles…' : 'Select vehicle…'}
                  items={vehicleItems}
                  loading={vehiclesLoading}
                  disabled={vehiclesLoading}
                  onSelect={(item) => { setVehicleId(item.value); setVehicleName(item.label); }}
                />
              )}
            </View>

            {/* STEP 3 — Driver */}
            <View style={[styles.stepCard, { overflow: 'visible' }, !datesSelected && styles.stepCardDisabled]}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepBadge, !datesSelected && styles.stepBadgeDisabled]}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={[styles.stepTitle, !datesSelected && styles.stepTitleDisabled]}>Select Driver</Text>
                {driversLoading && <ActivityIndicator size="small" color="#3477eb" style={{ marginLeft: 8 }} />}
              </View>

              {!datesSelected ? (
                <View style={styles.hintRow}>
                  <Icon name="arrow-up-circle" size={14} color="#D97706" />
                  <Text style={styles.hintText}>Select From and To date first</Text>
                </View>
              ) : (
                <CustomDropdown
                  label="Driver"
                  value={driverName}
                  placeholder={driversLoading ? 'Loading drivers…' : 'Select driver…'}
                  items={driverItems}
                  loading={driversLoading}
                  disabled={driversLoading}
                  onSelect={(item) => { setDriverId(item.value); setDriverName(item.label); }}
                />
              )}
            </View>

            {/* STEP 4 — Instructions */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>4</Text></View>
                <Text style={styles.stepTitle}>Instructions (optional)</Text>
              </View>
              <TextInput
                style={styles.remarksInput}
                placeholder="Pickup point, contact person, route preferences…"
                placeholderTextColor="#94A3B8"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.assignButton, !canSubmit && styles.assignButtonDisabled]}
              onPress={handleAssign}
              activeOpacity={canSubmit ? 0.8 : 1}
              disabled={!canSubmit}
            >
              <LinearGradient
                colors={canSubmit ? ['#059669', '#0D9488'] : ['#9CA3AF', '#9CA3AF']}
                style={styles.buttonGradient}
              >
                {isAssigning ? (
                  <><ActivityIndicator size="small" color="#FFF" /><Text style={styles.assignButtonText}>Assigning…</Text></>
                ) : (
                  <><Icon name="check-circle" size={20} color="#FFF" /><Text style={styles.assignButtonText}>Assign Driver to Vehicle</Text></>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Native pickers */}
      {showFromDate && <DateTimePicker value={fromDateTime} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onFromDateChange} />}
      {showFromTime && <DateTimePicker value={fromDateTime} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onFromTimeChange} />}
      {showToDate   && <DateTimePicker value={toDateTime}   mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onToDateChange} />}
      {showToTime   && <DateTimePicker value={toDateTime}   mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onToTimeChange} />}

      {/* ---------- Swap Driver popup ---------- */}
      <Popup
        visible={swapVisible}
        title="Swap Driver"
        subtitle="Assign another driver for the rest of this assignment"
        onClose={() => !swapping && setSwapVisible(false)}
      >
        <View style={styles.popupRow}>
          <PopupInfo label="Driver Name" value={getDriverName(swapAssignment?.driver_id)} />
          <PopupInfo label="Vehicle" value={swapAssignment?.vehicle_id?.registration_number} />
        </View>

        <View style={styles.popupRow}>
          <PopupInfo label="Swap From (today)" value={formatDate(swapWindow.from)} />
          <PopupInfo label="Swap To" value={formatDate(swapWindow.to)} />
        </View>

        <Text style={styles.popupLabel}>Available Drivers</Text>
        <CustomDropdown
          label="Driver"
          value={selectedSwapDriver?.label}
          placeholder="Select a driver"
          items={swapDrivers}
          loading={swapLoading}
          disabled={swapLoading}
          onSelect={(item) => setSelectedSwapDriver(item)}
        />

        {!!swapError && (
          <View style={[styles.errorContainer, { marginTop: 10 }]}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.errorText} numberOfLines={3}>{swapError}</Text>
            <TouchableOpacity
              onPress={() => loadSwapDrivers(swapWindow.from, swapWindow.to, swapAssignment)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.popupActions}>
          <TouchableOpacity
            style={[styles.ghostBtn, { flex: 1 }]}
            onPress={() => setSwapVisible(false)}
            disabled={swapping}
          >
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1 }, (swapping || !selectedSwapDriver) && { opacity: 0.6 }]}
            onPress={submitSwap}
            disabled={swapping || !selectedSwapDriver}
          >
            {swapping ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Swap</Text>}
          </TouchableOpacity>
        </View>
      </Popup>

      {/* ---------- Release Driver popup (trip_id is null) ---------- */}
      <Popup
        visible={releaseVisible}
        title="Release Driver"
        subtitle="Release the driver from this assignment"
        onClose={closeRelease}
      >
        {/* driver_id & vehicle_id (pre-filled from the card) */}
        <View style={styles.popupRow}>
          <PopupInfo label="Driver" value={getDriverName(releaseAssignment?.driver_id)} />
          <PopupInfo label="Vehicle" value={releaseAssignment?.vehicle_id?.registration_number} />
        </View>

        {/* from_datetime */}
        <Text style={styles.popupLabel}>From Date</Text>
        <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowReleaseFrom(true)}>
          <Icon name="calendar" size={18} color="#3477eb" />
          <Text style={styles.dateTimeText}>{formatDate(releaseFrom)}</Text>
        </TouchableOpacity>
        {showReleaseFrom && (
          <DateTimePicker
            value={releaseFrom}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onReleaseFromChange}
          />
        )}

        {/* to_datetime */}
        <Text style={[styles.popupLabel, { marginTop: 12 }]}>To Date</Text>
        <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowReleaseTo(true)}>
          <Icon name="calendar" size={18} color="#3477eb" />
          <Text style={styles.dateTimeText}>{formatDate(releaseTo)}</Text>
        </TouchableOpacity>
        {showReleaseTo && (
          <DateTimePicker
            value={releaseTo}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onReleaseToChange}
          />
        )}

        {/* instructions */}
        <Text style={[styles.popupLabel, { marginTop: 12 }]}>Instructions</Text>
        <TextInput
          style={styles.remarksInput}
          placeholder="Reason / notes for releasing the driver…"
          placeholderTextColor="#94A3B8"
          value={releaseInstructions}
          onChangeText={setReleaseInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* status (read-only) */}
        <Text style={[styles.popupLabel, { marginTop: 12 }]}>Status</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{RELEASE_STATUS_VALUE}</Text>
        </View>

        <View style={styles.popupActions}>
          <TouchableOpacity
            style={[styles.ghostBtn, { flex: 1 }]}
            onPress={closeRelease}
            disabled={releasing}
          >
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.releaseSubmitBtn, { flex: 1 }, releasing && { opacity: 0.6 }]}
            onPress={submitRelease}
            disabled={releasing}
          >
            {releasing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Release</Text>}
          </TouchableOpacity>
        </View>
      </Popup>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F1F5F9' },
  header:           { paddingTop: Platform.OS === 'ios' ? 20 : 16, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 },
  backButton:       { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle:      { fontSize: 22, fontWeight: '700', color: '#FFF' },

  subTabsContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  subTab:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  subTabActive:     { backgroundColor: '#3477eb', borderColor: '#3477eb' },
  subTabText:       { fontSize: 14, fontWeight: '600', color: '#64748B' },
  subTabTextActive: { color: '#FFF' },

  // ── Active / History switch inside the View tab ───────────────────────────
  innerTabs:         { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 },
  innerTab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 9, gap: 6 },
  innerTabActive:    { backgroundColor: '#3477eb', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
  innerTabText:      { fontSize: 14, fontWeight: '600', color: '#64748B' },
  innerTabTextActive:{ color: '#FFF' },

  contentContainer: { flex: 1 },
  formContainer:    { padding: 16, gap: 12 },

  messageBanner:        { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  messageBannerSuccess: { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
  messageBannerError:   { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  messageText:          { fontSize: 14, fontWeight: '600', flex: 1 },

  // ── Vehicle passed from the vehicle card ──────────────────────────────────
  presetBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  presetBannerText: { flex: 1, fontSize: 13.5, color: '#1E3A8A', fontWeight: '600' },
  presetWarn:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  presetWarnText:   { flex: 1, fontSize: 12.5, color: '#92400E', fontWeight: '500', lineHeight: 18 },

  stepCard:          { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  stepCardDisabled:  { opacity: 0.5 },
  stepHeader:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  stepBadge:         { width: 26, height: 26, borderRadius: 13, backgroundColor: '#3477eb', justifyContent: 'center', alignItems: 'center' },
  stepBadgeDisabled: { backgroundColor: '#CBD5E1' },
  stepBadgeText:     { fontSize: 13, fontWeight: '700', color: '#FFF' },
  stepTitle:         { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  stepTitleDisabled: { color: '#94A3B8' },
  hintRow:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  hintText:          { fontSize: 13, color: '#D97706', fontWeight: '500' },

  dateRangeConfirm:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  dateRangeConfirmText: { fontSize: 12, color: '#065F46', fontWeight: '500', flex: 1 },

  inputGroup:     { marginBottom: 12 },
  label:          { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 6 },
  dateTimeRow:    { flexDirection: 'row', gap: 10 },
  dateTimeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  dateTimeText:   { fontSize: 13, color: '#1E293B', fontWeight: '500', flex: 1 },
  remarksInput:   { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1E293B', minHeight: 80 },

  // ── Inline Dropdown ───────────────────────────────────────────────────────
  ddButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: 14, minHeight: 50,
  },
  ddButtonOpen: {
    borderColor: '#3477eb',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#EFF6FF',
  },
  ddDisabled:         { backgroundColor: '#F1F5F9' },
  ddText:             { fontSize: 14, color: '#1E293B', fontWeight: '500', flex: 1, marginRight: 8 },
  ddPlaceholder:      { color: '#94A3B8', fontWeight: '400' },
  ddLoadingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ddLoadingText:      { fontSize: 14, color: '#64748B' },

  ddPanel: {
    backgroundColor: '#FFF',
    borderWidth: 1, borderTopWidth: 0, borderColor: '#3477eb',
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 10,
  },
  ddSearchRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  ddSearchInput:      { flex: 1, fontSize: 14, color: '#1E293B', paddingVertical: 4 },
  ddList:             { maxHeight: 210 },
  ddItem:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ddItemSelected:     { backgroundColor: '#EFF6FF' },
  ddItemText:         { fontSize: 14, color: '#1E293B', flex: 1, marginRight: 8 },
  ddItemTextSelected: { color: '#3477eb', fontWeight: '600' },
  ddEmpty:            { alignItems: 'center', paddingVertical: 20 },
  ddEmptyText:        { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 16 },

  assignButton:         { borderRadius: 14, overflow: 'hidden', shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, marginBottom: 20 },
  assignButtonDisabled: { shadowOpacity: 0 },
  buttonGradient:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  assignButtonText:     { fontSize: 16, fontWeight: '700', color: '#FFF' },

  viewContainer:    { padding: 16 },
  searchContainer:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  searchInput:      { flex: 1, fontSize: 14, color: '#1E293B', paddingVertical: 10 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  loadingText:      { fontSize: 14, color: '#64748B' },
  errorContainer:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 8, gap: 8 },
  errorText:        { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },
  retryButton:      { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F44336', borderRadius: 6 },
  retryText:        { fontSize: 12, color: '#FFF', fontWeight: '600' },
  emptyContainer:   { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyText:        { fontSize: 16, color: '#64748B', fontWeight: '600' },

  assignmentCard:    { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardEntityRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEntityIcon:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  cardEntityEmoji:   { fontSize: 22 },
  cardEntityInfo:    { flex: 1 },
  cardEntityName:    { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardEntitySub:     { fontSize: 13, color: '#64748B', marginTop: 1 },
  cardDateGrid:      { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, gap: 12 },
  cardDateCell:      { flex: 1 },
  cardDateLabel:     { fontSize: 12, fontWeight: '700', color: '#059669', marginBottom: 3 },
  cardDateValue:     { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  instructionsRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  instructionsText:  { fontSize: 13, color: '#78350F', flex: 1, lineHeight: 18, fontStyle: 'italic' },
  deleteButton:      { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' },
  deleteButtonText:  { fontSize: 13, color: '#DC2626', fontWeight: '600' },

  // ── History card footer ───────────────────────────────────────────────────
  archivedRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  archivedText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  // ── Swap / Release button + status badge on assignment card ───────────────
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  swapBtn:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE },
  releaseBtn:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE },
  swapBtnDisabled: { backgroundColor: '#CBD5E1', opacity: 0.7 },

  // ── Swap / Release popup ──────────────────────────────────────────────────
  popupOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  popup:         { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', maxHeight: '88%' },
  popupHeader:   { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE, paddingHorizontal: 18, paddingVertical: 16 },
  popupTitle:    { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  popupSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  popupClose:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  popupBody:     { padding: 18, paddingBottom: 22 },
  popupRow:      { flexDirection: 'row', marginBottom: 12 },
  popupInfo:     { width: '50%', paddingRight: 8 },
  popupInfoLabel:{ fontSize: 11, color: '#64748B', fontWeight: '500', marginBottom: 2 },
  popupInfoValue:{ fontSize: 13, color: '#1E293B', fontWeight: '600' },
  popupLabel:    { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 4, marginBottom: 6 },
  popupActions:  { flexDirection: 'row', gap: 10, marginTop: 22 },
  ghostBtn:      { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12 },
  ghostBtnText:  { color: '#475569', fontSize: 14, fontWeight: '700' },
  primaryBtn:    { alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, borderRadius: 12, paddingVertical: 12 },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  releaseSubmitBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 12 },
  readOnlyField: { backgroundColor: '#F1F5F9', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12 },
  readOnlyText:  { fontSize: 14, color: '#475569', fontWeight: '600' },
});

export default AssignmentScreen;