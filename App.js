import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isTokenValid, logout as clearSession } from './src/utils/Api';
import LoginScreen from './src/screens/LoginScreen';
import VehicleDetailScreen from './src/screens/VehicleDetailScreen';
import CustomDrawer from './src/components/CustomDrawer';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import AddDriverScreen from './src/screens/AddDriverScreen';
import DriverDetailScreen from './src/screens/DriverDetailScreen';
import DriverLeaveScreen from './src/screens/DriverLeaveScreen';
import DriverAssignmentHistoryScreen from './src/screens/DriverAssignmentHistoryScreen';
import AssignmentScreen from './src/screens/AssignmentScreen';
import RouteManagementScreen from './src/screens/RouteManagementScreen';
import AddTripScreen from './src/screens/AddTripScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TripHistoryVehiclesScreen from './src/screens/TripHistoryVehiclesScreen';
import TripHistoryRoutesScreen from './src/screens/TripHistoryRoutesScreen';
import TripHistoryScreen from './src/screens/TripHistoryScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import SupportScreen from './src/screens/SupportScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ShareUsScreen from './src/screens/ShareUsScreen';
import ContactUsSreen from './src/screens/ContactUsScreen';
import AboutUsScreen from './src/screens/AboutUsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';
import RoutePlayDetailScreen from './src/screens/RoutePlayDetailScreen';
import KYCScreen from './src/screens/KYCScreen';
import LearnScreen from './src/screens/LearnScreen';
import VehicleKYCScreen from './src/screens/VehicleKYCScreen';
import VehicleReportsScreen from './src/screens/VehicleReportsScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="MainTabs" component={BottomTabNavigator} />
    </Drawer.Navigator>
  );
}

function AppNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Home"
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VehicleDetail"
        component={VehicleDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddDriver"
        component={AddDriverScreen}
        options={{ headerShown: false }}
      />

      {/* Driver Detail Screen (opens when a driver card is tapped) */}
      <Stack.Screen
        name="DriverDetail"
        component={DriverDetailScreen}
        options={{ headerShown: false }}
      />

      {/* Driver Leave Screen (opens when the leave icon on a driver card is tapped) */}
      <Stack.Screen
        name="DriverLeave"
        component={DriverLeaveScreen}
        options={{ headerShown: false }}
      />

      {/* Driver Assignment History Screen (opens when "History" on a driver card is tapped) */}
      <Stack.Screen
        name="DriverAssignmentHistory"
        component={DriverAssignmentHistoryScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Assignments"
        component={AssignmentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RouteManagement"
        component={RouteManagementScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddTrip"
        component={AddTripScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TripHistoryVehicles"
        component={TripHistoryVehiclesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TripHistoryRoutes"
        component={TripHistoryRoutesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TripHistory"
        component={TripHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HomeScreen"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AboutUs"
        component={AboutUsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReferUs"
        component={PlaceholderScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ShareUs"
        component={ShareUsScreen}
        initialParams={{
          title: 'Share Us',
          icon: 'share-variant',
          content: 'Share our app with your network and help others discover the best fleet management solution!',
        }}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsSreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PlayRoute"
        component={RoutePlayDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KYC"
        component={KYCScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Learn"
        component={LearnScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VehicleKYC"
        component={VehicleKYCScreen}
        options={{ headerShown: false }}
      />
            <Stack.Screen
        name="VehicleReports"
        component={VehicleReportsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  // null = still checking token, otherwise 'Login' | 'Home'
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const valid = await isTokenValid();
        if (!valid) await clearSession(); // remove stale / expired tokens
        setInitialRoute(valid ? 'Home' : 'Login');
      } catch {
        setInitialRoute('Login');
      }
    };
    checkAuth();
  }, []);

  // Splash while checking the saved token (avoids flashing the Login screen)
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#3477eb" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator initialRouteName={initialRoute} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}