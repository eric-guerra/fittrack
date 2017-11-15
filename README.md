# FitTrack

A workout tracker for iOS and Android built with **React Native + Redux** on **Firebase** (Auth + Realtime Database). It logs runs, rides, swims, strength sessions and more, and shows weekly progress toward a goal, streaks, calorie estimates and personal records. It keeps working offline.

> Portfolio reference implementation of a 2016 mobile project, built with current React Native and React Navigation, keeping the original Redux + Firebase v8 architecture.

## Features

- **Log** any of 7 activity types; distance for cardio, sets × reps × weight for strength
- **Today**: streak (counting back from today, or yesterday since today isn't over), Monday-based weekly bar chart, calories, a progress bar toward the weekly goal (minutes, workouts or distance), and recent workouts
- **Personal records**: longest run, fastest 5K/10K/half (from pace on any longer run), and estimated 1RM per lift (Epley). A banner celebrates new PRs right after saving
- **Offline-first**: saves are optimistic. Unsynced workouts are tracked and retried when the app returns to the foreground or the user signs in, and they're shown with ⏳. State persists to AsyncStorage, so the app opens instantly. Remote snapshots never overwrite unsynced local edits

## Structure

```
src/logic/workouts.js   pure fitness math (MET-based calories, pace, streaks, weekly summary, PRs, goals)
src/store/index.js      reducers, selectors and thunk-style action creators; Firebase API injected
src/services/firebase.js  Auth + Realtime DB (users/{uid}/workouts), live subscription
src/screens/            Today, Log, History, Login
database.rules.json     per-user isolation + server-side validation
```

## Run

```bash
npm install
# put your Firebase web config in src/config.js and deploy database.rules.json
npx react-native run-android   # or run-ios
```

## Test

```bash
npm test     # logic and Redux flows in Node (no device needed)
```
