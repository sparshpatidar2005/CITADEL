// App.tsx
// MUST be the very first import to initialize gesture handler native bits
import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootStack from './src/navigation'; // your navigator (Stack -> Tabs etc.)

// Improve native view performance for RN navigation
enableScreens();

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar
            barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
            backgroundColor="#ffffff"
          />
          <RootStack />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
