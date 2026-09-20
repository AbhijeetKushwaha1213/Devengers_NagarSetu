import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, MapPin, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { IssueService } from '@backend/services/issues/issueService';
import { Card, CardContent } from '@/components/ui/card';
import { Issue } from '@/types';

interface ResolvedIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  image: string;
  resolution_image: string;
  created_at: string;
  updated_at: string;
}

const ResolvedIssuesShowcase: React.FC = () => {
  const [resolvedIssues, setResolvedIssues] = useState<ResolvedIssue[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchResolvedIssues();
  }, []);

  // Auto-advance carousel every 8 seconds
  useEffect(() => {
    if (resolvedIssues.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % resolvedIssues.length);
      setSliderPosition(50); // Reset slider on change
    }, 8000);

    return () => clearInterval(interval);
  }, [resolvedIssues.length]);

  const fetchResolvedIssues = async () => {
    try {
      const data = await IssueService.getIssues({
        status: 'resolved',
        limit: 10,
        sort: 'newest',
      });

      if (data && data.length > 0) {
        const withPhotos = (data as unknown as Issue[]).filter(
          (item) => (item.image_urls && item.image_urls.length > 0) && (item.resolution_image_urls && item.resolution_image_urls.length > 0)
        );
        const mapped = withPhotos.map((item: Issue) => ({
          ...item,
          image: item.image_urls![0],
          resolution_image: item.resolution_image_urls![0],
          location: item.address || 'Location not specified',
          updated_at: item.updated_at || item.resolved_at || item.created_at
        }));
        setResolvedIssues(mapped);
      } else {
        setResolvedIssues([]);
      }
    } catch (error) {
      console.error('Error fetching resolved issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + resolvedIssues.length) % resolvedIssues.length);
    setSliderPosition(50);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % resolvedIssues.length);
    setSliderPosition(50);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const generateAIDescription = (issue: ResolvedIssue) => {
    const timeToResolve = Math.floor(
      (new Date(issue.updated_at).getTime() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const descriptions = [
      `Successfully resolved ${issue.category.toLowerCase()} issue in ${issue.location}. Our dedicated team worked diligently to address this concern, completing the work in ${timeToResolve} days. The transformation is clearly visible in the before and after images.`,
      `This ${issue.category.toLowerCase()} problem has been fully addressed by our municipal team. Located at ${issue.location}, the issue was resolved efficiently within ${timeToResolve} days, demonstrating our commitment to community welfare.`,
      `Community-reported ${issue.category.toLowerCase()} issue successfully resolved! Our team responded promptly to this concern at ${issue.location}, completing the necessary repairs in ${timeToResolve} days. The results speak for themselves.`,
      `Another success story! This ${issue.category.toLowerCase()} issue at ${issue.location} has been completely resolved by our field workers. The work was completed in ${timeToResolve} days, showcasing our dedication to maintaining our city's infrastructure.`,
    ];

    return descriptions[Math.floor(Math.random() * descriptions.length)];
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white/80">Loading success stories...</p>
      </div>
    );
  }

  if (resolvedIssues.length === 0) {
    return null; // Don't show section if no resolved issues
  }

  const currentIssue = resolvedIssues[currentIndex];

  return (
    <section className="py-20 px-6 bg-black/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">
              Success Stories
            </h2>
            <Sparkles className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-white/90 text-lg max-w-2xl mx-auto">
            See how we're making a difference - Real issues, Real solutions
          </p>
        </motion.div>

        <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Before/After Image Slider */}
              <div className="relative h-[400px] lg:h-[500px] bg-gray-900">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    {/* Before/After Slider Container */}
                    <div
                      className="relative w-full h-full overflow-hidden cursor-ew-resize select-none"
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onMouseMove={handleMouseMove}
                      onTouchStart={handleMouseDown}
                      onTouchEnd={handleMouseUp}
                      onTouchMove={handleTouchMove}
                    >
                      {/* After Image (Background) */}
                      <div className="absolute inset-0">
                        <img
                          src={currentIssue.resolution_image}
                          alt="After resolution"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg">
                          ✓ AFTER
                        </div>
                      </div>

                      {/* Before Image (Overlay with clip) */}
                      <div
                        className="absolute inset-0"
                        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                      >
                        <img
                          src={currentIssue.image}
                          alt="Before resolution"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg">
                          BEFORE
                        </div>
                      </div>

                      {/* Slider Handle */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                        style={{ left: `${sliderPosition}%` }}
                      >
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center">
                          <div className="flex gap-1">
                            <ChevronLeft className="w-4 h-4 text-gray-700" />
                            <ChevronRight className="w-4 h-4 text-gray-700" />
                          </div>
                        </div>
                      </div>

                      {/* Drag Instruction */}
                      {sliderPosition === 50 && (
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm animate-pulse">
                          ← Drag to compare →
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows */}
                {resolvedIssues.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevious}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10 shadow-lg"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10 shadow-lg"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Dots Indicator */}
                {resolvedIssues.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                    {resolvedIssues.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentIndex(index);
                          setSliderPosition(50);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentIndex
                            ? 'bg-white w-8'
                            : 'bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Issue Details */}
              <div className="p-8 lg:p-12 flex flex-col justify-center bg-gradient-to-br from-white/5 to-white/10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Status Badge */}
                    <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-2 rounded-full mb-6">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">RESOLVED</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
                      {currentIssue.title}
                    </h3>

                    {/* Category Badge */}
                    <div className="inline-block bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-sm font-medium mb-6">
                      {currentIssue.category}
                    </div>

                    {/* AI-Generated Description */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <span className="text-purple-300 font-semibold text-sm">AI Summary</span>
                      </div>
                      <p className="text-white/90 leading-relaxed text-sm">
                        {generateAIDescription(currentIssue)}
                      </p>
                    </div>

                    {/* Location & Date */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white/60 text-xs mb-1">Location</p>
                          <p className="text-white font-medium">{currentIssue.location}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-white/60 text-xs mb-1">Resolved On</p>
                          <p className="text-white font-medium">
                            {new Date(currentIssue.updated_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Time to Resolve */}
                      <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-4 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 text-sm">Time to Resolve:</span>
                          <span className="text-green-300 font-bold text-lg">
                            {calculateDaysToResolve(currentIssue.created_at, currentIssue.updated_at)} days
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Counter */}
                    {resolvedIssues.length > 1 && (
                      <div className="mt-8 text-center">
                        <p className="text-white/60 text-sm">
                          Success Story {currentIndex + 1} of {resolvedIssues.length}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instruction Text */}
        <div className="text-center mt-6">
          <p className="text-white/70 text-sm">
            💡 Drag the slider to see the transformation
          </p>
        </div>
      </div>
    </section>
  );
};

// Helper function to generate AI-style description
const generateAIDescription = (issue: ResolvedIssue): string => {
  const timeToResolve = calculateDaysToResolve(issue.created_at, issue.updated_at);
  const category = issue.category.toLowerCase();
  const location = issue.location;

  const templates = [
    `This ${category} issue at ${location} has been successfully resolved by our dedicated municipal team. The problem was addressed within ${timeToResolve} days, demonstrating our commitment to rapid response and quality service. The before and after images clearly show the significant improvement made to enhance community living standards.`,
    
    `Our field workers have successfully completed the resolution of this ${category} concern reported at ${location}. Through efficient coordination and skilled execution, the issue was resolved in just ${timeToResolve} days. The transformation visible in these images reflects our dedication to maintaining excellent civic infrastructure.`,
    
    `Community-reported ${category} issue at ${location} has been fully addressed! Our team responded promptly, completing all necessary work within ${timeToResolve} days. This success story showcases the power of citizen engagement and responsive governance working together for a better city.`,
    
    `Resolved with excellence! This ${category} problem at ${location} received immediate attention from our municipal services team. The issue was comprehensively addressed in ${timeToResolve} days, with quality workmanship evident in the after photos. Another step towards a cleaner, safer community.`,
    
    `Success! The ${category} issue reported at ${location} has been completely resolved by our skilled workforce. Completed in ${timeToResolve} days, this project demonstrates our commitment to maintaining high standards of civic infrastructure and responding effectively to community needs.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
};

// Helper function to calculate days to resolve
const calculateDaysToResolve = (createdAt: string, updatedAt: string): number => {
  const created = new Date(createdAt);
  const updated = new Date(updatedAt);
  const diffTime = Math.abs(updated.getTime() - created.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays || 1; // Minimum 1 day
};

export default ResolvedIssuesShowcase;
