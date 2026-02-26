import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';


const SupportScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('feedback');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handlePickImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      selectionLimit: 5,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets) {
        const newFiles = response.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName,
          type: asset.type || 'image/jpeg',
          fileType: 'image',
        }));
        setSelectedFiles([...selectedFiles, ...newFiles]);
      }
    });
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!subject.trim()) {
      Alert.alert('Validation Error', 'Please enter a subject');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please enter a description');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const submissionType = activeTab === 'feedback' ? 'feedback' : 'issue';
    Alert.alert(
      '✅ Success',
      `Your ${submissionType} has been submitted successfully!`,
      [
        {
          text: 'OK',
          onPress: () => {
            setSubject('');
            setDescription('');
            setSelectedFiles([]);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const renderForm = () => {
    const getPlaceholder = () => {
      return activeTab === 'feedback'
        ? 'Write your suggestions...'
        : 'Describe the problem you faced...';
    };

    const getLabel = () => {
      return activeTab === 'feedback' ? 'Your Feedback *' : 'Describe the issue *';
    };

    return (
      <View style={styles.formContainer}>
        <Text style={styles.label}>Subject *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter subject"
          placeholderTextColor="#95a5a6"
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={styles.label}>{getLabel()}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={getPlaceholder()}
          placeholderTextColor="#95a5a6"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Attachments (Optional)</Text>
        <View style={styles.fileButtonsContainer}>
          <TouchableOpacity
            onPress={handlePickImage}
            style={styles.fileButtonFull}>
            <Icon name="image-plus" size={20} color="#3477eb" />
            <Text style={styles.fileButtonText}>Add Images</Text>
          </TouchableOpacity>
        </View>

        {selectedFiles.length > 0 && (
          <View style={styles.filesListContainer}>
            <Text style={styles.filesListTitle}>
              Attached Files ({selectedFiles.length})
            </Text>
            {selectedFiles.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <View style={styles.fileInfo}>
                  <Icon name="file-image" size={24} color="#3477eb" />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveFile(index)}
                  style={styles.removeFileButton}>
                  <Icon name="close-circle" size={24} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
          <Icon name="send" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>
            Submit {activeTab === 'feedback' ? 'Feedback' : 'Issue'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feedback' && styles.activeTab]}
          onPress={() => {
            setActiveTab('feedback');
            setSubject('');
            setDescription('');
            setSelectedFiles([]);
          }}>
          <Icon
            name="message-text"
            size={20}
            color={activeTab === 'feedback' ? '#3477eb' : '#94A3B8'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'feedback' && styles.activeTabText,
            ]}>
            Feedback
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'issue' && styles.activeTab]}
          onPress={() => {
            setActiveTab('issue');
            setSubject('');
            setDescription('');
            setSelectedFiles([]);
          }}>
          <Icon
            name="bug"
            size={20}
            color={activeTab === 'issue' ? '#3477eb' : '#94A3B8'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'issue' && styles.activeTabText,
            ]}>
            Report Issue
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.contentContainer}>{renderForm()}</View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop:30,
    backgroundColor: '#3477eb',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3477eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#3477eb',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2c3e50',
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  fileButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  fileButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3477eb',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    flex: 1,
  },
  fileButtonText: {
    color: '#3477eb',
    fontSize: 14,
    fontWeight: '600',
  },
  filesListContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  filesListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  fileName: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  removeFileButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#3477eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
    gap: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SupportScreen;