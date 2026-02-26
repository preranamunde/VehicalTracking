import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import { apiPost, apiPut, ENDPOINTS } from '../utils/Api';

const LICENSE_TYPES = ['LMV', 'HMV', 'HPMV', 'MGV', 'TRANS', 'PSV'];

const AddDriverScreen = ({ navigation, route }) => {
  const editDriver = route?.params?.editDriver || null;
  const isEditMode = editDriver !== null;

  const [formData, setFormData] = useState({
    driver_name:          isEditMode ? (editDriver.driver_name          || '') : '',
    mobile_number:        isEditMode ? (editDriver.mobile_number        || '') : '',
    email_id:             isEditMode ? (editDriver.email_id             || '') : '',
    license_number:       isEditMode ? (editDriver.license_number       || '') : '',
    license_type:         isEditMode ? (editDriver.license_type         || '') : '',
  });

  const [loading,          setLoading]          = useState(false);
  const [errors,           setErrors]           = useState({});
  const [showLicenseTypes, setShowLicenseTypes] = useState(false);

  useEffect(() => {
    if (editDriver) {
      setFormData({
        driver_name:    editDriver.driver_name    || '',
        mobile_number:  editDriver.mobile_number  || '',
        email_id:       editDriver.email_id       || '',
        license_number: editDriver.license_number || '',
        license_type:   editDriver.license_type   || '',
      });
    }
  }, [editDriver]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.driver_name.trim())
      newErrors.driver_name = 'Driver name is required';

    if (!formData.mobile_number.trim())
      newErrors.mobile_number = 'Mobile number is required';
    else if (!/^\d{10}$/.test(formData.mobile_number))
      newErrors.mobile_number = 'Please enter a valid 10-digit mobile number';

    if (!formData.email_id.trim())
      newErrors.email_id = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_id))
      newErrors.email_id = 'Please enter a valid email address';

    if (!formData.license_number.trim())
      newErrors.license_number = 'License number is required';

    if (!formData.license_type.trim())
      newErrors.license_type = 'License type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      setLoading(true);

      if (isEditMode) {
        await apiPut(`${ENDPOINTS.DRIVERS}/${editDriver._id}`, formData);
        Alert.alert('Success', 'Driver updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await apiPost(ENDPOINTS.DRIVERS, formData);
        Alert.alert('Success', 'Driver added successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        setFormData({ driver_name: '', mobile_number: '', email_id: '', license_number: '', license_type: '' });
      }
    } catch (err) {
      Alert.alert(
        'Error',
        `Failed to ${isEditMode ? 'update' : 'add'} driver.\n\nError: ${err.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const headerTitle   = isEditMode ? 'Edit Driver'     : 'Add New Driver';
  const headerSub     = isEditMode ? 'Update driver details' : 'Fill in driver details';
  const buttonIcon    = isEditMode ? 'content-save'    : 'account-plus';
  const buttonLabel   = isEditMode ? 'Update Driver'   : 'Add Driver';
  const buttonLoading = isEditMode ? 'Updating...'     : 'Adding Driver...';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />

      {/* Header */}
      <LinearGradient colors={['#3477eb', '#5a94f5']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.subtitle}>{headerSub}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>

            {/* ── Driver Name ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Driver Name *</Text>
              <View style={[styles.inputWrapper, errors.driver_name && styles.inputError]}>
                <Icon name="account" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter driver name"
                  placeholderTextColor="#94A3B8"
                  value={formData.driver_name}
                  onChangeText={(t) => updateField('driver_name', t)}
                  editable={!loading}
                />
              </View>
              {errors.driver_name ? <Text style={styles.errorText}>{errors.driver_name}</Text> : null}
            </View>

            {/* ── Driver License Number ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Driver License Number *</Text>
              <View style={[styles.inputWrapper, errors.license_number && styles.inputError]}>
                <Icon name="card-account-details" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter license number"
                  placeholderTextColor="#94A3B8"
                  value={formData.license_number}
                  onChangeText={(t) => updateField('license_number', t)}
                  autoCapitalize="characters"
                  editable={!loading}
                />
              </View>
              {errors.license_number ? <Text style={styles.errorText}>{errors.license_number}</Text> : null}
            </View>

            {/* ── Driver License Type ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Driver License Type *</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, styles.pickerWrapper, errors.license_type && styles.inputError]}
                onPress={() => setShowLicenseTypes(!showLicenseTypes)}
                activeOpacity={0.7}
              >
                <Icon name="license" size={20} color="#64748B" style={styles.inputIcon} />
                <Text style={[styles.input, !formData.license_type && styles.placeholderText]}>
                  {formData.license_type || 'Select license type'}
                </Text>
                <Icon
                  name={showLicenseTypes ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
              {errors.license_type ? <Text style={styles.errorText}>{errors.license_type}</Text> : null}

              {/* Inline dropdown */}
              {showLicenseTypes && (
                <View style={styles.licenseDropdown}>
                  {LICENSE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.licenseOption,
                        formData.license_type === type && styles.licenseOptionActive,
                      ]}
                      onPress={() => {
                        updateField('license_type', type);
                        setShowLicenseTypes(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.licenseOptionText,
                        formData.license_type === type && styles.licenseOptionTextActive,
                      ]}>
                        {type}
                      </Text>
                      {formData.license_type === type && (
                        <Icon name="check-circle" size={16} color="#3477eb" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* ── Mobile Number ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number *</Text>
              <View style={[styles.inputWrapper, errors.mobile_number && styles.inputError]}>
                <Icon name="phone" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  value={formData.mobile_number}
                  onChangeText={(t) => updateField('mobile_number', t)}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!loading}
                />
              </View>
              {errors.mobile_number ? <Text style={styles.errorText}>{errors.mobile_number}</Text> : null}
            </View>

            {/* ── Email ── */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={[styles.inputWrapper, errors.email_id && styles.inputError]}>
                <Icon name="email" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#94A3B8"
                  value={formData.email_id}
                  onChangeText={(t) => updateField('email_id', t)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              {errors.email_id ? <Text style={styles.errorText}>{errors.email_id}</Text> : null}
            </View>

            {/* Info box */}
            <View style={styles.infoBox}>
              <Icon name="information" size={20} color="#3477eb" />
              <Text style={styles.infoText}>
                {isEditMode
                  ? 'Update the fields above and tap Update Driver to save changes.'
                  : 'All fields marked with * are required'}
              </Text>
            </View>

          </View>
        </ScrollView>

        {/* Submit button — pinned to bottom */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>{buttonLoading}</Text>
              </>
            ) : (
              <>
                <Icon name={buttonIcon} size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>{buttonLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F5F5F5' },
  header:        { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton:    { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter:  { flex: 1, marginLeft: 16 },
  headerTitle:   { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  subtitle:      { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '500', marginTop: 2 },
  placeholder:   { width: 40 },

  keyboardView:  { flex: 1 },
  scrollView:    { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  formContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  inputGroup:    { marginBottom: 20 },
  label:         { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
  inputWrapper:  {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16,
  },
  pickerWrapper: { paddingVertical: 1 },
  inputError:    { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  inputIcon:     { marginRight: 12 },
  input:         { flex: 1, fontSize: 15, color: '#1E293B', paddingVertical: 14, fontWeight: '500' },
  placeholderText: { color: '#94A3B8', fontWeight: '400' },
  errorText:     { fontSize: 12, color: '#EF4444', marginTop: 6, marginLeft: 4 },

  // License type inline dropdown
  licenseDropdown: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  licenseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  licenseOptionActive:     { backgroundColor: '#EFF6FF' },
  licenseOptionText:       { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  licenseOptionTextActive: { color: '#3477eb', fontWeight: '700' },

  infoBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginTop: 8, gap: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#3477eb', fontWeight: '500' },

  buttonContainer:      { padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  submitButton:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3477eb', borderRadius: 12, paddingVertical: 16, gap: 8, shadowColor: '#3477eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonDisabled: { backgroundColor: '#94A3B8' },
  submitButtonText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default AddDriverScreen;