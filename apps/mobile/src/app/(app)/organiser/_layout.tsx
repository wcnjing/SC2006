import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

/** Dialog Map 4: Organiser shell. Only reachable with the organiser role (NFR Access Control). */
export default function OrganiserLayout() {
  const { hasRole } = useAuth();
  if (!hasRole('organiser')) return <Redirect href="/profile" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
