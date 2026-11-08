import { Redirect } from 'expo-router';

import OrganiserDashboardScreen from '../organiser/index';
import { useAuth } from '@/context/AuthContext';

/** Organiser-only Dashboard tab: the organiser dashboard inside the tab bar. */
export default function DashboardTab() {
  const { hasRole } = useAuth();
  if (!hasRole('organiser')) return <Redirect href="/" />;
  return <OrganiserDashboardScreen />;
}
