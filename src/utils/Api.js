// ============================================
// src/utils/Api.js
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://vlts.nutanteksolutions.cloud';
//const API_BASE_URL = 'http://192.168.0.101:3006';
//const API_BASE_URL = 'http://10.67.181.153:3006';

export const ENDPOINTS = {
  LOGIN:               '/api/client-auth/login',
  LOGOUT:              '/api/client-auth/logout',           // used by CustomDrawer (POST)
  ME:                  '/api/client-auth/me',               // used by ProfileScreen (user + employee + organisation)
  VEHICLES:            '/api/vehicle',
  GPS_VEHICLES_CLIENT: '/api/assignments/gps-vehicle/client',   // used by VehicleScreen
  DRIVERS:             '/api/driver',                // singular - used for DELETE / GET by id
  DRIVER_BY_ID:        (id) => `/api/driver/${id}`,   // used by DriverDetailScreen
  DRIVERS_ASSIGNMENT:  '/api/driver/assignment',     // used by DriverScreen list (drivers + vehicle assignment)

  // ✅ NEW: Dashboard screen (DashboardScreen) — same 3 calls as the web AnalyticsDashboard
  //    web getAllDrivers()     -> GET /api/driver                         -> data.data (array)
  //    web getAllVehicles()    -> GET /api/assignments/gps-vehicle/client -> data.assignments (array)
  //    web getAllAssignments() -> GET /api/trip                           -> data.data (array of trips)
  //    Trip fields used: status (ACTIVE | IDLE | INACTIVE | COMPLETED), overspeed_count,
  //    geofence_crossing_count, route_id.place_from / place_to, driver_id.driver_name,
  //    vehicle_id.registration_number
  DASHBOARD_DRIVERS:     '/api/driver',
  DASHBOARD_VEHICLES:    '/api/assignments/gps-vehicle/client',
  DASHBOARD_ASSIGNMENTS: '/api/trip',

  // ✅ Driver Leave & Assignment Info screen (DriverLeaveScreen)
  // GET  /api/driverassignments/bydriver/:driver_id  → vehicle assignments of the driver
  DRIVER_ASSIGNMENTS_BY_DRIVER: (driverId) => `/api/driverassignments/bydriver/${driverId}`,

  // GET  /api/driverleaves/driver/:driver_id          → leave history of the driver
  //      Optional date-range filter (YYYY-MM-DD):
  //      /api/driverleaves/driver/:driver_id?from_date=2026-10-01&to_date=2026-10-30
  //      Response: { success, count, data: {driver}, leaves: [ { _id, leave_applied_date, leave_fromdate, leave_todate, leave_reasons, leave_status } ] }
  DRIVER_LEAVES_BY_DRIVER: (driverId, fromDate, toDate) => {
    const qs = [];
    if (fromDate) qs.push(`from_date=${encodeURIComponent(fromDate)}`);
    if (toDate) qs.push(`to_date=${encodeURIComponent(toDate)}`);
    return `/api/driverleaves/driver/${driverId}` + (qs.length ? `?${qs.join('&')}` : '');
  },

  // POST /api/driverleaves   Body: { driver_id, leave_fromdate (ISO), leave_todate (ISO), leave_reasons }
  DRIVER_LEAVES:       '/api/driverleaves',

  // PUT / DELETE /api/driverleaves/:leave_id
  DRIVER_LEAVE_BY_ID:  (leaveId) => `/api/driverleaves/${leaveId}`,

  // Get all drivers NOT assigned in the given date-time window
  // Used by AssignmentScreen (Select Driver dropdown)
  // Example: /api/driver/unassigned?from_datetime=2026-10-08T09:00:00.000Z&to_datetime=2026-10-09T18:00:00.000Z
  // Response: { success, from_datetime, to_datetime, count, data: [ { _id, employee_id: { name, mobile_number, ... }, ... } ] }
  DRIVERS_UNASSIGNED: (from_datetime, to_datetime) =>
    `/api/driver/unassigned` +
    `?from_datetime=${encodeURIComponent(from_datetime)}` +
    `&to_datetime=${encodeURIComponent(to_datetime)}`,

  DRIVER_ASSIGNMENTS:          '/api/driverassignments',          // used by POST (Add) & DELETE (Remove)
  // PUT /api/driverassignments/swap/:assignment_id
  // Body: { old_driver_id, new_driver_id, from_datetime (ISO), to_datetime (ISO), instructions }
  DRIVER_ASSIGNMENT_SWAP:      (assignmentId) => `/api/driverassignments/swap/${assignmentId}`,

  // ✅ Release driver from current assignment (used when trip_id is null)
  // PUT /api/driverassignments/release/:assignment_id
  // Body: { driver_id, vehicle_id, from_datetime ("YYYY/MM/DD"), to_datetime ("YYYY/MM/DD"), instructions, status }
  DRIVER_ASSIGNMENT_RELEASE:   (assignmentId) => `/api/driverassignments/release/${assignmentId}`,

  DRIVER_ASSIGNMENTS_CURRENT:  '/api/driverassignments/current',  // used by View → Active tab (GET)

  // ✅ NEW: past / expired assignments — used by View → History tab (GET)
  // Response: { success, count, data: [ { _id, driver_id: {...full driver}, vehicle_id: {...} | null,
  //             from_datetime, to_datetime, instructions, status: "EXPIRED", archived_at, ... } ] }
  DRIVER_ASSIGNMENTS_HISTORY:  '/api/driverassignments/history',

  // ✅ Trip History screen (TripHistoryScreen) — confirmed in Postman:
  //    GET /api/trip-history?startDate=<ISO>&endDate=<ISO>
  //    Response: { page, limit, total, totalPages, data: [ { trip_id, vehicle_id, route_id: {...}, ... } ] }
  //    The server pages results (default limit 10), so page/limit are added and the screen loads every page.
  //    The 2nd entry covers the "/api/trips-history" spelling visible in the Postman URL bar —
  //    delete whichever one is wrong once you know for sure.
  TRIP_HISTORY_CANDIDATES: [
    (s, e, page = 1, limit = 100) =>
      `/api/trip-history?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}` +
      `&page=${page}&limit=${limit}`,
    (s, e, page = 1, limit = 100) =>
      `/api/trips-history?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}` +
      `&page=${page}&limit=${limit}`,
  ],

  ROUTE_ASSIGNMENTS:   '/api/assignments/vehicle-route',
  ROUTES:              '/api/routes',

  ROUTES_MULTI: (source, destination) =>
    `/api/routes/multi-routes?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`,

  // Multi-routes with intermediate stops (same params as web getMultipleRoutesWithStops)
  //    source / destination / stops are either place names or "lng,lat".
  //    Commas are kept as plain "," (not %2C) so "lng,lat" reaches the backend unchanged.
  //    Example: /api/routes/multi-routes?source=78.07,21.47&destination=79.69,21.37&stops=Wardha&stops=79.1,20.7
  ROUTES_MULTI_STOPS: (source, destination, stops = []) => {
    const enc = (v) => encodeURIComponent(v).replace(/%2C/gi, ',');
    return (
      `/api/routes/multi-routes?source=${enc(source)}&destination=${enc(destination)}` +
      stops.map((s) => `&stops=${enc(s)}`).join('')
    );
  },

  ROUTES_GEOCODES: (source, destination) =>
    `/api/routes/geocodes?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`,

  VEHICLES_AVAILABLE: (departure_date, arrival_date, availability_place) =>
    `/api/checkavailability/vehiclebylocation` +
    `?departure_date=${encodeURIComponent(departure_date)}` +
    `&arrival_date=${encodeURIComponent(arrival_date)}` +
    `&availability_place=${encodeURIComponent(availability_place)}`,

  TRIPS:         '/api/trip',

  // Trips "View" tab (RouteManagementScreen). Paged list.
  // Example: /api/trip?page=1&limit=100
  // Response: { page, limit, total, totalPages, data: [ { trip_id, vehicle_id, route_id: {...}, ... } ] }
  TRIPS_VIEW: (page = 1, limit = 100) =>
    `/api/trip?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`,

  TRIPS_PENDING: '/api/trip/status?trip_approval_status=AWAITED',
  TRIPS_APPROVED:'/api/trip/status?trip_approval_status=APPROVED',

  // Approved tab: approved trips that have NOT departed yet
  TRIPS_APPROVED_AWAITED:
    '/api/trip/status?trip_approval_status=APPROVED&trip_dep_status=AWAITED',

  TRIP_APPROVE:  (id) => `/api/trip/${id}/status`,
  TRIP_REJECT:   (id) => `/api/trip/${id}/status`,
  TRIP_DEPART:   (id) => `/api/trip/${id}/status`,
  // Arrival Entry (RoutePlayDetailScreen) - PUT with body:
  //   { trip_arrival_status: 'INTIME' | 'ONTIME' | 'DELAYED',
  //     trip_actual_arrival_time: ISO string,
  //     trip_arrival_notes: string }
  TRIP_ARRIVE:   (id) => `/api/trip/${id}/status`,

  // Same arrival call in query-string form, if the backend expects params in the URL:
  //   /api/trip/status?trip_arrival_status=ONTIME&trip_actual_arrival_time=...&trip_arrival_notes=...
  TRIP_ARRIVAL_QUERY: (status, actualTime, notes = '') =>
    `/api/trip/status` +
    `?trip_arrival_status=${encodeURIComponent(status)}` +
    `&trip_actual_arrival_time=${encodeURIComponent(actualTime)}` +
    `&trip_arrival_notes=${encodeURIComponent(notes)}`,

  // ✅ NEW: Reports screen (VehicleReportsScreen)
  // GET /reports?date_filter=today&report_type=all&vehicle_id=&driver_id=&trip_id=&start_date=&end_date=&page=1&limit=20
  // date_filter : today | yesterday | this week | last week | this month | last month | custom range
  // report_type : all | overspeed | geofence | tamper_alert
  // start_date / end_date (YYYY-MM-DD) are mandatory when date_filter = 'custom range'
  // Response: { data: [...], pagination: { currentPage, pageSize, totalRecords, totalPages, hasNextPage, hasPreviousPage } }
  // NOTE: path has no "/api" prefix — same as the URL in Postman (…cloud/reports?...)
  REPORTS: ({
    dateFilter = 'today', reportType = 'all',
    vehicleId = '', driverId = '', tripId = '',
    startDate = '', endDate = '', page = 1, limit = 20,
  } = {}) => {
    const qs = [
      `date_filter=${encodeURIComponent(dateFilter)}`,
      `report_type=${encodeURIComponent(reportType)}`,
    ];
    if (vehicleId) qs.push(`vehicle_id=${encodeURIComponent(vehicleId)}`);
    if (driverId)  qs.push(`driver_id=${encodeURIComponent(driverId)}`);
    if (tripId)    qs.push(`trip_id=${encodeURIComponent(tripId)}`);
    if (startDate) qs.push(`start_date=${encodeURIComponent(startDate)}`);
    if (endDate)   qs.push(`end_date=${encodeURIComponent(endDate)}`);
    qs.push(`page=${page}`, `limit=${limit}`);
    return `/reports?${qs.join('&')}`;
  },
};

// ── Auth headers ──────────────────────────────────────────────────────────────
const getAuthHeaders = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    console.log('🔑 Token:', accessToken ? `${accessToken.substring(0, 30)}...` : 'NULL ❌');
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  } catch (error) {
    console.error('❌ Error getting auth headers:', error);
    return { 'Content-Type': 'application/json' };
  }
};

// ── HTML guard ────────────────────────────────────────────────────────────────
const guardHTML = (text, endpoint) => {
  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    throw new Error(`Endpoint not found: ${endpoint}`);
  }
};

// ── Error message extractor ───────────────────────────────────────────────────
// Reads the server's real reason: message / error / any JSON / raw text.
// (Before, only `message` was read, so replies like { error: "..." } showed just "HTTP 404".)
const extractError = (text, status) => {
  console.log('❌ Server reply body:', status, text);
  try {
    const j = JSON.parse(text);
    if (typeof j === 'string') return `${j} (HTTP ${status})`;
    const m = j.message || j.error || j.msg || j.details;
    if (m) return typeof m === 'string' ? m : JSON.stringify(m);
    return `HTTP ${status}: ${JSON.stringify(j)}`.slice(0, 300);
  } catch {
    return text && text.trim() ? `HTTP ${status}: ${text.trim().slice(0, 200)}` : `HTTP ${status}`;
  }
};

// ============================================
// GET
// ============================================
export const apiGet = async (endpoint) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 GET', url);
    const headers = await getAuthHeaders();
    const response = await fetch(url, { method: 'GET', headers });
    console.log('📥 Status:', response.status);
    const responseText = await response.text();
    guardHTML(responseText, endpoint);
    if (!response.ok) throw new Error(extractError(responseText, response.status));
    const data = JSON.parse(responseText);
    console.log('✅ Received:', Array.isArray(data) ? `${data.length} items` : '1 item');
    return data;
  } catch (error) {
    console.error('❌ GET Error:', error.message);
    throw error;
  }
};

// ============================================
// POST
// ============================================
export const apiPost = async (endpoint, data, useAuth = true) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📤 POST', url);
    const headers = useAuth ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
    console.log('📥 Status:', response.status);
    const responseText = await response.text();
    console.log('📥 Preview:', responseText.substring(0, 200));
    guardHTML(responseText, endpoint);
    if (!responseText.trim()) {
      if (response.ok) return { success: true };
      throw new Error(`HTTP ${response.status}: Empty response`);
    }
    const responseData = JSON.parse(responseText);
    if (!response.ok) throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`);
    console.log('✅ POST success');
    return responseData;
  } catch (error) {
    console.error('❌ POST Error:', error.message);
    throw error;
  }
};

// ============================================
// PUT
// ============================================
export const apiPut = async (endpoint, body) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 PUT', url, JSON.stringify(body));
    const headers = await getAuthHeaders();
    const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    console.log('📥 Status:', response.status);
    const responseText = await response.text();
    guardHTML(responseText, endpoint);
    if (!response.ok) throw new Error(extractError(responseText, response.status));
    const data = responseText ? JSON.parse(responseText) : { success: true };
    console.log('✅ PUT success');
    return data;
  } catch (error) {
    console.error('❌ PUT Error:', error.message);
    throw error;
  }
};

// ============================================
// DELETE
// ============================================
export const apiDelete = async (endpoint) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 DELETE', url);
    const headers = await getAuthHeaders();
    const response = await fetch(url, { method: 'DELETE', headers });
    console.log('📥 Status:', response.status);
    const responseText = await response.text();
    guardHTML(responseText, endpoint);
    if (!response.ok) throw new Error(extractError(responseText, response.status));
    console.log('✅ DELETE success');
    return true;
  } catch (error) {
    console.error('❌ DELETE Error:', error.message);
    throw error;
  }
};

// ============================================
// Logout
// ============================================
export const logout = async () => {
  try {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('userEmail');
    console.log('✅ Logout successful');
  } catch (error) {
    console.error('❌ Logout error:', error);
    throw error;
  }
};

// ============================================
// isAuthenticated
// ============================================
export const isAuthenticated = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    return !!accessToken;
  } catch {
    return false;
  }
};

// ============================================
// isTokenValid  (used at app launch → auto-login)
// Token must exist AND (if it is a JWT with "exp") must not be expired.
// ============================================
const base64Decode = (input) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const str = input.replace(/=+$/, '');
  let output = '';
  let bc = 0, bs = 0, buffer, idx = 0;
  while ((buffer = str.charAt(idx++))) {
    const i = chars.indexOf(buffer);
    if (i === -1) continue;
    bs = bc % 4 ? bs * 64 + i : i;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
};

export const isTokenValid = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) return false;

    const parts = accessToken.split('.');
    if (parts.length !== 3) return true; // not a JWT → can't check expiry, trust it

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(base64Decode(payloadB64));
    if (!payload.exp) return true;

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export default API_BASE_URL;