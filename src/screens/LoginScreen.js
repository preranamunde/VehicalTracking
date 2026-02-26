import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestLocationPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        console.log('📱 Requesting location permissions...');
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        console.log('📋 Permission results:', granted);

        if (
          granted['android.permission.ACCESS_FINE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('✅ Precise location permission granted');
          global.hasLocationPermission = true;
          global.hasPreciseLocation = true;
        } else if (
          granted['android.permission.ACCESS_COARSE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('✅ Approximate location permission granted');
          global.hasLocationPermission = true;
          global.hasPreciseLocation = false;
          Alert.alert(
            'Approximate Location',
            'You granted approximate location. For better tracking accuracy, you can enable precise location in settings.',
            [{ text: 'OK' }]
          );
        } else {
          console.log('❌ Location permissions denied');
          global.hasLocationPermission = false;
          global.hasPreciseLocation = false;
          Alert.alert(
            'Location Permission Denied',
            "You can still use the app to track vehicles, but your own location won't be shown on the map.",
            [{ text: 'OK' }]
          );
        }
      } catch (err) {
        console.warn('❌ Error requesting location permissions:', err);
        global.hasLocationPermission = false;
      }
    } else {
      global.hasLocationPermission = true;
      global.hasPreciseLocation = true;
    }
  };

  const handleLogin = async () => {
    // Validate inputs
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Bypassing API — mock login...');

      // ✅ Mock tokens (no API call)
      const accessToken = 'mock_access_token';
      const refreshToken = 'mock_refresh_token';

      // Store mock tokens in AsyncStorage
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('userEmail', email.trim());

      console.log('💾 Mock tokens stored successfully');

      // Request location permissions
      await requestLocationPermissions();

      setLoading(false);
      navigation.navigate('Home');
    } catch (error) {
      setLoading(false);
      console.error('❌ Login error:', error.message);
      Alert.alert('Login Failed', 'Something went wrong. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3477eb" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#3477eb', '#1a56cc']}
          style={styles.header}
        >
          <View style={styles.logoContainer}>
            <Icon name="car-connected" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Vehicle Tracker</Text>
          <Text style={styles.subtitle}>Monitor your fleet anywhere</Text>
        </LinearGradient>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Sign In</Text>
          <Text style={styles.welcomeSubtext}>
            Enter your credentials to continue
          </Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Feather
              name="mail"
              size={20}
              color="#94A3B8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Feather
              name="lock"
              size={20}
              color="#94A3B8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              disabled={loading}
            >
              <Feather
                name={showPassword ? 'eye' : 'eye-off'}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={['#3477eb', '#1a56cc']}
              style={styles.loginButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Feather
                    name="arrow-right"
                    size={20}
                    color="#FFFFFF"
                    style={styles.buttonIcon}
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#3477eb',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3477eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signupText: {
    color: '#64748B',
    fontSize: 15,
  },
  signupLink: {
    color: '#3477eb',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default LoginScreen;