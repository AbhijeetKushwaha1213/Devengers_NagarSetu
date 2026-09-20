/**
 * Civic Issue Automatic Routing Types & Contracts
 * File: backend/services/routing/types.ts
 */

export interface DepartmentRoutingResult {
  departmentId: string | null;
  departmentName: string | null;
  status: 'resolved' | 'pending';
  reason: string;
}

export interface WorkerCandidate {
  id: string;
  full_name: string;
  role: string;
  municipality_id: string | null;
  department_id: string | null;
  ward_id: string | null;
  is_active: boolean;
  activeTasksCount: number;
  wardMatch: boolean;
}

export interface WorkerRoutingResult {
  workerId: string | null;
  workerName: string | null;
  status: 'assigned' | 'pending';
  reason: string;
  evaluatedWorkersCount: number;
  activeWorkload?: number;
}

export interface IssueRoutingResult {
  issueId: string;
  status: 'assigned' | 'pending_department' | 'pending_worker';
  departmentResult: DepartmentRoutingResult;
  workerResult: WorkerRoutingResult;
  routingReason: string;
  assignedIssue?: Record<string, unknown> | null;
}

export interface RouteIssueOptions {
  aiAssisted?: boolean;
  fallbackToDeterministic?: boolean;
  actorId?: string | null;
}
