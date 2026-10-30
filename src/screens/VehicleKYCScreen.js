import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';

function VehicleKYCScreen({ navigation, route }) {
  const { vehicle } = route.params || {};

  // ─── Step: 'form' | 'otp' ────────────────────────────
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);

  // ─── Form fields ──────────────────────────────────────
  const [formData, setFormData] = useState({
    registration_number: vehicle?.registration_number || '',
    chassis_number: vehicle?.chassis_number || '',
    engine_number: vehicle?.engine_number || '',
    registration_date: '',
    valid_upto_date: '',
  });

  // ─── Date picker states ───────────────────────────────
  const [showRegDatePicker, setShowRegDatePicker] = useState(false);
  const [showValidUptoPicker, setShowValidUptoPicker] = useState(false);
  const [regDate, setRegDate] = useState(null);
  const [validUptoDate, setValidUptoDate] = useState(null);

  // ─── OTP state ────────────────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = Array(6).fill(null).map(() => React.createRef());

  const formatDate = (date) => {
    if (!date) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegDateChange = (event, selectedDate) => {
    setShowRegDatePicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) {
      setRegDate(selectedDate);
      setFormData((prev) => ({ ...prev, registration_date: formatDate(selectedDate) }));
    }
  };

  const handleValidUptoChange = (event, selectedDate) => {
    setShowValidUptoPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) {
      setValidUptoDate(selectedDate);
      setFormData((prev) => ({ ...prev, valid_upto_date: formatDate(selectedDate) }));
    }
  };

  const handleValidate = () => {
    if (
      !formData.registration_number ||
      !formData.chassis_number ||
      !formData.engine_number ||
      !formData.registration_date ||
      !formData.valid_upto_date
    ) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 1200);
  };

  const handleReset = () => {
    setFormData({
      registration_number: vehicle?.registration_number || '',
      chassis_number: vehicle?.chassis_number || '',
      engine_number: vehicle?.engine_number || '',
      registration_date: '',
      valid_upto_date: '',
    });
    setRegDate(null);
    setValidUptoDate(null);
  };

  const handleOtpChange = (value, index) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpSubmit = () => {
    const otpValue = otp.join('');
    if (otpValue.length < 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit OTP');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Success', 'KYC verified successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }, 1200);
  };

  // ─── Date Input Field ─────────────────────────────────
  const DateInputField = ({ label, value, onPress }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateInputRow} onPress={onPress} activeOpacity={0.8}>
        <Text style={value ? styles.dateInputText : styles.dateInputPlaceholder}>
          {value || 'DD/MM/YYYY'}
        </Text>
        <View style={styles.calendarIconBox}>
          <Icon name="calendar-month" size={20} color="#3477eb" />
        </View>
      </TouchableOpacity>
    </View>
  );

  // ─── FORM STEP ────────────────────────────────────────
  const renderForm = () => (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Notice Banner */}
      <View style={styles.noticeBanner}>
        <Icon name="information-outline" size={16} color="#3477eb" style={{ marginTop: 1 }} />
        <Text style={styles.noticeText}>
          Please note that in case you don't have complete information then visit RTO for getting details updated.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>VEHICLE KYC DETAILS</Text>

        {/* Vehicle Registration No */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Vehicle Registration No. *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. MH12AB1234"
            placeholderTextColor="#a0aec0"
            value={formData.registration_number}
            onChangeText={(v) => handleInputChange('registration_number', v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={10}
          />
        </View>

        {/* Chassis No */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Chassis No (Full) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. MA1TB2S10M6001234"
            placeholderTextColor="#a0aec0"
            value={formData.chassis_number}
            onChangeText={(v) => handleInputChange('chassis_number', v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={17}
          />
        </View>

        {/* Engine Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Engine Number (Full) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. K15B1234567"
            placeholderTextColor="#a0aec0"
            value={formData.engine_number}
            onChangeText={(v) => handleInputChange('engine_number', v.toUpperCase())}
            autoCapitalize="characters"
          />
        </View>

        {/* Registration Date */}
        <DateInputField
          label="Registration Date *"
          value={formData.registration_date}
          onPress={() => setShowRegDatePicker(true)}
        />

        {/* Registration / Fitness Valid Upto Date */}
        <DateInputField
          label="Registration / Fitness Valid Upto Date *"
          value={formData.valid_upto_date}
          onPress={() => setShowValidUptoPicker(true)}
        />

        <Text style={styles.helperText}>
          Enter fitness upto date for commercial vehicle and registration upto for private vehicle.
        </Text>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.8}>
            <Icon name="refresh" size={18} color="#3477eb" />
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.validateButton, loading && styles.buttonDisabled]}
            onPress={handleValidate}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Icon name="check-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.validateButtonText}>Validate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  // ─── OTP STEP ─────────────────────────────────────────
  const renderOtp = () => (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.formCard}>

        {/* OTP Icon */}
        <View style={styles.otpIconBox}>
          <Icon name="shield-key-outline" size={48} color="#3477eb" />
        </View>

        <Text style={styles.otpTitle}>OTP Verification</Text>
        <Text style={styles.otpSubtitle}>
          Enter the 6-digit OTP sent to your registered mobile number to complete KYC verification.
        </Text>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={otpRefs[index]}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(v) => handleOtpChange(v, index)}
              onKeyPress={(e) => handleOtpKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectionColor="#3477eb"
            />
          ))}
        </View>

        {/* Resend */}
        <TouchableOpacity style={styles.resendRow} onPress={() => setOtp(['', '', '', '', '', ''])}>
          <Icon name="refresh" size={16} color="#3477eb" />
          <Text style={styles.resendText}>Resend OTP</Text>
        </TouchableOpacity>

        {/* Submit OTP */}
        <TouchableOpacity
          style={[styles.validateButton, { marginTop: 8 }, loading && styles.buttonDisabled]}
          onPress={handleOtpSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Icon name="shield-check-outline" size={18} color="#ffffff" />
              <Text style={styles.validateButtonText}>Verify OTP</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Back to form */}
        <TouchableOpacity
          style={styles.backToFormBtn}
          onPress={() => { setStep('form'); setOtp(['', '', '', '', '', '']); }}
          activeOpacity={0.8}
        >
          <Icon name="arrow-left" size={16} color="#718096" />
          <Text style={styles.backToFormText}>Back to Form</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <LinearGradient colors={['#3477eb', '#2563eb']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle KYC</Text>
          <View style={styles.backButton} />
        </LinearGradient>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={styles.stepItem}>
            <View style={[styles.stepDot, styles.stepDotActive]}>
              <Icon name="file-document-outline" size={14} color="#ffffff" />
            </View>
            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Details</Text>
          </View>
          <View style={[styles.stepLine, step === 'otp' && styles.stepLineActive]} />
          <View style={styles.stepItem}>
            <View style={[styles.stepDot, step === 'otp' && styles.stepDotActive]}>
              <Icon name="shield-key-outline" size={14} color={step === 'otp' ? '#ffffff' : '#a0aec0'} />
            </View>
            <Text style={[styles.stepLabel, step === 'otp' && styles.stepLabelActive]}>OTP</Text>
          </View>
        </View>

        {step === 'form' ? renderForm() : renderOtp()}

        {/* Date Pickers */}
        {showRegDatePicker && (
          <DateTimePicker
            value={regDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleRegDateChange}
            minimumDate={new Date(2000, 0, 1)}
            maximumDate={new Date()}
          />
        )}
        {showValidUptoPicker && (
          <DateTimePicker
            value={validUptoDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleValidUptoChange}
            minimumDate={new Date(2000, 0, 1)}
            maximumDate={new Date(2100, 11, 31)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', textAlign: 'center' },

  // ── Step Indicator ──────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 60,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2eaf8',
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2eaf8',
    borderWidth: 1.5,
    borderColor: '#c3d0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: { backgroundColor: '#3477eb', borderColor: '#3477eb' },
  stepLabel: { fontSize: 11, color: '#a0aec0', fontWeight: '600' },
  stepLabelActive: { color: '#3477eb' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2eaf8',
    marginHorizontal: 10,
    marginBottom: 18,
  },
  stepLineActive: { backgroundColor: '#3477eb' },

  // ── Scroll ──────────────────────────────────────────────
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // ── Notice Banner ───────────────────────────────────────
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(52,119,235,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(52,119,235,0.22)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#3477eb',
    lineHeight: 18,
    fontWeight: '500',
  },

  // ── Form Card ───────────────────────────────────────────
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2eaf8',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3477eb',
    letterSpacing: 1,
    marginBottom: 20,
    textAlign: 'center',
  },

  // ── Input Fields ────────────────────────────────────────
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, color: '#4a5568', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#f5f8ff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1a2d4e',
    borderWidth: 1.5,
    borderColor: '#dce6f7',
  },

  // ── Date Input ──────────────────────────────────────────
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f8ff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#dce6f7',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateInputText: { flex: 1, fontSize: 15, color: '#1a2d4e' },
  dateInputPlaceholder: { flex: 1, fontSize: 15, color: '#a0aec0' },
  calendarIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(52,119,235,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,119,235,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  helperText: {
    fontSize: 12,
    color: '#a0aec0',
    fontStyle: 'italic',
    marginBottom: 24,
    lineHeight: 17,
  },

  // ── Buttons ─────────────────────────────────────────────
  buttonRow: { flexDirection: 'row', gap: 12 },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#3477eb',
    backgroundColor: 'transparent',
  },
  resetButtonText: { fontSize: 15, fontWeight: '700', color: '#3477eb' },
  validateButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3477eb',
    borderRadius: 10,
    paddingVertical: 14,
  },
  validateButtonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  buttonDisabled: { opacity: 0.6 },

  // ── OTP ─────────────────────────────────────────────────
  otpIconBox: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(52,119,235,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(52,119,235,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a2d4e',
    textAlign: 'center',
    marginBottom: 10,
  },
  otpSubtitle: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#f5f8ff',
    borderWidth: 1.5,
    borderColor: '#dce6f7',
    fontSize: 22,
    fontWeight: '700',
    color: '#1a2d4e',
  },
  otpBoxFilled: {
    borderColor: '#3477eb',
    backgroundColor: 'rgba(52,119,235,0.06)',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  resendText: { fontSize: 14, color: '#3477eb', fontWeight: '600' },
  backToFormBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
  },
  backToFormText: { fontSize: 14, color: '#718096' },
});

export default VehicleKYCScreen;