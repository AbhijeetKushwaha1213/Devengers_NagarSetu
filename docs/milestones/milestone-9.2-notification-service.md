# Milestone 9.2: Notification Service & Recipient Resolution Engine

## Status: COMPLETE — LIVE VERIFIED

---

## 1. Architecture Overview

Milestone 9.2 establishes the trusted backend/domain layer for NagarSetu civic notifications. It builds on the database foundation from Milestone 9.1 (`public.notifications`, RLS policies, anti-tampering triggers, and database procedures).

```
┌────────────────────────────────────────────────────────┐
│             Milestone 9.3: Civic Lifecycle Events      │
│     (Issue submission, status changes, assignments)    │
└───────────────────────────┬────────────────────────────┘
                            │ (dispatches event context)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   RecipientResolver                    │
│  - Authoritative stakeholder routing matrix            │
│  - Strict jurisdiction isolation (Urban vs. Rural)     │
│  - Actor exclusion & deterministic deduplication       │
│  - Active account validation                           │
└───────────────────────────┬────────────────────────────┘
                            │ (resolved recipient UUIDs)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  NotificationService                   │
│  - Validates payloads (UUIDs, types, size bounding)   │
│  - Invokes create_system_notification() RPC           │
│  - Recipient-scoped retrieval & unread counts          │
│  - markAsRead & markAllAsRead operations              │
│  - Isolated error handling for batch dispatches       │
└───────────────────────────┬────────────────────────────┘
                            │ (calls SECURITY DEFINER RPCs)
                            ▼
┌────────────────────────────────────────────────────────┐
│          PostgreSQL Database Foundation (9.1/9.2)      │
│  - public.notifications (canonical read_at TIMESTAMPTZ)│
│  - Anti-tampering trigger (trigger_prevent_tampering)  │
│  - RLS: No direct client INSERT, own SELECT/UPDATE    │
│  - Supabase Realtime publication                       │
└────────────────────────────────────────────────────────┘
```

---

## 2. NotificationService Contract

The canonical service exposes six backend methods:

### `NotificationService.createNotification(input, client)`
- Validates all input fields via domain validator:
  - Valid recipient UUID
  - Optional valid issue UUID
  - Controlled `NotificationType`
  - Non-empty, trimmed title (max 200 chars)
  - Non-empty, trimmed message (max 2000 chars)
  - Bounded payload size (max 10 KB)
- Invokes trusted `create_system_notification(...)` RPC.
- Returns canonical `Notification` domain object.

### `NotificationService.getNotifications(params, client)`
- Derives authenticated identity from `auth.getUser()`.
- Strictly enforces caller isolation: passing a `userId` that does not match `auth.uid()` throws `NotificationUnauthorized`.
- Filters `unreadOnly` using `read_at IS NULL` (zero `is_read`).
- Applies deterministic pagination and sorting (`ORDER BY created_at DESC, id DESC`).

### `NotificationService.getUnreadCount(params, client)`
- Evaluates `read_at IS NULL` exclusively.
- Scoped to authenticated caller.

### `NotificationService.markAsRead(notificationId, client)`
- Wraps `mark_notification_read(p_notification_id)` RPC.
- Handles already-read notifications idempotently.
- Throws `NotificationUnauthorized` if attempting to mark another user's notification.

### `NotificationService.markAllAsRead(client)`
- Invokes `mark_all_notifications_read()` RPC (with direct authenticated update fallback).
- Updates only rows where `user_id = auth.uid() AND read_at IS NULL`.

### `NotificationService.dispatch(event, template, client)`
- Coordinates `RecipientResolver` and `createNotification`.
- Implements isolated error handling: failure to dispatch to one recipient does not fail the batch.
- Returns `{ totalRecipients, sent, failed }`.

---

## 3. RecipientResolver Contract & Domain Model

The resolver determines **WHO** receives a notification from civic event context:

```typescript
export interface NotificationEvent {
  issueId: string;
  eventType: NotificationType;
  actorId?: string | null;
}
```

Key invariant: **Routing is strictly derived from verified database records.** Frontend-supplied jurisdiction IDs are never trusted.

---

## 4. Recipient-Routing Matrix

| Event Type | Candidate Recipients | Authority Scope | Isolation & Exclusions |
| :--- | :--- | :--- | :--- |
| `issue_submitted` | Reporter, Municipal Admin OR Pradhan/Worker, Administrator | Urban: `issues.municipality_id` == `profiles.municipality_id`<br>Rural: `issues.panchayat_id` == `profiles.panchayat_id` | Cross-jurisdiction strictly excluded.<br>Actor excluded.<br>Inactive users excluded. |
| `issue_verified` | Reporter | Central Administrator / Authority | Unassigned workers not notified.<br>Actor excluded. |
| `issue_assigned` | Reporter, Assigned Worker (`issues.assigned_worker_id`) | Scoped to assigned worker only | Other workers strictly excluded.<br>Actor excluded. |
| `issue_reassigned`| Reporter, New Assigned Worker | Scoped to assigned worker | Other workers strictly excluded.<br>Actor excluded.<br>Deduplicated. |
| `issue_in_progress`| Reporter, Assigned Worker | Authority if escalated | Actor excluded. |
| `issue_resolved` | Reporter, Assigned Worker | Authority | Actor excluded. |
| `issue_rejected` | Reporter, Assigned Worker, Authority | Scoped to jurisdiction | Actor excluded. |
| `issue_escalated` | Reporter, Assigned Worker, Municipal Admin OR Pradhan, Administrator | Scoped strictly to jurisdiction | Cross-jurisdiction excluded.<br>Actor excluded. |
| `feedback_received`| Assigned Worker, Municipal Admin OR Pradhan, Administrator | Scoped to jurisdiction | Submitting citizen actor excluded from self-notification. |
| `issue_upvoted` | Reporter | N/A | Upvoter excluded. |
| `issue_commented` | Reporter, Assigned Worker | N/A | Comment author excluded. |
| `system` | Specified recipient / authorities | Scoped to jurisdiction | Dedicated system notifications. |

---

## 5. Security Model & Boundaries

1. **Zero Client INSERT**: `public.notifications` has no permissive INSERT policies. All creations route through `create_system_notification()`.
2. **Authority Enforcement**: `create_system_notification()` verifies caller role in database. Ordinary citizens and community members are prohibited from arbitrary system notification injection.
3. **Anti-Tampering Trigger**: `trigger_prevent_notification_tampering` prevents mutation of `id`, `user_id`, `issue_id`, `title`, `message`, `type`, `channels`, and timestamps on update. Only `read_at` (and `delivery_status`) may change.
4. **Cross-User Protection**:
   - `SELECT` strictly filtered by RLS: `auth.uid() = user_id`.
   - `UPDATE` strictly filtered by RLS: `auth.uid() = user_id`.
   - `mark_notification_read` checks `v_notification.user_id = auth.uid()`.
5. **No `is_read`**: Database and domain layer strictly rely on `read_at IS NULL` (unread) and `read_at IS NOT NULL` (read).

---

## 6. Error Handling

Domain exceptions extend `NotificationError`:
- `NotificationRecipientNotFound` (404)
- `NotificationIssueNotFound` (404)
- `NotificationValidationError` (400)
- `NotificationUnauthorized` (403/401)
- `NotificationDispatchError` (500)

Errors are never swallowed silently.

---

## 7. Idempotency Limitation (Milestone Boundary)

Milestone 9.2 focuses on service contracts and recipient resolution. Deduplication within a single resolution call is fully enforced. However, distributed event-level deduplication across independent network retries requires event IDs or an events inbox table, which is scheduled for Milestone 9.3 lifecycle integration.

---

## 8. Test Results

### Dedicated Suite: `tests/backend/notifications/notificationService.test.ts`
All 26 required test cases pass:

```
===============================================================
🧪 MILESTONE 9.2: NOTIFICATION SERVICE & RECIPIENT RESOLVER
===============================================================

--- SECTION A: NotificationService Contract Tests ---
[✅ PASS] Test 1: create valid notification
[✅ PASS] Test 2: invalid recipient rejected
[✅ PASS] Test 3: nonexistent issue rejected
[✅ PASS] Test 4: invalid type rejected
[✅ PASS] Test 5: empty title rejected
[✅ PASS] Test 6: empty message rejected
[✅ PASS] Test 7: successful retrieval
[✅ PASS] Test 8: unread count
[✅ PASS] Test 9: mark as read
[✅ PASS] Test 10: already-read notification
[✅ PASS] Test 11: cross-user retrieval denied

--- SECTION B: RecipientResolver Domain Tests ---
[✅ PASS] Test 12: citizen reporter resolved
[✅ PASS] Test 13: assigned worker resolved
[✅ PASS] Test 14: municipal authority resolved only within municipality
[✅ PASS] Test 15: panchayat authority resolved only within panchayat
[✅ PASS] Test 16: unrelated municipality excluded
[✅ PASS] Test 17: unrelated panchayat excluded
[✅ PASS] Test 18: inactive users excluded where required
[✅ PASS] Test 19: duplicate recipients deduplicated
[✅ PASS] Test 20: actor exclusion behavior verified

--- SECTION C: Security & Remote Database Verification Tests ---
[✅ PASS] Test 21: citizen cannot dispatch arbitrary system notification
[✅ PASS] Test 22: client cannot directly INSERT notifications
[✅ PASS] Test 23: user cannot read another user's notifications
[✅ PASS] Test 24: user cannot modify notification content
[✅ PASS] Test 25: user cannot change recipient
[✅ PASS] Test 26: mark-as-read cannot affect another user's notification

--- Cleaning up live test-created notifications ---
Cleaned up 1 test notification(s).

===============================================================
📊 TEST SUMMARY: Total: 26 | Passed: 26 | Failed: 0
🎉 ALL 26/26 NOTIFICATION SERVICE TESTS PASSED!
===============================================================
```

### Milestone 9.1 Database Security Regression:
- `npm run test:notifications:db`: 14/14 tests PASSED.

### Full System Regression Suite:
- `npm run test:auth`: 16/16 PASSED
- `npm run test:issues`: 9/9 PASSED
- `npm run test:issues:get`: 23/23 PASSED
- `npm run test:issues:detail`: 16/16 PASSED
- `npm run test:issues:transition`: 10/10 PASSED
- `npm run test:workers:assign`: 10/10 PASSED
- `npm run test:issues:geo`: 14/14 PASSED
- `npm run test:storage`: 25/25 PASSED
- `npm run test:validators`: All PASSED
- `npm run test:issues:upvote`: 9/9 PASSED
- `npm run test:issues:comment`: 10/10 PASSED
- `npm run type-check`: 0 errors
- `npm run lint`: 0 errors
- `npm run build`: Production bundle built in 6.51s

---

## 9. Live Verification

Live tests against remote Supabase (`rhqeubludshvmncaclki.supabase.co`):
1. **Creation**: Admin created system notification via RPC with real timestamps.
2. **Authority Isolation**: Citizen RPC injection was rejected with `Permission denied: citizens cannot dispatch arbitrary system notifications`.
3. **Direct INSERT**: Blocked by Postgres RLS policy (`violates row-level security policy for table "notifications"`).
4. **Cross-User Reads**: Worker client unable to view citizen notifications (RLS filtered to 0 rows).
5. **Anti-Tampering**: Citizen attempt to alter notification title rejected with `Cannot modify notification title`.
6. **Recipient Integrity**: Citizen attempt to reassign recipient rejected with `Cannot modify notification user_id`.
7. **Cross-User Mark-as-Read**: Worker attempt to mark citizen notification rejected with `Permission denied: cannot mark another user's notification as read`.
8. **Residue Cleanup**: All live test rows cleanly deleted after execution.

---

## 10. Remaining Gaps for Milestone 9.3

Milestone 9.2 intentionally leaves the following for future milestones:
1. **Lifecycle Event Hooks (Milestone 9.3)**:
   - Integrating `NotificationService.dispatch` into `IssueService.createIssue()`
   - Integrating into `IssueService.transitionStatus()`
   - Integrating into `WorkerService.assignWorker()`
   - Integrating into `IssueService.submitFeedback()`
   - Integrating into `IssueService.addComment()`
2. **Frontend UI Integration (Milestone 9.4)**:
   - Refactoring `NotificationCenter.tsx` to consume `NotificationService.getNotifications()`
   - Updating unread badge counter on `Navbar.tsx` and `CitizenDashboard.tsx`
   - Cleaning up direct client inserts in `CitizenFeedbackModal.tsx`
3. **External Delivery Channels**: Email, SMS, WhatsApp, and Push delivery adapters.
