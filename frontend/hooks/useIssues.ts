import { useState, useEffect, useCallback } from 'react'
import { Issue, IssueFilters } from '@/types'
import { IssueService } from '@backend/services/issues/issueService'
import { useToast } from '@/components/ui/use-toast'
import { getErrorMessage } from '@/lib/utils'

interface UseIssuesOptions {
  filters?: IssueFilters
  pageSize?: number
  autoLoad?: boolean
}

interface UseIssuesReturn {
  issues: Issue[]
  loading: boolean
  error: string | null
  totalCount: number
  hasMore: boolean
  currentPage: number
  
  // Actions
  loadIssues: () => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  createIssue: (issueData: Omit<Issue, 'id' | 'created_at' | 'comments_count' | 'volunteers_count'>) => Promise<Issue>
  updateIssue: (id: string, issueData: Partial<Issue>) => Promise<void>
  deleteIssue: (id: string) => Promise<void>
  
  // Filters
  setFilters: (filters: IssueFilters) => void
  clearFilters: () => void
}

export const useIssues = (options: UseIssuesOptions = {}): UseIssuesReturn => {
  const { filters = {}, pageSize = 10, autoLoad = true } = options
  const { toast } = useToast()
  
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentFilters, setCurrentFilters] = useState<IssueFilters>(filters)

  const loadIssues = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const offset = (page - 1) * pageSize
      const data = await IssueService.getIssues({
        limit: pageSize,
        offset,
      })
      
      if (append) {
        setIssues(prev => [...prev, ...(data as unknown as Issue[])])
      } else {
        setIssues(data as unknown as Issue[])
      }
      
      setTotalCount(data.length)
      setHasMore(data.length === pageSize)
      setCurrentPage(page)
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
      toast({
        title: "Error loading issues",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [pageSize, toast])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    await loadIssues(currentPage + 1, true)
  }, [hasMore, loading, currentPage, loadIssues])

  const refresh = useCallback(async () => {
    await loadIssues(1, false)
  }, [loadIssues])

  const createIssue = useCallback(async (issueData: Omit<Issue, 'id' | 'created_at' | 'comments_count' | 'volunteers_count'>) => {
    try {
      // Assuming we have access to current user ID from auth context
      const newIssue = await issueService.create(issueData, issueData.created_by)
      
      // Add to the beginning of the list
      setIssues(prev => [newIssue, ...prev])
      setTotalCount(prev => prev + 1)
      
      toast({
        title: "Issue created",
        description: "Your issue has been reported successfully.",
      })
      
      return newIssue
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      toast({
        title: "Error creating issue",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    }
  }, [toast])

  const updateIssue = useCallback(async (id: string, issueData: Partial<Issue>) => {
    try {
      const updatedIssue = await issueService.update(id, issueData)
      
      setIssues(prev => prev.map(issue => 
        issue.id === id ? updatedIssue : issue
      ))
      
      toast({
        title: "Issue updated",
        description: "The issue has been updated successfully.",
      })
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      toast({
        title: "Error updating issue",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    }
  }, [toast])

  const deleteIssue = useCallback(async (id: string) => {
    try {
      await IssueService.deleteIssue(id)
      
      setIssues(prev => prev.filter(issue => issue.id !== id))
      setTotalCount(prev => prev - 1)
      
      toast({
        title: "Issue deleted",
        description: "The issue has been deleted successfully.",
      })
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      toast({
        title: "Error deleting issue",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    }
  }, [toast])

  const setFilters = useCallback((newFilters: IssueFilters) => {
    setCurrentFilters(newFilters)
    // Reset pagination when filters change
    setCurrentPage(1)
    loadIssues(1, false)
  }, [loadIssues])

  const clearFilters = useCallback(() => {
    setCurrentFilters({})
    setCurrentPage(1)
    loadIssues(1, false)
  }, [loadIssues])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadIssues()
    }
  }, [autoLoad, loadIssues])

  return {
    issues,
    loading,
    error,
    totalCount,
    hasMore,
    currentPage,
    
    // Actions
    loadIssues: () => loadIssues(),
    loadMore,
    refresh,
    createIssue,
    updateIssue,
    deleteIssue,
    
    // Filters
    setFilters,
    clearFilters,
  }
}