/**
 * Milestone 9.4: Production Notification Center Modal
 * File: frontend/components/NotificationCenter.tsx
 *
 * Implements the civic notification experience:
 * - Powered strictly by canonical NotificationService via useNotifications()
 * - Zero direct public.notifications queries or mutations
 * - Dynamic type badges and icons for all civic lifecycle events
 * - Newest-first ordering, relative timestamps, read/unread visual styling
 * - Filter tabs ("All" / "Unread")
 * - Single item & bulk mark-as-read
 * - Direct navigation to /issues/:id with automatic read marking
 * - Loading, empty, and error-recovery states
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MessageSquareHeart,
  ThumbsUp,
  MessageCircle,
  Info,
  FileText,
  UserCheck,
  ArrowRight,
  RotateCw,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import type { Notification, NotificationType } from '../../backend/services/notifications';

export interface NotificationCenterProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function NotificationCenter(props: NotificationCenterProps) {
  const navigate = useNavigate();
  const context = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const isOpen = props.isOpen !== undefined ? props.isOpen : context.isOpen;
  const handleClose = () => {
    props.onClose?.();
    context.closeNotificationCenter();
  };

  const {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    refresh,
    loadMore,
  } = context;

  if (!isOpen) return null;

  const displayedNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  const getTypeConfig = (type: NotificationType | string | undefined) => {
    switch (type) {
      case 'issue_submitted':
        return {
          label: 'Submitted',
          icon: <FileText className="h-4 w-4 text-blue-500" />,
          badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        };
      case 'issue_verified':
        return {
          label: 'Verified',
          icon: <CheckCheck className="h-4 w-4 text-teal-500" />,
          badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
        };
      case 'issue_assigned':
        return {
          label: 'Assigned',
          icon: <UserCheck className="h-4 w-4 text-indigo-500" />,
          badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
        };
      case 'issue_reassigned':
        return {
          label: 'Reassigned',
          icon: <RefreshCw className="h-4 w-4 text-purple-500" />,
          badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
        };
      case 'issue_in_progress':
        return {
          label: 'In Progress',
          icon: <PlayCircle className="h-4 w-4 text-amber-500" />,
          badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        };
      case 'issue_resolved':
        return {
          label: 'Resolved',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
        };
      case 'issue_rejected':
        return {
          label: 'Rejected',
          icon: <XCircle className="h-4 w-4 text-rose-500" />,
          badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
        };
      case 'issue_escalated':
        return {
          label: 'Escalated',
          icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
          badgeBg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
        };
      case 'feedback_received':
        return {
          label: 'Feedback',
          icon: <MessageSquareHeart className="h-4 w-4 text-pink-500" />,
          badgeBg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
        };
      case 'issue_upvoted':
        return {
          label: 'Upvoted',
          icon: <ThumbsUp className="h-4 w-4 text-sky-500" />,
          badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
        };
      case 'issue_commented':
        return {
          label: 'Commented',
          icon: <MessageCircle className="h-4 w-4 text-cyan-500" />,
          badgeBg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
        };
      case 'system':
        return {
          label: 'System',
          icon: <Info className="h-4 w-4 text-slate-500" />,
          badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        };
      default:
        return {
          label: 'Notice',
          icon: <Info className="h-4 w-4 text-blue-500" />,
          badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        };
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // If unread, mark as read
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    // If linked to an issue, close modal and navigate to issue detail
    if (notification.issue_id) {
      handleClose();
      navigate(`/issues/${notification.issue_id}`);
    }
  };

  return (
    <div
      id="notification-center-overlay"
      className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-center-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <Card
        id="notification-center-modal"
        className="relative w-full max-w-md max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden shadow-2xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl z-10"
      >
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle id="notification-center-title" className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Notifications
              </CardTitle>
            </div>
            {unreadCount > 0 && (
              <Badge
                id="notification-center-unread-badge"
                variant="destructive"
                className="ml-1 text-xs px-2 py-0.5 rounded-full font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {unreadCount} new
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {unreadCount > 0 && (
              <Button
                id="mark-all-read-btn"
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 h-8"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              id="notification-center-close-btn"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="p-1.5 h-8 w-8 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Filter Tabs */}
        <div className="flex items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 gap-2 text-xs font-medium">
          <button
            id="filter-tab-all"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            id="filter-tab-unread"
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
            <span className="truncate mr-2">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="h-6 text-[11px] px-2 border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <RotateCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Notification List Content */}
        <CardContent className="p-0 overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-800">
          {loading && notifications.length === 0 ? (
            <div className="py-12 px-4 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-600 border-t-transparent mx-auto mb-3" />
              <p className="text-sm font-medium">Loading notifications...</p>
              <p className="text-xs text-gray-400 mt-1">Checking for civic updates</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="py-12 px-6 text-center text-gray-500 dark:text-gray-400">
              <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-3 text-blue-500">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                {filter === 'unread'
                  ? 'You have addressed all your unread civic alerts.'
                  : 'Updates on your reported and assigned civic issues will appear here in real time.'}
              </p>
            </div>
          ) : (
            displayedNotifications.map((notification) => {
              const isUnread = !notification.read_at;
              const typeCfg = getTypeConfig(notification.type);

              return (
                <div
                  key={notification.id}
                  id={`notification-item-${notification.id}`}
                  onClick={() => handleNotificationClick(notification)}
                  className={`relative p-3.5 sm:p-4 cursor-pointer transition-all duration-150 flex items-start gap-3 text-left ${
                    isUnread
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/35 border-l-4 border-l-blue-600'
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60 border-l-4 border-l-transparent opacity-85 hover:opacity-100'
                  }`}
                >
                  {/* Type Icon */}
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white dark:bg-gray-800 shadow-2xs border border-gray-100 dark:border-gray-700/60">
                    {typeCfg.icon}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0 ${typeCfg.badgeBg}`}
                        >
                          {typeCfg.label}
                        </span>
                        <h4
                          className={`text-xs sm:text-sm truncate text-gray-900 dark:text-gray-100 ${
                            isUnread ? 'font-bold' : 'font-medium'
                          }`}
                        >
                          {notification.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                          {formatTimestamp(notification.created_at)}
                        </span>
                        {isUnread && (
                          <button
                            title="Mark as read"
                            aria-label="Mark as read"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors ml-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>

                    {notification.issue_id && (
                      <div className="mt-2 flex items-center text-[11px] font-semibold text-blue-600 dark:text-blue-400 gap-1 group">
                        <span>View Issue</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination: Load More */}
          {filter === 'all' && hasMore && (
            <div className="p-3 text-center bg-gray-50/60 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800">
              <Button
                id="notification-load-more-btn"
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline h-8 px-4"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Loading more...' : 'Load earlier notifications'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}