import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import config from '../config';

/**
 * Firebase Realtime Database layout:
 *   users/{uid}/workouts/{workoutId} = workout
 *   users/{uid}/profile = { bodyWeightKg, goal }
 * Security rules (database.rules.json) restrict each user to their own subtree.
 */
if (!firebase.apps.length) firebase.initializeApp(config.firebase);

const db = () => firebase.database();
const uid = () => {
  const u = firebase.auth().currentUser;
  if (!u) throw new Error('not signed in');
  return u.uid;
};

const api = {
  newId: () => db().ref('ids').push().key,

  signIn: (email, password) => firebase.auth().signInWithEmailAndPassword(email, password),
  signUp: (email, password) => firebase.auth().createUserWithEmailAndPassword(email, password),
  signOut: () => firebase.auth().signOut(),
  onAuth: (cb) => firebase.auth().onAuthStateChanged(cb),

  saveWorkout: (w) => db().ref(`users/${uid()}/workouts/${w.id}`).set(w),
  deleteWorkout: (id) => db().ref(`users/${uid()}/workouts/${id}`).remove(),
  saveProfile: (p) => db().ref(`users/${uid()}/profile`).set(p),

  /** Live subscription; returns an unsubscribe function. */
  watchWorkouts: (cb) => {
    const ref = db().ref(`users/${uid()}/workouts`).orderByChild('day').limitToLast(500);
    const handler = (snap) => cb(snap.val() || {});
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }
};

export default api;
