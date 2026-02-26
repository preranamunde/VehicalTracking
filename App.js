import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import VehicleDetailScreen from './src/screens/VehicleDetailScreen';
import CustomDrawer from './src/components/CustomDrawer';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import AddDriverScreen from './src/screens/AddDriverScreen';
import AssignmentScreen from './src/screens/AssignmentScreen';
import RouteManagementScreen from './src/screens/RouteManagementScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TripHistoryVehiclesScreen from './src/screens/TripHistoryVehiclesScreen';
import TripHistoryRoutesScreen from './src/screens/TripHistoryRoutesScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import SupportScreen from './src/screens/SupportScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ShareUsScreen from './src/screens/ShareUsScreen';
import ContactUsSreen from './src/screens/ContactUsScreen';
import AboutUsScreen from './src/screens/AboutUsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';

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

function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
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
      
      {/* Dashboard Screen */}
      <Stack.Screen 
        name="HomeScreen" 
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      
      {/* New Screens */}
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
      
      {/* Placeholder Screens */}
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
          content: 'Share our app with your network and help others discover the best fleet management solution!'
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
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}