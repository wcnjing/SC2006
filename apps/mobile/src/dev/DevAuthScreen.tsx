// TEMPORARY: bare-bones login/register so the auth flow can be tested end to
// end. Summer replaces this with the real designed screens; keep using
// useAuth() and the logic carries over unchanged.
import { ApiError } from '@communitylink/shared';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export function DevAuthScreen() {
  const { signIn, signUp, signedOutReason } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signIn({ email, password });
      } else {
        await signUp({ email, password, displayName });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CommunityLink</Text>
      {signedOutReason && <Text style={styles.notice}>{signedOutReason}</Text>}

      {mode === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          accessibilityLabel="Display name"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        onPress={submit}
        disabled={busy}
      />
      <Button
        title={mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  notice: { backgroundColor: '#fff4e5', padding: 12, borderRadius: 8 },
  error: { color: '#b00020' },
});
