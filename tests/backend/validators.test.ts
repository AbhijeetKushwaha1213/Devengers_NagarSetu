/**
 * Unit tests for backend validators
 */
import { loginSchema } from '../../backend/validators/auth';
import {
  createIssueSchema,
  validateCreateIssue,
  getIssuesSchema,
  validateGetIssues,
  validateIssueId,
  validateTransitionStatus,
  validateAssignWorker,
  validateDeleteIssue,
  validateSubmitFeedback,
  validateUpvoteIssue,
  validateAddComment,
  validateGetComments,
  IssueValidationError,
} from '../../backend/validators/issueValidator';

export function testValidators() {
  console.log('🧪 Running Backend Validator Tests...');

  // 1. Auth validator tests
  const validLogin = loginSchema.safeParse({
    email: 'citizen@example.com',
    password: 'securepassword123',
    accessType: 'citizen',
  });
  console.assert(validLogin.success, 'Valid login should pass validation');

  const invalidLogin = loginSchema.safeParse({
    email: 'invalid-email',
    password: '',
    accessType: 'citizen',
  });
  console.assert(!invalidLogin.success, 'Invalid email and short password should fail');

  // 2. Issue creation validator tests
  const validIssue = createIssueSchema.safeParse({
    description: 'The street lamp is completely dark and poses safety hazards at night.',
    category: 'street_light',
    address: 'MG Road, Ward 12',
    municipality_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    ward_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    latitude: 28.6139,
    longitude: 77.209,
    image_urls: ['https://example.com/photo.jpg'],
  });
  console.assert(validIssue.success, 'Valid issue report should pass validation');

  const invalidIssue = createIssueSchema.safeParse({
    description: 'Short',
    category: 'invalid_category',
    address: '',
  });
  console.assert(!invalidIssue.success, 'Short issue description should fail validation');

  try {
    validateCreateIssue({
      description: 'Too short',
      category: 'street_light',
      address: 'Valid address',
    });
    console.assert(false, 'Should have thrown IssueValidationError');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid data');
  }

  // 2b. Image URL security validation tests
  const dangerousUrls = [
    'javascript:alert(1)',
    'http://insecure-site.com/photo.jpg',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ];
  for (const badUrl of dangerousUrls) {
    const res = createIssueSchema.safeParse({
      description: 'Valid description for testing dangerous image URLs',
      category: 'cleanliness',
      address: 'Valid street address',
      image_urls: [badUrl],
    });
    console.assert(!res.success, `Should reject dangerous image URL: ${badUrl}`);
  }

  const validBase64 = createIssueSchema.safeParse({
    description: 'Valid description for testing valid base64 image',
    category: 'cleanliness',
    address: 'Valid street address',
    image_urls: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD'],
  });
  console.assert(validBase64.success, 'Should accept valid base64 JPEG image URL');

  // 3. Issue retrieval validator tests
  const validGetIssues = validateGetIssues({
    status: ['submitted', 'in_progress'],
    category: 'cleanliness',
    limit: 25,
    offset: 50,
    sortBy: 'priority',
  });
  console.assert(validGetIssues.limit === 25, 'Limit coerced to 25');
  console.assert(validGetIssues.offset === 50, 'Offset set to 50');
  console.assert(validGetIssues.sortBy === 'priority', 'SortBy set to priority');

  // Test empty and default values
  const defaultGetIssues = validateGetIssues({});
  console.assert(defaultGetIssues.limit === 50, 'Default limit is 50');
  console.assert(defaultGetIssues.offset === 0, 'Default offset is 0');
  console.assert(defaultGetIssues.sortBy === 'newest', 'Default sortBy is newest');

  // Test invalid parameters throw
  try {
    validateGetIssues({ limit: 0 });
    console.assert(false, 'Should fail for limit 0');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError for limit < 1');
  }

  // 4. Issue ID validator tests
  const validUuid = validateIssueId('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  console.assert(validUuid === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Valid UUID accepted');

  const validTrackingId = validateIssueId('GS123456');
  console.assert(validTrackingId === 'GS123456', 'Valid tracking ID accepted');

  try {
    validateIssueId('');
    console.assert(false, 'Empty ID should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on empty ID');
  }

  try {
    validateIssueId('inv@lid!id');
    console.assert(false, 'Special characters should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid characters');
  }

  // 5. Status Transition validator tests
  const validTransition = validateTransitionStatus({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    status: 'in_progress',
    notes: 'Assigning to road repair crew',
  });
  console.assert(validTransition.status === 'in_progress', 'Accepted valid transition');

  try {
    validateTransitionStatus({
      issueId: 'not-a-uuid',
      status: 'in_progress',
    });
    console.assert(false, 'Malformed issueId should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on malformed UUID');
  }

  try {
    validateTransitionStatus({
      issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'acknowledged', // Invalid enum
    });
    console.assert(false, 'Invalid status enum should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid status');
  }

  // 6. Assign Worker validator tests
  const validAssignment = validateAssignWorker({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    workerId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    notes: 'Urgent assignment',
  });
  console.assert(validAssignment.workerId === 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Accepted valid assignment');

  try {
    validateAssignWorker({
      issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      workerId: 'invalid-worker',
    });
    console.assert(false, 'Malformed workerId should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on malformed worker UUID');
  }

  // 7. Delete Issue validator tests
  const validDelete = validateDeleteIssue({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  });
  console.assert(validDelete.issueId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Accepted valid delete issueId');

  try {
    validateDeleteIssue({ issueId: 'not-a-uuid' });
    console.assert(false, 'Malformed issueId should fail delete');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on malformed delete issueId');
  }

  // 8. Submit Feedback validator tests
  const validFeedback = validateSubmitFeedback({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    feedback: 'satisfied',
    comment: 'Great job!',
  });
  console.assert(validFeedback.feedback === 'satisfied', 'Accepted valid feedback');

  try {
    validateSubmitFeedback({
      issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      feedback: 'invalid_choice' as unknown as 'satisfied',
    });
    console.assert(false, 'Invalid feedback choice should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid feedback choice');
  }

  // 10. Upvote validator tests
  const validUpvote = validateUpvoteIssue({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  });
  console.assert(validUpvote.issueId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Accepted valid upvote');

  try {
    validateUpvoteIssue({ issueId: 'not-a-uuid' });
    console.assert(false, 'Invalid upvote issueId should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid upvote issueId');
  }

  // 11. Add comment validator tests
  const validComment = validateAddComment({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    content: 'This is a genuine civic comment.',
  });
  console.assert(validComment.content === 'This is a genuine civic comment.', 'Accepted valid comment');

  try {
    validateAddComment({
      issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      content: '',
    });
    console.assert(false, 'Empty comment should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on empty comment');
  }

  try {
    validateAddComment({
      issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      content: '   ',
    });
    console.assert(false, 'Whitespace comment should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on whitespace comment');
  }

  try {
    validateAddComment({
      issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      content: 'a'.repeat(2001),
    });
    console.assert(false, 'Oversized comment should fail');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on oversized comment');
  }

  // 12. Get comments validator tests
  const validGetComments = validateGetComments({
    issueId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    limit: 20,
    offset: 10,
  });
  console.assert(validGetComments.limit === 20 && validGetComments.offset === 10, 'Accepted valid get comments');

  console.log('✅ All validator tests passed successfully!');
}

testValidators();

