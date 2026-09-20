/**
 * Milestone 9.4: Canonical Notification Context & Realtime Synchronization Engine
 * File: frontend/contexts/NotificationContext.tsx
 *
 * Provides single, authoritative frontend state management for NagarSetu notifications:
 * - Direct delegation to NotificationService for all reads and mutations
 * - Single Realtime subscription per authenticated user session with automatic teardown
 * - Optimistic local state updates with authoritative server synchronization
 * - read_at IS NULL semantics (zero is_read)
 * - Centralized modal open/close controls for Navbar and dashboards
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './SupabaseAuthContext';
import {
  NotificationService,
  type Notification,
} from '../../backend/services/notifications';

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  hasMore: boolean;
  openNotificationCenter: () => void;
  closeNotificationCenter: () => void;
  toggleNotificationCenter: () => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const PAGE_SIZE = 25;

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Track current active channel to prevent duplicate subscriptions
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch initial notifications and unread count
  const fetchInitialData = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [items, count] = await Promise.all([
        NotificationService.getNotifications({ limit: PAGE_SIZE, offset: 0 }, supabase),
        NotificationService.getUnreadCount(undefined, supabase),
      ]);

      setNotifications(items);
      setUnreadCount(count);
      setHasMore(items.length === PAGE_SIZE);
    } catch (err) {
      console.error('[NotificationContext] Failed to load notifications:', err);
      setError((err as Error).message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Load more notifications (pagination)
  const loadMore = useCallback(async () => {
    if (!currentUser || loading || !hasMore) return;

    try {
      const offset = notifications.length;
      const nextBatch = await NotificationService.getNotifications(
        { limit: PAGE_SIZE, offset },
        supabase
      );

      if (nextBatch.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const uniqueNew = nextBatch.filter((n) => !existingIds.has(n.id));
          return [...prev, ...uniqueNew];
        });
      }

      setHasMore(nextBatch.length === PAGE_SIZE);
    } catch (err) {
      console.error('[NotificationContext] Failed to load more notifications:', err);
      setError((err as Error).message || 'Failed to load more notifications');
    }
  }, [currentUser, loading, hasMore, notifications.length]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!currentUser) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await NotificationService.markAsRead(notificationId, supabase);
      // Sync authoritative count from database
      const latestCount = await NotificationService.getUnreadCount(undefined, supabase);
      setUnreadCount(latestCount);
    } catch (err) {
      console.error('[NotificationContext] Failed to mark notification as read:', err);
      // Revert/refresh on failure
      fetchInitialData();
    }
  }, [currentUser, fetchInitialData]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser) return;

    const now = new Date().toISOString();
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || now }))
    );
    setUnreadCount(0);

    try {
      await NotificationService.markAllAsRead(supabase);
      // Confirm authoritative count
      const latestCount = await NotificationService.getUnreadCount(undefined, supabase);
      setUnreadCount(latestCount);
    } catch (err) {
      console.error('[NotificationContext] Failed to mark all notifications as read:', err);
      fetchInitialData();
    }
  }, [currentUser, fetchInitialData]);

  // Realtime subscription management (strict single channel, cleanup on user change/unmount)
  useEffect(() => {
    if (!currentUser) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Load initial data
    fetchInitialData();

    // Clean up any stale channel before creating new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `user-notifications:${currentUser.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (!newNotif || !newNotif.id) return;

          setNotifications((prev) => {
            // Deduplicate if already present
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // Authoritatively refresh unread count
          NotificationService.getUnreadCount(undefined, supabase)
            .then((count) => setUnreadCount(count))
            .catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          if (!updated || !updated.id) return;

          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );

          NotificationService.getUnreadCount(undefined, supabase)
            .then((count) => setUnreadCount(count))
            .catch(console.warn);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser, fetchInitialData]);

  const openNotificationCenter = useCallback(() => setIsOpen(true), []);
  const closeNotificationCenter = useCallback(() => setIsOpen(false), []);
  const toggleNotificationCenter = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        isOpen,
        hasMore,
        openNotificationCenter,
        closeNotificationCenter,
        toggleNotificationCenter,
        markAsRead,
        markAllAsRead,
        refresh: fetchInitialData,
        loadMore,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
