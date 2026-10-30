import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import VehicleScreen from '../screens/VehicleScreen';
import RouteManagementScreen from '../screens/RouteManagementScreen';
import DriverScreen from '../screens/DriverScreen';
import { scale, moderateScale, moderateVerticalScale, normalizeFont } from '../utils/responsive';

const Tab = createBottomTabNavigator();

// Small helper to keep scaled values from blowing up on tall/tablet
// screens or shrinking too far on tiny screens.
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const BottomTabNavigator = () => {
  const insets = useSafeAreaInsets();
  // Not used directly here, but keeping the hook means this component
  // re-renders (and re-measures insets/orientation) on rotation.
  useWindowDimensions();

  // Content height (excludes safe-area inset) - clamped so it doesn't
  // grow/shrink out of control on unusual screen sizes.
  const baseContentHeight = Platform.select({
    ios: clamp(moderateVerticalScale(55), 50, 65),
    android: clamp(moderateVerticalScale(65), 58, 78),
    default: clamp(moderateVerticalScale(62), 55, 74),
  });

  const tabBarHeight = baseContentHeight + insets.bottom;

  // Small breathing-room padding below the icons/labels, damped
  // instead of linearly scaled, and clamped to a tight range.
  const extraBottomPad = clamp(moderateVerticalScale(8), 6, 12);
  const extraBottomPadAndroid = clamp(moderateVerticalScale(14), 12, 20);

  return (
    <Tab.Navigator
      initialRouteName="Vehicle"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Vehicle') {
            iconName = 'car-multiple';
          } else if (route.name === 'Trips') {
            iconName = 'routes';
          } else if (route.name === 'Driver') {
            iconName = 'account-group';
          }

          return (
            <View style={[
              styles.iconContainer,
              focused && styles.iconContainerActive,
            ]}>
              <Icon
                name={iconName}
                size={focused ? moderateScale(26) : moderateScale(24)}
                color={color}
              />
            </View>
          );
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarStyle: {
          backgroundColor: '#3477eb',
          borderTopWidth: 0,
          height: tabBarHeight,
          // insets.bottom already accounts for the home-indicator area on
          // notched/gesture-nav devices, so we only add a small clamped
          // breathing-room value instead of a raw linear scale.
          paddingBottom: Platform.OS === 'ios'
            ? insets.bottom + extraBottomPad
            : Math.max(insets.bottom, extraBottomPadAndroid),
          paddingTop: clamp(moderateVerticalScale(8), 6, 10),
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: normalizeFont(12),
          fontWeight: '700',
          marginTop: clamp(moderateVerticalScale(6), 4, 8),
          marginBottom: Platform.OS === 'android'
            ? clamp(moderateVerticalScale(4), 2, 6)
            : clamp(moderateVerticalScale(2), 1, 4),
        },
        tabBarItemStyle: {
          paddingVertical: clamp(moderateVerticalScale(6), 4, 8),
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Vehicle"
        component={VehicleScreen}
        options={{ tabBarLabel: 'Vehicles' }}
      />
      <Tab.Screen
        name="Trips"
        component={RouteManagementScreen}
        options={{ tabBarLabel: 'Trips' }}
      />
      <Tab.Screen
        name="Driver"
        component={DriverScreen}
        options={{ tabBarLabel: 'Drivers' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default BottomTabNavigator;