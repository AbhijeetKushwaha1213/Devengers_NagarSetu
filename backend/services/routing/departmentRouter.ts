/**
 * Department Router
 * File: backend/services/routing/departmentRouter.ts
 *
 * Dynamically resolves the appropriate municipal department from public.departments
 * strictly within the authorized municipality boundary.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { IssueCategory } from '../../types';
import { DepartmentRoutingResult } from './types';
import { matchesDepartmentCategory } from './routingRules';

export class DepartmentRouter {
  /**
   * Resolves the target department for an issue within a municipality
   */
  static async resolveDepartment(
    category: IssueCategory,
    municipalityId: string | null | undefined,
    supabaseClient: SupabaseClient = supabase
  ): Promise<DepartmentRoutingResult> {
    if (!municipalityId) {
      return {
        departmentId: null,
        departmentName: null,
        status: 'pending',
        reason: 'Issue is not associated with any municipality jurisdiction',
      };
    }

    try {
      // Query departments strictly scoped to the issue municipality
      const { data: departments, error } = await supabaseClient
        .from('departments')
        .select('id, name, municipality_id')
        .eq('municipality_id', municipalityId);

      if (error) {
        console.error('[DepartmentRouter] Error querying departments:', error);
        return {
          departmentId: null,
          departmentName: null,
          status: 'pending',
          reason: `Database error querying departments: ${error.message}`,
        };
      }

      if (!departments || departments.length === 0) {
        return {
          departmentId: null,
          departmentName: null,
          status: 'pending',
          reason: `No departments registered for municipality ${municipalityId}`,
        };
      }

      // Find first matching department according to deterministic category rules
      const matched = departments.find((dept) =>
        matchesDepartmentCategory(dept.name, category)
      );

      if (matched) {
        return {
          departmentId: matched.id,
          departmentName: matched.name,
          status: 'resolved',
          reason: `Category "${category}" matched department "${matched.name}"`,
        };
      }

      return {
        departmentId: null,
        departmentName: null,
        status: 'pending',
        reason: `No registered department in municipality matches category "${category}"`,
      };
    } catch (err) {
      console.error('[DepartmentRouter] Unexpected error in resolveDepartment:', err);
      return {
        departmentId: null,
        departmentName: null,
        status: 'pending',
        reason: `Unexpected routing error: ${(err as Error).message}`,
      };
    }
  }
}
