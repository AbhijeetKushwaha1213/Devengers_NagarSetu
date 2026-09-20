import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { IssueService } from '@backend/services/issues/issueService';

interface CitizenFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  issueTitle: string;
  onFeedbackSubmitted: () => void;
}

const CitizenFeedbackModal: React.FC<CitizenFeedbackModalProps> = ({
  isOpen,
  onClose,
  issueId,
  issueTitle,
  onFeedbackSubmitted
}) => {
  const [selectedFeedback, setSelectedFeedback] = useState<'satisfied' | 'not_satisfied' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedFeedback) {
      alert('Please select if you are satisfied or not satisfied');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (selectedFeedback === 'satisfied') {
        // Submit satisfied feedback via canonical IssueService
        await IssueService.submitFeedback({
          issueId,
          feedback: 'satisfied',
          comment: comment.trim() || undefined,
        });

        alert('✅ Thank you for your feedback! Your confirmation has been recorded.');
      } else {
        // Submit dissatisfaction and escalate via canonical IssueService
        await IssueService.submitFeedback({
          issueId,
          feedback: 'not_satisfied',
          comment: comment.trim() || 'Citizen is not satisfied with the resolution.',
        });

        alert('⚠️ Your feedback has been recorded. The issue has been escalated for administrative review.');
      }

      onFeedbackSubmitted();
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      const err = error as Error;
      alert('Failed to submit feedback: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Rate This Resolution
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {issueTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Question */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Are you satisfied with how this issue was resolved?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your feedback helps us improve our service quality.
            </p>
          </div>

          {/* Feedback Options */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Satisfied */}
            <button
              onClick={() => setSelectedFeedback('satisfied')}
              className={`p-6 border-2 rounded-xl transition-all ${
                selectedFeedback === 'satisfied'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
              }`}
            >
              <ThumbsUp className={`w-12 h-12 mx-auto mb-3 ${
                selectedFeedback === 'satisfied' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                Satisfied
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Issue is properly resolved
              </p>
            </button>

            {/* Not Satisfied */}
            <button
              onClick={() => setSelectedFeedback('not_satisfied')}
              className={`p-6 border-2 rounded-xl transition-all ${
                selectedFeedback === 'not_satisfied'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
              }`}
            >
              <ThumbsDown className={`w-12 h-12 mx-auto mb-3 ${
                selectedFeedback === 'not_satisfied' ? 'text-red-600' : 'text-gray-400'
              }`} />
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                Not Satisfied
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Issue needs more work
              </p>
            </button>
          </div>

          {/* Comment Section */}
          {selectedFeedback && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                {selectedFeedback === 'satisfied' 
                  ? 'Additional Comments (Optional)' 
                  : 'Please explain what needs to be fixed (Required)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  selectedFeedback === 'satisfied'
                    ? 'Share your experience or appreciation...'
                    : 'Describe what is still wrong or needs improvement...'
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                rows={4}
                required={selectedFeedback === 'not_satisfied'}
              />
              {selectedFeedback === 'not_satisfied' && !comment.trim() && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  * Please provide details so we can fix the issue properly
                </p>
              )}
            </div>
          )}

          {/* Info Box */}
          {selectedFeedback === 'satisfied' && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                ✅ <strong>This will permanently close the issue.</strong> The issue will be marked as successfully resolved.
              </p>
            </div>
          )}

          {selectedFeedback === 'not_satisfied' && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">
                ❌ <strong>This will reopen the issue.</strong> Your feedback will be sent to the worker and admin for review.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFeedback || (selectedFeedback === 'not_satisfied' && !comment.trim()) || submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CitizenFeedbackModal;
