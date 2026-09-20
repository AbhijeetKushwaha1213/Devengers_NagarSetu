
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageSquare, Calendar, Users, ThumbsUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { IssueService } from '@backend/services/issues/issueService';

interface IssueCardProps {
  id: string;
  title: string;
  description: string;
  location?: string;
  address?: string;
  category: string;
  image?: string;
  images?: string[]; // Support multiple images
  date: string;
  commentsCount: number;
  volunteersCount: number;
  isFeatured?: boolean;
  className?: string;
  onUpvoteUpdate?: (id: string, newCount: number) => void;
}

import { getCategoryMetadata } from '@/constants/categories';

const getCategoryClass = (category: string) => {
  const meta = getCategoryMetadata(category);
  return `${meta.bgColor} ${meta.color} ${meta.borderColor}`;
};


const IssueCard: React.FC<IssueCardProps> = ({
  id,
  title,
  description,
  location,
  address,
  category,
  image,
  images,
  date,
  commentsCount,
  volunteersCount,
  isFeatured = false,
  className,
  onUpvoteUpdate
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [upvoted, setUpvoted] = useState(false);
  const [currentUpvoteCount, setCurrentUpvoteCount] = useState(volunteersCount);
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Prepare images array - use images prop if available, otherwise use single image
  const imageArray = images && images.length > 0 ? images : (image ? [image] : []);
  const hasMultipleImages = imageArray.length > 1;

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 50;

  // Update local count when prop changes
  useEffect(() => {
    setCurrentUpvoteCount(volunteersCount);
  }, [volunteersCount]);

  // Query upvote status for the current user
  useEffect(() => {
    if (!currentUser?.id || !id) {
      setUpvoted(false);
      return;
    }
    let isMounted = true;
    IssueService.getUpvoteStatus(id)
      .then((status) => {
        if (isMounted) {
          setUpvoted(status.upvoted);
          setCurrentUpvoteCount(status.upvotes_count);
        }
      })
      .catch((err) => {
        console.debug('[IssueCard] Could not load upvote status:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [id, currentUser?.id]);

  // Handle image navigation
  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? imageArray.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === imageArray.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  // Touch handlers for swipe gestures
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Swipe left - go to next image
      setCurrentImageIndex((prev) => (prev === imageArray.length - 1 ? 0 : prev + 1));
    } else if (isRightSwipe) {
      // Swipe right - go to previous image
      setCurrentImageIndex((prev) => (prev === 0 ? imageArray.length - 1 : prev - 1));
    }
  };

  // Handle upvote with canonical IssueService
  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to detail page
    e.stopPropagation();

    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upvote this issue",
        variant: "destructive",
      });
      return;
    }

    if (isUpvoting || !id) return;
    setIsUpvoting(true);

    try {
      if (upvoted) {
        const result = await IssueService.removeUpvote(id);
        setUpvoted(result.upvoted);
        setCurrentUpvoteCount(result.upvotes_count);
        onUpvoteUpdate?.(id, result.upvotes_count);
        toast({
          title: "Upvote Removed",
          description: "Your upvote has been removed.",
        });
      } else {
        const result = await IssueService.upvoteIssue(id);
        setUpvoted(result.upvoted);
        setCurrentUpvoteCount(result.upvotes_count);
        onUpvoteUpdate?.(id, result.upvotes_count);
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
      setIsUpvoting(false);
    }
  };

  return (
    <div className={cn(
      "rounded-xl overflow-hidden bg-white border border-border/50 shadow-subtle hover:shadow-md transition-shadow",
      className
    )}>
      <Link to={`/issues/${id}`} className="block">
        {imageArray.length > 0 && (
          <div 
            className="relative w-full h-48 overflow-hidden group"
            onTouchStart={hasMultipleImages ? onTouchStart : undefined}
            onTouchMove={hasMultipleImages ? onTouchMove : undefined}
            onTouchEnd={hasMultipleImages ? onTouchEnd : undefined}
          >
            {/* Image Display */}
            <img 
              src={imageArray[currentImageIndex]} 
              alt={`${title} - Image ${currentImageIndex + 1}`} 
              className="w-full h-full object-cover transition-opacity duration-300" 
              loading="lazy" 
            />
            
            {/* Category Badge */}
            <div 
              className={cn(
                "absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium border",
                getCategoryClass(category)
              )}
            >
              {category}
            </div>

            {/* Multiple Images Indicator & Navigation */}
            {hasMultipleImages && (
              <>
                {/* Image Counter Badge */}
                <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium">
                  {currentImageIndex + 1} / {imageArray.length}
                </div>

                {/* Navigation Arrows */}
                <button
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Dot Indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {imageArray.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => handleDotClick(index, e)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        index === currentImageIndex 
                          ? "bg-white w-6" 
                          : "bg-white/50 hover:bg-white/70"
                      )}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        
        <div className="p-5">
          {!image && (
            <div 
              className={cn(
                "inline-flex mb-2 px-2 py-1 rounded-md text-xs font-medium border items-center gap-1",
                getCategoryClass(category)
              )}
            >
              <span>{getCategoryMetadata(category).icon}</span>
              <span>{getCategoryMetadata(category).label}</span>
            </div>
          )}
          
          <h3 className={cn(
            "font-semibold mb-2 text-balance",
            isFeatured ? "text-2xl" : "text-lg"
          )}>
            {title}
          </h3>
          
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {description}
          </p>
          
          <div className="flex items-center text-xs text-muted-foreground mb-3">
            <MapPin className="h-3 w-3 mr-1" />
            <span className="truncate">{address || location || 'Location not specified'}</span>
          </div>
        </div>
      </Link>
      
      {/* Action Bar - Outside the Link to prevent navigation conflicts */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between pt-4 border-t border-border/30">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleUpvote}
              disabled={isUpvoting}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                upvoted 
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
                  : "text-gray-600 hover:bg-gray-100",
                isUpvoting && "opacity-50 cursor-not-allowed"
              )}
            >
              <ThumbsUp className={cn("h-3 w-3", upvoted && "fill-current")} />
              <span>{currentUpvoteCount}</span>
            </button>
            
            <Link 
              to={`/issues/${id}`}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-xs"
            >
              <MessageSquare className="h-3 w-3" />
              <span>{commentsCount}</span>
            </Link>
          </div>
          
          <div className="flex items-center text-xs text-gray-500">
            <Calendar className="h-3 w-3 mr-1" />
            <span>{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueCard;
