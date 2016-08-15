import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persists the store locally so the app opens instantly and works offline. */
const KEY = 'fittrack.state.v1';

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function persistOnChange(store) {
  let timer = null;
  return store.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { workouts, pending, profile } = store.getState();
      AsyncStorage.setItem(KEY, JSON.stringify({ workouts, pending, profile })).catch(() => {});
    }, 300);
  });
}
