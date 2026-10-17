// Explicit opt-in only. A Supabase error must never silently enable demo mode.
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
