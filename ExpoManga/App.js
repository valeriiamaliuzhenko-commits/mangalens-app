import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import SeriesScreen from './src/screens/SeriesScreen';
import ViewerScreen from './src/screens/ViewerScreen';
import { Colors } from './src/theme';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: Colors.bg },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="Library" component={LibraryScreen} />
          <Stack.Screen name="Series" component={SeriesScreen} />
          <Stack.Screen name="Viewer" component={ViewerScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});