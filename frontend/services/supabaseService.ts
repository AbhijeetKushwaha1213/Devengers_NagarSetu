import { supabase } from '@/lib/supabase'
import { Issue, Event, User, Comment, PaginatedResponse, ApiResponse, UserRole } from '@/types'
import { getErrorMessage } from '@/lib/utils'
import { WorkerService } from '@backend/services/workers/workerService'
import { IssueService as CanonicalIssueService, type IssueCategory, type IssueStatus } from '@backend/services/issues/issueService'

// Base service class for common functionality
class BaseService {
  protected handleError(error: unknown, operation: string): never {
    console.error(`Error in ${operation}:`, error)
    throw new Error(getErrorMessage(error))
  }

  protected async executeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: unknown }>,
    operation: string
  ): Promise<T> {
    try {
      const { data, error } = await queryFn()
      
      if (error) {
        this.handleError(error, operation)
      }
      
      if (!data) {
        throw new Error(`No data returned from ${operation}`)
      }
      
      return data
    } catch (error) {
      this.handleError(error, operation)
    }
  }
}

// Event Service (Events feature coming soon; database table does not exist)
class EventService extends BaseService {
  async getAll(): Promise<Event[]> {
    return [];
  }

  async getById(_id: string): Promise<Event | null> {
    return null;
  }

  async create(_eventData: Omit<Event, 'id' | 'created_at'>, _userId: string): Promise<Event> {
    throw new Error('Events feature is coming soon.');
  }

  async update(_id: string, _eventData: Partial<Event>): Promise<Event> {
    throw new Error('Events feature is coming soon.');
  }

  async delete(_id: string): Promise<void> {
    return;
  }

  async getPaginated(limit: number, _offset: number = 0): Promise<PaginatedResponse<Event>> {
    return {
      data: [],
      totalCount: 0,
      hasMore: false,
      page: 1,
      limit
    };
  }

  async getByUser(_userId: string): Promise<Event[]> {
    return [];
  }
}

export const eventService = new EventService()

// Issue Service (delegated to canonical IssueService & WorkerService)
class IssueService extends BaseService {
  async getAll(): Promise<Issue[]> {
    const issues = await CanonicalIssueService.getIssues({ limit: 100, sort: 'newest' });
    return issues as unknown as Issue[];
  }

  async getById(id: string): Promise<Issue | null> {
    const issue = await CanonicalIssueService.getIssueById(id);
    return issue as unknown as Issue | null;
  }

  async create(issueData: Omit<Issue, 'id' | 'created_at' | 'comments_count' | 'volunteers_count'>, _userId: string): Promise<Issue> {
    const created = await CanonicalIssueService.createIssue({
      description: issueData.description,
      category: issueData.category as IssueCategory,
      address: issueData.address || 'Address not specified',
      municipality_id: issueData.municipality_id || null,
      panchayat_id: issueData.panchayat_id || null,
      ward_id: issueData.ward_id || null,
      image_urls: issueData.image_urls || undefined,
    });
    return created as unknown as Issue;
  }

  async update(id: string, issueData: Partial<Issue>): Promise<Issue> {
    if (issueData.status) {
      const updated = await CanonicalIssueService.transitionStatus({
        issueId: id,
        status: issueData.status as IssueStatus,
      });
      return updated as unknown as Issue;
    }
    const current = await CanonicalIssueService.getIssueById(id);
    return current as unknown as Issue;
  }

  async delete(id: string): Promise<void> {
    await CanonicalIssueService.deleteIssue(id);
  }

  async getPaginated(limit: number, offset: number = 0): Promise<PaginatedResponse<Issue>> {
    const data = await CanonicalIssueService.getIssues({ limit, offset, sort: 'newest' });
    return {
      data: (data || []) as unknown as Issue[],
      totalCount: data.length,
      hasMore: data.length === limit,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }

  async getByUser(userId: string): Promise<Issue[]> {
    const issues = await CanonicalIssueService.getIssues({ reporterId: userId });
    return issues as unknown as Issue[];
  }

  async getByCategory(category: string): Promise<Issue[]> {
    const issues = await CanonicalIssueService.getIssues({ category: category as IssueCategory });
    return issues as unknown as Issue[];
  }

  async getByStatus(status: string): Promise<Issue[]> {
    const issues = await CanonicalIssueService.getIssues({ status: status as IssueStatus });
    return issues as unknown as Issue[];
  }

  async assignToAuthority(issueId: string, authorityId: string, departmentId?: string): Promise<Issue> {
    const res = await WorkerService.assignWorker({
      issueId,
      workerId: authorityId,
      departmentId,
      notes: 'Assigned via supabaseService.assignToAuthority',
    });
    return res as unknown as Issue;
  }

  async upvote(issueId: string, userId: string): Promise<void> {
    await CanonicalIssueService.upvoteIssue(issueId, userId);
  }
}

export const issueService = new IssueService()

// File Storage Service
class StorageService extends BaseService {
  async uploadFile(file: File, bucket: string, path: string): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file)
      
      if (error) {
        this.handleError(error, 'uploadFile')
      }
      
      return data.path
    } catch (error) {
      this.handleError(error, 'uploadFile')
    }
  }

  getFileUrl(bucket: string, path: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    
    return data.publicUrl
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await this.executeQuery(
      () => supabase.storage
        .from(bucket)
        .remove([path]),
      'deleteFile'
    )
  }
}

export const storageService = new StorageService()

// User Service
class UserService extends BaseService {
  async getProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone, role, panchayat_id, municipality_id, ward_id, department_id, employee_id, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle()
      
      if (error) {
        this.handleError(error, 'getUserProfile')
      }
      
      return data
    } catch (error) {
      this.handleError(error, 'getUserProfile')
    }
  }

  async updateProfile(userId: string, profileData: Partial<User>): Promise<User> {
    const safeData: Record<string, unknown> = {}
    if (profileData.full_name !== undefined) safeData.full_name = profileData.full_name
    if (profileData.phone !== undefined) safeData.phone = profileData.phone
    if (profileData.panchayat_id !== undefined) safeData.panchayat_id = profileData.panchayat_id
    if (profileData.municipality_id !== undefined) safeData.municipality_id = profileData.municipality_id
    if (profileData.ward_id !== undefined) safeData.ward_id = profileData.ward_id
    safeData.updated_at = new Date().toISOString()

    return this.executeQuery(
      () => supabase
        .from('user_profiles')
        .update(safeData)
        .eq('id', userId)
        .select()
        .single(),
      'updateUserProfile'
    )
  }

  async createProfile(profileData: Partial<User> & { id: string; full_name: string; role?: UserRole }): Promise<User> {
    const safeData = {
      id: profileData.id,
      full_name: profileData.full_name,
      role: profileData.role || 'citizen',
      phone: profileData.phone || null,
      municipality_id: profileData.municipality_id || null,
      ward_id: profileData.ward_id || null,
      department_id: profileData.department_id || null,
      panchayat_id: profileData.panchayat_id || null,
      employee_id: profileData.employee_id || null,
      updated_at: new Date().toISOString(),
    }
    return this.executeQuery(
      () => supabase
        .from('user_profiles')
        .upsert(safeData, { onConflict: 'id' })
        .select()
        .single(),
      'createUserProfile'
    )
  }
}

export const userService = new UserService()

// Comment Service (Comments feature disabled; database table does not exist)
class CommentService extends BaseService {
  async getByIssue(_issueId: string): Promise<Comment[]> {
    return [];
  }

  async create(_commentData: Omit<Comment, 'id' | 'created_at' | 'user_name'>): Promise<Comment> {
    throw new Error('Comments feature is currently disabled.');
  }

  async delete(_commentId: string): Promise<void> {
    return;
  }
}

export const commentService = new CommentService()

// Export legacy functions for backward compatibility
export const getEvents = () => eventService.getAll()
export const getEventById = (id: string) => eventService.getById(id)
export const createEvent = (eventData: Omit<Event, 'id' | 'created_at'>, userId: string) => eventService.create(eventData, userId)
export const updateEvent = (id: string, eventData: Partial<Event>) => eventService.update(id, eventData)
export const deleteEvent = (id: string) => eventService.delete(id)
export const getUserEvents = (userId: string) => eventService.getByUser(userId)
export const getPaginatedEvents = (limit: number, offset?: number) => eventService.getPaginated(limit, offset)

export const getIssues = () => issueService.getAll()
export const getIssueById = (id: string) => issueService.getById(id)
export const createIssue = (issueData: Omit<Issue, 'id' | 'created_at'>, userId: string) => issueService.create(issueData, userId)
export const updateIssue = (id: string, issueData: Partial<Issue>) => issueService.update(id, issueData)
export const deleteIssue = (id: string) => issueService.delete(id)
export const getUserIssues = (userId: string) => issueService.getByUser(userId)

export const uploadFile = (file: File, bucket: string, path: string) => storageService.uploadFile(file, bucket, path)
export const getFileUrl = (bucket: string, path: string) => storageService.getFileUrl(bucket, path)