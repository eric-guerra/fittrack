'use strict';

var redux = require('redux');
var logic = require('../logic/workouts');

/**
 * State:
 *   workouts: { byId, ids (newest first) }
 *   pending:  ids saved locally but not yet acknowledged by Firebase (offline support)
 *   profile:  { bodyWeightKg, goal: { metric, target } }
 *   lastPRs:  record names the most recent save set (for the celebration banner)
 */
var T = {
  HYDRATE: 'HYDRATE', WORKOUT_SAVED: 'WORKOUT_SAVED', WORKOUT_SYNCED: 'WORKOUT_SYNCED', WORKOUT_DELETED: 'WORKOUT_DELETED',
  REMOTE_SNAPSHOT: 'REMOTE_SNAPSHOT', PROFILE_UPDATED: 'PROFILE_UPDATED', PR_DISMISSED: 'PR_DISMISSED', AUTH: 'AUTH'
};

function sortIds(byId) {
  return Object.keys(byId).sort(function (a, b) {
    var x = byId[a], y = byId[b];
    return y.day.localeCompare(x.day) || (y.createdAt || '').localeCompare(x.createdAt || '');
  });
}

function workouts(state, action) {
  state = state || { byId: {}, ids: [] };
  var byId;
  switch (action.type) {
    case T.HYDRATE:
      return action.state.workouts || state;
    case T.WORKOUT_SAVED:
      byId = Object.assign({}, state.byId);
      byId[action.workout.id] = action.workout;
      return { byId: byId, ids: sortIds(byId) };
    case T.WORKOUT_DELETED:
      byId = Object.assign({}, state.byId);
      delete byId[action.id];
      return { byId: byId, ids: sortIds(byId) };
    case T.REMOTE_SNAPSHOT: {
      // Server is the source of truth, except for local edits that haven't synced yet.
      byId = Object.assign({}, action.workouts);
      (action.pendingIds || []).forEach(function (id) { if (state.byId[id]) byId[id] = state.byId[id]; });
      return { byId: byId, ids: sortIds(byId) };
    }
    default:
      return state;
  }
}

function pending(state, action) {
  state = state || [];
  switch (action.type) {
    case T.HYDRATE: return action.state.pending || state;
    case T.WORKOUT_SAVED: return state.indexOf(action.workout.id) >= 0 ? state : state.concat(action.workout.id);
    case T.WORKOUT_SYNCED: return state.filter(function (id) { return id !== action.id; });
    case T.WORKOUT_DELETED: return state.filter(function (id) { return id !== action.id; });
    default: return state;
  }
}

function profile(state, action) {
  state = state || { bodyWeightKg: 70, goal: { metric: 'minutes', target: 150 } };
  switch (action.type) {
    case T.HYDRATE: return action.state.profile || state;
    case T.PROFILE_UPDATED: return Object.assign({}, state, action.changes);
    default: return state;
  }
}

function lastPRs(state, action) {
  state = state || [];
  if (action.type === T.WORKOUT_SAVED) return action.newRecords || [];
  if (action.type === T.PR_DISMISSED) return [];
  return state;
}

function user(state, action) {
  state = state || null;
  return action.type === T.AUTH ? action.user : state;
}

var reducer = redux.combineReducers({ workouts: workouts, pending: pending, profile: profile, lastPRs: lastPRs, user: user });

// ---- selectors ----
function allWorkouts(state) {
  return state.workouts.ids.map(function (id) { return state.workouts.byId[id]; });
}

function dashboard(state, today) {
  var list = allWorkouts(state);
  var summary = logic.weekSummary(list, today, state.profile.bodyWeightKg);
  return {
    summary: summary,
    streak: logic.streak(list, today),
    longestStreak: logic.longestStreak(list),
    goal: logic.goalProgress(state.profile.goal, summary),
    recent: list.slice(0, 5),
    unsynced: state.pending.length
  };
}

// ---- action creators (thunk-style; `api` is the Firebase service, injected for testability) ----
function saveWorkout(input, api) {
  return function (dispatch, getState) {
    var errors = logic.validate(input);
    if (Object.keys(errors).length) return Promise.resolve({ errors: errors });
    var state = getState();
    var workout = Object.assign({ id: input.id || api.newId(), createdAt: new Date().toISOString() }, input);
    workout.calories = logic.calories(workout, state.profile.bodyWeightKg);
    var before = logic.personalRecords(allWorkouts(state));
    var after = logic.personalRecords(allWorkouts(state).filter(function (w) { return w.id !== workout.id; }).concat(workout));
    dispatch({ type: T.WORKOUT_SAVED, workout: workout, newRecords: logic.newRecords(before, after, workout.id) });
    // Optimistic: the UI already shows the workout; sync in the background and retry later if offline.
    return api.saveWorkout(workout).then(function () {
      dispatch({ type: T.WORKOUT_SYNCED, id: workout.id });
      return { workout: workout };
    }, function () {
      return { workout: workout, offline: true };
    });
  };
}

function retryPending(api) {
  return function (dispatch, getState) {
    var state = getState();
    return Promise.all(state.pending.map(function (id) {
      var w = state.workouts.byId[id];
      if (!w) return dispatch({ type: T.WORKOUT_SYNCED, id: id });
      return api.saveWorkout(w).then(function () { dispatch({ type: T.WORKOUT_SYNCED, id: id }); }, function () {});
    }));
  };
}

function deleteWorkout(id, api) {
  return function (dispatch) {
    dispatch({ type: T.WORKOUT_DELETED, id: id });
    return api.deleteWorkout(id).catch(function () {});
  };
}

/** Minimal thunk middleware (what redux-thunk does). */
function thunk(store) {
  return function (next) {
    return function (action) {
      return typeof action === 'function' ? action(store.dispatch, store.getState) : next(action);
    };
  };
}

function createAppStore(preloaded) {
  return redux.createStore(reducer, preloaded, redux.applyMiddleware(thunk));
}

module.exports = {
  T: T, reducer: reducer, createAppStore: createAppStore, allWorkouts: allWorkouts, dashboard: dashboard,
  saveWorkout: saveWorkout, retryPending: retryPending, deleteWorkout: deleteWorkout
};
