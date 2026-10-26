import { hasRole, listMyActivityCollections } from '@communitylink/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { ActivityButton, activityStyles } from '../../activities/activityTheme';
import { useActivityQuery } from '../../activities/useActivityQuery';
import { supabase } from '../../lib/supabase';

const loadCollections = () => listMyActivityCollections(supabase);
const tabs = ['saved', 'joined', 'history'] as const;
const labels = { saved: 'Saved', joined: 'Joined', history: 'History' };
const empty = {
  saved: 'You have no saved activities.',
  joined: 'You have no upcoming joined activities.',
  history: 'You have no retained past registrations.',
};

export default function ResidentMyActivities() {
  const { profile, session, loading } = useAuth();
  if (loading) return <ActivityIndicator accessibilityLabel="Loading your account" />;
  if (!session || profile?.id !== session.user.id || !hasRole(profile, 'resident'))
    return (
      <View style={activityStyles.page}>
        <Link href="/" style={activityStyles.link}>
          Back to activities
        </Link>
        <Text accessibilityRole="alert">An active resident account is required.</Text>
      </View>
    );
  return <ResidentCollections key={profile.id} />;
}

function ResidentCollections() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('saved');
  const { data, loading, error, retry } = useActivityQuery(loadCollections);
  return (
    <ScrollView contentContainerStyle={activityStyles.page}>
      <Link href="/" style={activityStyles.link}>
        Back to activities
      </Link>
      <Text accessibilityRole="header" style={activityStyles.title}>
        My Activities
      </Text>
      <View style={activityStyles.row} accessibilityRole="tablist">
        {tabs.map((value) => (
          <ActivityButton
            key={value}
            title={labels[value]}
            color={tab === value ? '#075ca8' : '#555'}
            accessibilityLabel={`${labels[value]}${tab === value ? ', selected' : ''}`}
            onPress={() => setTab(value)}
          />
        ))}
      </View>
      <ActivityButton title="Refresh my activities" onPress={retry} disabled={loading} />
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading my activities" />
      ) : error ? (
        <View style={activityStyles.card}>
          <Text accessibilityRole="alert">{error}</Text>
          <ActivityButton title="Retry my activities" onPress={retry} />
        </View>
      ) : !data?.[tab].length ? (
        <Text accessibilityLiveRegion="polite">{empty[tab]}</Text>
      ) : (
        data[tab].map(({ activity, saved, joined }) => (
          <View key={activity.id} style={activityStyles.card}>
            <Link
              href={{ pathname: '/activities/[id]', params: { id: activity.id } }}
              style={activityStyles.heading}
            >
              {activity.title}
            </Link>
            <Text style={activityStyles.body}>
              Starts:{' '}
              {new Date(activity.starts_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}{' '}
              (Singapore)
            </Text>
            <Text style={activityStyles.body}>Location: {activity.location_name}</Text>
            <Text style={activityStyles.body}>Status: {activity.status}</Text>
            <View style={activityStyles.row}>
              <Text style={activityStyles.badge}>Saved: {saved ? 'Yes' : 'No'}</Text>
              <Text style={activityStyles.badge}>Joined: {joined ? 'Yes' : 'No'}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
