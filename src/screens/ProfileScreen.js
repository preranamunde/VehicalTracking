import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const ProfileScreen = ({ navigation }) => {
  const profileData = [
    { icon: 'account', label: 'Full Name', value: 'John Doe' },
    { icon: 'email', label: 'Email', value: 'john.doe@example.com' },
    { icon: 'phone', label: 'Phone', value: '+91 98765 43210' },
    { icon: 'map-marker', label: 'Location', value: 'Mumbai, Maharashtra' },
    { icon: 'briefcase', label: 'Role', value: 'Fleet Manager' },
    { icon: 'calendar', label: 'Joined Date', value: 'January 15, 2024' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
      
      {/* Header with Gradient */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Image Section */}
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.editProfileButton}>
            <Icon name="pencil" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.profileImageWrapper}>
            <LinearGradient
              colors={['#3477eb', '#5a94f5']}
              style={styles.profileImageContainer}
            >
              <Icon name="account" size={80} color="#FFFFFF" />
            </LinearGradient>
            <TouchableOpacity style={styles.cameraButton}>
              <Icon name="camera" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>John Doe</Text>
          <Text style={styles.profileRole}>Fleet Manager</Text>
        </View>

        {/* Profile Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.detailsContainer}>
            {profileData.map((item, index) => (
              <View 
                key={index} 
                style={[
                  styles.detailItem,
                  index === profileData.length - 1 && styles.detailItemLast
                ]}
              >
                <View style={styles.detailIconContainer}>
                  <LinearGradient
                    colors={['#3477eb15', '#5a94f515']}
                    style={styles.iconGradient}
                  >
                    <Icon name={item.icon} size={22} color="#3477eb" />
                  </LinearGradient>
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 40,
    paddingTop: 50,
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  editProfileButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3477eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3477eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  detailsContainer: {
    gap: 0,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailItemLast: {
    borderBottomWidth: 0,
  },
  detailIconContainer: {
    marginRight: 16,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 30,
  },
});

export default ProfileScreen;