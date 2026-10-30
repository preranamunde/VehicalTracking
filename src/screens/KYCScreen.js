import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
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
const KYCScreen = ({ navigation }) => {
  const [addressDoc, setAddressDoc]  = useState(null);
  const [idDoc,      setIdDoc]       = useState(null);
  const [submitting, setSubmitting]  = useState(false);

  const pickDocument = (type) => {
    // Replace with your actual document picker (e.g. react-native-document-picker)
    Alert.alert('Upload Document', 'Choose how to upload', [
      {
        text: 'Simulate Upload',
        onPress: () => {
          const fakeFile = { name: 'document.pdf' };
          if (type === 'address') setAddressDoc(fakeFile);
          else setIdDoc(fakeFile);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = () => {
    if (!addressDoc) {
      Alert.alert('Missing Document', 'Please upload your Address Proof.');
      return;
    }
    if (!idDoc) {
      Alert.alert('Missing Document', 'Please upload your ID Proof.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert('Success', 'KYC documents submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }, 1500);
  };

  const UploadBox = ({ doc, onPress }) => (
    <TouchableOpacity
      style={[styles.uploadBox, doc && styles.uploadBoxFilled]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {doc ? (
        <View style={styles.uploadedRow}>
          <View style={styles.fileIconWrap}>
            <Icon name="file-check-outline" size={22} color="#16a34a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadedName} numberOfLines={1}>{doc.name}</Text>
            <Text style={styles.uploadedSub}>Tap to change</Text>
          </View>
          <Icon name="check-circle" size={20} color="#16a34a" />
        </View>
      ) : (
        <View style={styles.uploadPlaceholder}>
          <View style={styles.uploadIconCircle}>
            <Icon name="cloud-upload-outline" size={28} color="#3477eb" />
          </View>
          <Text style={styles.uploadTitle}>Upload Document</Text>
          <Text style={styles.uploadSub}>PDF, JPG or PNG · Max 5 MB</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* ── Header ── */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Verification</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Icon name="shield-check-outline" size={20} color="#3477eb" />
          <Text style={styles.infoText}>
            Upload clear, valid documents. All data is encrypted and secure.
          </Text>
        </View>

        {/* ══════════════════════════════
            ADDRESS PROOF
        ══════════════════════════════ */}
        <View style={styles.card}>
          {/* Card Title Row */}
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Icon name="home-outline" size={20} color="#3477eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Address Proof</Text>
              <Text style={styles.cardSub}>Upload one valid address document</Text>
            </View>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredTxt}>Required</Text>
            </View>
          </View>

          {/* Upload Box */}
          <UploadBox doc={addressDoc} onPress={() => pickDocument('address')} />

          {/* Accepted Documents */}
          <View style={styles.acceptedWrap}>
            <Text style={styles.acceptedTitle}>ACCEPTED DOCUMENTS</Text>
            <View style={styles.docTagsRow}>
              {['Aadhaar Card', 'Voter ID', 'Driving Licence'].map((tag) => (
                <View key={tag} style={styles.docTag}>
                  <Icon name="check-circle-outline" size={13} color="#3477eb" />
                  <Text style={styles.docTagTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ══════════════════════════════
            ID PROOF
        ══════════════════════════════ */}
        <View style={styles.card}>
          {/* Card Title Row */}
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#fef3c7' }]}>
              <Icon name="card-account-details-outline" size={20} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>ID Proof</Text>
              <Text style={styles.cardSub}>Upload one valid identity document</Text>
            </View>
            <View style={[styles.requiredBadge, { backgroundColor: '#fef3c7' }]}>
              <Text style={[styles.requiredTxt, { color: '#d97706' }]}>Required</Text>
            </View>
          </View>

          {/* Upload Box */}
          <UploadBox doc={idDoc} onPress={() => pickDocument('id')} />

          {/* Accepted Documents */}
          <View style={styles.acceptedWrap}>
            <Text style={styles.acceptedTitle}>ACCEPTED DOCUMENTS</Text>
            <View style={styles.docTagsRow}>
              <View style={[styles.docTag, { backgroundColor: '#fefce8', borderColor: '#fde68a' }]}>
                <Icon name="check-circle-outline" size={13} color="#d97706" />
                <Text style={[styles.docTagTxt, { color: '#92400e' }]}>PAN Card</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════
            SUBMIT BUTTON
        ══════════════════════════════ */}
        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <LinearGradient
            colors={submitting ? ['#94a3b8', '#94a3b8'] : ['#3477eb', '#5a94f5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitBtn}
          >
            <Icon name={submitting ? 'timer-sand' : 'send-check-outline'} size={20} color="#fff" />
            <Text style={styles.submitTxt}>
              {submitting ? 'Submitting...' : 'Submit KYC'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          By submitting, you agree to our Terms & Privacy Policy.{'\n'}
          Documents will be verified within 24–48 hours.
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 10 : 38,
    paddingBottom: 18, paddingHorizontal: 16,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Info Banner
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoText: { flex: 1, fontSize: 12, color: '#1d4ed8', fontWeight: '500', lineHeight: 18 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub:   { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginTop: 1 },
  requiredBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  requiredTxt: { fontSize: 11, color: '#3477eb', fontWeight: '700' },

  // Upload Box
  uploadBox: {
    borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed',
    borderRadius: 14, backgroundColor: '#F8FAFC',
    minHeight: 100, justifyContent: 'center', alignItems: 'center',
  },
  uploadBoxFilled: {
    borderStyle: 'solid', borderColor: '#86EFAC', backgroundColor: '#F0FDF4',
  },
  uploadPlaceholder: { alignItems: 'center', paddingVertical: 22 },
  uploadIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  uploadSub:   { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  uploadedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 16, width: '100%',
  },
  fileIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadedName: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  uploadedSub:  { fontSize: 10, color: '#86efac', fontWeight: '500', marginTop: 2 },

  // Accepted docs
  acceptedWrap:  { marginTop: 14 },
  acceptedTitle: {
    fontSize: 10, color: '#94a3b8', fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8,
  },
  docTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  docTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  docTagTxt: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 16, marginBottom: 14,
    shadowColor: '#3477eb', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  submitTxt: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  footerNote: {
    fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 18,
  },
});

export default KYCScreen;