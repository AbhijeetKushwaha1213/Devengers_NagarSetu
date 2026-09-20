import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Award, Calendar, MapPin, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { IssueService } from '@backend/services/issues/issueService';

interface SuccessStory {
  id: string;
  title: string;
  location: string;
  beforeImage: string;
  afterImage: string;
  solverName: string;
  solverAvatar?: string;
  solvedDate: string;
  category: string;
}

// No hardcoded data - only show real resolved issues with before/after photos

const SuccessStoriesShowcase: React.FC = () => {
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuccessStories();

    // Set up real-time subscription for new success stories
    const subscription = supabase
      .channel('success-stories-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'issues',
          filter: 'status=eq.resolved'
        }, 
        (payload) => {
          console.log('Issue resolved - refreshing success stories:', payload);
          // Refresh success stories when an issue is marked as resolved
          fetchSuccessStories();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSuccessStories = async () => {
    setLoading(true);
    try {
      // Query for resolved issues via canonical IssueService
      const data = await IssueService.getIssues({
        status: 'resolved',
        limit: 10,
        sort: 'newest',
      });

      if (data && data.length > 0) {
        const storiesWithPhotos = data.filter(
          (story) =>
            ((story.image_urls && story.image_urls.length > 0) || story.image) &&
            ((story.resolution_image_urls && story.resolution_image_urls.length > 0) || story.resolution_image)
        );

        const transformedStories = storiesWithPhotos.map((story) => ({
          id: story.id,
          title: story.title,
          location: story.address || 'Local Community',
          beforeImage: (story.image_urls && story.image_urls[0]) || story.image || '',
          afterImage: (story.resolution_image_urls && story.resolution_image_urls[0]) || story.resolution_image || '',
          solverName: 'Municipal Worker',
          solverAvatar: undefined,
          solvedDate: story.resolved_at || story.updated_at,
          category: story.category || 'General'
        }));
        
        setStories(transformedStories);
      } else {
        // No resolved issues yet, hide component
        setStories([]);
      }
    } catch (error) {
      console.error('Error fetching success stories:', error);
      // Hide component on error
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  const nextStory = () => {
    setCurrentIndex((prev) => (prev + 1) % stories.length);
  };

  const prevStory = () => {
    setCurrentIndex((prev) => (prev - 1 + stories.length) % stories.length);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading || stories.length === 0) {
    return null; // Don't show anything if loading or no stories
  }

  const currentStory = stories[currentIndex];

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 py-8 mb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
              <Award className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Success Stories</h2>
              <p className="text-sm text-muted-foreground">See how our community is making a difference</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={prevStory}
              className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
              disabled={stories.length <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground px-2">
              {currentIndex + 1} of {stories.length}
            </span>
            <button
              onClick={nextStory}
              className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
              disabled={stories.length <= 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Before Image */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Before</h3>
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={currentStory.beforeImage}
                  alt="Before solving the issue"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* After Image */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">After</h3>
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={currentStory.afterImage}
                  alt="After solving the issue"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Story Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{currentStory.title}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{currentStory.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Solved on {formatDate(currentStory.solvedDate)}</span>
                  </div>
                </div>
              </div>

              {/* Solver Info */}
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Solved by:</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                    {currentStory.solverAvatar ? (
                      <img
                        src={currentStory.solverAvatar}
                        alt={currentStory.solverName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{currentStory.solverName}</p>
                    <p className="text-sm text-muted-foreground">Community Hero</p>
                  </div>
                </div>
              </div>

              {/* Category Badge */}
              <div className="pt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  {currentStory.category}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessStoriesShowcase;