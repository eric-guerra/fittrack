import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { saveWorkout } from '../store';
import { TYPES } from '../logic/workouts';
import api from '../services/firebase';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function LogScreen({ navigation }) {
  const dispatch = useDispatch();
  const [type, setType] = useState('run');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [day, setDay] = useState(todayIso());
  const [sets, setSets] = useState([{ exercise: '', reps: '', weightKg: '' }]);
  const [errors, setErrors] = useState({});

  const hasDistance = ['run', 'walk', 'cycle', 'swim'].includes(type);

  const submit = async () => {
    const input = {
      type, day, durationMin: Number(duration),
      distanceKm: hasDistance && distance ? Number(distance) : null,
      sets: type === 'strength' ? sets.filter((s) => s.exercise).map((s) => ({ exercise: s.exercise, reps: Number(s.reps), weightKg: Number(s.weightKg) })) : undefined
    };
    const result = await dispatch(saveWorkout(input, api));
    if (result.errors) { setErrors(result.errors); return; }
    setErrors({});
    setDuration(''); setDistance(''); setSets([{ exercise: '', reps: '', weightKg: '' }]);
    if (result.offline) Alert.alert('Saved offline', "We'll sync this workout when you're back online.");
    navigation.navigate('Today');
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.label}>Activity</Text>
      <View style={styles.chips}>
        {TYPES.map((t) => (
          <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={duration} onChangeText={setDuration} placeholder="45" />
      {errors.durationMin && <Text style={styles.error}>{errors.durationMin}</Text>}

      {hasDistance && (
        <>
          <Text style={styles.label}>Distance (km)</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={distance} onChangeText={setDistance} placeholder="5.0" />
        </>
      )}

      {type === 'strength' && (
        <>
          <Text style={styles.label}>Sets</Text>
          {sets.map((s, i) => (
            <View key={i} style={styles.setRow}>
              <TextInput style={[styles.input, { flex: 2 }]} placeholder="Exercise" value={s.exercise}
                         onChangeText={(v) => setSets(sets.map((x, j) => (j === i ? { ...x, exercise: v } : x)))} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Reps" keyboardType="numeric" value={s.reps}
                         onChangeText={(v) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: v } : x)))} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="kg" keyboardType="decimal-pad" value={s.weightKg}
                         onChangeText={(v) => setSets(sets.map((x, j) => (j === i ? { ...x, weightKg: v } : x)))} />
            </View>
          ))}
          <TouchableOpacity onPress={() => setSets(sets.concat({ exercise: '', reps: '', weightKg: '' }))}>
            <Text style={styles.link}>+ Add set</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={day} onChangeText={setDay} placeholder="YYYY-MM-DD" />
      {errors.day && <Text style={styles.error}>{errors.day}</Text>}

      <TouchableOpacity style={styles.button} onPress={submit}><Text style={styles.buttonText}>Save workout</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#ef476f' },
  chipText: { textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ddd' },
  setRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  link: { color: '#118ab2', marginTop: 4 },
  error: { color: '#d62828', marginTop: 4 },
  button: { backgroundColor: '#ef476f', padding: 14, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
