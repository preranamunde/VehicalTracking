import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const SettingsScreen = ({ navigation }) => {
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: () => navigation.navigate('Login'),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const SettingItem = ({ icon, title, subtitle, type, value, onToggle, onPress }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={type === 'toggle' ? 1 : 0.7}
      disabled={type === 'toggle'}
    >
      <View style={styles.settingIcon}>
        <Icon name={icon} size={24} color="#3477eb" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {type === 'toggle' ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
          thumbColor={value ? '#3477eb' : '#94A3B8'}
        />
      ) : (
        <Icon name="chevron-right" size={24} color="#CBD5E1" />
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#3477eb', '#3477eb']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Icon name="logout" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Settings */}
        <SectionHeader title="ACCOUNT" />
        <View style={styles.section}>
          <SettingItem
            icon="account-circle"
            title="Edit Profile"
            subtitle="Update your personal information"
            type="navigate"
            onPress={() => navigation.navigate('Profile')}
          />
          <SettingItem
            icon="lock-reset"
            title="Change Password"
            subtitle="Update your password"
            type="navigate"
            onPress={() => {}}
          />
          <SettingItem
            icon="shield-account"
            title="Privacy & Security"
            subtitle="Manage your privacy settings"
            type="navigate"
            onPress={() => {}}
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={styles.section}>
          <SettingItem
            icon="bell"
            title="Push Notifications"
            subtitle="Receive push notifications"
            type="toggle"
            value={pushNotifications}
            onToggle={setPushNotifications}
          />
          <SettingItem
            icon="email"
            title="Email Notifications"
            subtitle="Receive email updates"
            type="toggle"
            value={emailNotifications}
            onToggle={setEmailNotifications}
          />
          <SettingItem
            icon="message-text"
            title="SMS Alerts"
            subtitle="Receive SMS notifications"
            type="toggle"
            value={smsAlerts}
            onToggle={setSmsAlerts}
          />
        </View>

        {/* Preferences */}
        <SectionHeader title="PREFERENCES" />
        <View style={styles.section}>
          <SettingItem
            icon="theme-light-dark"
            title="Dark Mode"
            subtitle="Switch to dark theme"
            type="toggle"
            value={darkMode}
            onToggle={setDarkMode}
          />
          <SettingItem
            icon="sync"
            title="Auto Sync"
            subtitle="Automatically sync data"
            type="toggle"
            value={autoSync}
            onToggle={setAutoSync}
          />
          <SettingItem
            icon="translate"
            title="Language"
            subtitle="English (US)"
            type="navigate"
            onPress={() => {}}
          />
          <SettingItem
            icon="map-marker-radius"
            title="Location Services"
            subtitle="Manage location permissions"
            type="navigate"
            onPress={() => {}}
          />
        </View>

        {/* Data & Storage */}
        <SectionHeader title="DATA & STORAGE" />
        <View style={styles.section}>
          <SettingItem
            icon="download"
            title="Download Data"
            subtitle="Export your data"
            type="navigate"
            onPress={() => {}}
          />
          <SettingItem
            icon="delete-sweep"
            title="Clear Cache"
            subtitle="Free up storage space"
            type="navigate"
            onPress={() => {}}
          />
          <SettingItem
            icon="database"
            title="Storage Usage"
            subtitle="124 MB used"
            type="navigate"
            onPress={() => {}}
          />
        </View>

        {/* Support */}
        <SectionHeader title="SUPPORT" />
        <View style={styles.section}>
          <SettingItem
            icon="help-circle"
            title="Help Center"
            subtitle="Get help and support"
            type="navigate"
            onPress={() => navigation.navigate('Help')}
          />
          <SettingItem
            icon="file-document"
            title="Terms & Conditions"
            subtitle="Read our terms"
            type="navigate"
            onPress={() => {}}
          />
          <SettingItem
            icon="shield-check"
            title="Privacy Policy"
            subtitle="View privacy policy"
            type="navigate"
            onPress={() => {}}
          />
        </View>

        {/* App Info */}
        <SectionHeader title="ABOUT" />
        <View style={styles.section}>
          <SettingItem
            icon="information"
            title="About Us"
            subtitle="Learn more about us"
            type="navigate"
            onPress={() => navigation.navigate('AboutUs')}
          />
          <SettingItem
            icon="update"
            title="App Version"
            subtitle="1.0.0"
            type="navigate"
            onPress={() => {}}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  bottomSpacer: {
    height: 30,
  },
});

export default SettingsScreen;