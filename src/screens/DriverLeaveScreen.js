// src/screens/DriverLeaveScreen.js
// Driver Leave & Assignment Info
//   GET {{baseUrl}}/api/driver/:id                         → Driver Details
//   GET {{baseUrl}}/api/driverassignments/bydriver/:id     → Vehicle Assignment (horizontal cards)
//   GET {{baseUrl}}/api/driverleaves/driver/:id            → Leave History
//   GET {{baseUrl}}/api/driverleaves/driver/:id?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD  → Leave History search filter
// Apply Leave popup  → POST   /api/driverleaves        (Edit → PUT, Delete → DELETE /api/driverleaves/:id)
// Swap popup         → GET    /api/driver/unassigned?from_datetime=<now>&to_datetime=<assignment to date>
//                      PUT    /api/driverassignments/swap/:assignment_id
//                      then the Vehicle Assignment cards are refreshed.
import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiGet, apiPost, apiPut, apiDelete, ENDPOINTS } from '../utils/Api';

const BLUE = '#3477eb';

// ---------- helpers ----------
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => {
  const d = v instanceof Date ? v : toDate(v);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Assignment status shown on the vehicle card
const getAssignmentStatus = (a) => {
  const now = new Date();
  const from = toDate(a.from_datetime);
  const to = toDate(a.to_datetime);
  if (to && to < now) return 'Completed';
  if (from && from > now) return 'Upcoming';
  if (a.trip_id || a.route_id) return 'On Trip';
  return 'Parked / Idle';
};

// Status coming from the assignment API (e.g. "active" / "inactive"), nicely capitalised.
// Returns '' when the API did not send any status.
const getApiStatus = (a) => {
  const raw = a?.status ?? a?.assignment_status ?? a?.driver_assignment_status ?? '';
  const t = String(raw).trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};
// Swap is allowed ONLY when the API status is "active"
const isActiveStatus = (a) => getApiStatus(a).toLowerCase() === 'active';

// Leave status comes ONLY from the API (leave_status: "Completed" | "On-Going" | "Upcoming").
// Nothing is derived / guessed on the client.
const getLeaveStatus = (l) => String(l?.leave_status || '').trim();
// "On-Going", "Ongoing", "on going" -> "ongoing"  (used for comparisons)
const statusKey = (s) => String(s || '').toLowerCase().replace(/[\s_-]/g, '');

// Date → YYYY-MM-DD (query param for the leave filter API)
const toParam = (d) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : '';

const STATUS_STYLE = {
  Ongoing: { bg: '#FEF3C7', fg: '#92400E' },
  'On-Going': { bg: '#FEF3C7', fg: '#92400E' },
  'On Trip': { bg: '#DCFCE7', fg: '#166534' },
  'Parked / Idle': { bg: '#FEF3C7', fg: '#92400E' },
  Upcoming: { bg: '#DBEAFE', fg: '#1E40AF' },
  Completed: { bg: '#E2E8F0', fg: '#475569' },
  Active: { bg: '#DCFCE7', fg: '#166534' },
  Inactive: { bg: '#FEE2E2', fg: '#991B1B' },
};
const DEFAULT_STATUS_STYLE = { bg: '#E2E8F0', fg: '#475569' };

const normalizeAssignments = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.assignments)) return res.assignments;
  if (res?.data && typeof res.data === 'object') return [res.data];
  if (res?._id) return [res];
  return [];
};

// API already returns leaves sorted by leave_todate (ascending) - keep that order as is.
const normalizeLeaves = (res) =>
  res?.leaves || res?.data?.leaves || (Array.isArray(res?.data) ? res.data : []) || [];

// ---------- date field (date only) ----------
// Android: system dialog. iOS: inline spinner under the field.
const DateField = ({ value, onChange, placeholder, minimumDate, compact }) => {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={[styles.field, compact && styles.fieldCompact]}
        activeOpacity={0.7}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value ? fmtDate(value) : placeholder}
        </Text>
        <Icon name="calendar-month-outline" size={18} color="#64748B" />
      </TouchableOpacity>

      {open && (
        <View>
          <DateTimePicker
            value={value || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            onChange={(event, selected) => {
              if (Platform.OS === 'android') {
                setOpen(false);
                if (event.type === 'dismissed' || !selected) return;
              }
              if (selected) onChange(selected);
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.iosDone}>
              <Text style={styles.iosDoneText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ---------- centered popup ----------
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

const Info = ({ label, value, style }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={[styles.infoItem, style]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
};

const SectionError = ({ message, onRetry }) => (
  <View style={styles.sectionError}>
    <Icon name="alert-circle-outline" size={20} color="#B91C1C" />
    <Text style={styles.sectionErrorText} numberOfLines={3}>{message}</Text>
    <TouchableOpacity onPress={onRetry}>
      <Text style={styles.retryText}>Retry</Text>
    </TouchableOpacity>
  </View>
);

// ============================================
// Screen
// ============================================
const DriverLeaveScreen = ({ navigation, route }) => {
  const driverId = route?.params?.driverId || route?.params?.driver?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [driverInfo, setDriverInfo] = useState(null);
  const [leavesDriver, setLeavesDriver] = useState(null); // employee info returned by the leaves API
  const [assignments, setAssignments] = useState([]);
  const [leaves, setLeaves] = useState([]);       // list shown (filtered when a filter is applied)
  const [allLeaves, setAllLeaves] = useState([]);  // unfiltered (used for Leave From/To + numbering)

  // leave history search filter
  const [filterFrom, setFilterFrom] = useState(null);
  const [filterTo, setFilterTo] = useState(null);
  const [appliedFilter, setAppliedFilter] = useState({ from: null, to: null });
  const [filtering, setFiltering] = useState(false);
  const [errors, setErrors] = useState({ driver: null, assignments: null, leaves: null });

  // apply / edit leave sheet
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [lFrom, setLFrom] = useState(null);
  const [lTo, setLTo] = useState(null);
  const [lReason, setLReason] = useState('');
  const [saving, setSaving] = useState(false);

  // swap popup
  const [swapVisible, setSwapVisible] = useState(false);
  const [swapAssignment, setSwapAssignment] = useState(null);
  const [swapWindow, setSwapWindow] = useState({ from: null, to: null });
  const [swapDrivers, setSwapDrivers] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [ddOpen, setDdOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  // ---------- fetch ----------
  const fetchAll = useCallback(async () => {
    if (!driverId) {
      setLoading(false);
      return;
    }
    const [dRes, aRes, lRes] = await Promise.allSettled([
      apiGet(ENDPOINTS.DRIVER_BY_ID(driverId)),
      apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS_BY_DRIVER(driverId)),
      apiGet(ENDPOINTS.DRIVER_LEAVES_BY_DRIVER(driverId)),
    ]);

    const nextErrors = { driver: null, assignments: null, leaves: null };

    if (dRes.status === 'fulfilled') {
      setDriverInfo(dRes.value?.driver || dRes.value?.data || dRes.value);
    } else {
      nextErrors.driver = dRes.reason?.message || 'Failed to load driver details';
    }

    if (aRes.status === 'fulfilled') {
      setAssignments(normalizeAssignments(aRes.value));
    } else {
      setAssignments([]);
      nextErrors.assignments = aRes.reason?.message || 'Failed to load vehicle assignments';
    }

    if (lRes.status === 'fulfilled') {
      const all = normalizeLeaves(lRes.value);
      setLeavesDriver(lRes.value?.data?.employee_id || null);
      setAllLeaves(all);
      setLeaves(all);
      setFilterFrom(null);
      setFilterTo(null);
      setAppliedFilter({ from: null, to: null });
    } else {
      setAllLeaves([]);
      setLeaves([]);
      nextErrors.leaves = lRes.reason?.message || 'Failed to load leave history';
    }

    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
  }, [driverId]);

  // Reload leaves after Apply / Edit / Delete (keeps the applied filter)
  const fetchLeavesOnly = async (f = appliedFilter) => {
    try {
      const allRes = await apiGet(ENDPOINTS.DRIVER_LEAVES_BY_DRIVER(driverId));
      const all = normalizeLeaves(allRes);
      setAllLeaves(all);
      if (f.from || f.to) {
        const res = await apiGet(
          ENDPOINTS.DRIVER_LEAVES_BY_DRIVER(driverId, toParam(f.from), toParam(f.to))
        );
        setLeaves(normalizeLeaves(res));
      } else {
        setLeaves(all);
      }
      setErrors((e) => ({ ...e, leaves: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, leaves: err.message }));
    }
  };

  const fetchAssignmentsOnly = async () => {
    try {
      const res = await apiGet(ENDPOINTS.DRIVER_ASSIGNMENTS_BY_DRIVER(driverId));
      setAssignments(normalizeAssignments(res));
      setErrors((e) => ({ ...e, assignments: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, assignments: err.message }));
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---------- leave history search filter ----------
  // GET /api/driverleaves/driver/:id?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
  const applyFilter = async () => {
    if (!filterFrom && !filterTo) {
      Alert.alert('Select dates', 'Choose a from and/or to date to filter.');
      return;
    }
    if (filterFrom && filterTo && endOfDay(filterTo) < startOfDay(filterFrom)) {
      Alert.alert('Invalid dates', 'To date must be on or after from date.');
      return;
    }
    const f = { from: filterFrom, to: filterTo };
    try {
      setFiltering(true);
      const res = await apiGet(
        ENDPOINTS.DRIVER_LEAVES_BY_DRIVER(driverId, toParam(f.from), toParam(f.to))
      );
      setLeaves(normalizeLeaves(res));
      setAppliedFilter(f);
      setErrors((e) => ({ ...e, leaves: null }));
    } catch (err) {
      setErrors((e) => ({ ...e, leaves: err.message }));
    } finally {
      setFiltering(false);
    }
  };

  const clearFilter = () => {
    setFilterFrom(null);
    setFilterTo(null);
    setAppliedFilter({ from: null, to: null });
    setLeaves(allLeaves);
    setErrors((e) => ({ ...e, leaves: null }));
  };

  // ---------- swap ----------
  // Swap from TODAY (now) till the assignment's To Date.
  const loadSwapDrivers = async (from, to) => {
    try {
      setSwapLoading(true);
      setSwapError(null);
      const res = await apiGet(ENDPOINTS.DRIVERS_UNASSIGNED(from.toISOString(), to.toISOString()));
      const list = Array.isArray(res) ? res : res?.data || res?.drivers || [];
      setSwapDrivers(
        list
          .filter((d) => d._id !== driverId)
          .map((d) => ({
            id: d._id,
            name: d.employee_id?.name || 'Unknown Driver',
            phone: d.employee_id?.mobile_number || '',
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
    const to = toDate(assignment.to_datetime);
    if (!to || to <= from) {
      Alert.alert('Swap not possible', 'This assignment has already ended.');
      return;
    }
    setSwapAssignment(assignment);
    setSwapWindow({ from, to });
    setSelectedDriver(null);
    setDdOpen(false);
    setSwapVisible(true);
    loadSwapDrivers(from, to);
  };

  const submitSwap = async () => {
    if (!selectedDriver) return Alert.alert('Missing field', 'Select a driver.');
    try {
      setSwapping(true);
      await apiPut(ENDPOINTS.DRIVER_ASSIGNMENT_SWAP(swapAssignment._id), {
        old_driver_id: driverId,
        new_driver_id: selectedDriver.id,
        from_datetime: swapWindow.from.toISOString(),
        to_datetime: swapWindow.to.toISOString(),
        instructions: `Swapping driver ${name || ''} with ${selectedDriver.name}`.trim(),
      });
      setSwapVisible(false);
      Alert.alert('Success', `Driver swapped with ${selectedDriver.name}.`);
      fetchAssignmentsOnly(); // refresh Vehicle Assignment cards
    } catch (err) {
      Alert.alert('Error', `Could not swap driver.\n\n${err.message}`);
    } finally {
      setSwapping(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  // ---------- leave actions ----------
  const openApply = () => {
    setEditingId(null);
    setLFrom(null);
    setLTo(null);
    setLReason('');
    setSheetVisible(true);
  };

  const openEdit = (leave) => {
    setEditingId(leave._id);
    setLFrom(toDate(leave.leave_fromdate));
    setLTo(toDate(leave.leave_todate));
    setLReason(leave.leave_reasons || '');
    setSheetVisible(true);
  };

  const submitLeave = async () => {
    if (!lFrom) return Alert.alert('Missing field', 'Select a from date.');
    if (!lTo) return Alert.alert('Missing field', 'Select a to date.');
    if (endOfDay(lTo) < startOfDay(lFrom)) {
      return Alert.alert('Invalid dates', 'To date must be on or after from date.');
    }
    if (!lReason.trim()) return Alert.alert('Missing field', 'Enter the reason for leave.');

    const body = {
      leave_fromdate: startOfDay(lFrom).toISOString(),
      leave_todate: endOfDay(lTo).toISOString(),
      leave_reasons: lReason.trim(),
    };

    try {
      setSaving(true);
      if (editingId) {
        await apiPut(ENDPOINTS.DRIVER_LEAVE_BY_ID(editingId), body);
      } else {
        await apiPost(ENDPOINTS.DRIVER_LEAVES, { driver_id: driverId, ...body });
      }
      setSheetVisible(false);
      Alert.alert('Success', editingId ? 'Leave updated successfully.' : 'Leave applied successfully.');
      fetchLeavesOnly();
    } catch (err) {
      Alert.alert('Error', `Could not save leave.\n\n${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteLeave = (leave) => {
    Alert.alert('Delete leave', 'Are you sure you want to delete this leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDelete(ENDPOINTS.DRIVER_LEAVE_BY_ID(leave._id));
            fetchLeavesOnly();
          } catch (err) {
            Alert.alert('Error', `Could not delete leave.\n\n${err.message}`);
          }
        },
      },
    ]);
  };

  // ---------- driver fields: ONLY from API responses (no dummy / list fallback) ----------
  // Sources: GET /api/driver/:id, GET /api/driverleaves/driver/:id (data.employee_id),
  //          GET /api/driverassignments/bydriver/:id (driver_id populated)
  const pick = (...vals) =>
    vals.find((v) => v !== null && v !== undefined && String(v).trim() !== '');
  const assignDriver = assignments.find((a) => a.driver_id && typeof a.driver_id === 'object')?.driver_id;
  const emp = driverInfo?.employee_id || {};
  const lEmp = leavesDriver || {};
  const aEmp = assignDriver?.employee_id || {};

  const name = pick(emp.name, lEmp.name, aEmp.name);
  const mobile = pick(emp.mobile_number, lEmp.mobile_number, aEmp.mobile_number);
  const email = pick(emp.email, lEmp.email, aEmp.email);
  const licenseType = pick(driverInfo?.license_type, assignDriver?.license_type);
  const licenseNo = pick(driverInfo?.driver_license, assignDriver?.driver_license);
  const rating = pick(driverInfo?.driver_rating, assignDriver?.driver_rating);

  // Leave From / To shown in Driver Details: ongoing leave, else the next upcoming one
  const currentLeave =
    allLeaves.find((l) => statusKey(getLeaveStatus(l)) === 'ongoing') ||
    allLeaves
      .filter((l) => statusKey(getLeaveStatus(l)) === 'upcoming')
      .sort((x, y) => toDate(x.leave_fromdate) - toDate(y.leave_fromdate))[0];

  // Status badge next to the driver name
  const activeAssignment = assignments.find((a) => {
    const st = getAssignmentStatus(a);
    return st === 'On Trip' || st === 'Parked / Idle';
  });
  const upcomingAssignment = assignments.find((a) => getAssignmentStatus(a) === 'Upcoming');
  let driverStatus = { label: 'Not mapped to a vehicle', bg: '#E2E8F0', fg: '#475569' };
  if (activeAssignment) {
    driverStatus = { label: `Mapped · ${getAssignmentStatus(activeAssignment)}`, bg: '#FEF3C7', fg: '#92400E' };
  } else if (upcomingAssignment) {
    driverStatus = { label: 'Mapped · Upcoming', bg: '#DBEAFE', fg: '#1E40AF' };
  }
  if (errors.assignments) driverStatus = null; // assignments API failed → don't guess

  // Serial number follows the API order (1 = first record), independent of the filter
  const leaveNumber = (leave, idx) => {
    const i = allLeaves.findIndex((l) => l._id === leave._id);
    return i >= 0 ? i + 1 : idx + 1;
  };

  // Ratings: shown only when the API returned a rating
  const hasRating = rating !== undefined && rating !== null && !isNaN(Number(rating));
  const renderStars = (r) => {
    const n = Math.max(0, Math.min(5, Math.round(Number(r))));
    return '★'.repeat(n) + '☆'.repeat(5 - n) + `  (${r})`;
  };

  // ============================================
  // Render
  // ============================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      <LinearGradient colors={[BLUE, '#5a94f5']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="arrow-left" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Driver Leave & Assignment Info</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={styles.centerText}>Loading driver info...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BLUE]} tintColor={BLUE} />
          }
        >
          {/* ---------- Driver Details (API data only) ---------- */}
          <View style={styles.card}>
            {/* Row 1: avatar + name + status */}
            <View style={styles.driverTop}>
              <View style={styles.avatar}>
                <Icon name="account" size={28} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                {!!name && <Text style={styles.driverName} numberOfLines={1}>{name}</Text>}
                {driverStatus && (
                  <View
                    style={[styles.badge, { backgroundColor: driverStatus.bg, alignSelf: 'flex-start', marginTop: 4 }]}
                  >
                    <Text style={[styles.badgeText, { color: driverStatus.fg }]}>{driverStatus.label}</Text>
                  </View>
                )}
              </View>
            </View>

            {errors.driver && <SectionError message={errors.driver} onRetry={fetchAll} />}

            {/* Row 2: ratings (only if the API returned one) */}
            {hasRating && (
              <View style={styles.ratingRow}>
                <Icon name="star" size={16} color="#F59E0B" />
                <Text style={styles.ratingLabel}>Ratings</Text>
                <Text style={styles.ratingValue}>{renderStars(rating)}</Text>
              </View>
            )}

            <View style={styles.vDivider} />

            <View style={styles.infoGrid}>
              <Info style={styles.infoTile} label="License Type" value={licenseType} />
              <Info style={styles.infoTile} label="License Number" value={licenseNo} />
              <Info style={styles.infoTile} label="Mobile" value={mobile} />
              <Info style={styles.infoTile} label="Email" value={email} />
              <Info style={styles.infoTile} label="Leave From" value={currentLeave ? fmtDate(currentLeave.leave_fromdate) : ''} />
              <Info style={styles.infoTile} label="Leave To" value={currentLeave ? fmtDate(currentLeave.leave_todate) : ''} />
            </View>
          </View>

          {/* ---------- Vehicle Assignment (horizontal cards) ---------- */}
          <View style={styles.sectionHeader}>
            <View style={styles.cardTitleRow}>
              <Icon name="truck-outline" size={18} color={BLUE} />
              <Text style={styles.cardTitle}>Vehicle Assignment</Text>
            </View>
            <Text style={styles.cardSub}>{assignments.length} record{assignments.length === 1 ? '' : 's'}</Text>
          </View>

          {errors.assignments && <SectionError message={errors.assignments} onRetry={fetchAll} />}

          {assignments.length === 0 && !errors.assignments ? (
            <View style={[styles.card, styles.empty]}>
              <Icon name="car-off" size={36} color="#CBD5E1" />
              <Text style={styles.emptyText}>No vehicle assignments</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
            >
              {assignments.map((a, idx) => {
                const v = a.vehicle_id || {};
                const apiStatus = getApiStatus(a);
                const status = apiStatus || getAssignmentStatus(a);
                const st = STATUS_STYLE[status] || DEFAULT_STATUS_STYLE;
                const canSwap = isActiveStatus(a);
                const routeName =
                  a.route_id?.name ||
                  (a.route_id?.place_from && a.route_id?.place_to
                    ? `${a.route_id.place_from} → ${a.route_id.place_to}`
                    : '');
                const makeModel = [v.make, v.model].filter(Boolean).join(' ');

                return (
                  <View key={a._id || idx} style={styles.vCard}>
                    {/* Colored status accent strip */}
                    <View style={[styles.vAccent, { backgroundColor: st.fg }]} />

                    {/* Header: vehicle + swap icon */}
                    <View style={styles.vTop}>
                      <View style={styles.vIcon}>
                        <Icon name="truck-outline" size={20} color={BLUE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        {!!v.registration_number && (
                          <Text style={styles.vRegn} numberOfLines={1}>{v.registration_number}</Text>
                        )}
                        {!!makeModel && <Text style={styles.vModel} numberOfLines={1}>{makeModel}</Text>}
                      </View>
                      <TouchableOpacity
                        style={[styles.swapBtn, !canSwap && styles.swapBtnDisabled]}
                        activeOpacity={0.7}
                        disabled={!canSwap}
                        onPress={() => openSwap(a)}
                      >
                        <Icon name="swap-horizontal" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.vDivider} />

                    {/* Details */}
                    <View style={styles.vDetailRow}>
                      <Text style={styles.vLabel}>Status</Text>
                      <View style={[styles.badge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.badgeText, { color: st.fg }]}>{status}</Text>
                      </View>
                    </View>

                    {!!fmtDate(a.from_datetime) && (
                      <View style={styles.vDetailRow}>
                        <Text style={styles.vLabel}>From</Text>
                        <Text style={styles.vValue}>{fmtDate(a.from_datetime)}</Text>
                      </View>
                    )}

                    {!!fmtDate(a.to_datetime) && (
                      <View style={styles.vDetailRow}>
                        <Text style={styles.vLabel}>To</Text>
                        <Text style={styles.vValue}>{fmtDate(a.to_datetime)}</Text>
                      </View>
                    )}

                    {!!routeName && (
                      <View style={styles.vDetailRow}>
                        <Text style={styles.vLabel}>Trip</Text>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('RouteManagement')}>
                          <Text style={[styles.link, { textAlign: 'right' }]} numberOfLines={1}>{routeName}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ---------- Leave History ---------- */}
          <View style={[styles.card, { marginTop: 18 }]}>
            <View style={styles.lhHeader}>
              <View>
                <Text style={styles.cardTitle}>Leave History</Text>
                <Text style={styles.cardSub}>{leaves.length} record{leaves.length === 1 ? '' : 's'}</Text>
              </View>
              <TouchableOpacity style={styles.applyBtn} activeOpacity={0.8} onPress={openApply}>
                <Icon name="calendar-plus" size={16} color="#FFFFFF" />
                <Text style={styles.applyText}>Apply Leave</Text>
              </TouchableOpacity>
            </View>

            {/* Search filter */}
            <View style={styles.filterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>From</Text>
                <DateField compact value={filterFrom} onChange={setFilterFrom} placeholder="dd-mm-yyyy" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>To</Text>
                <DateField
                  compact
                  value={filterTo}
                  onChange={setFilterTo}
                  placeholder="dd-mm-yyyy"
                  minimumDate={filterFrom || undefined}
                />
              </View>
            </View>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.filterBtn, filtering && { opacity: 0.7 }]}
                onPress={applyFilter}
                disabled={filtering}
              >
                {filtering ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Filter</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ghostBtn, styles.filterBtn]} onPress={clearFilter} disabled={filtering}>
                <Text style={styles.ghostBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {errors.leaves && <SectionError message={errors.leaves} onRetry={() => fetchLeavesOnly()} />}

            {leaves.length === 0 && !errors.leaves ? (
              <View style={styles.empty}>
                <Icon name="calendar-blank-outline" size={36} color="#CBD5E1" />
                <Text style={styles.emptyText}>No leave records found</Text>
              </View>
            ) : (
              leaves.map((leave, idx) => {
                const lst = getLeaveStatus(leave);
                const lstyle = STATUS_STYLE[lst] || DEFAULT_STATUS_STYLE;
                return (
                  <View key={leave._id || idx} style={[styles.leaveItem, { borderLeftColor: lstyle.fg }]}>
                    <View style={styles.leaveTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.srBadge}>
                          <Text style={styles.srText}>#{leaveNumber(leave, idx)}</Text>
                        </View>
                        {!!fmtDate(leave.leave_applied_date) && (
                          <Text style={styles.leaveApplied} numberOfLines={1}>
                            Applied: {fmtDate(leave.leave_applied_date)}
                          </Text>
                        )}
                      </View>
                      {!!lst && (
                        <View style={[styles.badge, { backgroundColor: lstyle.bg }]}>
                          <Text style={[styles.badgeText, { color: lstyle.fg }]}>{lst}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.vRow}>
                      <Icon name="calendar-range" size={16} color="#64748B" />
                      <Text style={styles.leaveDates}>
                        {fmtDate(leave.leave_fromdate)}  →  {fmtDate(leave.leave_todate)}
                      </Text>
                    </View>
                    {!!leave.leave_reasons && <Text style={styles.leaveReason}>{leave.leave_reasons}</Text>}

                    <View style={styles.actionsRow}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(leave)}>
                        <Icon name="pencil-outline" size={16} color="#92400E" />
                        <Text style={[styles.actionText, { color: '#92400E' }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteLeave(leave)}>
                        <Icon name="trash-can-outline" size={16} color="#991B1B" />
                        <Text style={[styles.actionText, { color: '#991B1B' }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ---------- Apply / Edit Leave popup ---------- */}
      <Popup
        visible={sheetVisible}
        title={editingId ? 'Edit Leave' : 'Apply Leave'}
        onClose={() => !saving && setSheetVisible(false)}
      >
        <View style={styles.popupRow}>
          <Info label="Driver Name" value={name} />
          <Info label="Mobile" value={mobile} />
        </View>

        <Text style={styles.label}>Leave From Date</Text>
        <DateField value={lFrom} onChange={setLFrom} placeholder="dd-mm-yyyy" />

        <Text style={styles.label}>Leave To Date</Text>
        <DateField value={lTo} onChange={setLTo} placeholder="dd-mm-yyyy" minimumDate={lFrom || undefined} />

        <Text style={styles.label}>Reasons *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Reason for leave"
          placeholderTextColor="#94A3B8"
          value={lReason}
          onChangeText={setLReason}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.popupActions}>
          <TouchableOpacity style={[styles.ghostBtn, { flex: 1 }]} onPress={() => setSheetVisible(false)} disabled={saving}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1 }, saving && { opacity: 0.7 }]}
            onPress={submitLeave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Submit</Text>}
          </TouchableOpacity>
        </View>
      </Popup>

      {/* ---------- Swap Driver popup ---------- */}
      <Popup
        visible={swapVisible}
        title="Swap Driver"
        subtitle="Assign another driver for the rest of this assignment"
        onClose={() => !swapping && setSwapVisible(false)}
      >
        <View style={styles.popupRow}>
          <Info label="Driver Name" value={name} />
          <Info label="Vehicle" value={swapAssignment?.vehicle_id?.registration_number} />
        </View>

        <View style={styles.popupRow}>
          <Info label="Swap From (today)" value={fmtDate(swapWindow.from)} />
          <Info label="Swap To" value={fmtDate(swapWindow.to)} />
        </View>

        <Text style={styles.label}>Available Drivers</Text>
        <TouchableOpacity
          style={styles.field}
          activeOpacity={0.7}
          onPress={() => setDdOpen((o) => !o)}
          disabled={swapLoading}
        >
          <Text style={[styles.fieldText, !selectedDriver && styles.fieldPlaceholder]} numberOfLines={1}>
            {swapLoading ? 'Loading drivers...' : selectedDriver ? selectedDriver.name : 'Select a driver'}
          </Text>
          {swapLoading ? (
            <ActivityIndicator size="small" color={BLUE} />
          ) : (
            <Icon name={ddOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#64748B" />
          )}
        </TouchableOpacity>

        {swapError && <SectionError message={swapError} onRetry={() => loadSwapDrivers(swapWindow.from, swapWindow.to)} />}

        {ddOpen && !swapLoading && (
          <View style={styles.ddList}>
            {swapDrivers.length === 0 ? (
              <Text style={styles.ddEmpty}>No drivers available for this period</Text>
            ) : (
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                {swapDrivers.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.ddRow, selectedDriver?.id === d.id && styles.ddRowActive]}
                    onPress={() => {
                      setSelectedDriver(d);
                      setDdOpen(false);
                    }}
                  >
                    <Text style={styles.ddName}>{d.name}</Text>
                    {!!d.phone && <Text style={styles.infoLabel}>{d.phone}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.popupActions}>
          <TouchableOpacity style={[styles.ghostBtn, { flex: 1 }]} onPress={() => setSwapVisible(false)} disabled={swapping}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { flex: 1 }, (swapping || !selectedDriver) && { opacity: 0.6 }]}
            onPress={submitSwap}
            disabled={swapping || !selectedDriver}
          >
            {swapping ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Swap</Text>}
          </TouchableOpacity>
        </View>
      </Popup>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 16, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: '#FFFFFF' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { marginTop: 14, fontSize: 15, color: '#64748B', fontWeight: '500' },

  content: { padding: 16, paddingBottom: 40 },

  // Generic / driver card: thin border + soft blue shadow
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BLUE,
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  cardSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },

  // Driver detail info shown as small bordered tiles
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  infoItem: { width: '50%', paddingRight: 8 },
  infoTile: {
    width: '48.5%',
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#BBD0F7',
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 11, color: '#64748B', fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 13, color: '#1E293B', fontWeight: '600' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  hList: { paddingRight: 8 },

  // Vehicle assignment card
  vCard: {
    width: 270,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
    marginRight: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: BLUE,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  vAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  vTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vRegn: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  vModel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  vRowText: { fontSize: 13, color: '#1E293B', fontWeight: '500', flex: 1 },
  link: { fontSize: 13, color: BLUE, fontWeight: '700', textDecorationLine: 'underline' },
  swapBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE },
  swapBtnDisabled: { backgroundColor: '#CBD5E1', opacity: 0.7 },
  vIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBE7FB',
  },
  vDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  vDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  vLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', width: 56 },
  vValue: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1, textAlign: 'right' },

  driverTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#BBD0F7',
  },
  driverName: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  ratingValue: { fontSize: 13, fontWeight: '700', color: '#F59E0B', flex: 1, textAlign: 'right' },

  lhHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  filterBtn: { flex: 1, paddingVertical: 10 },

  // Leave card with status-colored left accent
  leaveItem: {
    borderWidth: 1,
    borderColor: BLUE,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: '#FAFCFF',
  },

  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BLUE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  applyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  leaveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  srBadge: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBE7FB', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  srText: { fontSize: 12, fontWeight: '700', color: BLUE },
  leaveApplied: { fontSize: 12, color: '#64748B' },
  leaveDates: { fontSize: 13, color: '#1E293B', fontWeight: '600', flex: 1 },
  leaveReason: { fontSize: 13, color: '#475569', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 10, paddingVertical: 8 },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 8 },
  actionText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 13, color: '#94A3B8', marginTop: 8 },

  sectionError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, marginBottom: 10 },
  sectionErrorText: { flex: 1, fontSize: 12, color: '#991B1B' },
  retryText: { fontSize: 13, fontWeight: '700', color: BLUE },

  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  fieldCompact: { paddingVertical: 10, paddingHorizontal: 10 },
  fieldText: { fontSize: 13, color: '#1E293B', fontWeight: '500', flex: 1 },
  fieldPlaceholder: { color: '#94A3B8' },
  iosDone: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 10 },
  iosDoneText: { color: BLUE, fontWeight: '700', fontSize: 14 },

  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 14, marginBottom: 6 },
  textArea: { minHeight: 90, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1E293B' },

  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  popup: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', maxHeight: '88%' },
  popupHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE, paddingHorizontal: 18, paddingVertical: 16 },
  popupTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  popupSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  popupClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  popupBody: { padding: 18, paddingBottom: 22 },
  popupRow: { flexDirection: 'row', marginBottom: 12 },
  popupActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  ddList: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginTop: 6, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  ddRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ddRowActive: { backgroundColor: '#EFF6FF' },
  ddName: { fontSize: 14, color: '#1E293B', fontWeight: '600' },
  ddEmpty: { padding: 14, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  ghostBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 12 },
  ghostBtnText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: BLUE, borderRadius: 12, paddingVertical: 12 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

export default DriverLeaveScreen;