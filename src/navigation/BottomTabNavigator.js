import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import VehicleScreen from '../screens/VehicleScreen';
import RouteManagementScreen from '../screens/RouteManagementScreen';
import DriverScreen from '../screens/DriverScreen';

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.select({
    ios: 80 + insets.bottom,
    android: 99,
    default: 95,
  });

  return (
    <Tab.Navigator
      initialRouteName="Vehicle"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
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
                size={focused ? 26 : 24}
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
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 15 : 25,
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
          fontSize: 12,
          fontWeight: '700',
          marginTop: 6,
          marginBottom: Platform.OS === 'android' ? 8 : 4,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default BottomTabNavigator;