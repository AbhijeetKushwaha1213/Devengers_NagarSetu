# Official Portal - Deployment Checklist

## Pre-Deployment Checklist

### ✅ Database Setup

- [ ] **Run Migration Script**
  - File: `docs/migration/department-official-portal.sql`
  - Verify: All tables created
  - Verify: All indexes created
  - Verify: RLS policies active

- [ ] **Verify Schema Changes**
  ```sql
  -- Check user_profiles has official type
  SELECT DISTINCT user_type FROM user_profiles;
  -- Should include: 'citizen', 'authority', 'official'
  
  -- Check issues has new fields
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'issues' 
  AND column_name IN ('after_image', 'completed_at', 'show_in_gallery');
  -- Should return all three
  
  -- Check internal notes table exists
  SELECT table_name FROM information_schema.tables 
  WHERE table_name = 'issue_internal_notes';
  -- Should return the table
  ```

- [ ] **Test RLS Policies**
  ```sql
  -- As official user, try to query issues
  SELECT * FROM issues WHERE assigned_to = auth.uid();
  -- Should work
  
  SELECT * FROM issues WHERE assigned_to != auth.uid();
  -- Should return empty (RLS blocking)
  ```

---

### ✅ Storage Setup

- [ ] **Verify Storage Bucket**
  - Bucket name: `issue-images`
  - Public access: Enabled
  - File size limit: 5MB
  - Allowed formats: JPG, PNG, WebP

- [ ] **Test Upload**
  ```typescript
  // Test file upload
  const { data, error } = await supabase.storage
    .from('issue-images')
    .upload('test/test.jpg', file);
  ```

- [ ] **Test Public URL**
  ```typescript
  // Get public URL
  const { data } = supabase.storage
    .from('issue-images')
    .getPublicUrl('test/test.jpg');
  // Should return valid URL
  ```

---

### ✅ User Accounts

- [ ] **Create Test Official**
  - Use: `docs/scripts/create-official-user.sql`
  - Email: test-official@municipality.gov
  - Password: Set secure password
  - Employee ID: TEST-001
  - Department: Test Department

- [ ] **Verify Official Profile**
  ```sql
  SELECT * FROM user_profiles 
  WHERE user_type = 'official' 
  AND email = 'test-official@municipality.gov';
  ```

- [ ] **Test Login**
  - Go to `/official/login`
  - Enter credentials
  - Should reach dashboard
  - Should NOT allow citizen/authority users

---

### ✅ Application Build

- [ ] **Install Dependencies**
  ```bash
  npm install
  ```

- [ ] **Check for Errors**
  ```bash
  npm run build
  # Should complete without errors
  ```

- [ ] **Run Type Check**
  ```bash
  npx tsc --noEmit
  # Should pass without errors
  ```

- [ ] **Test Locally**
  ```bash
  npm run dev
  # Visit http://localhost:5173/official/login
  ```

---

### ✅ Functionality Testing

#### Login Page
- [ ] Valid official can login
- [ ] Invalid credentials show error
- [ ] Non-official users rejected
- [ ] Forgot password link works
- [ ] Mobile responsive

#### Dashboard
- [ ] Stats cards display correctly
- [ ] NEW ASSIGNED count accurate
- [ ] IN-PROGRESS count accurate
- [ ] PENDING APPROVAL count accurate
- [ ] Clicking cards filters list
- [ ] Sort options work
- [ ] Task cards clickable
- [ ] Real-time updates work
- [ ] Mobile responsive

#### Issue Details
- [ ] Issue data loads correctly
- [ ] Before photo displays
- [ ] Map shows correct location
- [ ] Map marker positioned correctly
- [ ] GET DIRECTIONS opens maps
- [ ] COPY LOCATION copies to clipboard
- [ ] MARK AS IN-PROGRESS works
- [ ] ADD NOTE saves correctly
- [ ] Notes history displays
- [ ] Status-based buttons appear
- [ ] Mobile responsive

#### Upload Resolution
- [ ] Before photo displays
- [ ] Camera/gallery opens
- [ ] Image upload works
- [ ] Image preview shows
- [ ] File size validation works
- [ ] Resolution notes save
- [ ] SUBMIT button works
- [ ] Redirects to dashboard
- [ ] Mobile responsive

#### Profile
- [ ] Profile data displays
- [ ] Change password works
- [ ] Password validation works
- [ ] Logout works
- [ ] Mobile responsive

---

### ✅ Integration Testing

#### Complete Workflow
- [ ] **Step 1**: Admin assigns issue to official
  ```sql
  UPDATE issues SET 
    assigned_to = '[official-id]',
    status = 'assigned',
    department = 'Test Department'
  WHERE id = '[issue-id]';
  ```

- [ ] **Step 2**: Official sees in NEW ASSIGNED
  - Dashboard shows count = 1
  - Issue appears in task list

- [ ] **Step 3**: Official marks in-progress
  - Click MARK AS IN-PROGRESS
  - Status changes to 'in_progress'
  - Moves to IN-PROGRESS card
  - Automatic note added

- [ ] **Step 4**: Official adds notes
  - Click ADD INTERNAL NOTE
  - Type note
  - Save
  - Note appears in history

- [ ] **Step 5**: Official uploads resolution
  - Click MARK AS RESOLVED
  - Upload after photo
  - Add resolution note
  - Click SUBMIT FOR FINAL APPROVAL

- [ ] **Step 6**: Verify submission
  - Status = 'pending_approval'
  - after_image URL set
  - completed_at timestamp set
  - Moves to PENDING APPROVAL card

- [ ] **Step 7**: Admin approves
  ```sql
  UPDATE issues SET 
    status = 'resolved',
    show_in_gallery = true
  WHERE id = '[issue-id]';
  ```

- [ ] **Step 8**: Verify success story
  - Query success stories
  - Should include this issue
  - Before/after photos present
  - Worker attribution correct

---

### ✅ Real-Time Features

- [ ] **Dashboard Updates**
  - Assign new issue
  - Dashboard updates without refresh
  - Count increases automatically

- [ ] **Status Changes**
  - Update issue status
  - Dashboard reflects change
  - Task moves to correct card

- [ ] **Notes Updates**
  - Add note from another session
  - Notes list updates automatically

---

### ✅ Security Testing

- [ ] **Authentication**
  - Cannot access without login
  - Session persists correctly
  - Logout clears session

- [ ] **Authorization**
  - Official sees only assigned issues
  - Cannot access other officials' issues
  - Cannot modify unassigned issues

- [ ] **Data Protection**
  - Internal notes not public
  - After images properly secured
  - RLS policies enforced

---

### ✅ Performance Testing

- [ ] **Page Load Times**
  - Login: < 1 second
  - Dashboard: < 2 seconds
  - Issue Details: < 2 seconds
  - Map loads: < 3 seconds

- [ ] **Image Upload**
  - 1MB image: < 5 seconds
  - 5MB image: < 10 seconds
  - Progress indicator shows

- [ ] **Real-Time Updates**
  - Updates appear: < 2 seconds
  - No lag or delay
  - Smooth transitions

---

### ✅ Mobile Testing

#### iOS Testing
- [ ] Safari browser
- [ ] Chrome browser
- [ ] Touch interactions
- [ ] Camera access
- [ ] Maps integration
- [ ] Responsive layout

#### Android Testing
- [ ] Chrome browser
- [ ] Firefox browser
- [ ] Touch interactions
- [ ] Camera access
- [ ] Maps integration
- [ ] Responsive layout

#### Tablet Testing
- [ ] iPad
- [ ] Android tablet
- [ ] Landscape mode
- [ ] Portrait mode
- [ ] All features work

---

### ✅ Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

---

### ✅ Documentation

- [ ] **User Documentation**
  - Quick start guide complete
  - Training materials ready
  - Troubleshooting guide available

- [ ] **Technical Documentation**
  - API documentation complete
  - Database schema documented
  - Security policies documented

- [ ] **Admin Documentation**
  - Setup instructions clear
  - User management guide ready
  - Monitoring guide available

---

## Deployment Steps

### 1. Pre-Deployment

- [ ] All checklist items above completed
- [ ] Backup current database
- [ ] Notify team of deployment
- [ ] Schedule maintenance window

### 2. Database Deployment

- [ ] Run migration script
- [ ] Verify schema changes
- [ ] Test RLS policies
- [ ] Create official users

### 3. Application Deployment

- [ ] Build production bundle
  ```bash
  npm run build
  ```

- [ ] Deploy to hosting platform
  ```bash
  # Example for Vercel
  vercel --prod
  ```

- [ ] Verify deployment URL
- [ ] Test production site

### 4. Post-Deployment

- [ ] Test login on production
- [ ] Verify all features work
- [ ] Check real-time updates
- [ ] Monitor error logs
- [ ] Test mobile access

### 5. User Onboarding

- [ ] Send login credentials to officials
- [ ] Provide training materials
- [ ] Schedule training session
- [ ] Set up support channel

---

## Post-Deployment Monitoring

### Day 1
- [ ] Monitor error logs
- [ ] Check user logins
- [ ] Verify issue assignments
- [ ] Test photo uploads
- [ ] Check success stories

### Week 1
- [ ] Review user feedback
- [ ] Monitor performance
- [ ] Check completion rates
- [ ] Analyze usage patterns
- [ ] Address any issues

### Month 1
- [ ] Gather official feedback
- [ ] Review success metrics
- [ ] Plan improvements
- [ ] Update documentation
- [ ] Train new officials

---

## Rollback Plan

### If Issues Occur:

1. **Identify Problem**
   - Check error logs
   - Review user reports
   - Test functionality

2. **Assess Impact**
   - Critical: Rollback immediately
   - Minor: Fix and redeploy
   - Cosmetic: Schedule fix

3. **Rollback Steps**
   ```bash
   # Revert to previous deployment
   vercel rollback
   
   # Or restore database backup
   # (if database changes caused issue)
   ```

4. **Communicate**
   - Notify users
   - Explain issue
   - Provide timeline

---

## Success Criteria

### Technical
- ✅ All tests passing
- ✅ No critical errors
- ✅ Performance acceptable
- ✅ Security verified

### Functional
- ✅ Officials can login
- ✅ Issues display correctly
- ✅ Photos upload successfully
- ✅ Success stories appear

### User Experience
- ✅ Intuitive interface
- ✅ Fast response times
- ✅ Mobile-friendly
- ✅ Positive feedback

---

## Support Plan

### During Deployment
- Development team on standby
- Admin team available
- Support channel active

### Post-Deployment
- Monitor for 24 hours
- Quick response to issues
- Regular check-ins with users

### Ongoing
- Weekly reviews
- Monthly updates
- Continuous improvement

---

## Sign-Off

### Completed By:
- [ ] Developer: _________________ Date: _______
- [ ] QA Tester: _________________ Date: _______
- [ ] Admin: ____________________ Date: _______
- [ ] Project Lead: ______________ Date: _______

### Approved For Production:
- [ ] Technical Lead: ____________ Date: _______
- [ ] Project Manager: ___________ Date: _______

---

## Notes

_Add any deployment-specific notes, issues encountered, or special considerations here:_

---

**Deployment Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Completed | ⬜ Verified

**Go-Live Date**: _______________

**Deployed By**: _______________
