import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, ArrowLeft, Send, ThumbsUp, MessageSquare, AlertCircle, CheckCircle, Clock, Eye, X, Trash2, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import CitizenFeedbackModal from '@/components/CitizenFeedbackModal';
import { IssueService, type Issue, type IssueComment } from '@backend/services/issues/issueService';

// Helper functions
const getStatusIcon = (status) => {
  switch (status) {
    case 'resolved':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'in_progress':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-red-500" />;
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'resolved':
      return 'Resolved';
    case 'in_progress':
      return 'In Progress';
    case 'assigned':
      return 'Assigned';
    default:
      return 'Pending';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'resolved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-red-100 text-red-800 border-red-200';
  }
};

const IssueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  // Fetch issue data, upvote status, and persisted comments
  const fetchIssue = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    setCommentsLoading(true);
    try {
      // Query issue, upvote status, and comments via canonical IssueService
      const [issueData, upvoteStatus, persistedComments] = await Promise.all([
        IssueService.getIssueById(id),
        IssueService.getUpvoteStatus(id),
        IssueService.getComments(id),
      ]);

      if (!issueData) {
        throw new Error('Issue not found');
      }
      
      setIssue(issueData);
      setUpvoted(upvoteStatus.upvoted);
      setUpvoteCount(upvoteStatus.upvotes_count);
      setComments(persistedComments);
      setViewCount(0);
      
    } catch (error) {
      console.error('Error fetching issue:', error);
      toast({
        title: "Error loading issue",
        description: "Failed to load issue details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setCommentsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Real-time subscription for upvotes and comments
  useEffect(() => {
    if (!id) return;

    const subscription = supabase
      .channel(`issue-${id}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'issues',
          filter: `id=eq.${id}`
        }, 
        (payload) => {
          if (payload.new) {
            setUpvoteCount(payload.new.upvotes_count ?? payload.new.volunteers_count ?? 0);
            setViewCount(payload.new.view_count || 0);
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issue_comments',
          filter: `issue_id=eq.${id}`
        },
        async () => {
          try {
            const updated = await IssueService.getComments(id);
            setComments(updated);
          } catch (err) {
            console.error('Real-time comments reload error:', err);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  // Handle upvote with canonical IssueService
  const handleUpvote = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upvote this issue",
        variant: "destructive",
      });
      return;
    }

    if (!id || upvoteLoading) return;
    setUpvoteLoading(true);

    try {
      if (upvoted) {
        const result = await IssueService.removeUpvote(id);
        setUpvoted(result.upvoted);
        setUpvoteCount(result.upvotes_count);
        toast({
          title: "Upvote Removed",
          description: "Your upvote has been removed.",
        });
      } else {
        const result = await IssueService.upvoteIssue(id);
        setUpvoted(result.upvoted);
        setUpvoteCount(result.upvotes_count);
        toast({
          title: "Issue Upvoted",
          description: "Thank you for validating this civic priority.",
        });
      }
    } catch (error: unknown) {
      console.error('Error updating upvote:', error);
      const errMsg = error instanceof Error ? error.message : "Failed to update upvote";
      toast({
        title: "Action failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setUpvoteLoading(false);
    }
  };
  
  // Handle comment submission via canonical IssueService
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      });
      return;
    }
    
    if (!comment.trim() || !id || commentSubmitting) return;
    
    setCommentSubmitting(true);
    
    try {
      const newComment = await IssueService.addComment(id, comment.trim());
      setComments(prev => [...prev, newComment]);
      setComment('');
      setCommentModalOpen(false);
      
      toast({
        title: "Comment Posted",
        description: "Your note has been added to the discussion.",
      });
    } catch (error: unknown) {
      console.error('Error posting comment:', error);
      const errMsg = error instanceof Error ? error.message : "Could not post your comment";
      toast({
        title: "Failed to post comment",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Open comment modal
  const handleCommentClick = () => {
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      });
      return;
    }
    setCommentModalOpen(true);
  };

  // Handle issue deletion
  const handleDeleteIssue = async () => {
    if (!currentUser || !issue) return;

    // Check if current user is the creator
    const isCreator = (issue.reporter_id || issue.created_by) === currentUser.id;
    if (!isCreator) {
      toast({
        title: "Permission denied",
        description: "You can only delete issues you created",
        variant: "destructive",
      });
      return;
    }

    // Only allow deletion while status is submitted
    if (issue.status !== 'submitted') {
      toast({
        title: "Cannot Delete",
        description: `Cannot delete issue with status "${issue.status}". Only "submitted" issues can be deleted.`,
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Delete the issue via canonical IssueService
      await IssueService.deleteIssue(id!);

      toast({
        title: "Issue Deleted",
        description: "Your issue has been successfully deleted",
      });

      // Navigate back to issues page
      navigate('/issues');
    } catch (error: unknown) {
      console.error('Error deleting issue:', error);
      const errMsg = error instanceof Error ? error.message : "Failed to delete the issue. Please try again.";
      toast({
        title: "Delete Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading issue details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Issue not found</h2>
            <p className="text-gray-600 mb-4">The issue you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/issues')}>Back to Issues</Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="pt-32 pb-20 px-4 md:px-6 container mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate('/issues')}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back to Issues</span>
            </button>

            {/* Delete button - only show for issue creator when status is submitted */}
            {currentUser && issue && (issue.reporter_id || issue.created_by) === currentUser.id && issue.status === 'submitted' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Issue
              </Button>
            )}
          </div>
          
          {/* Issue Images - Before and After */}
          {(() => {
            const beforeImage = (issue.image_urls && issue.image_urls.length > 0) ? issue.image_urls[0] : issue.image;
            const afterImage = (issue.resolution_image_urls && issue.resolution_image_urls.length > 0) ? issue.resolution_image_urls[0] : undefined;

            return (
              <div className={`grid grid-cols-1 ${afterImage ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
                <div className="rounded-xl overflow-hidden border bg-secondary">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Reported Issue (Citizen Photo)
                  </div>
                  <div className="h-64 md:h-80 flex items-center justify-center overflow-hidden">
                    {beforeImage ? (
                      <img 
                        src={beforeImage} 
                        alt={issue.title} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No photo provided</p>
                      </div>
                    )}
                  </div>
                </div>

                {afterImage && (
                  <div className="rounded-xl overflow-hidden border border-green-300 bg-green-50/20">
                    <div className="p-2 bg-green-100 dark:bg-green-900/40 text-xs font-semibold text-green-800 dark:text-green-300 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Resolution Proof (Worker Evidence)
                    </div>
                    <div className="h-64 md:h-80 flex items-center justify-center overflow-hidden">
                      <img 
                        src={afterImage} 
                        alt="Resolved condition" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          
          {/* Issue Title and Status */}
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-3xl md:text-4xl font-semibold flex-1 pr-4">{issue.title}</h1>
            <div className="flex items-center gap-2">
              {getStatusIcon(issue.status)}
              <Badge className={`${getStatusColor(issue.status)} border`}>
                {getStatusText(issue.status)}
              </Badge>
            </div>
          </div>

          {/* Citizen Feedback Button - Show only for resolved issues created by current user */}
          {issue.status === 'resolved' && currentUser && (issue.reporter_id || issue.created_by) === currentUser.id && !issue.citizen_feedback && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    ✅ This issue has been marked as resolved!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Please let us know if you're satisfied with the resolution. Your feedback helps us improve our service.
                  </p>
                  <button
                    onClick={() => setFeedbackModalOpen(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Rate This Resolution
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Show feedback if already provided */}
          {issue.citizen_feedback && (
            <div className={`border-2 rounded-xl p-6 mb-6 ${
              issue.citizen_feedback === 'satisfied'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {issue.citizen_feedback === 'satisfied' ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {issue.citizen_feedback === 'satisfied' 
                      ? '✅ Citizen Satisfied' 
                      : '❌ Citizen Not Satisfied'}
                  </h3>
                  {issue.citizen_feedback_comment && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      "{issue.citizen_feedback_comment}"
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Feedback provided on {new Date(issue.citizen_feedback_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Issue Meta Information */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1.5" />
              <span>Reported {new Date(issue.created_at).toLocaleDateString()}</span>
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1.5" />
              <span>{issue.address || issue.location || 'Location not specified'}</span>
            </div>
            
            <Badge variant="outline" className="text-xs">
              {issue.category}
            </Badge>
          </div>
          
          {/* Issue Description */}
          <div className="bg-card border rounded-xl p-6 mb-8">
            <div className="prose prose-sm max-w-none">
              {issue.description.split('\n\n').map((paragraph, index) => (
                <p key={index} className="mb-4 text-foreground/90 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          
          {/* Upvote and Engagement Section */}
          <div className="bg-card border rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleUpvote}
                  disabled={upvoteLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
                    upvoted
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  } ${upvoteLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {upvoteLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className={`h-4 w-4 ${upvoted ? 'fill-current' : ''}`} />
                  )}
                  <span>{upvoteCount} {upvoteCount === 1 ? 'upvote' : 'upvotes'}</span>
                </button>
                
                <button
                  onClick={handleCommentClick}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{comments.length} {comments.length === 1 ? 'note' : 'notes'}</span>
                </button>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Status: <span className="font-medium">{getStatusText(issue.status)}</span>
              </div>
            </div>
          </div>
          
          {/* Comments Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Discussion ({comments.length})</h2>
            
            {commentsLoading ? (
              <div className="flex items-center justify-center py-8 mb-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading discussion...</span>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4 mb-8">
                {comments.map((c) => (
                  <div key={c.id} className="bg-card border rounded-lg p-4 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm text-primary flex-shrink-0">
                        {(c.author?.name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-foreground">{c.author?.name || 'Citizen'}</span>
                          {c.author?.role && c.author.role !== 'citizen' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                              {c.author.role.replace('_', ' ')}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-8 border rounded-lg bg-card/50">
                <MessageSquare className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No comments yet. Be the first to share your thoughts!</p>
              </div>
            )}
            
            {currentUser ? (
              <form onSubmit={handleCommentSubmit} className="bg-card border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3">Add your comment</h3>
                <div className="mb-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-3 rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Share your thoughts on this issue..."
                    rows={3}
                    required
                    disabled={commentSubmitting}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={commentSubmitting || !comment.trim()} className="flex items-center">
                    {commentSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <span>Post Comment</span>
                        <Send className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="bg-card border rounded-lg p-6 text-center">
                <p className="text-muted-foreground mb-4">Sign in to join the discussion</p>
                <Button onClick={() => navigate('/')}>Sign In</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Comment</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCommentSubmit} className="space-y-4">
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Share your thoughts on this issue..."
                rows={4}
                required
                disabled={commentSubmitting}
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCommentModalOpen(false)}
                disabled={commentSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={commentSubmitting || !comment.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {commentSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Posting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Post Comment
                  </span>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Issue
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action cannot be undone. Deleting this issue will permanently remove it from:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>All issues pages</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>Your profile and homepage</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>Authority dashboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span>All comments and upvotes</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>Issue:</strong> {issue?.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Reported on {issue && new Date(issue.created_at).toLocaleDateString()}
              </p>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete this issue?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteIssue}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Yes, Delete Issue
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Citizen Feedback Modal */}
      {issue && (
        <CitizenFeedbackModal
          isOpen={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          issueId={issue.id}
          issueTitle={issue.title}
          onFeedbackSubmitted={() => {
            // Refresh issue data
            fetchIssue();
          }}
        />
      )}
    </div>
  );
};

export default IssueDetail;
