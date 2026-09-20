# End-to-End User Journey Tests

Comprehensive specification for automated and manual end-to-end testing flows in NagarSetu-Civic.

## Journey 1: Citizen Issue Reporting
1. **Visit Landing Page**: Citizen arrives at `/`.
2. **Authentication**: Signs in or creates citizen account.
3. **Report Form**: Navigates to `/report`.
4. **Data Entry**:
   - Uploads camera photo.
   - Canvas compresses image to lightweight base64.
   - Enters description and selects category.
   - Location automatically acquired via geolocation or manual map picker.
5. **Duplicate Check**:
   - System checks existing active reports within 150m.
   - If match found: Shows `DuplicateIssueModal` with similarity rating.
   - Citizen can proceed or cancel.
6. **Submission**: Issue saved to database with status `submitted`.
7. **Redirection**: Directed to `/issues` feed.

## Journey 2: Municipal Worker Resolution Flow
1. **Login**: Field worker signs in via `/official/login`.
2. **Dashboard**: Assigned tasks displayed on `/official/dashboard`.
3. **Resolution**: Worker updates status to `in_progress`, uploads after-resolution photo.
4. **Closure**: Issue marked as `resolved`.
5. **Public Confirmation**: Citizen sees verified resolution showcase on home feed.
