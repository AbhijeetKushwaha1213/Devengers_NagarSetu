# Official Portal - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migration (2 minutes)

Open your Supabase SQL Editor and run:

```sql
-- Copy and paste the entire contents of:
-- docs/migration/department-official-portal.sql
```

This adds:
- Official user type
- Internal notes table
- After image field
- Success story flag
- All necessary indexes and policies

### Step 2: Create an Official User (1 minute)

**Option A: Via Supabase Dashboard**
1. Go to Authentication > Users
2. Click "Add User"
3. Enter email and password
4. Copy the user ID

**Option B: Via SQL**
```sql
-- Create auth user first through dashboard, then:
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  user_type,
  department,
  employee_id,
  is_onboarding_complete
) VALUES (
  'paste-user-id-here',
  'official@test.com',
  'Test Official',
  'official',
  'Public Works',
  'EMP-001',
  true
);
```

### Step 3: Assign a Test Issue (1 minute)

```sql
-- Find an existing issue
SELECT id, title FROM issues LIMIT 1;

-- Assign it to your official
UPDATE issues
SET 
  assigned_to = 'official-user-id',
  status = 'assigned',
  department = 'Public Works'
WHERE id = 'issue-id-from-above';
```

### Step 4: Test the Portal (1 minute)

1. Navigate to `/official/login`
2. Login with official credentials
3. See the assigned issue in dashboard
4. Click to view details
5. Test the workflow!

---

## 🎯 Quick Test Workflow

### Complete Flow (5 minutes):

1. **Login**
   - Go to `/official/login`
   - Enter credentials
   - Should see dashboard

2. **View Dashboard**
   - See "1" in NEW ASSIGNED card
   - Click the card to filter
   - Click task to view details

3. **Mark In-Progress**
   - Click "MARK AS 'IN-PROGRESS'" button
   - Should see status change
   - Add a test note: "Testing the system"

4. **Upload Resolution**
   - Click "MARK AS 'RESOLVED'" button
   - Upload any test image
   - Add note: "Test resolution"
   - Click "SUBMIT FOR FINAL APPROVAL"

5. **Verify Success**
   - Should return to dashboard
   - Issue now in "PENDING APPROVAL"
   - Check database: `after_image` should be set

---

## 🗺️ Test Map Features

### Get Directions:
1. Open issue with coordinates
2. Click "GET DIRECTIONS"
3. Should open Google Maps
4. Verify destination is correct

### Copy Location:
1. Click "COPY LOCATION LINK"
2. Paste in browser
3. Should open Google Maps
4. Verify location matches

---

## 📸 Test Photo Upload

### Valid Upload:
- Use image < 5MB
- Should show preview
- Can remove and re-upload
- Submit should work

### Invalid Upload:
- Try image > 5MB
- Should show error
- Should not allow submit

---

## 🔐 Test Security

### Official Access:
```sql
-- Verify official can only see assigned issues
SELECT * FROM issues WHERE assigned_to = 'official-user-id';
-- Should return only assigned issues
```

### Non-Official Access:
1. Try logging in with citizen account
2. Should be rejected
3. Error: "This portal is for authorized officials only"

---

## 📊 Verify Success Story

### After Admin Approval:

```sql
-- Admin approves the issue
UPDATE issues
SET 
  status = 'resolved',
  show_in_gallery = true
WHERE id = 'issue-id';
```

### Check Citizen App:
1. Go to success stories page
2. Should see the resolved issue
3. Before/after photos displayed
4. Worker name shown
5. Completion date visible

---

## 🐛 Troubleshooting

### Can't Login?
```sql
-- Check user exists and is official
SELECT id, email, user_type FROM user_profiles 
WHERE email = 'your-email@test.com';
-- user_type should be 'official'
```

### No Issues Showing?
```sql
-- Check if issues are assigned
SELECT id, title, assigned_to, status FROM issues 
WHERE assigned_to = 'your-user-id';
-- Should return assigned issues
```

### Map Not Loading?
- Check issue has latitude/longitude
- Verify internet connection
- Check browser console for errors

### Can't Upload Photo?
- Check file size < 5MB
- Verify storage bucket exists
- Check RLS policies

---

## 📱 Mobile Testing

### Test on Phone:
1. Open `/official/login` on mobile
2. Login with credentials
3. Test touch interactions
4. Try camera upload
5. Test map directions
6. Verify responsive layout

### Test on Tablet:
1. Same as mobile
2. Verify larger layout
3. Test landscape mode
4. Check all features work

---

## ✅ Checklist

Before going to production:

- [ ] Database migration completed
- [ ] Official users created
- [ ] Test issue assigned
- [ ] Login works
- [ ] Dashboard displays correctly
- [ ] Issue details load
- [ ] Map shows location
- [ ] Get Directions works
- [ ] Copy Location works
- [ ] Mark In-Progress works
- [ ] Add Note works
- [ ] Upload Photo works
- [ ] Submit for Approval works
- [ ] Success story appears
- [ ] Mobile responsive
- [ ] Security tested
- [ ] Performance acceptable

---

## 🎓 Training Officials

### 5-Minute Training Script:

**1. Login (30 seconds)**
"Use your email and password to login at /official/login"

**2. Dashboard (1 minute)**
"Your dashboard shows three numbers:
- NEW ASSIGNED: Issues just given to you
- IN-PROGRESS: Work you've started
- PENDING APPROVAL: Work waiting for admin review"

**3. View Issue (1 minute)**
"Click any task to see full details. You'll see:
- What the problem is
- Where it's located
- A map to get there"

**4. Get Directions (30 seconds)**
"Click 'GET DIRECTIONS' to open maps on your phone"

**5. Mark Progress (1 minute)**
"When you start work, click 'MARK AS IN-PROGRESS'
Add notes like: 'Dispatched crew at 10 AM'"

**6. Upload Proof (1 minute)**
"When done, click 'MARK AS RESOLVED'
Take a photo of the fixed problem
Add a note about what you did
Click 'SUBMIT FOR FINAL APPROVAL'"

**Done!** "The admin will review and approve your work"

---

## 📞 Quick Reference

### URLs:
- Login: `/official/login`
- Dashboard: `/official/dashboard`
- Profile: `/official/profile`

### Key Actions:
- **Acknowledge Work**: Mark as In-Progress
- **Add Updates**: Use Internal Notes
- **Complete Work**: Upload After Photo
- **Submit**: Send for Admin Approval

### Support:
- Technical Issues: Check troubleshooting guide
- Account Problems: Contact admin
- Feature Requests: Contact development team

---

## 🎉 You're Ready!

The Official Portal is now set up and ready to use. Officials can:
- ✅ Login securely
- ✅ See assigned work
- ✅ Navigate to locations
- ✅ Track progress
- ✅ Upload proof of completion
- ✅ Build public trust through success stories

**Happy Issue Resolving! 🚀**
