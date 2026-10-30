import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActionSheetIOS,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  isSmallDevice,
  isTablet,
} from '../utils/responsive';
// ─── Predefined Reports Data ───────────────────────────────────────────────
const PREDEFINED_REPORTS = [
  {
    id: '1',
    type: 'feedback',
    subject: 'Dashboard UI Improvement',
    description:
      'The dashboard could benefit from a dark mode option. Many users work late and a dark theme would reduce eye strain significantly.',
    date: 'Mar 10, 2025',
    status: 'pending',
  },
  {
    id: '2',
    type: 'issue',
    subject: 'App Crashes on Profile Edit',
    description:
      'Whenever I try to edit my profile picture, the app crashes unexpectedly. This happens consistently on Android 13.',
    date: 'Mar 08, 2025',
    status: 'open',
  },
  {
    id: '3',
    type: 'feedback',
    subject: 'Add Export to PDF Feature',
    description:
      'It would be really helpful to export reports directly to PDF format. Currently we have to take screenshots which is inconvenient.',
    date: 'Mar 05, 2025',
    status: 'closed',
  },
  {
    id: '4',
    type: 'issue',
    subject: 'Notifications Not Received',
    description:
      'Push notifications stopped working after the last update (v2.3.1). I have enabled all notification permissions but still not receiving any alerts.',
    date: 'Feb 28, 2025',
    status: 'resolved',
  },
];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: '#fffbeb', icon: 'clock-outline'       },
  open:     { label: 'Open',     color: '#3477eb', bg: '#eff6ff', icon: 'lock-open-outline'   },
  closed:   { label: 'Closed',   color: '#64748b', bg: '#f1f5f9', icon: 'lock-outline'        },
  resolved: { label: 'Resolved', color: '#10b981', bg: '#ecfdf5', icon: 'check-circle-outline'},
};

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All Reports' },
  { value: 'pending',  label: 'Pending'     },
  { value: 'open',     label: 'Open'        },
  { value: 'closed',   label: 'Closed'      },
  { value: 'resolved', label: 'Resolved'    },
];

const MAX_FILES = 5;

// ─── SupportScreen ─────────────────────────────────────────────────────────
const SupportScreen = ({ navigation }) => {
  const [activeTab, setActiveTab]         = useState('feedback');
  const [subject, setSubject]             = useState('');
  const [description, setDescription]     = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Edit mode
  const [editingReport, setEditingReport] = useState(null);
  const [editFormType, setEditFormType]   = useState('feedback');

  // Filter dropdown
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // ── File helpers ───────────────────────────────────────────────────────────

  const appendFiles = (assets) => {
    setSelectedFiles((prev) => {
      const slots = MAX_FILES - prev.length;
      if (slots <= 0) {
        Alert.alert('Limit Reached', `You can attach a maximum of ${MAX_FILES} images.`);
        return prev;
      }
      const incoming = assets.slice(0, slots).map((a) => ({
        uri:      a.uri,
        name:     a.fileName || `image_${Date.now()}.jpg`,
        type:     a.type     || 'image/jpeg',
        fileType: 'image',
      }));
      if (assets.length > slots) {
        Alert.alert('Limit Reached', `Only ${slots} image(s) added. Maximum is ${MAX_FILES}.`);
      }
      return [...prev, ...incoming];
    });
  };

  // ── Image Picker ───────────────────────────────────────────────────────────

  const openGallery = () => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1080, selectionLimit: MAX_FILES },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) { Alert.alert('Gallery Error', response.errorMessage || 'Could not open gallery.'); return; }
        if (response.assets?.length) appendFiles(response.assets);
      },
    );
  };

  const openCamera = () => {
    launchCamera(
      { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1080, saveToPhotos: false },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode === 'camera_unavailable') { Alert.alert('Unavailable', 'Camera is not available on this device.'); return; }
        if (response.errorCode === 'permission')         { Alert.alert('Permission Required', 'Please enable camera permission in Settings.'); return; }
        if (response.errorCode)                          { Alert.alert('Camera Error', response.errorMessage || 'Could not open camera.'); return; }
        if (response.assets?.length) appendFiles(response.assets);
      },
    );
  };

  const handlePickImage = () => {
    if (selectedFiles.length >= MAX_FILES) {
      Alert.alert('Limit Reached', `You can attach a maximum of ${MAX_FILES} images.`);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Gallery'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) openCamera(); else if (idx === 2) openGallery(); },
      );
    } else {
      Alert.alert('Add Image', 'Choose an option', [
        { text: 'Take Photo',          onPress: openCamera  },
        { text: 'Choose from Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' },
      ], { cancelable: true });
    }
  };

  const handleRemoveFile = (index) =>
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const resetForm = () => { setSubject(''); setDescription(''); setSelectedFiles([]); };

  const validateForm = () => {
    if (!subject.trim())     { Alert.alert('Validation Error', 'Please enter a subject.');     return false; }
    if (!description.trim()) { Alert.alert('Validation Error', 'Please enter a description.'); return false; }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    const type = activeTab === 'feedback' ? 'feedback' : 'issue';
    Alert.alert('✅ Success', `Your ${type} has been submitted successfully!`, [
      { text: 'OK', onPress: () => { resetForm(); navigation.goBack(); } },
    ]);
  };

  const handleEditSave = () => {
    if (!validateForm()) return;
    Alert.alert('✅ Updated', 'Your report has been updated successfully!', [
      { text: 'OK', onPress: () => { setEditingReport(null); resetForm(); setActiveTab('reports'); } },
    ]);
  };

  const handleEditPress = (report) => {
    setEditingReport(report);
    setEditFormType(report.type);
    setSubject(report.subject);
    setDescription(report.description);
    setSelectedFiles([]);
    setActiveTab('edit');
  };

  const handleCancelEdit = () => { setEditingReport(null); resetForm(); setActiveTab('reports'); };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    resetForm();
    if (tab !== 'edit') setEditingReport(null);
  };

  // ── Filtered reports ───────────────────────────────────────────────────────

  const filteredReports = selectedFilter === 'all'
    ? PREDEFINED_REPORTS
    : PREDEFINED_REPORTS.filter((r) => r.status === selectedFilter);

  const selectedFilterLabel = FILTER_OPTIONS.find((f) => f.value === selectedFilter)?.label || 'All Reports';

  // ── Render Form ────────────────────────────────────────────────────────────

  const renderForm = (isEdit = false) => {
    const type        = isEdit ? editFormType : activeTab;
    const placeholder = type === 'feedback' ? 'Write your suggestions...' : 'Describe the problem you faced...';
    const descLabel   = type === 'feedback' ? 'Your Feedback *' : 'Describe the issue *';

    return (
      <View style={styles.formContainer}>
        {isEdit && (
          <View style={styles.editBanner}>
            <Icon
              name={editFormType === 'feedback' ? 'message-text' : 'bug'}
              size={16}
              color={editFormType === 'feedback' ? '#3477eb' : '#e74c3c'}
            />
            <Text style={[styles.editBannerText, { color: editFormType === 'feedback' ? '#3477eb' : '#e74c3c' }]}>
              Editing {editFormType === 'feedback' ? 'Feedback' : 'Issue Report'}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Subject *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter subject"
          placeholderTextColor="#95a5a6"
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.label}>{descLabel}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={placeholder}
          placeholderTextColor="#95a5a6"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>
          Attachments (Optional){' '}
          <Text style={styles.labelHint}>{selectedFiles.length}/{MAX_FILES}</Text>
        </Text>

        <View style={styles.fileButtonsContainer}>
          <TouchableOpacity
            onPress={handlePickImage}
            style={[styles.fileButtonFull, selectedFiles.length >= MAX_FILES && styles.fileButtonDisabled]}
            disabled={selectedFiles.length >= MAX_FILES}>
            <Icon name="image-plus" size={20} color={selectedFiles.length >= MAX_FILES ? '#a0aec0' : '#3477eb'} />
            <Text style={[styles.fileButtonText, selectedFiles.length >= MAX_FILES && styles.fileButtonTextDisabled]}>
              Add Images
            </Text>
          </TouchableOpacity>
        </View>

        {selectedFiles.length > 0 && (
          <View style={styles.filesListContainer}>
            <Text style={styles.filesListTitle}>Attached Files ({selectedFiles.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagePreviewRow}>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: file.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <TouchableOpacity onPress={() => handleRemoveFile(index)} style={styles.imageRemoveBtn}>
                    <Icon name="close-circle" size={22} color="#e74c3c" />
                  </TouchableOpacity>
                  <Text style={styles.imagePreviewName} numberOfLines={1}>{file.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {isEdit ? (
          <View style={styles.editButtonRow}>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelButton}>
              <Icon name="close" size={18} color="#64748b" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditSave} style={styles.saveButton}>
              <Icon name="content-save" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
            <Icon name="send" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>
              Submit {activeTab === 'feedback' ? 'Feedback' : 'Issue'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render Report Card ─────────────────────────────────────────────────────

  const renderReportCard = (report) => {
    const statusCfg  = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
    const isFeedback = report.type === 'feedback';
    const isClosed   = report.status === 'closed';

    return (
      <View key={report.id} style={[styles.reportCard, isClosed && styles.reportCardClosed]}>
        {/* Card header row */}
        <View style={styles.reportCardHeader}>
          {/* Type chip */}
          <View style={[styles.reportTypeChip, { borderColor: isFeedback ? '#bfdbfe' : '#fecaca' }]}>
            <Icon name={isFeedback ? 'message-text' : 'bug'} size={13} color={isFeedback ? '#3477eb' : '#e74c3c'} />
            <Text style={[styles.reportTypeText, { color: isFeedback ? '#3477eb' : '#e74c3c' }]}>
              {isFeedback ? 'Feedback' : 'Issue'}
            </Text>
          </View>

          {/* Right side: status + edit */}
          <View style={styles.reportCardRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Icon name={statusCfg.icon} size={11} color={statusCfg.color} style={{ marginRight: 3 }} />
              <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>

            {/* Edit icon — hidden for closed */}
            {!isClosed ? (
              <TouchableOpacity
                onPress={() => handleEditPress(report)}
                style={styles.editIconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="pencil-outline" size={19} color="#3477eb" />
              </TouchableOpacity>
            ) : (
              /* Placeholder so layout stays consistent */
              <View style={styles.editIconPlaceholder} />
            )}
          </View>
        </View>

        {/* Subject */}
        <Text style={[styles.reportSubject, isClosed && styles.reportSubjectClosed]}>
          {report.subject}
        </Text>

        {/* Description */}
        <Text style={styles.reportDescription} numberOfLines={2}>{report.description}</Text>

        {/* Footer */}
        <View style={styles.reportFooter}>
          <Icon name="calendar-outline" size={13} color="#94a3b8" />
          <Text style={styles.reportDate}>{report.date}</Text>
          {isClosed && (
            <View style={styles.closedNote}>
              <Icon name="information-outline" size={12} color="#94a3b8" />
              <Text style={styles.closedNoteText}>Editing not available</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Dropdown ───────────────────────────────────────────────────────────────

  const renderDropdown = () => (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>Filter by Status</Text>

      <TouchableOpacity
        style={styles.dropdownTrigger}
        onPress={() => setDropdownVisible(true)}
        activeOpacity={0.8}>
        <View style={styles.dropdownTriggerLeft}>
          {selectedFilter !== 'all' && (
            <View style={[styles.dotIndicator, { backgroundColor: STATUS_CONFIG[selectedFilter]?.color || '#3477eb' }]} />
          )}
          <Text style={styles.dropdownTriggerText}>{selectedFilterLabel}</Text>
        </View>
        <Icon name={dropdownVisible ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
      </TouchableOpacity>

      {/* Dropdown menu */}
      <Modal
        transparent
        visible={dropdownVisible}
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownMenuTitle}>Filter by Status</Text>
            {FILTER_OPTIONS.map((option) => {
              const isSelected = selectedFilter === option.value;
              const dotColor   = option.value === 'all' ? '#3477eb' : STATUS_CONFIG[option.value]?.color;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                  onPress={() => { setSelectedFilter(option.value); setDropdownVisible(false); }}>
                  <View style={styles.dropdownItemLeft}>
                    <View style={[styles.dotIndicator, { backgroundColor: dotColor }]} />
                    <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                      {option.label}
                    </Text>
                    {/* Count badge */}
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>
                        {option.value === 'all'
                          ? PREDEFINED_REPORTS.length
                          : PREDEFINED_REPORTS.filter((r) => r.status === option.value).length}
                      </Text>
                    </View>
                  </View>
                  {isSelected && <Icon name="check" size={16} color="#3477eb" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  // ── Reports Tab ────────────────────────────────────────────────────────────

  const renderReportsTab = () => (
    <View style={styles.reportsContainer}>
      {/* Dropdown filter */}
      {renderDropdown()}

      {/* Result count */}
      <View style={styles.resultCountRow}>
        <Text style={styles.resultCountText}>
          {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'} found
        </Text>
      </View>

      {/* Cards */}
      {filteredReports.length > 0 ? (
        filteredReports.map(renderReportCard)
      ) : (
        <View style={styles.emptyState}>
          <Icon name="clipboard-text-off-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyStateTitle}>No reports found</Text>
          <Text style={styles.emptyStateText}>No reports match the selected filter.</Text>
        </View>
      )}
    </View>
  );

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={activeTab === 'edit' ? handleCancelEdit : () => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activeTab === 'edit' ? 'Edit Report' : 'Support'}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      {activeTab !== 'edit' && (
        <View style={styles.tabContainer}>
          {[
            { key: 'feedback', icon: 'message-text',           label: 'Feedback'     },
            { key: 'issue',    icon: 'bug',                    label: 'Report Issue' },
            { key: 'reports',  icon: 'clipboard-list-outline', label: 'My Reports'   },
          ].map(({ key, icon, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && styles.activeTab]}
              onPress={() => handleTabSwitch(key)}>
              <Icon name={icon} size={20} color={activeTab === key ? '#3477eb' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.contentContainer}>
          {activeTab === 'feedback' && renderForm(false)}
          {activeTab === 'issue'    && renderForm(false)}
          {activeTab === 'reports'  && renderReportsTab()}
          {activeTab === 'edit'     && renderForm(true)}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, paddingTop: 30,
    backgroundColor: '#3477eb', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', elevation: 2,
  },
  backButton:  { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  placeholder: { width: 40 },

  tabContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 5, borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  activeTab:     { borderBottomColor: '#3477eb' },
  tabText:       { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  activeTabText: { color: '#3477eb' },

  scrollContainer:  { flex: 1 },
  contentContainer: { padding: 16 },

  // ── Form ──────────────────────────────────────────────────────────────────
  formContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  label:         { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 8, marginTop: 10 },
  labelHint:     { fontSize: 12, fontWeight: '400', color: '#94a3b8' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12,
    fontSize: 16, color: '#2c3e50', backgroundColor: '#f9f9f9', marginBottom: 15,
  },
  textArea: { height: 120, textAlignVertical: 'top' },

  fileButtonsContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  fileButtonFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3477eb',
    borderRadius: 8, padding: 12, gap: 8, flex: 1,
  },
  fileButtonDisabled:     { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  fileButtonText:         { color: '#3477eb', fontSize: 14, fontWeight: '600' },
  fileButtonTextDisabled: { color: '#a0aec0' },

  filesListContainer: { marginTop: 4, marginBottom: 16 },
  filesListTitle:     { fontSize: 13, fontWeight: '600', color: '#2c3e50', marginBottom: 10 },
  imagePreviewRow:    { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  imagePreviewWrapper:{ alignItems: 'center', width: 80 },
  imagePreview: {
    width: 80, height: 80, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  imageRemoveBtn:   { position: 'absolute', top: -7, right: -7, backgroundColor: '#fff', borderRadius: 12 },
  imagePreviewName: { fontSize: 10, color: '#64748b', marginTop: 4, width: 80, textAlign: 'center' },

  submitButton: {
    backgroundColor: '#3477eb', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 16, borderRadius: 8, marginTop: 10, gap: 10,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 8, marginBottom: 12, alignSelf: 'flex-start',
  },
  editBannerText: { fontSize: 13, fontWeight: '700' },
  editButtonRow:  { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 14, borderRadius: 8, borderWidth: 1.5,
    borderColor: '#cbd5e1', backgroundColor: '#f8fafc',
  },
  cancelButtonText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  saveButton: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 14, borderRadius: 8, backgroundColor: '#3477eb',
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Reports Tab ───────────────────────────────────────────────────────────
  reportsContainer: { gap: 12 },

  // Dropdown filter
  filterRow: { marginBottom: 4 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2,
  },
  dropdownTriggerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownTriggerText:  { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  dotIndicator: { width: 8, height: 8, borderRadius: 4 },

  // Modal overlay
  dropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start', paddingTop: 180, paddingHorizontal: 16,
  },
  dropdownMenu: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  dropdownMenuTitle: {
    fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.8,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  dropdownItemActive:     { backgroundColor: '#eff6ff' },
  dropdownItemLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownItemText:       { fontSize: 14, fontWeight: '500', color: '#374151' },
  dropdownItemTextActive: { color: '#3477eb', fontWeight: '700' },
  countBadge: {
    backgroundColor: '#f1f5f9', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748b' },

  // Result count
  resultCountRow: { flexDirection: 'row', alignItems: 'center' },
  resultCountText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  // Report cards
  reportCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0', gap: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  reportCardClosed: { backgroundColor: '#fafafa', borderColor: '#e9edf2', opacity: 0.85 },

  reportCardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportTypeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f8fafc', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  reportTypeText:       { fontSize: 12, fontWeight: '700' },
  reportCardRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge:          { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText:           { fontSize: 11, fontWeight: '700' },
  editIconButton:       { padding: 5, borderRadius: 7, backgroundColor: '#eff6ff' },
  editIconPlaceholder:  { width: 29, height: 29 }, // keeps layout stable for closed cards

  reportSubject:       { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 21 },
  reportSubjectClosed: { color: '#94a3b8' },
  reportDescription:   { fontSize: 13, color: '#64748b', lineHeight: 19 },

  reportFooter:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  reportDate:      { fontSize: 12, color: '#94a3b8' },
  closedNote:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 },
  closedNoteText:  { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },

  // Empty state
  emptyState: {
    alignItems: 'center', paddingVertical: 48,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 12 },
  emptyStateText:  { fontSize: 13, color: '#94a3b8', marginTop: 4 },
});

export default SupportScreen;