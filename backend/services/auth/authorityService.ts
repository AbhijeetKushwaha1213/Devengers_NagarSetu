import { supabase } from '@/lib/supabase'
import { Issue, IssueStatus } from '@/types'
import { IssueService } from '../issues/issueService'
import { WorkerService } from '../workers/workerService'

export interface AuthorityStats {
  totalReports: number
  submittedIssues: number
  verifiedIssues: number
  inProgress: number
  resolvedToday: number
  totalResolved: number
  unassigned: number
  avgResponseTime: string
  satisfactionRate: number
}

export interface IssueWithPriority extends Issue {
  priority: 'low' | 'medium' | 'high' | 'critical'
}

// Get dashboard statistics scoped to municipality
export const getDashboardStats = async (municipalityId?: string): Promise<AuthorityStats> => {
  try {
    let query = supabase
      .from('issues')
      .select('id, status, created_at, resolved_at, assigned_worker_id, municipality_id')

    if (municipalityId) {
      query = query.eq('municipality_id', municipalityId)
    }

    const { data: issues, error } = await query

    if (error) throw error

    const total = issues?.length || 0
    const submitted = issues?.filter(i => i.status === 'submitted').length || 0
    const verified = issues?.filter(i => i.status === 'verified').length || 0
    const inProgress = issues?.filter(i => i.status === 'in_progress').length || 0
    const totalResolved = issues?.filter(i => i.status === 'resolved').length || 0
    const unassigned = issues?.filter(i => !i.assigned_worker_id && i.status !== 'resolved' && i.status !== 'rejected').length || 0
    
    // Calculate resolved today
    const today = new Date().toISOString().split('T')[0]
    const resolvedToday = issues?.filter(i => 
      i.status === 'resolved' && 
      (i.resolved_at?.startsWith(today) || i.created_at?.startsWith(today))
    ).length || 0

    // Calculate average response/resolution time from actual resolved issues
    const resolvedWithDates = issues?.filter(i => i.status === 'resolved' && i.resolved_at && i.created_at) || []
    let avgResponseTime = '0h'
    if (resolvedWithDates.length > 0) {
      const totalHours = resolvedWithDates.reduce((acc, curr) => {
        const diff = (new Date(curr.resolved_at!).getTime() - new Date(curr.created_at).getTime()) / (1000 * 60 * 60)
        return acc + Math.max(0, diff)
      }, 0)
      avgResponseTime = `${(totalHours / resolvedWithDates.length).toFixed(1)}h`
    }

    return {
      totalReports: total,
      submittedIssues: submitted,
      verifiedIssues: verified,
      inProgress,
      resolvedToday,
      totalResolved,
      unassigned,
      avgResponseTime,
      satisfactionRate: 0
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    throw error
  }
}

// Get issues with priority calculation scoped to municipality
export const getIssuesWithPriority = async (municipalityId?: string): Promise<IssueWithPriority[]> => {
  try {
    const issues = await IssueService.getIssues({
      municipalityId,
      limit: 50,
      offset: 0,
      sort: 'newest',
    });

    return (issues || []).map(issue => ({
      ...issue,
      location: issue.address || 'Address not specified',
      assigned_worker_id: issue.assigned_worker_id,
      priority: calculatePriority(issue.category, issue.created_at)
    }))
  } catch (error) {
    console.error('Error fetching issues:', error)
    throw error
  }
}

const CANONICAL_PRIORITIES: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  dead_animal: 'critical',
  water_supply: 'high',
  stagnant_water: 'high',
  street_light: 'medium',
  garbage_dump: 'medium',
  cleanliness: 'low',
  littering: 'low',
};

// Calculate priority based on category and age
const calculatePriority = (category: string, createdAt: string): 'low' | 'medium' | 'high' | 'critical' => {
  let basePriority = CANONICAL_PRIORITIES[category] || 'medium';

  
  // Increase priority based on age
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceCreated > 7) {
    const priorities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical']
    const currentIndex = priorities.indexOf(basePriority)
    if (currentIndex < priorities.length - 1) {
      basePriority = priorities[currentIndex + 1]
    }
  }

  return basePriority
}

// Update issue status with valid DB enum
export const updateIssueStatus = async (issueId: string, status: IssueStatus, assignedWorkerId?: string) => {
  try {
    if (assignedWorkerId) {
      await WorkerService.assignWorker({
        issueId,
        workerId: assignedWorkerId,
        notes: `Status update to ${status} with worker assignment`,
      });
    }

    await IssueService.transitionStatus({
      issueId,
      status,
      notes: `Status updated via authority service to ${status}`,
    });

    return { success: true }
  } catch (error) {
    console.error('Error updating issue status:', error)
    throw error
  }
}

// Assign issue to department/worker using real DB columns
export const assignIssue = async (issueId: string, assignedWorkerId: string, departmentId?: string) => {
  try {
    await WorkerService.assignWorker({
      issueId,
      workerId: assignedWorkerId,
      departmentId,
      notes: 'Assigned via authority service',
    });

    return { success: true }
  } catch (error) {
    console.error('Error assigning issue:', error)
    throw error
  }
}

// Get category breakdown for analytics
export const getCategoryBreakdown = async (municipalityId?: string) => {
  try {
    let query = supabase
      .from('issues')
      .select('category')

    if (municipalityId) {
      query = query.eq('municipality_id', municipalityId)
    }

    const { data: issues, error } = await query

    if (error) throw error

    const categoryCount: { [key: string]: number } = {}
    issues?.forEach(issue => {
      categoryCount[issue.category] = (categoryCount[issue.category] || 0) + 1
    })

    return Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  } catch (error) {
    console.error('Error fetching category breakdown:', error)
    throw error
  }
}

// Get performance metrics
export const getPerformanceMetrics = async (municipalityId?: string) => {
  try {
    let query = supabase
      .from('issues')
      .select('id, status, created_at, resolved_at')

    if (municipalityId) {
      query = query.eq('municipality_id', municipalityId)
    }

    const { data: issues, error } = await query

    if (error) throw error

    const total = issues?.length || 0
    const resolved = issues?.filter(issue => issue.status === 'resolved').length || 0
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    const resolvedWithDates = issues?.filter(issue => issue.status === 'resolved' && issue.resolved_at && issue.created_at) || []
    let avgResponseTime = '0h'
    if (resolvedWithDates.length > 0) {
      const totalHours = resolvedWithDates.reduce((acc, curr) => {
        const diff = (new Date(curr.resolved_at!).getTime() - new Date(curr.created_at).getTime()) / (1000 * 60 * 60)
        return acc + Math.max(0, diff)
      }, 0)
      avgResponseTime = `${(totalHours / resolvedWithDates.length).toFixed(1)}h`
    }

    return {
      resolutionRate,
      avgResponseTime,
      satisfactionRate: 0,
      totalIssues: total,
      resolvedIssues: resolved
    }
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    throw error
  }
}