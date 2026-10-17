import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  CommunityButton,
  CommunityError,
  communityStyles as styles,
} from '../community/communityUi';
import { colors, spacing } from '../theme/tokens';
import { DEMO_ACCOUNTS, getDemoBackend } from './demoBackend';
import { can } from '@communitylink/shared';

export function DemoBanner() {
  const { profile, signOut } = useAuth();
  return (
    <View style={{ padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.infoSoft }}>
      <Text style={styles.label}>Demo mode · Data stays in this browser</Text>
      {profile && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Text style={styles.body}>Signed in as {profile.display_name}</Text>
          <Link href="/community" style={styles.label}>
            Community feed
          </Link>
          <CommunityButton label="Switch demo resident" onPress={() => void signOut()} secondary />
        </View>
      )}
    </View>
  );
}

export function DemoWelcomeScreen() {
  const { signIn, signOut, signedOutReason } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enter(email: string) {
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password: 'demo-only' });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to open the demo.');
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setError(null);
    try {
      getDemoBackend().reset();
      await signOut('Demo data reset. Choose a resident to begin.');
    } catch {
      setError('Unable to reset demo data. Check that browser storage is enabled.');
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        Try CommunityLink
      </Text>
      <Text style={styles.body}>
        Choose a demo resident to try creating, editing and deleting posts. No account setup is
        needed.
      </Text>
      {signedOutReason && <Text style={styles.body}>{signedOutReason}</Text>}
      {DEMO_ACCOUNTS.map((account) => (
        <CommunityButton
          key={account.email}
          label={`Continue as ${account.profile.display_name}`}
          onPress={() => void enter(account.email)}
          disabled={busy}
        />
      ))}
      {error && <CommunityError>{error}</CommunityError>}
      <Text style={styles.muted}>
        Demo posts, comments, likes and reports persist after refresh. Resetting clears this demo
        data.
      </Text>
      <CommunityButton
        label="Reset demo data"
        onPress={() => void reset()}
        disabled={busy}
        secondary
      />
    </ScrollView>
  );
}

export function DemoHomeScreen() {
  const { profile } = useAuth();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        Hi, {profile?.display_name}
      </Text>
      <Text style={styles.body}>
        Open the community feed, choose a neighbourhood and publish your first post.
      </Text>
      <CommunityButton label="Open community feed" onPress={() => router.push('/community')} />
      <CommunityButton label="Connections" onPress={() => router.push('/connections')} secondary />
      <CommunityButton label="Messages" onPress={() => router.push('/messages')} secondary />
      {can(profile, 'report:review') && (
        <CommunityButton
          label="Admin moderation"
          onPress={() => router.push('/admin/moderation')}
          secondary
        />
      )}
      <Text style={styles.muted}>
        Try switching residents to check which posts you can edit. Bedok starts with an empty feed.
      </Text>
    </ScrollView>
  );
}
