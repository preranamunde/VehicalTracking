import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

const ShareUsScreen = ({ navigation }) => {
  const shareLink = 'https://chatgpt.com/c/69861cfd-bb38-8322-869c-4bebb7c90831';

  const handleShare = async (platform) => {
    try {
      const message = `Check out this amazing Fleet Management System! 🚚\n\n${shareLink}`;
      
      const result = await Share.share({
        message: message,
        url: shareLink,
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Shared successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const copyToClipboard = () => {
    Alert.alert('Copied!', 'Link copied to clipboard');
  };

  const shareOptions = [
    {
      id: 1,
      icon: 'whatsapp',
      title: 'WhatsApp',
      color: '#25D366',
      action: () => handleShare('whatsapp'),
    },
    {
      id: 2,
      icon: 'facebook',
      title: 'Facebook',
      color: '#1877F2',
      action: () => handleShare('facebook'),
    },
    {
      id: 3,
      icon: 'twitter',
      title: 'Twitter',
      color: '#1DA1F2',
      action: () => handleShare('twitter'),
    },
    {
      id: 4,
      icon: 'linkedin',
      title: 'LinkedIn',
      color: '#0A66C2',
      action: () => handleShare('linkedin'),
    },
    {
      id: 5,
      icon: 'email',
      title: 'Email',
      color: '#EA4335',
      action: () => handleShare('email'),
    },
    {
      id: 6,
      icon: 'share-variant',
      title: 'More',
      color: '#64748B',
      action: () => handleShare('more'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Share Us</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Share Message */}
        <View style={styles.section}>
          <View style={styles.messageCard}>
            <Icon name="information-outline" size={24} color="#3477eb" />
            <Text style={styles.messageText}>
              Help others discover our amazing fleet management solution!
            </Text>
          </View>
        </View>

        {/* Link Box */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Link</Text>
          <View style={styles.linkContainer}>
            <View style={styles.linkBox}>
              <Icon name="link-variant" size={20} color="#3477eb" />
              <Text style={styles.linkText} numberOfLines={1}>
                {shareLink}
              </Text>
            </View>
            <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
              <Icon name="content-copy" size={20} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Share Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Via</Text>
          <View style={styles.shareGrid}>
            {shareOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.shareOption}
                onPress={option.action}
                activeOpacity={0.7}
              >
                <View style={[styles.shareIcon, { backgroundColor: `${option.color}15` }]}>
                  <Icon name={option.icon} size={28} color={option.color} />
                </View>
                <Text style={styles.shareTitle}>{option.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Share?</Text>
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <Icon name="check-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Help your network grow their business</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="check-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Get exclusive rewards for referrals</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="check-circle" size={20} color="#10B981" />
              <Text style={styles.benefitText}>Build a stronger community</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
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
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  messageCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  linkContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  copyButton: {
    backgroundColor: '#3477eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shareOption: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  shareIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  benefitsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});

export default ShareUsScreen;