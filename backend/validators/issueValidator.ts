import { z } from 'zod';

/**
 * Verified PostgreSQL issue_category enum values from remote database
 */
export const ISSUE_CATEGORIES = [
  'cleanliness',
  'dead_animal',
  'garbage_dump',
  'littering',
  'stagnant_water',
  'street_light',
  'water_supply',
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const issueCategorySchema = z.enum(ISSUE_CATEGORIES, {
  errorMap: () => ({ message: 'Invalid issue category' }),
});

export const safeImageUrlSchema = z
  .string({ required_error: 'Image URL must be a string' })
  .trim()
  .min(1, 'Image URL cannot be empty')
  .max(10_000_000, 'Image payload too large')
  .refine(
    (val) => {
      if (/\s/.test(val)) return false;
      // Allow HTTPS URLs (reject insecure http:, javascript:, ftp:, etc.)
      if (/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(val)) {
        return true;
      }
      // Allow safe image Data URLs (jpeg, png, webp, gif, heic)
      if (/^data:image\/(jpeg|jpg|png|webp|gif|heic);base64,[A-Za-z0-9+/=]+$/i.test(val)) {
        return true;
      }
      return false;
    },
    { message: 'Each image must be a valid HTTPS URL or an image Data URL' }
  );

export const createIssueSchema = z.object({
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(10, 'Description must be at least 10 characters'),
  category: issueCategorySchema,
  address: z
    .string({ required_error: 'Address is required' })
    .trim()
    .min(3, 'Address must be at least 3 characters'),
  municipality_id: z
    .string()
    .uuid('Invalid municipality UUID')
    .nullable()
    .optional(),
  panchayat_id: z
    .string()
    .uuid('Invalid panchayat UUID')
    .nullable()
    .optional(),
  ward_id: z
    .string()
    .uuid('Invalid ward UUID')
    .nullable()
    .optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .nullable()
    .optional(),
  image_urls: z
    .array(safeImageUrlSchema)
    .max(5, 'Maximum 5 images allowed')
    .optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const ISSUE_STATUSES = [
  'submitted',
  'verified',
  'in_progress',
  'resolved',
  'escalated',
  'rejected',
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const issueStatusSchema = z.enum(ISSUE_STATUSES, {
  errorMap: () => ({ message: 'Invalid issue status' }),
});

const optionalUuid = (fieldName: string) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().uuid(`Invalid ${fieldName} UUID`).optional()
  );

export const getIssuesSchema = z.object({
  status: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.union([issueStatusSchema, z.array(issueStatusSchema)]).optional()
  ),
  category: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || val === 'All' ? undefined : val),
    issueCategorySchema.optional()
  ),
  municipality_id: optionalUuid('municipality'),
  ward_id: optionalUuid('ward'),
  department_id: optionalUuid('department'),
  reporter_id: optionalUuid('reporter'),
  assigned_worker_id: optionalUuid('assigned worker'),
  search: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().max(100, 'Search term cannot exceed 100 characters').trim().optional()
  ),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(50),
  offset: z.coerce
    .number()
    .int()
    .min(0, 'Offset must be 0 or greater')
    .default(0),
  sortBy: z.enum(['newest', 'oldest', 'priority', 'upvotes']).default('newest'),
});

export type GetIssuesInput = z.infer<typeof getIssuesSchema>;

export class IssueValidationError extends Error {
  statusCode: number;
  errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'IssueValidationError';
    this.statusCode = 400;
    this.errors = errors;
    Object.setPrototypeOf(this, IssueValidationError.prototype);
  }
}

export function validateCreateIssue(input: unknown): CreateIssueInput {
  const result = createIssueSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage = result.error.issues[0]?.message || 'Invalid issue data';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export function validateGetIssues(input: unknown = {}): GetIssuesInput {
  let normalized = input ?? {};
  if (typeof normalized === 'object' && normalized !== null) {
    const obj = { ...(normalized as Record<string, unknown>) };
    if (obj.municipalityId && !obj.municipality_id) {
      obj.municipality_id = obj.municipalityId;
    }
    if (obj.assignedWorkerId && !obj.assigned_worker_id) {
      obj.assigned_worker_id = obj.assignedWorkerId;
    }
    if (obj.wardId && !obj.ward_id) {
      obj.ward_id = obj.wardId;
    }
    if (obj.departmentId && !obj.department_id) {
      obj.department_id = obj.departmentId;
    }
    if (obj.reporterId && !obj.reporter_id) {
      obj.reporter_id = obj.reporterId;
    }
    if (obj.panchayatId && !obj.panchayat_id) {
      obj.panchayat_id = obj.panchayatId;
    }
    if (obj.sort && !obj.sortBy) {
      obj.sortBy = obj.sort;
    }
    normalized = obj;
  }


  const result = getIssuesSchema.safeParse(normalized);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid get issues query parameter';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const issueIdSchema = z
  .string({ required_error: 'Issue ID is required' })
  .trim()
  .min(1, 'Issue ID cannot be empty')
  .max(64, 'Issue ID is too long')
  .refine(
    (val) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const isTrackingId = /^[A-Za-z0-9_-]{4,32}$/.test(val);
      return isUuid || isTrackingId;
    },
    { message: 'Invalid Issue ID format (must be a valid UUID or tracking ID)' }
  );

export function validateIssueId(id: unknown): string {
  const result = issueIdSchema.safeParse(id);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {
      id: result.error.issues.map((i) => i.message),
    };
    const firstErrorMessage = result.error.issues[0]?.message || 'Invalid Issue ID';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

/**
 * Deterministic status transition graph
 */
export const VALID_STATUS_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  submitted: ['verified', 'in_progress', 'rejected', 'escalated'],
  verified: ['in_progress', 'escalated', 'rejected'],
  in_progress: ['resolved', 'escalated'],
  resolved: ['escalated', 'in_progress'],
  escalated: ['in_progress', 'verified', 'resolved', 'rejected'],
  rejected: ['submitted', 'verified'],
} as const;

export const transitionStatusSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
  status: issueStatusSchema,
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').trim().optional(),
  resolutionImageUrls: z.array(safeImageUrlSchema).max(5, 'Maximum 5 resolution images allowed').optional(),
  resolutionNotes: z.string().max(1000, 'Resolution notes cannot exceed 1000 characters').trim().optional(),
});

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;

export function validateTransitionStatus(input: unknown): TransitionStatusInput {
  const result = transitionStatusSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid status transition parameters';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const assignWorkerSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
  workerId: z.string({ required_error: 'Worker ID is required' }).uuid('Invalid Worker UUID'),
  departmentId: z.string().uuid('Invalid Department UUID').nullable().optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').trim().optional(),
});

export type AssignWorkerInput = z.infer<typeof assignWorkerSchema>;

export function validateAssignWorker(input: unknown): AssignWorkerInput {
  // Normalize snake_case parameters if present
  let normalized = input;
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const raw = input as Record<string, unknown>;
    normalized = {
      ...raw,
      issueId: raw.issueId !== undefined ? raw.issueId : raw.issue_id,
      workerId: raw.workerId !== undefined ? raw.workerId : raw.worker_id,
      departmentId: raw.departmentId !== undefined ? raw.departmentId : raw.department_id,
    };
  }

  const result = assignWorkerSchema.safeParse(normalized);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid worker assignment parameters';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const deleteIssueSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
});

export type DeleteIssueInput = z.infer<typeof deleteIssueSchema>;

export function validateDeleteIssue(input: unknown): DeleteIssueInput {
  const result = deleteIssueSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid issue ID for deletion';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const submitFeedbackSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
  feedback: z.enum(['satisfied', 'not_satisfied'], {
    errorMap: () => ({ message: 'Feedback must be either "satisfied" or "not_satisfied"' }),
  }),
  comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').trim().optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export function validateSubmitFeedback(input: unknown): SubmitFeedbackInput {
  const result = submitFeedbackSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid feedback parameters';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const upvoteIssueSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
});

export type UpvoteIssueInput = z.infer<typeof upvoteIssueSchema>;

export function validateUpvoteIssue(input: unknown): UpvoteIssueInput {
  const result = upvoteIssueSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid upvote parameters';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const addCommentSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
  content: z
    .string({ required_error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment cannot exceed 2000 characters'),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;

export function validateAddComment(input: unknown): AddCommentInput {
  const result = addCommentSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid comment parameters';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

export const getCommentsSchema = z.object({
  issueId: z.string({ required_error: 'Issue ID is required' }).uuid('Invalid Issue UUID'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type GetCommentsInput = z.infer<typeof getCommentsSchema>;

export function validateGetComments(input: unknown): GetCommentsInput {
  const result = getCommentsSchema.safeParse(input);
  if (!result.success) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      if (!formattedErrors[path]) {
        formattedErrors[path] = [];
      }
      formattedErrors[path].push(issue.message);
    }
    const firstErrorMessage =
      result.error.issues[0]?.message || 'Invalid get comments parameters';
    throw new IssueValidationError(firstErrorMessage, formattedErrors);
  }
  return result.data;
}

