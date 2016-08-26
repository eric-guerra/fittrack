import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { dashboard, T } from '../store';
import { formatPace, paceMinPerKm } from '../logic/workouts';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PR_LABELS = { longestRunKm: 'Longest run', fastest5k: 'Fastest 5K', fastest10k: 'Fastest 10K', fastestHalf: 'Fastest half marathon' };

export default function HomeScreen() {
  const dispatch = useDispatch();
  const data = useSelector((s) => dashboard(s, today()));
  const prs = useSelector((s) => s.lastPRs);
  const maxMinutes = Math.max(30, ...data.summary.days.map((d) => d.minutes));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      {prs.length > 0 && (
        <TouchableOpacity style={styles.pr} onPress={() => dispatch({ type: T.PR_DISMISSED })}>
          <Text style={styles.prText}>🏆 New record: {prs.map((p) => PR_LABELS[p] || p.replace('lift:', '') + ' 1RM').join(', ')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.row}>
        <Stat label="Streak" value={`${data.streak} 🔥`} />
        <Stat label="This week" value={`${data.summary.minutes} min`} />
        <Stat label="Calories" value={data.summary.calories} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly goal: {data.goal.target} {data.goal.metricLabel || 'min'}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${data.goal.pct}%` }]} /></View>
        <Text style={styles.muted}>{data.goal.met ? 'Goal met — nice work!' : `${data.goal.pct}% complete`}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Week of {data.summary.weekOf}</Text>
        <View style={styles.chart}>
          {data.summary.days.map((d) => (
            <View key={d.day} style={styles.barCol}>
              <View style={[styles.bar, { height: `${(d.minutes / maxMinutes) * 100}%` }]} />
              <Text style={styles.barLabel}>{'MTWTFSS'[new Date(d.day + 'T12:00:00Z').getUTCDay() === 0 ? 6 : new Date(d.day + 'T12:00:00Z').getUTCDay() - 1]}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.section}>Recent</Text>
      {data.recent.map((w) => (
        <View key={w.id} style={styles.item}>
          <Text style={styles.itemTitle}>{w.type} · {w.durationMin} min{w.distanceKm ? ` · ${w.distanceKm} km` : ''}</Text>
          <Text style={styles.muted}>{w.day}{w.distanceKm ? ` · ${formatPace(paceMinPerKm(w))}` : ''} · {w.calories} kcal</Text>
        </View>
      ))}
      {data.unsynced > 0 && <Text style={styles.offline}>{data.unsynced} workout(s) will sync when you're back online</Text>}
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8f9fa' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  progressTrack: { height: 10, backgroundColor: '#eee', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: '#06d6a0' },
  chart: { flexDirection: 'row', height: 120, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: { width: 18, backgroundColor: '#ef476f', borderRadius: 4 },
  barLabel: { fontSize: 11, color: '#888', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '700', marginVertical: 8 },
  item: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  itemTitle: { fontWeight: '600', textTransform: 'capitalize' },
  muted: { color: '#888', fontSize: 12 },
  pr: { backgroundColor: '#ffd166', borderRadius: 12, padding: 12, marginBottom: 12 },
  prText: { fontWeight: '700' },
  offline: { color: '#e76f51', textAlign: 'center', marginTop: 8 }
});
