import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OfficialTaskCard } from '@/types';
import { IssueService } from '@backend/services/issues/issueService';
import { StorageService } from '@backend/services/storage/storageService';
import { WorkerService } from '@backend/services/workers/workerService';

const UploadResolution: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [issue, setIssue] = useState<OfficialTaskCard | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);
  const [afterImagePreview, setAfterImagePreview] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchIssueDetails = useCallback(async () => {
    try {
      const data = await IssueService.getIssueById(id);

      if (!data) {
        throw new Error('Issue not found');
      }

      if (data.status !== 'in_progress') {
        navigate(`/official/issue/${id}`);
        return;
      }

      setIssue(data as unknown as OfficialTaskCard);
    } catch (error) {
      console.error('Error fetching issue:', error);
      setError('Failed to load issue details');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) {
      fetchIssueDetails();
    }
  }, [id, fetchIssueDetails]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      setAfterImage(file);
      setAfterImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue) return;

    setUploading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let resolutionImageUrl: string | null = null;

      // Upload resolution photo via canonical StorageService with base64 fallback
      if (afterImage) {
        try {
          resolutionImageUrl = await StorageService.uploadResolutionImage(afterImage, issue.id);
        } catch (storageErr) {
          console.warn('[UploadResolution] Storage upload unavailable, using base64 fallback:', storageErr);
          resolutionImageUrl = await StorageService.compressImageToBase64(afterImage);
        }
      }

      // Update issue using canonical WorkerService contract
      await WorkerService.resolveTask({
        issueId: issue.id,
        workerId: user.id,
        resolutionImageUrls: resolutionImageUrl ? [resolutionImageUrl] : [],
        citizenFeedback: resolutionNote.trim() || undefined,
      });

      // Navigate back to worker dashboard with success message
      navigate('/worker/dashboard', { 
        state: { message: 'Issue marked as resolved successfully!' }
      });
    } catch (err) {
      console.error('Error submitting resolution:', err);
      const submitError = err as Error;
      setError(submitError.message || 'Failed to submit resolution. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Issue Not Found</h2>
          <button
            onClick={() => navigate('/worker/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const beforePhoto = (issue.image_urls && issue.image_urls.length > 0)
    ? issue.image_urls[0]
    : issue.image;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(`/worker/issue/${id}`)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Issue</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Complete Job #{issue.tracking_id || issue.id.slice(0, 8).toUpperCase()}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Before (Reference) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              "Before" Photo (Citizen Report)
            </h2>
            {beforePhoto ? (
              <img
                src={beforePhoto}
                alt="Before"
                className="w-full max-w-2xl rounded-lg shadow-md max-h-96 object-cover"
              />
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No before image available</p>
            )}
          </div>

          {/* Section 2: After (Required) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              "After" (Required) <span className="text-red-500">*</span>
            </h2>
            
            <div className="space-y-4">
              {afterImagePreview ? (
                <div className="relative">
                  <img
                    src={afterImagePreview}
                    alt="After"
                    className="w-full max-w-2xl rounded-lg shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAfterImage(null);
                      setAfterImagePreview('');
                    }}
                    className="absolute top-2 right-2 px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                  <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Upload a photo of the resolved issue
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Upload className="w-5 h-5" />
                    UPLOAD 'AFTER' PHOTO
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Maximum file size: 5MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Resolution Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Resolution Notes (Optional)
            </h2>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g., Resolved by Crew A. Used 3 bags of asphalt. Road is clear."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              rows={4}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <button
              type="submit"
              disabled={uploading || !afterImage}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  SUBMIT FOR FINAL APPROVAL
                </>
              )}
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-3">
              This will move the issue to "Pending Approval" and notify the admin
            </p>
          </div>
        </form>
      </main>
    </div>
  );
};

export default UploadResolution;
