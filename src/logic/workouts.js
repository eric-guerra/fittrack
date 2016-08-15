'use strict';

/**
 * Pure fitness math, shared by reducers and screens.
 * Dates are ISO strings; "day" means the user's local calendar day (YYYY-MM-DD), passed in explicitly
 * so the logic stays deterministic and testable.
 */

/** Metabolic equivalents (Compendium of Physical Activities, approximate). */
var MET = {
  run: function (paceMinPerKm) {
    if (!paceMinPerKm) return 9.8;
    if (paceMinPerKm <= 4) return 14.5;
    if (paceMinPerKm <= 5) return 11.5;
    if (paceMinPerKm <= 6) return 9.8;
    if (paceMinPerKm <= 7) return 8.3;
    return 7.0;
  },
  walk: function () { return 3.5; },
  cycle: function (paceMinPerKm) {
    var kmh = paceMinPerKm ? 60 / paceMinPerKm : 20;
    return kmh >= 25 ? 10 : kmh >= 19 ? 8 : 6;
  },
  swim: function () { return 7.0; },
  strength: function () { return 5.0; },
  yoga: function () { return 2.5; },
  hiit: function () { return 8.0; }
};

var TYPES = Object.keys(MET);

function validate(w) {
  var errors = {};
  if (TYPES.indexOf(w.type) < 0) errors.type = 'Choose an activity';
  if (!(w.durationMin > 0 && w.durationMin <= 24 * 60)) errors.durationMin = 'Duration must be 1-1440 minutes';
  if (w.distanceKm !== undefined && w.distanceKm !== null && !(w.distanceKm >= 0 && w.distanceKm < 1000)) errors.distanceKm = 'Distance looks wrong';
  if (w.type === 'strength') {
    (w.sets || []).forEach(function (s, i) {
      if (!s.exercise || !(s.reps > 0) || !(s.weightKg >= 0)) errors['sets.' + i] = 'Each set needs an exercise, reps and weight';
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.day || '')) errors.day = 'Day is required';
  return errors;
}

function paceMinPerKm(w) {
  return w.distanceKm > 0 ? w.durationMin / w.distanceKm : null;
}

/** kcal = MET × body weight (kg) × hours. */
function calories(w, bodyWeightKg) {
  var met = MET[w.type](paceMinPerKm(w));
  return Math.round(met * (bodyWeightKg || 70) * (w.durationMin / 60));
}

function formatPace(minPerKm) {
  if (!minPerKm) return '—';
  var m = Math.floor(minPerKm);
  var s = Math.round((minPerKm - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return m + ':' + (s < 10 ? '0' : '') + s + ' /km';
}

/** Epley estimate of a one-rep max. */
function oneRepMax(weightKg, reps) {
  return reps === 1 ? weightKg : Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function addDays(day, n) {
  var d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Consecutive days with at least one workout, ending today (or yesterday: today isn't over yet). */
function streak(workouts, today) {
  var days = {};
  workouts.forEach(function (w) { days[w.day] = true; });
  var cursor = days[today] ? today : addDays(today, -1);
  var n = 0;
  while (days[cursor]) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

function longestStreak(workouts) {
  var days = Object.keys(workouts.reduce(function (acc, w) { acc[w.day] = true; return acc; }, {})).sort();
  var best = 0, run = 0, prev = null;
  days.forEach(function (d) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  return best;
}

/** Monday-start week containing `day`. */
function weekStart(day) {
  var d = new Date(day + 'T12:00:00Z');
  var dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

/** Per-day minutes for the week of `today` plus totals, for the bar chart on the home screen. */
function weekSummary(workouts, today, bodyWeightKg) {
  var start = weekStart(today);
  var days = [];
  for (var i = 0; i < 7; i++) days.push({ day: addDays(start, i), minutes: 0, calories: 0, count: 0 });
  var byDay = {};
  days.forEach(function (d) { byDay[d.day] = d; });
  var distanceKm = 0;
  workouts.forEach(function (w) {
    var slot = byDay[w.day];
    if (!slot) return;
    slot.minutes += w.durationMin;
    slot.calories += calories(w, bodyWeightKg);
    slot.count += 1;
    distanceKm += w.distanceKm || 0;
  });
  return {
    weekOf: start,
    days: days,
    minutes: days.reduce(function (a, d) { return a + d.minutes; }, 0),
    calories: days.reduce(function (a, d) { return a + d.calories; }, 0),
    workouts: days.reduce(function (a, d) { return a + d.count; }, 0),
    activeDays: days.filter(function (d) { return d.count > 0; }).length,
    distanceKm: Math.round(distanceKm * 100) / 100
  };
}

/**
 * Personal records: fastest pace for runs ≥ 1 km at standard distances (5K, 10K, half),
 * longest run, and best estimated 1RM per lift. Returns PRs that `candidate` would set.
 */
function personalRecords(workouts) {
  var prs = { longestRunKm: null, fastest5k: null, fastest10k: null, fastestHalf: null, lifts: {} };
  workouts.forEach(function (w) {
    if (w.type === 'run' && w.distanceKm > 0) {
      if (!prs.longestRunKm || w.distanceKm > prs.longestRunKm.value) prs.longestRunKm = { value: w.distanceKm, id: w.id };
      [['fastest5k', 5], ['fastest10k', 10], ['fastestHalf', 21.0975]].forEach(function (pair) {
        if (w.distanceKm >= pair[1]) {
          var est = paceMinPerKm(w) * pair[1];
          if (!prs[pair[0]] || est < prs[pair[0]].value) prs[pair[0]] = { value: Math.round(est * 10) / 10, id: w.id };
        }
      });
    }
    if (w.type === 'strength') {
      (w.sets || []).forEach(function (s) {
        var est = oneRepMax(s.weightKg, s.reps);
        var key = s.exercise.trim().toLowerCase();
        if (!prs.lifts[key] || est > prs.lifts[key].value) prs.lifts[key] = { value: est, id: w.id };
      });
    }
  });
  return prs;
}

function newRecords(before, after, workoutId) {
  var out = [];
  ['longestRunKm', 'fastest5k', 'fastest10k', 'fastestHalf'].forEach(function (k) {
    if (after[k] && after[k].id === workoutId && (!before[k] || before[k].id !== workoutId)) out.push(k);
  });
  Object.keys(after.lifts).forEach(function (k) {
    if (after.lifts[k].id === workoutId && (!before.lifts[k] || before.lifts[k].id !== workoutId)) out.push('lift:' + k);
  });
  return out;
}

function goalProgress(goal, summary) {
  var value = goal.metric === 'minutes' ? summary.minutes : goal.metric === 'workouts' ? summary.workouts : summary.distanceKm;
  return { value: value, target: goal.target, pct: Math.min(100, Math.round(100 * value / goal.target)), met: value >= goal.target };
}

module.exports = {
  TYPES: TYPES, validate: validate, calories: calories, paceMinPerKm: paceMinPerKm, formatPace: formatPace,
  oneRepMax: oneRepMax, streak: streak, longestStreak: longestStreak, weekStart: weekStart, weekSummary: weekSummary,
  personalRecords: personalRecords, newRecords: newRecords, goalProgress: goalProgress, addDays: addDays
};
