import React, { useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { allWorkouts, deleteWorkout } from '../store';
import { formatPace, paceMinPerKm, personalRecords } from '../logic/workouts';
import api from '../services/firebase';

export default function HistoryScreen() {
  const dispatch = useDispatch();
  const workouts = useSelector(allWorkouts);
  const pending = useSelector((s) => s.pending);
  const prs = useMemo(() => personalRecords(workouts), [workouts]);

  const confirmDelete = (w) => Alert.alert('Delete workout?', `${w.type} on ${w.day}`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteWorkout(w.id, api)) }
  ]);

  return (
    <FlatList
      data={workouts}
      keyExtractor={(w) => w.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View style={styles.prs}>
          <Text style={styles.title}>Personal records</Text>
          {prs.fastest5k && <Text>5K: {prs.fastest5k.value} min</Text>}
          {prs.fastest10k && <Text>10K: {prs.fastest10k.value} min</Text>}
          {prs.longestRunKm && <Text>Longest run: {prs.longestRunKm.value} km</Text>}
          {Object.keys(prs.lifts).map((k) => <Text key={k}>{k}: {prs.lifts[k].value} kg (est. 1RM)</Text>)}
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>No workouts yet — log your first one!</Text>}
      renderItem={({ item: w }) => (
        <TouchableOpacity style={styles.item} onLongPress={() => confirmDelete(w)}>
          <Text style={styles.itemTitle}>{w.type} · {w.durationMin} min {pending.includes(w.id) ? '⏳' : ''}</Text>
          <Text style={styles.muted}>
            {w.day}{w.distanceKm ? ` · ${w.distanceKm} km · ${formatPace(paceMinPerKm(w))}` : ''} · {w.calories} kcal
          </Text>
          {w.sets && w.sets.map((s, i) => <Text key={i} style={styles.muted}>{s.exercise}: {s.reps} × {s.weightKg} kg</Text>)}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  prs: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { fontWeight: '700', marginBottom: 6 },
  item: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  itemTitle: { fontWeight: '600', textTransform: 'capitalize' },
  muted: { color: '#888', fontSize: 12 }
});
