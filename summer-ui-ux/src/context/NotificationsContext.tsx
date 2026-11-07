import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import {
  createActivityReminders,
  listNotifications,
  markNotificationRead,
  subscribeToNotifications,
  type AppNotification,
} from '@/services/notifications';

type NotificationsValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  markRead: (notification: AppNotification) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();

  const refresh = useCallback(async () => {
    if (!session) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      await createActivityReminders();
      setNotifications(await listNotifications());
    } catch (nextError) {
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeToNotifications(session?.account.accountId, () => void refresh());
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      unsubscribe?.();
      foreground.remove();
    };
  }, [refresh]);

  const markRead = useCallback(async (notification: AppNotification) => {
    if (notification.read_at) return;
    await markNotificationRead(notification.id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read_at).length,
      loading,
      error,
      refresh,
      markRead,
    }),
    [notifications, loading, error, refresh, markRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return context;
}
