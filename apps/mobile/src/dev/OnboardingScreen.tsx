import { ApiError, completeOnboarding, listNeighbourhoods, type Neighbourhood } from '@communitylink/shared';
import { useEffect, useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

function commaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [neighbourhoods, setNeighbourhoods] = useState<Neighbourhood[]>([]);
  const [neighbourhoodId, setNeighbourhoodId] = useState<number | null>(null);
  const [interests, setInterests] = useState('');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listNeighbourhoods(supabase)
      .then(setNeighbourhoods)
      .catch((cause) => {
        setError(cause instanceof ApiError ? cause.message : 'Unable to load neighbourhoods.');
      });
  }, []);

  async function submit() {
    if (neighbourhoodId === null) {
      setError('Please select your neighbourhood.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await completeOnboarding(supabase, {
        neighbourhoodId,
        interests: commaSeparated(interests),
        accessibilityNeeds: commaSeparated(accessibilityNeeds),
        preferredLanguage: 'en',
      });
      await refreshProfile();
      onComplete();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>
          {profile?.display_name ? `Welcome, ${profile.display_name}. ` : ''}
          Complete this step before continuing to the app.
        </Text>

        <Text style={styles.label}>Neighbourhood</Text>
        <View style={styles.options}>
          {neighbourhoods.map((neighbourhood) => (
            <Button
              key={neighbourhood.id}
              title={neighbourhood.name}
              onPress={() => setNeighbourhoodId(neighbourhood.id)}
              color={neighbourhood.id === neighbourhoodId ? '#1565c0' : '#666666'}
            />
          ))}
        </View>

        <Text style={styles.label}>Interests</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. sports, cooking, volunteering"
          value={interests}
          onChangeText={setInterests}
          placeholderTextColor="#666666"
        />

        <Text style={styles.label}>Accessibility needs</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional, separated by commas"
          value={accessibilityNeeds}
          onChangeText={setAccessibilityNeeds}
          placeholderTextColor="#666666"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        <Button title={busy ? 'Saving...' : 'Continue'} onPress={submit} disabled={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1, backgroundColor: '#ffffff' },
  scrollView: { flex: 1, backgroundColor: '#ffffff' },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#000000' },
  subtitle: { color: '#333333', marginBottom: 8 },
  label: { fontWeight: '600', color: '#000000', marginTop: 8 },
  options: { gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 12,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  error: { color: '#b00020' },
});
