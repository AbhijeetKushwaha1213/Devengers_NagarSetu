import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { IssueValidationError, safeImageUrlSchema, validateAssignWorker } from '../../validators/issueValidator';
import { AuthenticationError } from '../auth/types';
import { IssueService } from '../issues/issueService';
import { NotificationService } from '../notifications';

export interface AssignWorkerDTO {
  issueId: string;
  workerId: string;
  assignedBy?: string;
  departmentId?: string | null;
  notes?: string;
}

export interface ResolveTaskDTO {
  issueId: string;
  workerId: string;
  resolutionImageUrls: string[];
  citizenFeedback?: string;
}

export class WorkerService {
  /**
   * Assign or reassign a field worker to an issue with full authorization and audit logging
   */
  static async assignWorker(
    dto: AssignWorkerDTO,
    supabaseClient: SupabaseClient = supabase
  ) {
    // 1. Runtime validation
    const validated = validateAssignWorker(dto);

    // 2. Derive authenticated user
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user?.id) {
      throw new AuthenticationError(
        'UNAUTHENTICATED',
        'Authentication required to assign workers',
        401
      );
    }
    const userId = authData.user.id;

    // Check existing issue assignment state before update to determine assignment vs reassignment
    const { data: existingIssue } = await supabaseClient
      .from('issues')
      .select('id, assigned_worker_id, title, tracking_id, category')
      .eq('id', validated.issueId)
      .single();

    const isReassignment = !!(existingIssue && existingIssue.assigned_worker_id);
    const eventType = isReassignment ? 'issue_reassigned' : 'issue_assigned';

    // 3. Attempt atomic database RPC assign_issue_worker first
    try {
      const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
        'assign_issue_worker',
        {
          p_issue_id: validated.issueId,
          p_worker_id: validated.workerId,
          p_department_id: validated.departmentId || null,
          p_notes: validated.notes || null,
        }
      );

      if (!rpcError && rpcData) {
        // Dispatch lifecycle event (failure-isolated)
        await NotificationService.dispatchLifecycleEvent(
          {
            issueId: validated.issueId,
            eventType,
            actorId: userId,
            issueTitle: rpcData.title || existingIssue?.title,
            trackingId: rpcData.tracking_id || existingIssue?.tracking_id,
            category: rpcData.category || existingIssue?.category,
          },
          supabaseClient
        );
        return rpcData;
      }
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

    // 4. Service-level authorization & assignment fallback
    // Fetch assigner profile
    const { data: assignerProfile, error: assignerErr } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (assignerErr || !assignerProfile || !assignerProfile.is_active) {
      throw new IssueValidationError('Assigner profile not found or inactive');
    }

    const allowedAssignerRoles = ['municipal_admin', 'administrator', 'pradhan'];
    if (!allowedAssignerRoles.includes(assignerProfile.role)) {
      throw new IssueValidationError('Only officials and administrators can assign workers');
    }

    // Fetch target worker profile
    const { data: workerProfile, error: workerErr } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', validated.workerId)
      .single();

    if (workerErr || !workerProfile) {
      throw new IssueValidationError('Target worker profile not found');
    }

    if (!workerProfile.is_active) {
      throw new IssueValidationError('Target worker is inactive');
    }

    const validWorkerRoles = ['worker', 'panchayat_worker'];
    if (!validWorkerRoles.includes(workerProfile.role)) {
      throw new IssueValidationError(
        `Target user is not a field worker (role: ${workerProfile.role})`
      );
    }

    // Fetch issue
    const { data: issue, error: issueErr } = await supabaseClient
      .from('issues')
      .select('*')
      .eq('id', validated.issueId)
      .single();

    if (issueErr || !issue) {
      throw new IssueValidationError('Issue not found');
    }

    // Strict Scope & Boundary Verification (ZERO UNSAFE NULL FALLBACKS)
    if (assignerProfile.role === 'municipal_admin') {
      if (!assignerProfile.municipality_id) {
        throw new IssueValidationError('Municipal admin profile lacks municipality assignment');
      }
      if (!issue.municipality_id) {
        throw new IssueValidationError('Cannot assign non-municipal/rural issue');
      }
      if (assignerProfile.municipality_id !== issue.municipality_id) {
        throw new IssueValidationError('Cannot assign issues outside your municipality');
      }
      if (workerProfile.role !== 'worker') {
        throw new IssueValidationError('Municipal admin can only assign municipal workers');
      }
      if (workerProfile.municipality_id && workerProfile.municipality_id !== assignerProfile.municipality_id) {
        throw new IssueValidationError('Target worker belongs to another municipality');
      }
    } else if (assignerProfile.role === 'pradhan') {
      if (!assignerProfile.panchayat_id) {
        throw new IssueValidationError('Pradhan profile lacks panchayat assignment');
      }
      if (!issue.panchayat_id) {
        throw new IssueValidationError('Cannot assign non-panchayat/urban issue');
      }
      if (assignerProfile.panchayat_id !== issue.panchayat_id) {
        throw new IssueValidationError('Cannot assign issues outside your panchayat');
      }
      if (workerProfile.role !== 'panchayat_worker') {
        throw new IssueValidationError('Pradhan can only assign panchayat workers');
      }
      if (workerProfile.panchayat_id && workerProfile.panchayat_id !== assignerProfile.panchayat_id) {
        throw new IssueValidationError('Target worker belongs to another panchayat');
      }
    } else if (assignerProfile.role === 'administrator') {
      // Central administrator
      if (issue.municipality_id && workerProfile.role === 'panchayat_worker') {
        throw new IssueValidationError('Cannot assign panchayat worker to municipal issue');
      }
      if (issue.panchayat_id && workerProfile.role === 'worker') {
        throw new IssueValidationError('Cannot assign municipal worker to rural panchayat issue');
      }
    }

    // Determine action: initial assignment vs reassignment
    const action = issue.assigned_worker_id ? 'WORKER_REASSIGNED' : 'WORKER_ASSIGNED';
    const targetStatus = ['submitted', 'verified'].includes(issue.status)
      ? 'in_progress'
      : issue.status;
    const now = new Date().toISOString();

    // Execute issue update
    const { data: updatedIssue, error: updateErr } = await supabaseClient
      .from('issues')
      .update({
        assigned_worker_id: validated.workerId,
        assigned_manager_id: userId,
        department_id: validated.departmentId || issue.department_id || null,
        status: targetStatus,
        updated_at: now,
      })
      .eq('id', validated.issueId)
      .select()
      .single();

    if (updateErr) {
      console.error('[WorkerService] Failed to update issue assignment:', updateErr);
      throw updateErr;
    }

    // Insert audit log record
    const { error: auditError } = await supabaseClient
      .from('issue_audit_log')
      .insert({
        issue_id: validated.issueId,
        user_id: userId,
        action,
        old_status: issue.status,
        new_status: targetStatus,
        old_data: {
          assigned_worker_id: issue.assigned_worker_id,
          department_id: issue.department_id,
          status: issue.status,
        },
        new_data: {
          assigned_worker_id: validated.workerId,
          assigned_manager_id: userId,
          department_id: validated.departmentId || issue.department_id,
          status: targetStatus,
        },
        notes: validated.notes || null,
        created_at: now,
      });

    if (auditError) {
      console.warn('[WorkerService] Failed to insert audit log record:', auditError);
    }

    // Dispatch lifecycle event (failure-isolated)
    await NotificationService.dispatchLifecycleEvent(
      {
        issueId: validated.issueId,
        eventType,
        actorId: userId,
        issueTitle: updatedIssue.title || issue.title,
        trackingId: updatedIssue.tracking_id || issue.tracking_id,
        category: updatedIssue.category || issue.category,
      },
      supabaseClient
    );

    return updatedIssue;
  }

  /**
   * Complete and resolve a task with resolution photos
   */
  static async resolveTask(dto: ResolveTaskDTO, supabaseClient: SupabaseClient = supabase) {
    if (dto.resolutionImageUrls && dto.resolutionImageUrls.length > 0) {
      for (const url of dto.resolutionImageUrls) {
        safeImageUrlSchema.parse(url);
      }
    }

    return IssueService.transitionStatus(
      {
        issueId: dto.issueId,
        status: 'resolved',
        resolutionImageUrls: dto.resolutionImageUrls,
        notes: dto.citizenFeedback || 'Task resolved by field worker',
      },
      supabaseClient
    );
  }

  /**
   * Fetch worker tasks
   */
  static async getWorkerTasks(workerId: string, supabaseClient: SupabaseClient = supabase) {
    return IssueService.getIssues({ assignedWorkerId: workerId }, supabaseClient);
  }
}

export default WorkerService;
