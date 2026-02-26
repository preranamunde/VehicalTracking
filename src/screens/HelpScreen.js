import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const HelpScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const helpCategories = [
    {
      icon: 'car',
      title: 'Vehicle Management',
      description: 'Learn about adding and managing vehicles',
    },
    {
      icon: 'routes',
      title: 'Route Planning',
      description: 'Optimize routes and track trips',
    },
    {
      icon: 'account-group',
      title: 'Driver Management',
      description: 'Add and manage your drivers',
    },
    {
      icon: 'bell',
      title: 'Notifications',
      description: 'Configure alerts and notifications',
    },
  ];

  const faqs = [
    {
      question: 'How do I add a new vehicle?',
      answer: 'Go to the Vehicles tab, tap the "+" button in the top right corner, fill in the vehicle details including registration number, model, and capacity, then tap "Save".',
    },
    {
      question: 'How can I track my vehicle in real-time?',
      answer: 'Navigate to the Dashboard or Vehicles screen. Tap on any vehicle card to view its detailed information and real-time location on the map.',
    },
    {
      question: 'How do I assign a driver to a vehicle?',
      answer: 'Go to the Assignments screen, select a vehicle, choose a driver from your driver list, set the assignment date and time, then confirm the assignment.',
    },
    {
      question: 'Can I view trip history?',
      answer: 'Yes! Use the Trip History option in the menu. You can view history by vehicles or by routes, with detailed information about each trip.',
    },
    {
      question: 'How do I create a new route?',
      answer: 'Navigate to Route Management, tap "Add Route", enter the route name, add stops/waypoints, and save. You can then assign vehicles to this route.',
    },
    {
      question: 'How do I reset my password?',
      answer: 'On the login screen, tap "Forgot Password", enter your registered email address, and follow the instructions sent to your email to reset your password.',
    },
    {
      question: 'What should I do if the app is not syncing?',
      answer: 'Check your internet connection first. If the issue persists, go to Settings > Data & Storage > Clear Cache, then restart the app. Contact support if the problem continues.',
    },
    {
      question: 'How do I enable notifications?',
      answer: 'Go to Settings > Notifications and toggle on the notification types you want to receive (Push, Email, or SMS notifications).',
    },
  ];

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const filteredFaqs = faqs.filter(
    faq =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Text style={styles.headerTitle}>Help</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for help..."
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

        {/* Help Categories */}
        {searchQuery.length === 0 && (
          <>
            <Text style={styles.sectionTitle}>Browse Topics</Text>
            <View style={styles.categoriesGrid}>
              {helpCategories.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoryCard}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryIcon}>
                    <Icon name={category.icon} size={32} color="#3477eb" />
                  </View>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* FAQs */}
        <Text style={styles.sectionTitle}>
          {searchQuery.length > 0 ? 'Search Results' : 'Frequently Asked Questions'}
        </Text>
        <View style={styles.faqContainer}>
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleFaq(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <Icon
                    name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#3477eb"
                  />
                </TouchableOpacity>
                {expandedFaq === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.noResults}>
              <Icon name="help-circle-outline" size={64} color="#CBD5E1" />
              <Text style={styles.noResultsText}>No results found</Text>
              <Text style={styles.noResultsSubtext}>
                Try searching with different keywords
              </Text>
            </View>
          )}
        </View>

        {/* Contact Support Card */}
        {searchQuery.length === 0 && (
          <View style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <Icon name="lifebuoy" size={40} color="#3477eb" />
            </View>
            <Text style={styles.supportTitle}>Still need help?</Text>
            <Text style={styles.supportText}>
              Our support team is available 24/7 to assist you
            </Text>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => navigation.navigate('Support')}
            >
              <Text style={styles.supportButtonText}>Contact Support</Text>
              <Icon name="arrow-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: '1%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  faqContainer: {
    marginHorizontal: 16,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    paddingTop: 12,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  supportCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  supportIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  supportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3477eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  supportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  bottomSpacer: {
    height: 30,
  },
});

export default HelpScreen;