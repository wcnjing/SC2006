import type { Notification } from '@communitylink/shared';

import { supabase } from '@/lib/supabase';

export type AppNotification = Notification;

export async function listNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function createActivityReminders(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('create_activity_reminders');
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export function subscribeToNotifications(
  userId: string | undefined,
  onChange: () => void,
): (() => void) | null {
  if (!supabase || !userId) return null;
  const client = supabase;
  const channel = client
    .channel('user-notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToConversation(
  userId: string | undefined,
  peerId: string,
  onChange: () => void,
): (() => void) | null {
  if (!supabase || !userId) return null;
  const client = supabase;
  const channel = client
    .channel(`conversation:${userId}:${peerId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${peerId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
