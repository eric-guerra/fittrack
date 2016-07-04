import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createAppStore, T, retryPending } from './src/store';
import api from './src/services/firebase';
import { loadState, persistOnChange } from './src/persist';
import HomeScreen from './src/screens/HomeScreen';
import LogScreen from './src/screens/LogScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    loadState().then((saved) => {
      const s = createAppStore();
      if (saved) s.dispatch({ type: T.HYDRATE, state: saved });
      persistOnChange(s);
      setStore(s);
    });
  }, []);

  useEffect(() => {
    if (!store) return undefined;
    let unwatch = () => {};
    const unAuth = api.onAuth((u) => {
      setUser(u);
      store.dispatch({ type: T.AUTH, user: u ? { uid: u.uid, email: u.email } : null });
      unwatch();
      if (u) {
        unwatch = api.watchWorkouts((workouts) => store.dispatch({ type: T.REMOTE_SNAPSHOT, workouts, pendingIds: store.getState().pending }));
        store.dispatch(retryPending(api));
      }
    });
    // Retry unsynced workouts when the app comes back to the foreground.
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') store.dispatch(retryPending(api)); });
    return () => { unAuth(); unwatch(); sub.remove(); };
  }, [store]);

  if (!store || user === undefined) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <Provider store={store}>
      <NavigationContainer>
        {user ? (
          <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#ef476f' }}>
            <Tab.Screen name="Today" component={HomeScreen} />
            <Tab.Screen name="Log" component={LogScreen} />
            <Tab.Screen name="History" component={HistoryScreen} />
          </Tab.Navigator>
        ) : (
          <LoginScreen />
        )}
      </NavigationContainer>
    </Provider>
  );
}
