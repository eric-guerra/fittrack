'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../src/logic/workouts');
var S = require('../src/store');

var seq = 0;
function w(day, type, durationMin, extra) {
  return Object.assign({ id: 'w' + (++seq), day: day, type: type, durationMin: durationMin }, extra || {});
}

test('validation', function () {
  assert.deepEqual(L.validate(w('2016-05-02', 'run', 30)), {});
  var e = L.validate({ type: 'skydive', durationMin: 0, day: 'today', distanceKm: -1 });
  assert.deepEqual(Object.keys(e).sort(), ['day', 'distanceKm', 'durationMin', 'type']);
  assert.ok(L.validate(w('2016-05-02', 'strength', 30, { sets: [{ exercise: '', reps: 5, weightKg: 60 }] }))['sets.0']);
});

test('calories scale with pace, weight and time', function () {
  var easy = w('2016-05-02', 'run', 60, { distanceKm: 8 });  // 7.5 min/km → MET 7.0
  var fast = w('2016-05-02', 'run', 60, { distanceKm: 13 }); // ~4.6 min/km → MET 11.5
  assert.equal(L.calories(easy, 70), 490);
  assert.equal(L.calories(fast, 70), 805);
  assert.equal(L.calories(w('2016-05-02', 'yoga', 30), 60), 75);
  assert.equal(L.formatPace(L.paceMinPerKm(w('d', 'run', 25, { distanceKm: 5 }))), '5:00 /km');
  assert.equal(L.formatPace(5.999), '6:00 /km');
});

test('streaks count back from today or yesterday', function () {
  var list = [w('2016-05-01', 'run', 20), w('2016-05-02', 'walk', 20), w('2016-05-03', 'yoga', 20), w('2016-05-03', 'run', 10), w('2016-04-28', 'run', 10)];
  assert.equal(L.streak(list, '2016-05-03'), 3);
  assert.equal(L.streak(list, '2016-05-04'), 3, 'today not done yet keeps the streak');
  assert.equal(L.streak(list, '2016-05-05'), 0);
  assert.equal(L.longestStreak(list), 3);
  assert.equal(L.addDays('2016-02-28', 1), '2016-02-29', 'leap year');
});

test('week summary is Monday-based', function () {
  assert.equal(L.weekStart('2016-05-08'), '2016-05-02'); // Sunday → previous Monday
  assert.equal(L.weekStart('2016-05-02'), '2016-05-02');
  var s = L.weekSummary([w('2016-05-02', 'run', 30, { distanceKm: 5 }), w('2016-05-04', 'strength', 45), w('2016-04-30', 'run', 60)], '2016-05-05', 70);
  assert.equal(s.minutes, 75);
  assert.equal(s.workouts, 2);
  assert.equal(s.activeDays, 2);
  assert.equal(s.distanceKm, 5);
  assert.equal(s.days[0].day, '2016-05-02');
  assert.equal(s.days.length, 7);
  assert.deepEqual(L.goalProgress({ metric: 'minutes', target: 150 }, s), { value: 75, target: 150, pct: 50, met: false });
});

test('personal records and which ones a new workout sets', function () {
  var a = w('2016-05-01', 'run', 30, { distanceKm: 5 });          // 5K in 30
  var b = w('2016-05-02', 'run', 50, { distanceKm: 10 });         // 10K in 50 → 5K pace 25
  var c = w('2016-05-03', 'strength', 40, { sets: [{ exercise: 'Squat', reps: 5, weightKg: 100 }] });
  var prs = L.personalRecords([a, b, c]);
  assert.equal(prs.fastest5k.value, 25);
  assert.equal(prs.fastest5k.id, b.id);
  assert.equal(prs.fastest10k.value, 50);
  assert.equal(prs.longestRunKm.value, 10);
  assert.equal(prs.lifts.squat.value, 116.7);
  assert.equal(L.oneRepMax(100, 1), 100);
  assert.deepEqual(L.newRecords(L.personalRecords([a]), L.personalRecords([a, b]), b.id), ['longestRunKm', 'fastest5k', 'fastest10k']);
});

test('save flow: optimistic, PR banner, offline queue and retry', async function () {
  var online = false;
  var saved = [];
  var api = {
    newId: function () { return 'id' + (++seq); },
    saveWorkout: function (wk) { if (!online) return Promise.reject(new Error('offline')); saved.push(wk.id); return Promise.resolve(); },
    deleteWorkout: function () { return Promise.resolve(); }
  };
  var store = S.createAppStore();

  var bad = await store.dispatch(S.saveWorkout({ type: 'run', durationMin: 0, day: '2016-05-02' }, api));
  assert.ok(bad.errors.durationMin);

  var res = await store.dispatch(S.saveWorkout({ type: 'run', durationMin: 25, distanceKm: 5, day: '2016-05-02' }, api));
  assert.equal(res.offline, true);
  assert.equal(S.allWorkouts(store.getState()).length, 1, 'shown immediately');
  assert.deepEqual(store.getState().pending, [res.workout.id]);
  assert.deepEqual(store.getState().lastPRs, ['longestRunKm', 'fastest5k']);
  assert.equal(res.workout.calories, L.calories(res.workout, 70));

  online = true;
  await store.dispatch(S.retryPending(api));
  assert.deepEqual(store.getState().pending, []);
  assert.deepEqual(saved, [res.workout.id]);

  // A remote snapshot replaces local data, except unsynced local edits.
  online = false;
  var local = await store.dispatch(S.saveWorkout({ type: 'yoga', durationMin: 30, day: '2016-05-03' }, api));
  store.dispatch({ type: S.T.REMOTE_SNAPSHOT, workouts: { remote1: { id: 'remote1', type: 'walk', durationMin: 20, day: '2016-05-01' } }, pendingIds: store.getState().pending });
  var ids = S.allWorkouts(store.getState()).map(function (x) { return x.id; });
  assert.deepEqual(ids, [local.workout.id, 'remote1'], 'newest first; pending local kept');

  await store.dispatch(S.deleteWorkout(local.workout.id, api));
  assert.deepEqual(store.getState().pending, []);
  var dash = S.dashboard(store.getState(), '2016-05-03');
  assert.equal(dash.recent.length, 1);
  assert.equal(dash.unsynced, 0);
});
