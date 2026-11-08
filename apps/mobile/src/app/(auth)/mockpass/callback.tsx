import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/SettingsContext';

/**
 * Return point for Xavier's Mockpass bridge (services/mockpass-auth). After
 * the user consents in Mockpass, the bridge redirects to
 * communitylink://mockpass/callback?access_token=…&refresh_token=…
 * (or http://localhost:8081/mockpass/callback on web). We hand the tokens to
 * Supabase; the root guard then routes to Home, or to Complete Your Profile
 * for a new user. Any failure → back to Login with the FR 1.3.6 error.
 */
export default function MockpassCallbackScreen() {
  const t = useT();
  const { completeSingpass } = useAuth();
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fail = () => router.replace({ pathname: '/login', params: { error: 'singpass' } });
    if (!params.access_token || !params.refresh_token) return fail();
    completeSingpass({
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
    }).catch(fail);
  }, [params.access_token, params.refresh_token, completeSingpass]);

  return (
    <Screen>
      <LoadingState label={t('singpass.completing')} />
    </Screen>
  );
}
