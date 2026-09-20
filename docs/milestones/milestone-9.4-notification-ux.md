# Milestone 9.4: Notification Center & Global Notification UX

## Status: COMPLETE — VERIFIED & LIVE-TESTED

---

## 1. Architectural Overview

Milestone 9.4 delivers the canonical frontend notification user experience for `NagarSetu-Civic`. Built strictly on top of `NotificationService` and Supabase Realtime, it completely eliminates ad-hoc database queries (`public.notifications`) from React components, replacing them with a centralized reactive context (`NotificationContext`) and a notification center modal.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Supabase PostgreSQL Realtime                    │
│      public.notifications (filtered by user_id=eq.${currentUser.id})   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (single subscription per session)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           frontend/contexts/NotificationContext.tsx                    │
│  - Single authoritative state engine for all notifications             │
│  - Strict read_at IS NULL semantics (zero is_read)                     │
│  - Optimistic updates + authoritative sync via NotificationService     │
│  - Realtime INSERT (prepend & newest-first) and UPDATE (in-place sync) │
│  - Automatic channel teardown on unmount / user logout                 │
│  - Modal visibility management (open, close, toggle)                   │
└───────────────┬──────────────────────────────────────┬─────────────────┘
                │                                      │
                ▼                                      ▼
┌───────────────────────────────┐      ┌─────────────────────────────────┐
│  frontend/components/         │      │  frontend/components/           │
│  Navbar.tsx                   │      │  NotificationCenter.tsx         │
│  - Desktop notification bell  │      │  - Filter tabs: All / Unread    │
│  - Mobile top-bar bell        │      │  - Relative timestamps          │
│  - Mobile drawer item         │      │  - Civic lifecycle badges       │
│  - Unread badge (hidden at 0) │      │  - Item & bulk mark-as-read     │
│  - 99+ formatting             │      │  - Issue navigation             │
└───────────────────────────────┘      └─────────────────────────────────┘
```

---

## 2. Core Implementation Components

### 2.1 `NotificationContext` (`frontend/contexts/NotificationContext.tsx`)
- **API Delegation:** Directly delegates all data fetching, unread counting, mark-as-read, and mark-all-read operations to `NotificationService`.
- **State Properties:**
  - `notifications: Notification[]`: Newest-first list of notifications.
  - `unreadCount: number`: Strict count of notifications where `read_at IS NULL`.
  - `loading: boolean`, `error: string | null`, `isOpen: boolean`, `hasMore: boolean`.
- **Methods:**
  - `openNotificationCenter()`, `closeNotificationCenter()`, `toggleNotificationCenter()`.
  - `markAsRead(notificationId: string)`: Optimistic read status update + server RPC invocation.
  - `markAllAsRead()`: Optimistic batch update + server RPC invocation.
  - `loadMore()`: Offset-based pagination appending non-duplicate items.
  - `refresh()`: Full authoritative refetch and error recovery.
- **Realtime Synchronization:**
  - Establishes a single channel: `user-notifications:${currentUser.id}`.
  - Subscribes with filter: `user_id=eq.${currentUser.id}` for both `INSERT` and `UPDATE` events.
  - Guarantees deduplication on incoming `INSERT` payloads.
  - Preserves newest-first ordering by prepending new events to position 0.
  - Cleans up active channels and resets state on user logout or session switch.

### 2.2 `NotificationCenter` (`frontend/components/NotificationCenter.tsx`)
- **Design & Layout:**
  - Elegant modal with backdrop blur and responsive card container.
  - Unread notification count badge in header.
  - "Mark all read" header action (dynamically shown when unread count > 0).
  - Filter tabs: **"All (count)"** and **"Unread (count)"**.
- **Civic Type Badging & Icons:**
  - All 11 civic lifecycle types + `system` mapped to distinctive icons and color tokens:
    - `issue_submitted` (FileText / Blue / "Submitted")
    - `issue_verified` (CheckCheck / Teal / "Verified")
    - `issue_assigned` (UserCheck / Indigo / "Assigned")
    - `issue_reassigned` (RefreshCw / Purple / "Reassigned")
    - `issue_in_progress` (PlayCircle / Amber / "In Progress")
    - `issue_resolved` (CheckCircle2 / Emerald / "Resolved")
    - `issue_rejected` (XCircle / Rose / "Rejected")
    - `issue_escalated` (AlertTriangle / Orange / "Escalated")
    - `feedback_received` (MessageSquareHeart / Pink / "Feedback")
    - `issue_upvoted` (ThumbsUp / Sky / "Upvoted")
    - `issue_commented` (MessageCircle / Cyan / "Commented")
    - `system` (Info / Slate / "System")
- **Read / Unread Styling:**
  - Unread: Left accent border (`border-l-blue-600`), soft background tint (`bg-blue-50/40`), bold title, individual mark-as-read check button.
  - Read: Transparent accent border, standard background, regular font weight.
- **Issue Navigation:**
  - Clicking any notification linked to an `issue_id` automatically marks the notification as read, closes the modal, and navigates directly to `/issues/${issue_id}`.
  - Notifications without `issue_id` (e.g., system announcements) are marked as read in place without triggering route navigation.
- **Empty & Error States:**
  - Loading spinner with status message.
  - Distinct empty states for "All" vs "Unread" filters.
  - Error banner with "Retry" action calling `refresh()`.
- **Pagination:**
  - "Load earlier notifications" button appears when `hasMore` is true.

### 2.3 Global Navbar Integration (`frontend/components/Navbar.tsx`)
- **Desktop Action Bar:**
  - Notification bell with unread badge counter (`#navbar-notification-bell`, `#navbar-notification-badge`).
  - Badge is strictly hidden when `unreadCount === 0`.
  - Badge displays `99+` for large counts.
  - Accessible `aria-label` with dynamic unread count.
- **Mobile Responsive Support:**
  - Mobile top-bar bell icon with unread badge (`#navbar-mobile-top-bell`, `#navbar-mobile-top-badge`) right next to the menu hamburger button.
  - Mobile drawer row (`#navbar-mobile-notification-drawer-btn`) with unread badge count.
- **Global Mounting:**
  - `<NotificationProvider>` mounted within `<AuthProvider>` and `<LocationProvider>` in `frontend/App.tsx`.
  - Single global `<NotificationCenter />` mounted inside `BrowserRouter`, accessible from any page, route, or dashboard.

---

## 3. Security & Domain Compliance

1. **Zero Direct Component Queries:**
   - Audited the entire frontend codebase: zero direct `.from('notifications')` queries or mutations exist in React components.
   - All interactions go through `NotificationContext` which calls canonical `NotificationService`.
2. **Canonical Unread Semantics:**
   - Unread evaluation is strictly `read_at IS NULL`.
   - Zero references to legacy `is_read` column exist in frontend code.
3. **Channel Isolation & Anti-Leakage:**
   - Realtime channels are isolated to `user-notifications:${userId}` with server filter `user_id=eq.${userId}`.
   - Cross-user retrieval and tampering remain prohibited by PostgreSQL Row-Level Security and anti-tampering triggers.

---

## 4. Verification Suite Results

### 4.1 Frontend Integration Test Suite
Command: `npm run test:frontend:notifications`
- **Total Tests:** 14
- **Passed:** 14
- **Failed:** 0

| Test # | Test Case Description | Result |
| :--- | :--- | :--- |
| 1 | Notification List Loading and Ordering (Newest-First) | ✅ PASS |
| 2 | Empty State Handling (Zero notifications) | ✅ PASS |
| 3 | Strict read_at IS NULL Unread Evaluation (Zero is_read) | ✅ PASS |
| 4 | Mark Single Notification as Read | ✅ PASS |
| 5 | Mark All Notifications as Read | ✅ PASS |
| 6 | Realtime INSERT Event Handling (Prepending & Count Update) | ✅ PASS |
| 7 | Realtime UPDATE Event Handling (In-Place State Sync) | ✅ PASS |
| 8 | Duplicate Event Protection (Deduplication) | ✅ PASS |
| 9 | Realtime Subscription Cleanup on Logout / Unmount | ✅ PASS |
| 10 | Navigation on Notification Click (Issue vs System) | ✅ PASS |
| 11 | Cross-User Channel Filter Isolation | ✅ PASS |
| 12 | Civic Lifecycle Notification Types Coverage (11 Types + System) | ✅ PASS |
| 13 | Pagination Support (loadMore and hasMore) | ✅ PASS |
| 14 | Error Handling and Retry Recovery | ✅ PASS |

### 4.2 Backend Notification & Lifecycle Suites
- `npm run test:notifications:service`: **26/26 PASS**
- `npm run test:notifications:db`: **14/14 PASS**
- `npm run test:notifications:lifecycle`: **20/20 PASS**

### 4.3 Full System Regression Suites
- `npm run test:auth`: **16/16 PASS**
- `npm run test:issues`: **9/9 PASS**
- `npm run test:issues:get`: **23/23 PASS**
- `npm run test:issues:detail`: **16/16 PASS**
- `npm run test:issues:transition`: **10/10 PASS**
- `npm run test:issues:geo`: **14/14 PASS**
- `npm run test:issues:upvote`: **9/9 PASS**
- `npm run test:issues:comment`: **10/10 PASS**
- `npm run test:validators`: **PASS**
- `npm run test:workers:assign`: **10/10 PASS**
- `npm run test:storage`: **25/25 PASS**
- `npm run test:frontend:auth`: **9/9 PASS**

### 4.4 Code Quality & Build Checks
- `npm run type-check`: **Zero errors**
- `npm run lint`: **Zero errors** (10 warnings on pre-existing component exports)
- `npm run build`: **Production bundle built in 6.69s**

### 4.5 Live Remote Supabase Verification
Executed against remote Supabase (`rhqeubludshvmncaclki.supabase.co`) with test credentials:
- Admin created live system notification via `create_system_notification` RPC.
- Citizen retrieved unread notification via `NotificationService.getNotifications`.
- Citizen verified `read_at === null` and initial unread count.
- Citizen marked notification read via `NotificationService.markAsRead`. Verified `read_at` timestamp.
- Citizen marked all read via `NotificationService.markAllAsRead`. Verified unread count = 0.
- Cleaned up test notification row; verified zero orphan rows in remote database.
