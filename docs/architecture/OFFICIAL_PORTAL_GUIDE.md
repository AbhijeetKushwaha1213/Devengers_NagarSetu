# Department Official's Portal - Complete Guide

## Overview

The Department Official's Portal is a dedicated web application for municipal department officials to manage assigned issues from field assignment to resolution. It's designed for mobile-first/tablet experience with a focus on ease of use for field workers.

## Portal Access

**URL:** `/official/login`

**Login Credentials:**
- Email ID / Employee ID
- Password

**Security Note:** This portal is for authorized municipal department officials only. All activity is logged.

---

## Database Setup

### Step 1: Run the Migration

Execute the migration file to set up the database schema:

```sql
-- Run: docs/migration/department-official-portal.sql
```

This migration adds:
- `official` user type to user_profiles
- `employee_id` field for officials
- `issue_internal_notes` table for tracking work progress
- `after_image` field for resolution photos
- `completed_at` timestamp
- `show_in_gallery` flag for success stories
- New issue statuses: `assigned`, `pending_approval`
- RLS policies for officials
- `official_dashboard_stats` view for metrics

### Step 2: Create Official User Accounts

```sql
-- Example: Create an official user
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('official@municipality.gov', crypt('password123', gen_salt('bf')), NOW());

-- Get the user ID and create profile
INSERT INTO user_profiles (id, email, full_name, user_type, department, employee_id)
VALUES (
  '[user-id-from-above]',
  'official@municipality.gov',
  'Mr. A.K. Sharma',
  'official',
  'Public Works - Pothole Division',
  'EMP-405'
);
```

---

## Portal Pages

### 1. Official's Sign-In (`/official/login`)

**Features:**
- Clean, professional login interface
- Email/Employee ID and password fields
- Forgot password link
- Security notice footer
- Validates user is an official before allowing access

**Security:**
- Only users with `user_type = 'official'` can access
- Invalid credentials show error message
- All activity is logged

---

### 2. Dashboard (`/official/dashboard`)

**The Command Center** - Answers "What is my workload right now?"

**Header:**
- Welcome message with official's name
- Department and Employee ID display
- Profile icon (links to profile page)
- Logout button

**Key Metric Cards:**
1. **NEW ASSIGNED** - Issues just assigned by admin
   - Click to filter list to "assigned" status
   - Blue highlight when active

2. **IN-PROGRESS** - Issues official has acknowledged
   - Click to filter list to "in_progress" status
   - Yellow highlight when active

3. **PENDING ADMIN APPROVAL** - Work submitted for review
   - Click to filter list to "pending_approval" status
   - Green highlight when active

**Filter & Sort Bar:**
- Shows current filter status
- Clear filter button
- Sort options:
  - Newest First
  - Oldest First
  - Priority (Critical → High → Medium → Low)

**Task List:**
- Each task card shows:
  - Issue ID (first 8 characters)
  - Urgency badge (🔴 CRITICAL, etc.)
  - Title and location
  - Assignment time
  - Current status badge
  - "View Details →" link

**Real-Time Updates:**
- Auto-refreshes when new issues are assigned
- Live status updates
- No page reload needed

---

### 3. Issue Details Page (`/official/issue/:id`)

**The Case File** - Where all work happens

#### Section 1: The Problem (What & Where)

**Displays:**
- Issue ID and urgency badge
- Category and report date
- Full title and description
- "Before" photo from citizen
- AI severity (if available)
- Number of citizen reports

#### Section 2: Location & Path (The Map)

**Features:**
- Full address display
- GPS coordinates
- Interactive Leaflet.js map with precise pin
- Two action buttons:

**[➔ GET DIRECTIONS]**
- Opens native Google Maps/Apple Maps
- Pre-filled destination
- Official can navigate to location
- Perfect for field crews

**[🔗 COPY LOCATION LINK]**
- Copies Google Maps link to clipboard
- Can paste into WhatsApp for crew
- Easy sharing with team members

#### Section 3: Status & Action (The Official's Job)

**Content changes based on status:**

**If Status = "ASSIGNED":**
- Shows big button: **[MARK AS 'IN-PROGRESS']**
- Action: Acknowledges job, dispatches crew
- Updates status in database
- Admin sees work has started
- Adds automatic note to activity log

**If Status = "IN-PROGRESS":**
- Shows big button: **[MARK AS 'RESOLVED']**
- Action: Takes to Upload Resolution page
- Requires after photo upload
- Submits for admin approval

**If Status = "PENDING_APPROVAL":**
- Shows success message
- "Submitted for admin approval"
- Waiting for admin's final review

**Internal Notes:**
- **[💬 ADD INTERNAL NOTE]** button
- Text area for notes
- Examples:
  - "Dispatched Crew A at 10:30 AM. ETA 2 hours"
  - "Blocked by heavy traffic, will attempt tomorrow"
  - "Need additional materials, ordered"
- Notes visible to admin
- Full history of all notes shown below

---

### 4. Upload Resolution Page (`/official/issue/:id/upload-resolution`)

**The Proof of Work** - Core of accountability

#### Section 1: "Before" (For Reference)
- Shows citizen's original photo
- Side-by-side comparison reference

#### Section 2: "After" (Required) *
- **[📷 UPLOAD 'AFTER' PHOTO]** button
- Opens phone camera or gallery
- Mandatory proof of completion
- Maximum file size: 5MB
- Preview before submission
- Remove and re-upload option

#### Section 3: Resolution Notes (Optional)
- Text area for closing notes
- Examples:
  - "Resolved by Crew A. Used 3 bags of asphalt. Road is clear."
  - "Replaced streetlight bulb. Tested and working."
  - "Cleaned drainage. Water flowing properly."

#### Final Action:
**[SUBMIT FOR FINAL APPROVAL]** button
- Uploads after photo to storage
- Changes status to `pending_approval`
- Sets `completed_at` timestamp
- Moves from "In-Progress" to "Pending Approval"
- Sends notification to admin
- Adds automatic note to activity log

---

### 5. Profile Page (`/official/profile`)

**Account Management**

**Displays:**
- Official's photo placeholder
- Full name
- Employee ID
- Department
- Email address

**Actions:**
- **[Change Password]** button
  - New password field
  - Confirm password field
  - Minimum 6 characters
  - Success/error messages
- **[Logout]** button
  - Signs out of portal
  - Returns to login page

---

## Success Story Workflow

### The Complete Journey:

1. **Citizen Reports Issue**
   - Uploads "before" photo
   - Provides description and location

2. **Admin Assigns to Official**
   - Issue appears in official's "NEW ASSIGNED"
   - Official receives notification

3. **Official Acknowledges**
   - Marks as "IN-PROGRESS"
   - Dispatches crew
   - Adds internal notes

4. **Work Completed**
   - Official uploads "after" photo
   - Adds resolution notes
   - Marks as "RESOLVED"

5. **Admin Reviews**
   - Sees before/after photos side-by-side
   - Reviews resolution notes
   - Clicks **[✅ APPROVE & CLOSE]**

6. **Becomes Success Story**
   - Status changes to `resolved`
   - `show_in_gallery` flag set to `true`
   - Automatically appears in citizen app
   - Public can see transformation
   - Builds community trust

---

## Technical Implementation

### Database Schema

**user_profiles:**
```sql
- user_type: 'citizen' | 'authority' | 'official'
- employee_id: VARCHAR(50) UNIQUE
- department: VARCHAR(100)
```

**issues:**
```sql
- status: 'reported' | 'assigned' | 'in_progress' | 'pending_approval' | 'resolved' | 'closed'
- after_image: TEXT (URL to resolution photo)
- completed_at: TIMESTAMP
- show_in_gallery: BOOLEAN
```

**issue_internal_notes:**
```sql
- id: UUID PRIMARY KEY
- issue_id: UUID (FK to issues)
- official_id: UUID (FK to user_profiles)
- note: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Real-Time Features

**Dashboard:**
- Subscribes to `issues` table changes
- Auto-refreshes on new assignments
- Live status updates

**Issue Details:**
- Real-time note updates
- Status change notifications

### File Upload

**After Photos:**
- Stored in Supabase Storage bucket: `issue-images`
- Path: `issue-resolutions/{issue-id}-after-{timestamp}.{ext}`
- Public URL generated automatically
- Maximum size: 5MB
- Formats: JPG, PNG, WebP

### Security

**Row Level Security (RLS):**
- Officials can only view/update assigned issues
- Internal notes visible to official and authorities
- After photos only uploadable by assigned official
- All actions logged with timestamps

---

## Mobile-First Design

### Optimizations:
- Large touch targets (buttons, cards)
- Responsive grid layouts
- Bottom-aligned action buttons
- Swipe-friendly interfaces
- Native map integration
- Camera/gallery access
- Clipboard functionality
- Offline-ready (future enhancement)

### Performance:
- Lazy loading of images
- Optimized queries with indexes
- Real-time subscriptions
- Efficient state management

---

## Admin Integration

### Admin Dashboard Features:

**Review Queue:**
- See all `pending_approval` issues
- Before/after photo comparison
- Resolution notes from official
- Internal notes history
- One-click approval

**Final Approval:**
- **[✅ APPROVE & CLOSE]** button
- Changes status to `resolved`
- Sets `show_in_gallery = true`
- Issue becomes success story
- Official gets confirmation

**Monitoring:**
- Track official performance
- View completion times
- Monitor work quality
- Review internal notes

---

## API Endpoints (Supabase)

### Queries Used:

**Dashboard Stats:**
```typescript
supabase
  .from('official_dashboard_stats')
  .select('*')
  .eq('official_id', userId)
  .single()
```

**Assigned Tasks:**
```typescript
supabase
  .from('issues')
  .select('*')
  .eq('assigned_to', userId)
  .order('created_at', { ascending: false })
```

**Issue Details:**
```typescript
supabase
  .from('issues')
  .select('*')
  .eq('id', issueId)
  .single()
```

**Internal Notes:**
```typescript
supabase
  .from('issue_internal_notes')
  .select(`
    *,
    user_profiles!issue_internal_notes_official_id_fkey(full_name)
  `)
  .eq('issue_id', issueId)
  .order('created_at', { ascending: false })
```

**Update Status:**
```typescript
supabase
  .from('issues')
  .update({ 
    status: 'in_progress',
    updated_at: new Date().toISOString()
  })
  .eq('id', issueId)
```

**Upload Resolution:**
```typescript
// 1. Upload image
supabase.storage
  .from('issue-images')
  .upload(filePath, file)

// 2. Update issue
supabase
  .from('issues')
  .update({
    after_image: publicUrl,
    status: 'pending_approval',
    completed_at: new Date().toISOString()
  })
  .eq('id', issueId)
```

---

## Testing Checklist

### Login:
- [ ] Valid official can login
- [ ] Invalid credentials show error
- [ ] Non-official users are rejected
- [ ] Forgot password link works

### Dashboard:
- [ ] Stats cards show correct counts
- [ ] Clicking cards filters task list
- [ ] Sort options work correctly
- [ ] Real-time updates appear
- [ ] Task cards navigate to details

### Issue Details:
- [ ] All issue data displays correctly
- [ ] Map shows correct location
- [ ] Get Directions opens native maps
- [ ] Copy Location copies to clipboard
- [ ] Status-specific buttons appear
- [ ] Mark In-Progress updates status
- [ ] Add Note saves correctly
- [ ] Notes history displays

### Upload Resolution:
- [ ] Before photo displays
- [ ] Camera/gallery opens
- [ ] Image preview works
- [ ] File size validation
- [ ] Resolution notes save
- [ ] Submit updates status
- [ ] Navigates to dashboard

### Profile:
- [ ] All profile data displays
- [ ] Change password works
- [ ] Password validation
- [ ] Logout works correctly

### Success Stories:
- [ ] Resolved issues appear in gallery
- [ ] Before/after photos display
- [ ] Worker attribution correct
- [ ] Real-time updates work

---

## Future Enhancements

### Planned Features:
1. **Offline Mode**
   - Cache assigned issues
   - Queue actions when offline
   - Sync when connection restored

2. **Push Notifications**
   - New assignment alerts
   - Admin approval notifications
   - Urgent issue alerts

3. **Crew Management**
   - Assign specific crew members
   - Track crew availability
   - Crew performance metrics

4. **Resource Tracking**
   - Materials used
   - Equipment deployed
   - Cost tracking

5. **Photo Annotations**
   - Draw on photos
   - Add markers
   - Highlight areas

6. **Voice Notes**
   - Record audio notes
   - Speech-to-text
   - Attach to issues

7. **Route Optimization**
   - Multiple issue routing
   - Optimal path calculation
   - ETA predictions

8. **Analytics Dashboard**
   - Completion rates
   - Average resolution time
   - Performance trends
   - Department comparisons

---

## Support & Troubleshooting

### Common Issues:

**Can't Login:**
- Verify email/employee ID is correct
- Check user_type is 'official' in database
- Ensure account is active

**No Tasks Showing:**
- Verify issues are assigned to official
- Check assigned_to field matches user ID
- Refresh page

**Map Not Loading:**
- Check latitude/longitude are set
- Verify internet connection
- Check Leaflet.js is loaded

**Can't Upload Photo:**
- Check file size < 5MB
- Verify storage bucket exists
- Check RLS policies

**Status Not Updating:**
- Verify RLS policies allow update
- Check assigned_to matches user
- Review browser console for errors

---

## Conclusion

The Department Official's Portal provides a complete, mobile-first solution for field workers to manage municipal issues from assignment to resolution. With real-time updates, native map integration, and photo-based accountability, it streamlines the entire workflow while building public trust through transparent success stories.

For questions or support, contact the development team.
