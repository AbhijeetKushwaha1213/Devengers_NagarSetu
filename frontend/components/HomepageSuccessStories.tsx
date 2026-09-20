import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, ArrowRight, Calendar, MapPin, User } from 'lucide-react';
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

const HomepageSuccessStories: React.FC = () => {
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuccessStories();

    // Set up real-time subscription for new success stories
    const subscription = supabase
      .channel('homepage-success-stories')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'issues',
          filter: 'status=eq.resolved'
        }, 
        (payload) => {
          console.log('Issue resolved - refreshing homepage success stories:', payload);
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
        limit: 3,
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
        // No resolved issues yet, show empty state
        setStories([]);
      }
    } catch (error) {
      console.error('Error fetching success stories:', error);
      // Show empty state on error
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <section className="py-16 px-4 md:px-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
        <div className="container mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                <Award className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-3xl font-semibold">Success Stories</h2>
            </div>
            <p className="text-muted-foreground mb-8">Loading amazing transformations...</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700"></div>
                  <div className="p-5">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full mr-3"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Don't render if no success stories
  if (stories.length === 0) {
    return (
      <section className="py-16 px-4 md:px-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
              <Award className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-3xl font-semibold">Success Stories</h2>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 max-w-2xl mx-auto mt-8">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold mb-2">No Success Stories Yet</h3>
            <p className="text-muted-foreground mb-6">
              Success stories will appear here when issues are resolved with before/after photos by our municipal workers.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>How it works:</strong> When a worker completes an issue and uploads an 'after' photo, 
                and an authority approves it as resolved, it becomes a success story showcasing our community's progress!
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-4 md:px-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
      <div className="container mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                <Award className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-3xl font-semibold">Success Stories</h2>
            </div>
            <p className="text-muted-foreground">See how our community is making a real difference</p>
          </div>
          <Link to="/issues" className="text-primary flex items-center hover:underline font-medium">
            <span>View all stories</span>
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((story, index) => (
            <div 
              key={story.id} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-scale-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Before/After Images */}
              <div className="grid grid-cols-2 h-48">
                <div className="relative">
                  <img
                    src={story.beforeImage}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    Before
                  </div>
                </div>
                <div className="relative">
                  <img
                    src={story.afterImage}
                    alt="After"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    After
                  </div>
                </div>
              </div>

              {/* Story Details */}
              <div className="p-5">
                <h3 className="font-semibold text-lg mb-2 line-clamp-1">{story.title}</h3>
                
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{story.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>Solved {formatDate(story.solvedDate)}</span>
                  </div>
                </div>

                {/* Solver Info */}
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    {story.solverAvatar ? (
                      <img
                        src={story.solverAvatar}
                        alt={story.solverName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{story.solverName}</p>
                    <p className="text-xs text-muted-foreground">Community Hero</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    {story.category}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground mb-4">
            Want to be featured as a community hero? Help solve local issues!
          </p>
          <Link 
            to="/issues" 
            className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <span>Find Issues to Solve</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomepageSuccessStories;