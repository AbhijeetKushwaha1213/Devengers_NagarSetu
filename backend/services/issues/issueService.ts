import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  type CreateIssueInput,
  validateCreateIssue,
  type GetIssuesInput,
  validateGetIssues,
  validateIssueId,
  type TransitionStatusInput,
  validateTransitionStatus,
  validateDeleteIssue,
  type SubmitFeedbackInput,
  validateSubmitFeedback,
  type UpvoteIssueInput,
  validateUpvoteIssue,
  type AddCommentInput,
  validateAddComment,
  type GetCommentsInput,
  validateGetComments,
  VALID_STATUS_TRANSITIONS,
  IssueValidationError,
  type IssueCategory,
  type IssueStatus,
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
} from '../../validators/issueValidator';
import { AuthenticationError } from '../auth/types';
import { checkForDuplicates, type DuplicateDetectionResult } from './duplicateDetectionService';
import { NotificationService, type NotificationEventType } from '../notifications';
import { RoutingService } from '../routing/routingService';

export type {
  CreateIssueInput,
  GetIssuesInput,
  TransitionStatusInput,
  SubmitFeedbackInput,
  UpvoteIssueInput,
  AddCommentInput,
  GetCommentsInput,
  IssueCategory,
  IssueStatus,
};
export { ISSUE_CATEGORIES, ISSUE_STATUSES, VALID_STATUS_TRANSITIONS };

export interface IssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
}

export interface UpvoteStatus {
  upvoted: boolean;
  upvotes_count: number;
}

export interface Issue {
  id: string;
  tracking_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  address: string;
  reporter_id: string;
  priority_score?: number;
  panchayat_id?: string | null;
  municipality_id?: string | null;
  ward_id?: string | null;
  department_id?: string | null;
  assigned_worker_id?: string | null;
  assigned_manager_id?: string | null;
  image_urls?: string[] | null;
  resolution_image_urls?: string[] | null;
  metadata?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  upvotes_count: number;
  volunteers_count: number;
  created_at: string;
  updated_at?: string;
  verified_at?: string | null;
  resolved_at?: string | null;
  escalated_at?: string | null;
  citizen_feedback?: unknown | null;
}

const DB_CATEGORY_MAP: Record<string, string> = {
  street_light: 'street_light',
  water_supply: 'water_supply',
  garbage_dump: 'garbage_dump',
  cleanliness: 'cleanliness',
  stagnant_water: 'stagnant_water',
  littering: 'littering',
  dead_animal: 'dead_animal',
  streetlight: 'street_light',
  Electricity: 'street_light',
  water: 'water_supply',
  Water: 'water_supply',
  waste: 'garbage_dump',
  Trash: 'garbage_dump',
  drainage: 'stagnant_water',
  pothole: 'stagnant_water',
  Infrastructure: 'stagnant_water',
  infrastructure: 'stagnant_water',
  parks: 'cleanliness',
  others: 'cleanliness',
  other: 'cleanliness',
  Other: 'cleanliness',
};

export const normalizeIssueCategory = (cat?: string): string => {
  if (!cat) return 'cleanliness';
  return DB_CATEGORY_MAP[cat] || 'cleanliness';
};

export class IssueService {
  /**
   * Fetch civic issues with canonical validation and parameterized filtering
   */
  static async getIssues(
    input: GetIssuesInput = {},
    supabaseClient: SupabaseClient = supabase
  ): Promise<Issue[]> {
    // 1. Validate and normalize query inputs
    const validated = validateGetIssues(input);

    // 2. Build parameterized query
    let query = supabaseClient.from('issues').select('*');

    if (validated.status) {
      if (Array.isArray(validated.status)) {
        query = query.in('status', validated.status);
      } else {
        query = query.eq('status', validated.status);
      }
    }

    if (validated.category) {
      query = query.eq('category', validated.category);
    }

    if (validated.municipality_id) {
      query = query.eq('municipality_id', validated.municipality_id);
    }

    if (validated.ward_id) {
      query = query.eq('ward_id', validated.ward_id);
    }

    if (validated.department_id) {
      query = query.eq('department_id', validated.department_id);
    }

    if (validated.reporter_id) {
      query = query.eq('reporter_id', validated.reporter_id);
    }

    if (validated.assigned_worker_id) {
      query = query.eq('assigned_worker_id', validated.assigned_worker_id);
    }

    if (validated.search) {
      const sanitized = validated.search.replace(/[%_,()]/g, '').trim();
      if (sanitized) {
        query = query.or(
          `title.ilike.%${sanitized}%,description.ilike.%${sanitized}%,address.ilike.%${sanitized}%`
        );
      }
    }

    // 3. Apply sorting
    switch (validated.sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'priority':
        query = query.order('priority_score', { ascending: false });
        break;
      case 'upvotes':
        query = query.order('upvotes_count', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // 4. Apply range pagination
    const offset = validated.offset ?? 0;
    const limit = validated.limit ?? 50;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      console.error('[IssueService] Failed to fetch issues:', error);
      throw error;
    }

    const rows = (data || []) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const metadata = (row.metadata as Record<string, unknown> | null) || null;
      const latitude = (row.latitude as number | null | undefined) ?? (metadata?.latitude as number | undefined) ?? null;
      const longitude = (row.longitude as number | null | undefined) ?? (metadata?.longitude as number | undefined) ?? null;
      const citizen_feedback_comment = (row.citizen_feedback_comment as string | null | undefined) ?? (metadata?.citizen_feedback_comment as string | undefined) ?? null;
      const citizen_feedback_at = (row.citizen_feedback_at as string | null | undefined) ?? (metadata?.citizen_feedback_at as string | undefined) ?? null;
      return {
        ...(row as unknown as Issue),
        latitude,
        longitude,
        citizen_feedback_comment,
        citizen_feedback_at,
      };
    });
  }

  /**
   * Fetch a single issue by UUID or tracking_id with canonical validation
   */
  static async getIssueById(
    id: unknown,
    supabaseClient: SupabaseClient = supabase
  ): Promise<Issue | null> {
    const validatedId = validateIssueId(id);

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedId);

    let query = supabaseClient.from('issues').select('*');

    if (isUuid) {
      query = query.eq('id', validatedId);
    } else {
      query = query.eq('tracking_id', validatedId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[IssueService] Failed to fetch issue by ID:', error);
      throw error;
    }

    if (!data) return null;

    const row = data as Record<string, unknown>;
    const metadata = (row.metadata as Record<string, unknown> | null) || null;
    const latitude = (row.latitude as number | null | undefined) ?? (metadata?.latitude as number | undefined) ?? null;
    const longitude = (row.longitude as number | null | undefined) ?? (metadata?.longitude as number | undefined) ?? null;
    const citizen_feedback_comment = (row.citizen_feedback_comment as string | null | undefined) ?? (metadata?.citizen_feedback_comment as string | undefined) ?? null;
    const citizen_feedback_at = (row.citizen_feedback_at as string | null | undefined) ?? (metadata?.citizen_feedback_at as string | undefined) ?? null;

    return {
      ...(row as unknown as Issue),
      latitude,
      longitude,
      citizen_feedback_comment,
      citizen_feedback_at,
    };
  }

  /**
   * Canonical Issue Creation Method
   *
   * Validates user-controlled issue input, derives authenticated reporter ID
   * from Supabase session, constructs database row, and returns created Issue
   * containing database-generated tracking_id.
   */
  static async createIssue(
    input: CreateIssueInput,
    supabaseClient: SupabaseClient = supabase
  ): Promise<Issue> {
    // 1. Validate user-controlled input (description, category, address, municipality_id, ward_id, coordinates, images)
    const validated = validateCreateIssue(input);

    // 2. Derive reporter_id from the authenticated Supabase session
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to report an issue',
        401
      );
    }

    const reporter_id = authData.user.id;

    // 3. Generate title from description (first 50 characters)
    const title =
      validated.description.length > 50
        ? validated.description.substring(0, 47) + '...'
        : validated.description;

    // 4. Construct internal insert payload
    const issueData: Record<string, unknown> = {
      title,
      description: validated.description,
      category: validated.category,
      address: validated.address,
      reporter_id,
      status: 'submitted',
      volunteers_count: 0,
      upvotes_count: 0,
    };

    let municipalityId = validated.municipality_id || null;
    let wardId = validated.ward_id || null;
    let panchayatId = validated.panchayat_id || null;

    if (!municipalityId && !panchayatId) {
      // 1. Check reporter's profile
      try {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('municipality_id, ward_id, panchayat_id')
          .eq('id', reporter_id)
          .maybeSingle();

        if (profile?.municipality_id) {
          municipalityId = profile.municipality_id;
          if (!wardId && profile.ward_id) {
            wardId = profile.ward_id;
          }
        } else if (profile?.panchayat_id) {
          panchayatId = profile.panchayat_id;
        }
      } catch (profileErr) {
        console.warn('[IssueService] Failed to load reporter profile for jurisdiction derivation:', profileErr);
      }
    }

    if (!municipalityId && !panchayatId) {
      // 2. Derive jurisdiction from address and coordinates
      try {
        const addr = (validated.address || '').toLowerCase();
        const lat = validated.latitude;
        const lng = validated.longitude;

        const isPrayagrajCoords =
          lat != null &&
          lng != null &&
          lat >= 25.25 &&
          lat <= 25.65 &&
          lng >= 81.65 &&
          lng <= 82.05;

        const isPrayagrajAddr =
          addr.includes('prayagraj') ||
          addr.includes('allahabad') ||
          addr.includes('civil lines') ||
          addr.includes('katra') ||
          addr.includes('george town');

        const { data: municipalities } = await supabaseClient
          .from('municipalities')
          .select('id, name');

        if (municipalities && municipalities.length > 0) {
          let matched = municipalities.find((m) =>
            addr.includes(m.name.toLowerCase())
          );

          if (!matched && (isPrayagrajCoords || isPrayagrajAddr)) {
            matched = municipalities.find(
              (m) =>
                m.name.toLowerCase().includes('prayagraj') ||
                m.name.toLowerCase().includes('allahabad')
            );
          }

          // If only 1 municipality exists in system, associate urban report with it
          if (!matched && municipalities.length === 1) {
            matched = municipalities[0];
          }

          if (matched) {
            municipalityId = matched.id;

            if (!wardId) {
              const { data: wards } = await supabaseClient
                .from('wards')
                .select('id, name')
                .eq('municipality_id', matched.id)
                .order('ward_number', { ascending: true })
                .limit(1);

              if (wards && wards.length > 0) {
                wardId = wards[0].id;
              }
            }
          }
        }
      } catch (geoErr) {
        console.warn('[IssueService] Failed to derive jurisdiction from location:', geoErr);
      }
    }

    if (municipalityId) {
      issueData.municipality_id = municipalityId;
    }

    if (panchayatId) {
      issueData.panchayat_id = panchayatId;
    }

    if (wardId) {
      issueData.ward_id = wardId;
    }


    if (validated.image_urls && validated.image_urls.length > 0) {
      issueData.image_urls = validated.image_urls;
    }

    if (validated.latitude != null && validated.longitude != null) {
      issueData.metadata = {
        latitude: validated.latitude,
        longitude: validated.longitude,
      };
    }

    // 5. Insert into Supabase (database trigger generates tracking_id)
    const { data, error } = await supabaseClient
      .from('issues')
      .insert([issueData])
      .select()
      .single();

    if (error) {
      console.error('[IssueService] Failed to insert issue:', error);
      throw error;
    }

    const createdIssue = data as Issue;

    // Dispatch lifecycle event: issue_submitted (failure-isolated)
    await NotificationService.dispatchLifecycleEvent(
      {
        issueId: createdIssue.id,
        eventType: 'issue_submitted',
        actorId: reporter_id,
        issueTitle: createdIssue.title,
        trackingId: createdIssue.tracking_id,
        category: createdIssue.category,
      },
      supabaseClient
    );
 
    // 6. Automatic Department & Worker Routing
    try {
      const routingResult = await RoutingService.routeIssue(
        createdIssue,
        supabaseClient,
        { actorId: reporter_id }
      );
      if (routingResult.assignedIssue) {
        return routingResult.assignedIssue as Issue;
      }
    } catch (routeErr) {
      console.warn('[IssueService] Automatic routing failed gracefully (issue remains submitted):', routeErr);
    }

    return createdIssue;
  }

  /**
   * Run duplicate issue detection
   */
  static async checkDuplicates(
    description: string,
    location: string,
    coordinates: { lat: number; lng: number } | null,
    imageBase64?: string,
    category?: string
  ): Promise<DuplicateDetectionResult> {
    return checkForDuplicates(description, location, coordinates, imageBase64, category);
  }

  /**
   * Transition an issue's status through the formal transition state machine
   */
  /**
   * Helper to dispatch lifecycle events for status transitions
   */
  private static async dispatchStatusTransitionNotification(
    issue: {
      id: string;
      title?: string;
      tracking_id?: string;
      category?: string;
    },
    newStatus: IssueStatus,
    actorId: string,
    client: SupabaseClient
  ): Promise<void> {
    const eventTypeMap: Partial<Record<IssueStatus, NotificationEventType>> = {
      verified: 'issue_verified',
      in_progress: 'issue_in_progress',
      resolved: 'issue_resolved',
      rejected: 'issue_rejected',
      escalated: 'issue_escalated',
    };

    const eventType = eventTypeMap[newStatus];
    if (eventType) {
      await NotificationService.dispatchLifecycleEvent(
        {
          issueId: issue.id,
          eventType,
          actorId,
          issueTitle: issue.title,
          trackingId: issue.tracking_id,
          category: issue.category,
        },
        client
      );
    }
  }

  static async transitionStatus(
    input: TransitionStatusInput,
    supabaseClient: SupabaseClient = supabase
  ): Promise<Issue> {
    // 1. Validate runtime input
    const validated = validateTransitionStatus(input);

    // 2. Derive authenticated user
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to update issue status',
        401
      );
    }
    const userId = authData.user.id;

    // 3. Attempt atomic database RPC transition_issue_status first
    try {
      const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
        'transition_issue_status',
        {
          p_issue_id: validated.issueId,
          p_new_status: validated.status,
          p_notes: validated.notes || null,
        }
      );

      if (!rpcError && rpcData) {
        const transitionedIssue = rpcData as Issue;
        await this.dispatchStatusTransitionNotification(
          transitionedIssue,
          validated.status,
          userId,
          supabaseClient
        );
        return transitionedIssue;
      }
      // If RPC failed due to validation/auth exception, throw IssueValidationError
      if (rpcError && !rpcError.message.includes('Could not find the function')) {
        throw new IssueValidationError(rpcError.message);
      }
    } catch (rpcErr) {
      if (rpcErr instanceof IssueValidationError) {
        throw rpcErr;
      }
      const err = rpcErr as Error;
      if (!err.message?.includes('Could not find the function')) {
        throw err;
      }
    }

    // 4. Service-level authorization and transition logic
    // Fetch user profile
    const { data: profile, error: profError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profError || !profile || !profile.is_active) {
      throw new IssueValidationError('User profile not found or inactive');
    }

    // Fetch existing issue
    const { data: issue, error: issueError } = await supabaseClient
      .from('issues')
      .select('*')
      .eq('id', validated.issueId)
      .single();

    if (issueError || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    // Role authorization check
    const userRole = profile.role;
    if (userRole === 'citizen' || userRole === 'community_member') {
      // Citizens can only escalate resolved issues via feedback
      if (!(issue.reporter_id === userId && issue.status === 'resolved' && validated.status === 'escalated')) {
        throw new IssueValidationError('Citizens cannot perform official status transitions');
      }
    } else if (userRole === 'worker' || userRole === 'panchayat_worker') {
      // Workers can only transition their assigned issues
      if (issue.assigned_worker_id !== userId) {
        throw new IssueValidationError('Workers can only transition issues assigned to them');
      }
      if (validated.status === 'rejected') {
        throw new IssueValidationError('Workers cannot reject issues');
      }
    } else if (userRole === 'municipal_admin') {
      if (!profile.municipality_id) {
        throw new IssueValidationError('Municipal admin profile lacks municipality assignment');
      }
      if (!issue.municipality_id) {
        throw new IssueValidationError('Cannot manage non-municipal/rural issue');
      }
      if (profile.municipality_id !== issue.municipality_id) {
        throw new IssueValidationError('Cannot manage issues outside your municipality');
      }
    } else if (userRole === 'pradhan') {
      if (!profile.panchayat_id) {
        throw new IssueValidationError('Pradhan profile lacks panchayat assignment');
      }
      if (!issue.panchayat_id) {
        throw new IssueValidationError('Cannot manage non-panchayat/urban issue');
      }
      if (profile.panchayat_id !== issue.panchayat_id) {
        throw new IssueValidationError('Cannot manage issues outside your panchayat');
      }
    } else if (userRole === 'administrator') {
      // Central admin has full authority
    } else {
      throw new IssueValidationError(`Role "${userRole}" not authorized to transition status`);
    }

    // Check if status is already target
    if (issue.status === validated.status) {
      return issue as Issue;
    }

    // Validate transition graph
    const allowedTransitions = VALID_STATUS_TRANSITIONS[issue.status as IssueStatus];
    if (!allowedTransitions || !allowedTransitions.includes(validated.status)) {
      throw new IssueValidationError(
        `Cannot transition issue from "${issue.status}" to "${validated.status}"`
      );
    }

    // Execute issue update
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: validated.status,
      updated_at: now,
    };
    if (validated.status === 'verified' && !issue.verified_at) updatePayload.verified_at = now;
    if (validated.status === 'resolved') updatePayload.resolved_at = now;
    if (validated.status === 'escalated') updatePayload.escalated_at = now;
    if (validated.resolutionImageUrls && validated.resolutionImageUrls.length > 0) {
      updatePayload.resolution_image_urls = validated.resolutionImageUrls;
    }

    const { data: updatedIssue, error: updateError } = await supabaseClient
      .from('issues')
      .update(updatePayload)
      .eq('id', validated.issueId)
      .select()
      .single();

    if (updateError) {
      console.error('[IssueService] Failed to update issue status:', updateError);
      throw updateError;
    }

    // Insert into issue_audit_log
    const { error: auditError } = await supabaseClient
      .from('issue_audit_log')
      .insert({
        issue_id: validated.issueId,
        user_id: userId,
        action: 'STATUS_CHANGED',
        old_status: issue.status,
        new_status: validated.status,
        old_data: { status: issue.status },
        new_data: {
          status: validated.status,
          resolution_notes: validated.resolutionNotes || null,
        },
        notes: validated.notes || null,
        created_at: now,
      });

    if (auditError) {
      console.warn('[IssueService] Failed to insert audit log record:', auditError);
    }

    const finalIssue = updatedIssue as Issue;
    await this.dispatchStatusTransitionNotification(
      finalIssue,
      validated.status,
      userId,
      supabaseClient
    );

    return finalIssue;
  }

  /**
   * Delete an issue reported by the authenticated citizen (strictly in submitted status)
   */
  static async deleteIssue(
    issueId: string,
    supabaseClient: SupabaseClient = supabase
  ): Promise<{ success: boolean; deletedIssueId: string }> {
    const { issueId: validId } = validateDeleteIssue({ issueId });

    const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to delete issue',
        401
      );
    }
    const userId = authData.user.id;

    // Fetch issue to verify ownership and status
    const { data: issue, error: fetchErr } = await supabaseClient
      .from('issues')
      .select('id, reporter_id, status')
      .eq('id', validId)
      .single();

    if (fetchErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    if (issue.reporter_id !== userId) {
      throw new IssueValidationError('You can only delete issues you reported');
    }

    if (issue.status !== 'submitted') {
      throw new IssueValidationError(
        `Cannot delete issue with status "${issue.status}". Only "submitted" issues can be deleted.`
      );
    }

    const { data: deletedRows, error: delErr } = await supabaseClient
      .from('issues')
      .delete()
      .eq('id', validId)
      .select('id');

    if (delErr) {
      console.error('[IssueService] Failed to delete issue:', delErr);
      throw delErr;
    }

    if (!deletedRows || deletedRows.length === 0) {
      throw new IssueValidationError(
        'Failed to delete issue: database policy prevented deletion or issue was not found'
      );
    }

    return { success: true, deletedIssueId: validId };
  }

  /**
   * Submit citizen feedback on a resolved issue
   */
  static async submitFeedback(
    dto: { issueId: string; feedback: 'satisfied' | 'not_satisfied'; comment?: string },
    supabaseClient: SupabaseClient = supabase
  ): Promise<Issue> {
    const validated = validateSubmitFeedback(dto);

    const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to submit feedback',
        401
      );
    }
    const userId = authData.user.id;

    // Fetch issue
    const { data: issue, error: fetchErr } = await supabaseClient
      .from('issues')
      .select('*')
      .eq('id', validated.issueId)
      .single();

    if (fetchErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    if (issue.reporter_id !== userId) {
      throw new IssueValidationError('Only the issue reporter can submit feedback');
    }

    if (issue.status !== 'resolved' && issue.status !== 'escalated') {
      throw new IssueValidationError('Feedback can only be submitted for resolved issues');
    }

    const now = new Date().toISOString();
    const feedbackComment = validated.comment?.trim() || null;
    const currentMetadata = (issue.metadata as Record<string, unknown> | null) || {};
    const updatedMetadata = {
      ...currentMetadata,
      citizen_feedback_comment: feedbackComment,
      citizen_feedback_at: now,
    };

    if (validated.feedback === 'satisfied') {
      const { data: updated, error: updateErr } = await supabaseClient
        .from('issues')
        .update({
          citizen_feedback: 'satisfied',
          metadata: updatedMetadata,
          updated_at: now,
        })
        .eq('id', validated.issueId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const finalIssue = {
        ...(updated as Issue),
        citizen_feedback_comment: feedbackComment,
        citizen_feedback_at: now,
      };
      await NotificationService.dispatchLifecycleEvent(
        {
          issueId: finalIssue.id,
          eventType: 'feedback_received',
          actorId: userId,
          issueTitle: finalIssue.title,
          trackingId: finalIssue.tracking_id,
          category: finalIssue.category,
          feedback: 'satisfied',
        },
        supabaseClient
      );

      return finalIssue;
    } else {
      // Transition status to escalated using canonical transitionStatus (dispatches issue_escalated)
      await this.transitionStatus(
        {
          issueId: validated.issueId,
          status: 'escalated',
          notes: feedbackComment || 'Citizen marked resolution as not satisfied',
        },
        supabaseClient
      );

      const { data: updated, error: updateErr } = await supabaseClient
        .from('issues')
        .update({
          citizen_feedback: 'not_satisfied',
          metadata: updatedMetadata,
          updated_at: now,
        })
        .eq('id', validated.issueId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const finalIssue = {
        ...(updated as Issue),
        citizen_feedback_comment: feedbackComment,
        citizen_feedback_at: now,
      };
      await NotificationService.dispatchLifecycleEvent(
        {
          issueId: finalIssue.id,
          eventType: 'feedback_received',
          actorId: userId,
          issueTitle: finalIssue.title,
          trackingId: finalIssue.tracking_id,
          category: finalIssue.category,
          feedback: 'not_satisfied',
        },
        supabaseClient
      );

      return finalIssue;
    }
  }

  /**
   * Upvote a civic issue as the authenticated user
   */
  static async upvoteIssue(
    issueId: string,
    supabaseClient: SupabaseClient = supabase
  ): Promise<UpvoteStatus> {
    const { issueId: validId } = validateUpvoteIssue({ issueId });

    const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to upvote an issue',
        401
      );
    }
    const userId = authData.user.id;

    // Verify issue exists and is accessible
    const { data: issue, error: issueErr } = await supabaseClient
      .from('issues')
      .select('id, upvotes_count, title, tracking_id, category, reporter_id')
      .eq('id', validId)
      .single();

    if (issueErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    // Check if user has already upvoted
    const { data: existing } = await supabaseClient
      .from('upvotes')
      .select('id')
      .eq('issue_id', validId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new IssueValidationError('You have already upvoted this issue');
    }

    // Insert new upvote row
    const { error: insertErr } = await supabaseClient
      .from('upvotes')
      .insert({
        issue_id: validId,
        user_id: userId,
      });

    if (insertErr) {
      if (insertErr.code === '23505' || insertErr.message?.toLowerCase().includes('unique')) {
        throw new IssueValidationError('You have already upvoted this issue');
      }
      console.error('[IssueService] Failed to insert upvote:', insertErr);
      throw insertErr;
    }

    // Dispatch lifecycle event: issue_upvoted (failure-isolated)
    await NotificationService.dispatchLifecycleEvent(
      {
        issueId: validId,
        eventType: 'issue_upvoted',
        actorId: userId,
        issueTitle: issue.title,
        trackingId: issue.tracking_id,
        category: issue.category,
      },
      supabaseClient
    );

    // Retrieve updated count (maintained by DB trigger or compute)
    const { data: updatedIssue } = await supabaseClient
      .from('issues')
      .select('upvotes_count')
      .eq('id', validId)
      .single();

    const finalCount = updatedIssue?.upvotes_count ?? ((issue.upvotes_count || 0) + 1);
    return { upvoted: true, upvotes_count: finalCount };
  }

  /**
   * Remove an upvote previously cast by the authenticated user
   */
  static async removeUpvote(
    issueId: string,
    supabaseClient: SupabaseClient = supabase
  ): Promise<UpvoteStatus> {
    const { issueId: validId } = validateUpvoteIssue({ issueId });

    const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to remove upvote',
        401
      );
    }
    const userId = authData.user.id;

    // Verify issue exists
    const { data: issue, error: issueErr } = await supabaseClient
      .from('issues')
      .select('id, upvotes_count')
      .eq('id', validId)
      .single();

    if (issueErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    // Delete upvote explicitly scoped to current user
    const { error: deleteErr } = await supabaseClient
      .from('upvotes')
      .delete()
      .eq('issue_id', validId)
      .eq('user_id', userId);

    if (deleteErr) {
      console.error('[IssueService] Failed to remove upvote:', deleteErr);
      throw deleteErr;
    }

    // Retrieve updated count
    const { data: updatedIssue } = await supabaseClient
      .from('issues')
      .select('upvotes_count')
      .eq('id', validId)
      .single();

    const finalCount = updatedIssue?.upvotes_count ?? Math.max(0, (issue.upvotes_count || 0) - 1);
    return { upvoted: false, upvotes_count: finalCount };
  }

  /**
   * Check whether the authenticated user has upvoted an issue and get the current count
   */
  static async getUpvoteStatus(
    issueId: string,
    supabaseClient: SupabaseClient = supabase
  ): Promise<UpvoteStatus> {
    const { issueId: validId } = validateUpvoteIssue({ issueId });

    // Fetch issue
    const { data: issue, error: issueErr } = await supabaseClient
      .from('issues')
      .select('id, upvotes_count')
      .eq('id', validId)
      .single();

    if (issueErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    const currentCount = issue.upvotes_count || 0;

    // Check user auth
    const { data: authData } = await supabaseClient.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) {
      return { upvoted: false, upvotes_count: currentCount };
    }

    const { data: upvoteRecord } = await supabaseClient
      .from('upvotes')
      .select('id')
      .eq('issue_id', validId)
      .eq('user_id', userId)
      .maybeSingle();

    return {
      upvoted: !!upvoteRecord,
      upvotes_count: currentCount,
    };
  }

  /**
   * Add a new comment to an issue as the authenticated user
   */
  static async addComment(
    issueId: string,
    content: string,
    supabaseClient: SupabaseClient = supabase
  ): Promise<IssueComment> {
    const validated = validateAddComment({ issueId, content });

    const { data: authData, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to add a comment',
        401
      );
    }
    const user = authData.user;
    const userId = user.id;

    // Verify issue exists and is accessible
    const { data: issue, error: issueErr } = await supabaseClient
      .from('issues')
      .select('id, title, tracking_id, category, reporter_id, assigned_worker_id')
      .eq('id', validated.issueId)
      .single();

    if (issueErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    // Insert comment
    const { data: commentRow, error: insertErr } = await supabaseClient
      .from('issue_comments')
      .insert({
        issue_id: validated.issueId,
        user_id: userId,
        content: validated.content,
      })
      .select()
      .single();

    if (insertErr || !commentRow) {
      console.error('[IssueService] Failed to insert comment:', insertErr);
      throw insertErr || new IssueValidationError('Failed to post comment');
    }

    // Dispatch lifecycle event: issue_commented (failure-isolated)
    await NotificationService.dispatchLifecycleEvent(
      {
        issueId: validated.issueId,
        eventType: 'issue_commented',
        actorId: userId,
        issueTitle: issue.title,
        trackingId: issue.tracking_id,
        category: issue.category,
        commentSnippet:
          validated.content.length > 50
            ? validated.content.slice(0, 47) + '...'
            : validated.content,
      },
      supabaseClient
    );

    // Fetch author profile
    let authorName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Citizen';
    let authorAvatar: string | undefined;
    let authorRole = 'citizen';

    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('full_name, avatar_url, role')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      if (profile.full_name) authorName = profile.full_name;
      if (profile.avatar_url) authorAvatar = profile.avatar_url;
      if (profile.role) authorRole = profile.role;
    }

    return {
      id: commentRow.id,
      issue_id: commentRow.issue_id,
      user_id: commentRow.user_id,
      content: commentRow.content,
      created_at: commentRow.created_at,
      updated_at: commentRow.updated_at,
      author: {
        id: userId,
        name: authorName,
        avatar: authorAvatar,
        role: authorRole,
      },
    };
  }

  /**
   * Retrieve comments for an issue with pagination and author profiles
   */
  static async getComments(
    issueId: string,
    options: { limit?: number; offset?: number } = {},
    supabaseClient: SupabaseClient = supabase
  ): Promise<IssueComment[]> {
    const validated = validateGetComments({ issueId, ...options });

    // Verify issue exists and is accessible
    const { data: issue, error: issueErr } = await supabaseClient
      .from('issues')
      .select('id')
      .eq('id', validated.issueId)
      .single();

    if (issueErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    const limit = validated.limit ?? 50;
    const offset = validated.offset ?? 0;

    const { data: comments, error: fetchErr } = await supabaseClient
      .from('issue_comments')
      .select('*')
      .eq('issue_id', validated.issueId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchErr) {
      console.error('[IssueService] Failed to fetch comments:', fetchErr);
      throw fetchErr;
    }

    if (!comments || comments.length === 0) {
      return [];
    }

    // Retrieve unique author profiles
    const userIds = Array.from(new Set(comments.map((c: { user_id: string }) => c.user_id)));
    const { data: profiles } = await supabaseClient
      .from('user_profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', userIds);

    const profileMap = new Map<string, { full_name?: string; avatar_url?: string; role?: string }>();
    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, p);
      }
    }

    return comments.map((c: { id: string; issue_id: string; user_id: string; content: string; created_at: string; updated_at: string }) => {
      const p = profileMap.get(c.user_id);
      return {
        id: c.id,
        issue_id: c.issue_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        updated_at: c.updated_at,
        author: {
          id: c.user_id,
          name: p?.full_name || 'Citizen',
          avatar: p?.avatar_url,
          role: p?.role || 'citizen',
        },
      };
    });
  }
}

export default IssueService;

