import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

/** Dialog Map 5: Administrator shell. Only reachable with the admin role (NFR Access Control). */
export default function AdminLayout() {
  const { hasRole } = useAuth();
  if (!hasRole('admin')) return <Redirect href="/profile" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
