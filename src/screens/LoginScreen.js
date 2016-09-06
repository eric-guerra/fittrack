import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../services/firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [error, setError] = useState(null);

  const submit = () => {
    setError(null);
    (mode === 'signin' ? api.signIn(email.trim(), password) : api.signUp(email.trim(), password))
      .catch((e) => setError(e.message));
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>FitTrack</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={submit}>
        <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text style={styles.link}>{mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8f9fa' },
  brand: { fontSize: 36, fontWeight: '800', color: '#ef476f', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  error: { color: '#d62828', marginBottom: 8 },
  button: { backgroundColor: '#ef476f', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#118ab2', textAlign: 'center', marginTop: 16 }
});
