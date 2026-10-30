import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useDrawerStatus } from '@react-navigation/drawer';
import { apiGet, apiPost, ENDPOINTS, logout as clearSession } from '../utils/Api';

const CustomDrawer = ({ navigation }) => {
  const [expandedItem, setExpandedItem] = useState(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const drawerStatus = useDrawerStatus(); // 'open' | 'closed'

  const menuItems = [
    { icon: 'view-dashboard',        label: 'Dashboard',          route: 'HomeScreen' },
    { icon: 'clipboard-text',        label: 'Driver Assignments', route: 'Assignments' },
    { icon: 'history',               label: 'Trip History',       route: 'TripHistory' },
    { icon: 'headset',               label: 'Help Desk',          route: 'Support' },
    { icon: 'phone',                 label: 'Contact Us',         route: 'ContactUs' },
    { icon: 'account-multiple-plus', label: 'Refer Us',           route: 'ReferUs' },
    { icon: 'share-variant',         label: 'Share Us',           route: 'ShareUs' },
    { icon: 'information-outline',   label: 'About Us',           route: 'AboutUs' },
  ];

  // ── fetch /api/client-auth/me → employee.name & employee.mobile_number ──────
  const fetchProfile = useCallback(async () => {
    try {
      const data = await apiGet(ENDPOINTS.ME);
      const emp = data?.employee || {};
      setName(emp.name || '');
      setMobile(emp.mobile_number || '');
    } catch (e) {
      console.log('Drawer profile error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // first load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // refresh every time the drawer is opened (covers re-login / profile changes)
  useEffect(() => {
    if (drawerStatus === 'open') fetchProfile();
  }, [drawerStatus, fetchProfile]);

  const toggleSubmenu = (index) => {
    setExpandedItem(expandedItem === index ? null : index);
  };

  const handleNavigation = (route) => {
    navigation.navigate(route);
  };

  // ── Logout: POST /api/client-auth/logout → clear tokens → back to Login ────
  const performLogout = async () => {
    try {
      setLoggingOut(true);
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      await apiPost(ENDPOINTS.LOGOUT, refreshToken ? { refreshToken } : {});
    } catch (e) {
      // even if the server call fails (expired token / offline) we still log out locally
      console.log('Logout API error:', e.message);
    } finally {
      await clearSession(); // removes accessToken, refreshToken, userEmail
      setLoggingOut(false);
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
      );
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: performLogout },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Profile Section - Clickable */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.9}
      >
        <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImage}>
              <Icon name="account" size={60} color="#3477eb" />
            </View>
          </View>

          {loading && !name ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.loader} />
          ) : (
            <>
              <Text style={styles.profileName} numberOfLines={1}>
                {name || '-'}
              </Text>
              <View style={styles.profileInfoRow}>
                <Icon name="phone" size={14} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.profilePhone}>{mobile || '-'}</Text>
              </View>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Menu Items */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {menuItems.map((item, index) => (
          <View key={index}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (item.hasSubmenu) {
                  toggleSubmenu(index);
                } else {
                  handleNavigation(item.route);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Icon name={item.icon} size={22} color="#3477eb" />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.hasSubmenu ? (
                <Icon
                  name={expandedItem === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94A3B8"
                />
              ) : (
                <Icon name="chevron-right" size={20} color="#CBD5E1" />
              )}
            </TouchableOpacity>

            {/* Submenu Items */}
            {item.hasSubmenu && expandedItem === index && (
              <View style={styles.submenuContainer}>
                {item.submenu.map((subItem, subIndex) => (
                  <TouchableOpacity
                    key={subIndex}
                    style={styles.submenuItem}
                    onPress={() => handleNavigation(subItem.route)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.submenuDot} />
                    <Text style={styles.submenuLabel}>{subItem.label}</Text>
                    <Icon name="chevron-right" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <>
            <Icon name="logout" size={22} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </>
        )}
      </TouchableOpacity>

      {/* App Version */}
      <View style={styles.footer}>
        <Icon name="information-outline" size={14} color="#94A3B8" />
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  profileSection: {
    paddingTop: 40,
    paddingBottom: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  profileImageContainer: {
    marginBottom: 1,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  loader: {
    marginVertical: 14,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profilePhone: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '500',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 12,
  },
  menuIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  submenuContainer: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  submenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  submenuDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3477eb',
    marginRight: 14,
  },
  submenuLabel: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  versionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});

export default CustomDrawer;