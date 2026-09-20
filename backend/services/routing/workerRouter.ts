/**
 * Worker Router
 * File: backend/services/routing/workerRouter.ts
 *
 * Implements deterministic worker selection:
 * 1. Filter by municipality
 * 2. Filter by department
 * 3. Filter by active status (is_active = true)
 * 4. Filter by role (worker or panchayat_worker)
 * 5. Prioritize matching ward over municipality-wide workers
 * 6. Calculate active workload per candidate
 * 7. Select worker with lowest workload, using deterministic worker ID tie-break
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { WorkerCandidate, WorkerRoutingResult } from './types';
import { formatRoutingReason } from './routingRules';

export class WorkerRouter {
  /**
   * Finds the best eligible worker for an issue
   */
  static async selectWorker(params: {
    category: string;
    departmentId: string;
    departmentName: string;
    municipalityId: string;
    wardId?: string | null;
    wardName?: string | null;
    supabaseClient?: SupabaseClient;
  }): Promise<WorkerRoutingResult> {
    const client = params.supabaseClient || supabase;

    try {
      // 1. Query candidate workers matching municipality, department, active status, and worker role
      const query = client
        .from('user_profiles')
        .select('id, full_name, role, municipality_id, department_id, ward_id, is_active')
        .eq('municipality_id', params.municipalityId)
        .eq('department_id', params.departmentId)
        .eq('is_active', true)
        .in('role', ['worker', 'panchayat_worker']);

      const { data: workers, error: workersErr } = await query;

      if (workersErr) {
        console.error('[WorkerRouter] Error querying candidate workers:', workersErr);
        return {
          workerId: null,
          workerName: null,
          status: 'pending',
          reason: `Database error querying workers: ${workersErr.message}`,
          evaluatedWorkersCount: 0,
        };
      }

      if (!workers || workers.length === 0) {
        return {
          workerId: null,
          workerName: null,
          status: 'pending',
          reason: `No active workers registered in ${params.departmentName} for municipality`,
          evaluatedWorkersCount: 0,
        };
      }

      // 2. Filter out workers assigned to an explicit different ward if wardId is specified
      // (Workers with matching wardId or null wardId remain eligible)
      const eligibleWorkers = workers.filter((w) => {
        if (params.wardId && w.ward_id) {
          return w.ward_id === params.wardId;
        }
        return true;
      });

      if (eligibleWorkers.length === 0) {
        return {
          workerId: null,
          workerName: null,
          status: 'pending',
          reason: `No eligible workers available for ward scope in ${params.departmentName}`,
          evaluatedWorkersCount: workers.length,
        };
      }

      // 3. Compute active workloads for eligible workers
      const workerIds = eligibleWorkers.map((w) => w.id);
      const { data: activeTasks, error: tasksErr } = await client
        .from('issues')
        .select('id, assigned_worker_id')
        .in('assigned_worker_id', workerIds)
        .in('status', ['submitted', 'verified', 'in_progress']);

      if (tasksErr) {
        console.warn('[WorkerRouter] Failed to query active workloads, proceeding with 0 base:', tasksErr);
      }

      const workloadMap = new Map<string, number>();
      for (const id of workerIds) {
        workloadMap.set(id, 0);
      }

      for (const task of activeTasks || []) {
        if (task.assigned_worker_id) {
          const current = workloadMap.get(task.assigned_worker_id) || 0;
          workloadMap.set(task.assigned_worker_id, current + 1);
        }
      }

      // 4. Build scored candidates
      const candidates: WorkerCandidate[] = eligibleWorkers.map((w) => {
        const isWardMatch = !!(params.wardId && w.ward_id === params.wardId);
        return {
          id: w.id,
          full_name: w.full_name || 'Municipal Worker',
          role: w.role,
          municipality_id: w.municipality_id,
          department_id: w.department_id,
          ward_id: w.ward_id,
          is_active: w.is_active,
          activeTasksCount: workloadMap.get(w.id) || 0,
          wardMatch: isWardMatch,
        };
      });

      // 5. Deterministic sorting:
      // - Prioritize ward match (true > false)
      // - Sort by activeTasksCount ASC
      // - Tie-break by worker ID ASC
      candidates.sort((a, b) => {
        if (a.wardMatch !== b.wardMatch) {
          return a.wardMatch ? -1 : 1;
        }
        if (a.activeTasksCount !== b.activeTasksCount) {
          return a.activeTasksCount - b.activeTasksCount;
        }
        return a.id.localeCompare(b.id);
      });

      const selected = candidates[0];
      const explainableReason = formatRoutingReason({
        category: params.category,
        departmentName: params.departmentName,
        wardName: selected.wardMatch ? params.wardName || 'Assigned Ward' : 'General Municipal Scope',
        activeWorkload: selected.activeTasksCount,
        workerName: selected.full_name,
      });

      return {
        workerId: selected.id,
        workerName: selected.full_name,
        status: 'assigned',
        reason: explainableReason,
        evaluatedWorkersCount: candidates.length,
        activeWorkload: selected.activeTasksCount,
      };
    } catch (err) {
      console.error('[WorkerRouter] Unexpected error in selectWorker:', err);
      return {
        workerId: null,
        workerName: null,
        status: 'pending',
        reason: `Unexpected worker routing error: ${(err as Error).message}`,
        evaluatedWorkersCount: 0,
      };
    }
  }
}
