import React, { useState, useEffect } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
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

interface CompactCardProps {
  issue: ResolvedIssue;
  index: number;
}

const CompactCard: React.FC<CompactCardProps> = ({ issue, index }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

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

  // Truncate description to 80 characters
  const shortDescription = issue.description.length > 80 
    ? issue.description.substring(0, 80) + '...' 
    : issue.description;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group">
        <CardContent className="p-0">
          {/* Before/After Image Slider */}
          <div
            className="relative h-48 overflow-hidden cursor-ew-resize select-none"
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
                src={issue.resolution_image}
                alt="After"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold shadow-lg">
                AFTER
              </div>
            </div>

            {/* Before Image (Overlay with clip) */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src={issue.image}
                alt="Before"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold shadow-lg">
                BEFORE
              </div>
            </div>

            {/* Slider Handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center">
                <div className="flex gap-0.5">
                  <ChevronLeft className="w-3 h-3 text-gray-700" />
                  <ChevronRight className="w-3 h-3 text-gray-700" />
                </div>
              </div>
            </div>

            {/* Drag Hint - shows on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 px-3 py-1 rounded-full text-xs font-medium text-gray-800">
                ← Drag to compare →
              </div>
            </div>
          </div>

          {/* Issue Details */}
          <div className="p-4 bg-gradient-to-br from-white/5 to-white/10">
            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-xs font-semibold">RESOLVED</span>
            </div>

            {/* Title */}
            <h3 className="text-white font-bold text-sm mb-2 line-clamp-2">
              {issue.title}
            </h3>

            {/* Category Badge */}
            <div className="inline-block bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded text-xs font-medium mb-2">
              {issue.category}
            </div>

            {/* Short Description */}
            <p className="text-white/80 text-xs leading-relaxed mb-3 line-clamp-2">
              {shortDescription}
            </p>

            {/* Location */}
            <div className="flex items-center gap-1 text-white/60 text-xs">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{issue.location}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const CompactResolvedShowcase: React.FC = () => {
  const [resolvedIssues, setResolvedIssues] = useState<ResolvedIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResolvedIssues();
  }, []);

  const fetchResolvedIssues = async () => {
    try {
      const data = await IssueService.getIssues({
        status: 'resolved',
        limit: 6,
        sort: 'newest',
      });

      if (data && data.length > 0) {
        const withPhotos = (data as unknown as Issue[]).filter(
          (issue) => (issue.image_urls && issue.image_urls.length > 0) && (issue.resolution_image_urls && issue.resolution_image_urls.length > 0)
        );
        setResolvedIssues(withPhotos.map((issue: Issue) => ({
          id: issue.id,
          title: issue.title,
          description: issue.description || '',
          location: issue.address || 'Local Community',
          category: issue.category || 'General',
          image: issue.image_urls![0],
          resolution_image: issue.resolution_image_urls![0],
          created_at: issue.created_at,
          updated_at: issue.updated_at || issue.resolved_at || issue.created_at
        })));
      } else {
        setResolvedIssues([]);
      }
    } catch (error) {
      console.error('Error fetching resolved issues:', error);
      setResolvedIssues([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading || resolvedIssues.length === 0) {
    return null; // Don't show section if loading or no resolved issues
  }

  return (
    <section className="py-16 px-6 bg-black/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">
              Explore Our Impact
            </h2>
          </div>
          <p className="text-white/90 text-lg max-w-2xl mx-auto">
            See how UrbanCare is transforming communities
          </p>
        </motion.div>

        {/* Grid of Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resolvedIssues.map((issue, index) => (
            <CompactCard key={issue.id} issue={issue} index={index} />
          ))}
        </div>

        {/* View More Button */}
        {resolvedIssues.length >= 6 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center mt-8"
          >
            <button className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-full border border-white/30 transition-all duration-300 hover:scale-105 shadow-lg">
              View More Success Stories →
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default CompactResolvedShowcase;
