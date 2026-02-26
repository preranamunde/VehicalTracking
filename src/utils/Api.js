// ============================================
// src/utils/Api.js
// ============================================
// CENTRALIZED API CONFIGURATION
//
// This is the ONLY file where the base URL lives.
// Every screen imports from here.
// To change the server → edit ONE line below.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://vlts-server.nutanteksolutions.cloud';

// ============================================
// All API endpoints — add new ones here
// ============================================
export const ENDPOINTS = {
  LOGIN: '/api/auth/tenantadmin/login',
  VEHICLES: '/api/vehicles',
  DRIVERS: '/api/drivers',
  DRIVER_ASSIGNMENTS: '/api/driverassignments',
  ROUTE_ASSIGNMENTS: '/api/assignments/vehicle-route',
  ROUTES: '/api/routes',
  // future endpoints go here
  // TRIPS:    '/api/trips',
  // ALERTS:   '/api/alerts',
};

// ============================================
// Helper function to get auth headers
// ============================================
const getAuthHeaders = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    
    const headers = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  } catch (error) {
    console.error('❌ Error getting auth headers:', error);
    return {
      'Content-Type': 'application/json',
    };
  }
};

// ============================================
// GET
// Usage: const data = await apiGet(ENDPOINTS.VEHICLES);
// ============================================
export const apiGet = async (endpoint) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 GET', url);

    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    console.log('📥 Status:', response.status);

    // Get response text first to handle both JSON and error cases
    const responseText = await response.text();

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If parsing fails, use the text response
        errorMessage = responseText.substring(0, 100) || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
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
// Usage: const data = await apiPost(ENDPOINTS.DRIVERS, { driver_name: 'John' });
// For login (no token needed): const data = await apiPost(ENDPOINTS.LOGIN, { email, password }, false);
// ============================================
export const apiPost = async (endpoint, data, useAuth = true) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📤 POST Request:', url);
    console.log('📤 POST Data:', JSON.stringify(data, null, 2));
    
    // Get headers - with or without auth based on useAuth parameter
    let headers;
    if (useAuth) {
      headers = await getAuthHeaders();
    } else {
      headers = {
        'Content-Type': 'application/json',
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    console.log('📥 Response status:', response.status);
    
    // Get response text first
    const responseText = await response.text();
    console.log('📥 Response text:', responseText.substring(0, 200));

    // Check if response is empty
    if (!responseText || responseText.trim() === '') {
      if (response.ok) {
        return { success: true, message: 'Operation completed successfully' };
      }
      throw new Error(`HTTP ${response.status}: Empty response from server`);
    }

    // Try to parse as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('❌ Response preview:', responseText.substring(0, 200));
      
      // If it's an HTML error page
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error(`Server error: Received HTML instead of JSON (Status: ${response.status})`);
      }
      
      throw new Error('Server returned invalid JSON response');
    }

    // Check if request was successful
    if (!response.ok) {
      const errorMessage = 
        responseData.message || 
        responseData.error || 
        responseData.msg ||
        `HTTP ${response.status}: Request failed`;
      
      throw new Error(errorMessage);
    }

    console.log('✅ POST success');
    return responseData;
  } catch (error) {
    console.error('❌ POST Error:', error.message);
    throw error;
  }
};

// ============================================
// PUT
// Usage: const data = await apiPut(ENDPOINTS.DRIVERS + '/id123', { driver_name: 'Jane' });
// ============================================
export const apiPut = async (endpoint, body) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 PUT', url);
    console.log('📤 PUT Data:', JSON.stringify(body, null, 2));

    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    console.log('📥 Status:', response.status);

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = responseText.substring(0, 100) || errorMessage;
      }
      throw new Error(errorMessage);
    }

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
// Usage: await apiDelete(ENDPOINTS.DRIVERS + '/id123');
// ============================================
export const apiDelete = async (endpoint) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('📡 DELETE', url);

    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    console.log('📥 Status:', response.status);

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = responseText.substring(0, 100) || errorMessage;
      }
      throw new Error(errorMessage);
    }

    console.log('✅ DELETE success');
    return true;
  } catch (error) {
    console.error('❌ DELETE Error:', error.message);
    throw error;
  }
};

// ============================================
// Logout - Clear tokens from AsyncStorage
// ============================================
export const logout = async () => {
  try {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('userEmail');
    console.log('✅ Logout successful - tokens cleared');
  } catch (error) {
    console.error('❌ Logout error:', error);
    throw error;
  }
};

// ============================================
// Check if user is authenticated
// ============================================
export const isAuthenticated = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    return !!accessToken;
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    return false;
  }
};

export default API_BASE_URL;