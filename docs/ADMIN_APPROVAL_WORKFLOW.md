# Admin Approval Workflow - Complete Guide

## 🎯 Overview

When a worker uploads an "after" photo, the issue automatically changes to **"pending_approval"** status. The admin can then review and approve it, which makes it appear in the success stories.

---

## 🔄 Complete Workflow

### Step 1: Worker Uploads After Photo

```
Worker opens issue
    ↓
Scrolls to "After Photo" section
    ↓
Uploads photo of resolved issue
    ↓
Photo saved to database
    ↓
Status automatically changes to "pending_approval"
    ↓
completed_at timestamp set
```

### Step 2: Admin Reviews

```
Admin opens Authority Dashboard
    ↓
Sees issues with status "pending_approval"
    ↓
Opens issue details
    ↓
Sees before/after photos side-by-side
    ↓
Reviews resolution quality
```

### Step 3: Admin Approves

```
Admin clicks "Approve & Mark as Resolved"
    ↓
Status changes to "resolved"
    ↓
show_in_gallery set to TRUE
    ↓
Issue appears in Success Stories
```

---

## 📊 Database Schema

### Issues Table Fields:

| Field | Type | Purpose |
|-------|------|---------|
| `after_image` | TEXT | Base64 or URL of resolution photo |
| `status` | VARCHAR | Current status (pending_approval, resolved, etc.) |
| `completed_at` | TIMESTAMP | When worker marked as complete |
| `show_in_gallery` | BOOLEAN | Whether to show in success stories |

### Status Flow:

```
reported → assigned → in_progress → pending_approval → resolved
                                          ↑
                                    (Worker uploads photo)
```

---

## 🗄️ Database Setup

### Run This SQL:

```sql
-- Ensure all required columns exist
ALTER TABLE issues ADD COLUMN IF NOT EXISTS after_image TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN DEFAULT FALSE;

-- Update status constraint
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check 
  CHECK (status IN ('reported', 'assigned', 'in_progress', 'pending_approval', 'resolved', 'closed'));
```

---

## 👨‍💼 Admin Dashboard Integration

### Query for Pending Approvals:

```sql
SELECT 
  id,
  title,
  location,
  image as before_image,
  after_image,
  status,
  completed_at,
  assigned_to
FROM issues
WHERE status = 'pending_approval'
ORDER BY completed_at DESC;
```

### Approve Issue:

```sql
UPDATE issues
SET 
  status = 'resolved',
  show_in_gallery = TRUE,
  updated_at = NOW()
WHERE id = 'issue-id';
```

---

## 🎨 Success Stories Integration

### Query for Success Stories:

```sql
SELECT 
  i.id,
  i.title,
  i.location,
  i.image as before_image,
  i.after_image,
  i.category,
  i.completed_at,
  u.full_name as worker_name,
  u.department
FROM issues i
LEFT JOIN user_profiles u ON i.assigned_to = u.id
WHERE i.status = 'resolved'
  AND i.show_in_gallery = TRUE
  AND i.after_image IS NOT NULL
ORDER BY i.completed_at DESC;
```

This query is already used in:
- `src/components/HomepageSuccessStories.tsx`
- `src/components/SuccessStoriesShowcase.tsx`

---

## 🔍 Admin Review Checklist

When reviewing a pending approval:

- [ ] **Before photo** shows the original problem clearly
- [ ] **After photo** shows the problem is resolved
- [ ] **Location** matches the reported issue
- [ ] **Quality** of resolution is acceptable
- [ ] **Worker notes** provide context (if any)
- [ ] **Completion date** is reasonable

If all checks pass → **Approve**

---

## 💻 Implementation Example

### Admin Dashboard Component:

```typescript
// Fetch pending approvals
const { data: pendingIssues } = await supabase
  .from('issues')
  .select(`
    *,
    user_profiles!issues_assigned_to_fkey(full_name, department)
  `)
  .eq('status', 'pending_approval')
  .order('completed_at', { ascending: false });

// Approve issue
const handleApprove = async (issueId: string) => {
  const { error } = await supabase
    .from('issues')
    .update({
      status: 'resolved',
      show_in_gallery: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', issueId);
    
  if (!error) {
    alert('✅ Issue approved and added to success stories!');
    refreshIssues();
  }
};
```

---

## 🎯 Success Story Display

### Homepage Success Stories:

The component automatically shows approved issues:

```typescript
// Already implemented in HomepageSuccessStories.tsx
const { data } = await supabase
  .from('issues')
  .select(`
    id, title, location, image, after_image, category,
    completed_at, user_profiles(full_name, avatar_url)
  `)
  .eq('status', 'resolved')
  .eq('show_in_gallery', true)
  .not('after_image', 'is', null)
  .order('completed_at', { ascending: false })
  .limit(6);
```

### Features:
- ✅ Before/after photo comparison
- ✅ Worker attribution
- ✅ Completion date
- ✅ Location information
- ✅ Category badge
- ✅ Real-time updates

---

## 🔔 Notifications (Future Enhancement)

### When Worker Uploads Photo:

```typescript
// Send notification to admin
await supabase
  .from('notifications')
  .insert({
    user_id: 'admin-user-id',
    title: 'New Resolution Pending Approval',
    message: `Issue "${issue.title}" has been marked as resolved`,
    type: 'pending_approval',
    issue_id: issue.id
  });
```

### When Admin Approves:

```typescript
// Send notification to worker
await supabase
  .from('notifications')
  .insert({
    user_id: worker.id,
    title: 'Issue Approved!',
    message: `Your resolution for "${issue.title}" has been approved`,
    type: 'approved',
    issue_id: issue.id
  });
```

---

## 📊 Admin Dashboard Metrics

### Pending Approvals Count:

```sql
SELECT COUNT(*) as pending_count
FROM issues
WHERE status = 'pending_approval';
```

### Approval Rate:

```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'resolved') as approved,
  COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'resolved')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as approval_rate
FROM issues
WHERE status IN ('pending_approval', 'resolved');
```

### Average Resolution Time:

```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_hours
FROM issues
WHERE status = 'resolved'
  AND completed_at IS NOT NULL;
```

---

## 🚨 Important Notes

### Photo Storage:

Currently using **base64 encoding** stored directly in database:
- ✅ Simple and reliable
- ✅ No storage bucket configuration needed
- ✅ Works immediately
- ⚠️ Larger database size for images

**Alternative:** Use Supabase Storage (requires bucket setup)

### Status Transitions:

Valid transitions:
- `reported` → `assigned`
- `assigned` → `in_progress`
- `in_progress` → `pending_approval` (automatic when photo uploaded)
- `pending_approval` → `resolved` (admin approval)
- Any status → `closed` (admin can close)

### Gallery Flag:

The `show_in_gallery` flag allows admins to:
- ✅ Approve but not show publicly (set to FALSE)
- ✅ Approve and showcase (set to TRUE)
- ✅ Remove from gallery later (set back to FALSE)

---

## ✅ Testing Checklist

### Worker Side:
- [ ] Upload after photo
- [ ] See preview before upload
- [ ] Upload completes successfully
- [ ] Status changes to pending_approval
- [ ] Photo visible after refresh

### Admin Side:
- [ ] See pending approval in dashboard
- [ ] View before/after photos
- [ ] Approve issue
- [ ] Status changes to resolved
- [ ] Issue appears in success stories

### Citizen Side:
- [ ] See success story on homepage
- [ ] Before/after photos visible
- [ ] Worker name displayed
- [ ] Completion date shown
- [ ] Can click for more details

---

## 🎉 Summary

The complete workflow is now:

1. **Worker** uploads after photo → Status: `pending_approval`
2. **Admin** reviews and approves → Status: `resolved`, Gallery: `TRUE`
3. **Citizens** see success story on homepage
4. **Trust** in the system increases! 🚀

---

## 📞 Quick Reference

**Worker uploads photo:**
- Status: `in_progress` → `pending_approval`
- Field: `after_image` populated
- Field: `completed_at` set

**Admin approves:**
- Status: `pending_approval` → `resolved`
- Field: `show_in_gallery` = `TRUE`
- Appears in success stories

**Success story query:**
- Status = `resolved`
- `show_in_gallery` = `TRUE`
- `after_image` IS NOT NULL
