# Worker Onboarding & Department-Based Assignment System

## 🎯 Overview

Complete implementation of:
1. **Worker Onboarding** - First-time profile setup
2. **Department-Based Assignment** - Admin assigns work by department
3. **Worker Dashboard** - Shows assigned work automatically

---

## 🚀 New Features

### 1. Worker Onboarding Flow

When a worker logs in for the first time, they complete their profile:

**Fields Collected:**
- ✅ Full Name
- ✅ Employee ID
- ✅ Department (dropdown selection)
- ✅ Phone Number
- ✅ Address

**Flow:**
```
Worker Login → Check Profile Complete → 
  If Incomplete: Onboarding Page → 
  If Complete: Dashboard
```

### 2. Department-Based Worker Assignment

Admins can now assign work by department:

**Process:**
1. Admin clicks "Assign" on an issue
2. Selects department from dropdown
3. Sees list of all workers in that department
4. Selects specific worker
5. Work is assigned and appears in worker's dashboard

### 3. Automatic Dashboard Updates

Workers see assigned work immediately:
- Real-time updates
- No manual refresh needed
- Shows in "NEW ASSIGNED" card

---

## 📋 Database Changes

### Step 1: Run Migration

Execute this SQL in Supabase:

```sql
-- File: docs/migration/add-worker-profile-fields.sql

-- Add phone field
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Add address field
ALTER TABLE user_profiles 
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index for department-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_department 
  ON user_profiles(department) 
  WHERE user_type = 'official';

-- Create index for employee_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id 
  ON user_profiles(employee_id);
```

### Step 2: Verify

```sql
-- Check new fields exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('phone', 'address', 'employee_id', 'department');

-- Should return 4 rows
```

---

## 🎨 New Components

### 1. OfficialOnboarding.tsx

**Location:** `src/pages/official/OfficialOnboarding.tsx`

**Purpose:** First-time worker profile setup

**Features:**
- Form with all required fields
- Department dropdown (10+ departments)
- Validation
- Saves to database
- Redirects to dashboard

**Route:** `/official/onboarding`

### 2. AssignWorkerModal.tsx

**Location:** `src/components/AssignWorkerModal.tsx`

**Purpose:** Admin assigns work to workers

**Features:**
- Two-step process:
  1. Select department
  2. Select worker from that department
- Search functionality
- Shows worker details (name, ID, phone, address)
- Visual selection indicator
- Assigns work with one click

**Usage:**
```tsx
<AssignWorkerModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  issueId={issue.id}
  issueTitle={issue.title}
  onAssignSuccess={() => refreshIssues()}
/>
```

---

## 🔄 Complete User Flows

### Flow 1: New Worker First Login

```
1. Worker goes to landing page
2. Clicks "Access as Worker"
3. Enters email/password
4. System checks: is_onboarding_complete?
   
   If FALSE:
   5a. Redirects to /official/onboarding
   6a. Worker fills out profile form:
       - Full Name: "John Doe"
       - Employee ID: "EMP-123"
       - Department: "Public Works - Pothole Division"
       - Phone: "555-1234"
       - Address: "123 Main St"
   7a. Clicks "Complete Profile"
   8a. Profile saved to database
   9a. Redirects to dashboard
   
   If TRUE:
   5b. Redirects directly to dashboard
```

### Flow 2: Admin Assigns Work

```
1. Admin opens Authority Dashboard
2. Sees list of reported issues
3. Clicks "Assign" button on an issue
4. AssignWorkerModal opens
5. Admin selects department: "Public Works - Pothole Division"
6. System loads all workers in that department
7. Admin sees list:
   - John Doe (EMP-123) - 555-1234
   - Jane Smith (EMP-124) - 555-5678
   - Bob Johnson (EMP-125) - 555-9012
8. Admin clicks on "John Doe"
9. Worker card highlights (blue border)
10. Admin clicks "Assign Worker"
11. System updates issue:
    - assigned_to: john-doe-user-id
    - status: 'assigned'
    - department: 'Public Works - Pothole Division'
12. Modal closes
13. Issue list refreshes
```

### Flow 3: Worker Sees Assignment

```
1. Worker is on dashboard
2. Real-time subscription detects new assignment
3. Dashboard auto-updates:
   - "NEW ASSIGNED" count increases: 0 → 1
   - New task card appears in list
4. Worker clicks task card
5. Sees full issue details
6. Can start work immediately
```

---

## 🏗️ Available Departments

Default departments in the system:

1. Public Works - Pothole Division
2. Public Works - Road Maintenance
3. Water Supply Department
4. Electrical Department
5. Sanitation Department
6. Drainage Department
7. Parks & Recreation
8. Street Lighting
9. Waste Management
10. Other

**Note:** Departments are populated from actual worker profiles in the database.

---

## 💻 Implementation Details

### Worker Profile Structure

```typescript
interface User {
  id: string;
  email: string;
  full_name: string;
  user_type: 'citizen' | 'authority' | 'official';
  department?: string;
  employee_id?: string;
  phone?: string;           // NEW
  address?: string;         // NEW
  created_at: string;
  is_onboarding_complete: boolean;
}
```

### Assignment Process

```typescript
// When admin assigns work
await supabase
  .from('issues')
  .update({
    assigned_to: workerId,
    status: 'assigned',
    department: departmentName,
    updated_at: new Date().toISOString()
  })
  .eq('id', issueId);
```

### Dashboard Query

```typescript
// Worker dashboard fetches assigned issues
const { data } = await supabase
  .from('issues')
  .select('*')
  .eq('assigned_to', workerId)
  .order('created_at', { ascending: false });
```

---

## 🧪 Testing Guide

### Test 1: Worker Onboarding

1. **Create New User**
   - Supabase Dashboard > Authentication > Users
   - Email: `worker1@test.com`
   - Password: `Test@123456`

2. **Login as Worker**
   - Go to `/official/login`
   - Enter credentials
   - Should redirect to `/official/onboarding`

3. **Complete Profile**
   - Fill all fields
   - Select department
   - Click "Complete Profile"
   - Should redirect to dashboard

4. **Verify in Database**
   ```sql
   SELECT * FROM user_profiles 
   WHERE email = 'worker1@test.com';
   -- Should show all fields filled
   ```

### Test 2: Department-Based Assignment

1. **Create Multiple Workers**
   ```sql
   -- Create 3 workers in same department
   INSERT INTO user_profiles (id, email, full_name, user_type, department, employee_id, phone, address, is_onboarding_complete)
   VALUES 
   ('id-1', 'worker1@test.com', 'John Doe', 'official', 'Public Works', 'EMP-001', '555-1111', '123 Main St', true),
   ('id-2', 'worker2@test.com', 'Jane Smith', 'official', 'Public Works', 'EMP-002', '555-2222', '456 Oak Ave', true),
   ('id-3', 'worker3@test.com', 'Bob Johnson', 'official', 'Water Supply', 'EMP-003', '555-3333', '789 Pine Rd', true);
   ```

2. **Login as Admin**
   - Go to Authority Dashboard
   - Find an issue

3. **Assign Work**
   - Click "Assign" button
   - Select "Public Works" department
   - Should see John Doe and Jane Smith (not Bob)
   - Select John Doe
   - Click "Assign Worker"

4. **Verify Assignment**
   ```sql
   SELECT i.title, i.status, i.department, u.full_name
   FROM issues i
   JOIN user_profiles u ON i.assigned_to = u.id
   WHERE i.id = 'issue-id';
   ```

### Test 3: Worker Dashboard

1. **Login as Assigned Worker**
   - Use worker1@test.com credentials
   - Go to dashboard

2. **Verify Issue Appears**
   - Should see "1" in NEW ASSIGNED card
   - Issue should appear in task list
   - Click to view details

3. **Test Real-Time Updates**
   - Keep dashboard open
   - In another tab, assign another issue
   - Dashboard should auto-update (no refresh needed)

---

## 🔍 Search Functionality

The assignment modal includes search:

**Search by:**
- Worker name
- Employee ID
- Email address

**Example:**
- Search "EMP-001" → Finds John Doe
- Search "jane" → Finds Jane Smith
- Search "@test.com" → Finds all test workers

---

## 📊 Database Queries

### Get Workers by Department

```sql
SELECT 
  id,
  full_name,
  employee_id,
  email,
  phone,
  address
FROM user_profiles
WHERE user_type = 'official'
  AND department = 'Public Works'
  AND is_onboarding_complete = true
ORDER BY full_name;
```

### Get All Departments

```sql
SELECT DISTINCT department
FROM user_profiles
WHERE user_type = 'official'
  AND department IS NOT NULL
ORDER BY department;
```

### Get Worker's Assigned Issues

```sql
SELECT 
  i.*,
  COUNT(*) OVER() as total_assigned
FROM issues i
WHERE i.assigned_to = 'worker-user-id'
ORDER BY i.created_at DESC;
```

---

## 🎯 Key Benefits

### For Workers:
✅ Easy first-time setup
✅ Professional profile
✅ Clear department assignment
✅ Contact information stored
✅ Immediate work visibility

### For Admins:
✅ Department-based organization
✅ See all available workers
✅ Worker contact details visible
✅ Quick assignment process
✅ Search functionality

### For System:
✅ Structured data
✅ Efficient queries
✅ Real-time updates
✅ Scalable architecture
✅ Clear audit trail

---

## 🚨 Important Notes

### Onboarding is Required

Workers MUST complete onboarding before accessing dashboard:
- System checks `is_onboarding_complete` flag
- Redirects to onboarding if false
- Cannot skip this step

### Department Consistency

When assigning work:
- Issue's department matches worker's department
- Helps with reporting and analytics
- Enables department-based filtering

### Real-Time Sync

Dashboard uses Supabase real-time subscriptions:
- No polling needed
- Instant updates
- Efficient bandwidth usage

---

## 📝 Summary

### What's New:

1. **Worker Onboarding Page** (`/official/onboarding`)
   - Collects complete worker profile
   - Required on first login
   - Saves to database

2. **Assignment Modal Component**
   - Department dropdown
   - Worker list with details
   - Search functionality
   - One-click assignment

3. **Enhanced Dashboard**
   - Shows assigned work automatically
   - Real-time updates
   - Department-based organization

### Complete Flow:

```
Worker Signs Up → 
First Login → 
Complete Profile → 
Admin Assigns Work by Department → 
Work Appears in Worker Dashboard → 
Worker Completes Task → 
Uploads Proof → 
Admin Approves → 
Success Story
```

---

## 🎉 Ready to Use!

The system is now fully functional with:
- ✅ Worker onboarding
- ✅ Department-based assignment
- ✅ Automatic dashboard updates
- ✅ Real-time synchronization
- ✅ Complete audit trail

Workers can now be properly onboarded, organized by department, and assigned work efficiently!
