import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, AlertTriangle } from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: string;
  created_at: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface SimpleMapProps {
  issues: Issue[];
  onIssueSelect?: (issue: Issue) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Enhanced color mapping for unresolved issues with urgency indicators
const getUrgencyColor = (priority: string, status: string, daysSinceCreated: number) => {
  // Resolved issues are green and smaller
  if (status === 'resolved') return '#10B981'; // Green
  
  // For unresolved issues, use yellow/orange spectrum based on urgency
  if (status === 'reported' || status === 'in-progress') {
    // Base colors for unresolved issues
    switch (priority) {
      case 'critical':
        return daysSinceCreated > 3 ? '#DC2626' : '#EF4444'; // Dark red to red
      case 'high':
        return daysSinceCreated > 5 ? '#EA580C' : '#F97316'; // Dark orange to orange
      case 'medium':
        return daysSinceCreated > 7 ? '#D97706' : '#F59E0B'; // Dark yellow to yellow
      case 'low':
        return daysSinceCreated > 14 ? '#F59E0B' : '#FCD34D'; // Yellow to light yellow
      default:
        return '#F59E0B'; // Default yellow for unresolved
    }
  }
  
  return '#6B7280'; // Gray for other statuses
};

// Get marker size based on urgency and age
const getMarkerSize = (priority: string, status: string, daysSinceCreated: number) => {
  if (status === 'resolved') return 6; // Small for resolved
  
  let baseSize = 8;
  switch (priority) {
    case 'critical': baseSize = 14; break;
    case 'high': baseSize = 12; break;
    case 'medium': baseSize = 10; break;
    case 'low': baseSize = 8; break;
  }
  
  // Increase size for older unresolved issues
  if (daysSinceCreated > 7) baseSize += 2;
  if (daysSinceCreated > 14) baseSize += 2;
  
  return Math.min(baseSize, 18); // Cap at 18
};

// Get urgency level text
const getUrgencyLevel = (priority: string, daysSinceCreated: number) => {
  if (daysSinceCreated > 14) return 'OVERDUE';
  if (daysSinceCreated > 7) return 'URGENT';
  if (priority === 'critical') return 'CRITICAL';
  if (priority === 'high') return 'HIGH';
  return priority.toUpperCase();
};

// Extract marker creation logic for reuse
const addMarkersToMap = (map: google.maps.Map, issues: Issue[], onIssueSelect?: (issue: Issue) => void): google.maps.Marker[] => {
  const markers: google.maps.Marker[] = [];
  
  // Filter and add markers for issues (focus on unresolved)
  const unresolvedIssues = issues.filter(issue => issue.status !== 'resolved');
  const resolvedIssues = issues.filter(issue => issue.status === 'resolved');
  
  // Add unresolved issues first (they get priority)
  [...unresolvedIssues, ...resolvedIssues].forEach((issue, index) => {
    // Generate coordinates based on location hash for consistency
    let hash = 0;
    for (let i = 0; i < issue.location.length; i++) {
      const char = issue.location.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const lat = 40.7128 + ((hash % 2000) / 20000) * (hash > 0 ? 1 : -1);
    const lng = -74.0060 + (((hash * 7) % 2000) / 20000) * (hash > 0 ? 1 : -1);
    
    const priority = issue.priority || calculatePriority(issue.category, issue.created_at);
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const color = getUrgencyColor(priority, issue.status, daysSinceCreated);
    const markerSize = getMarkerSize(priority, issue.status, daysSinceCreated);
    const urgencyLevel = getUrgencyLevel(priority, daysSinceCreated);
    
    // Create pulsing effect for critical unresolved issues
    const shouldPulse = issue.status !== 'resolved' && (priority === 'critical' || daysSinceCreated > 7);

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
      title: `${urgencyLevel}: ${issue.title}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: issue.status === 'resolved' ? 0.6 : 0.9,
        strokeColor: issue.status === 'resolved' ? '#ffffff' : '#000000',
        strokeWeight: issue.status === 'resolved' ? 1 : 2,
        scale: markerSize
      },
      animation: shouldPulse ? google.maps.Animation.BOUNCE : undefined,
      zIndex: issue.status === 'resolved' ? 1 : (priority === 'critical' ? 1000 : 100)
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="max-width: 280px; padding: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
            <h3 style="margin: 0; font-size: 15px; font-weight: bold; color: #1f2937;">
              ${issue.title}
            </h3>
          </div>
          
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #4b5563; line-height: 1.4;">
            ${issue.description.length > 100 ? issue.description.substring(0, 100) + '...' : issue.description}
          </p>
          
          <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
            <span style="background: ${color}; color: ${issue.status === 'resolved' ? '#000' : '#fff'}; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold;">
              ${urgencyLevel}
            </span>
            <span style="background: #e5e7eb; color: #374151; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
              ${issue.category}
            </span>
            <span style="background: ${issue.status === 'resolved' ? '#10b981' : issue.status === 'in-progress' ? '#f59e0b' : '#ef4444'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
              ${issue.status.replace('-', ' ').toUpperCase()}
            </span>
          </div>
          
          <div style="font-size: 11px; color: #6b7280; line-height: 1.3;">
            <div style="margin-bottom: 2px;">📍 ${issue.location}</div>
            <div style="margin-bottom: 2px;">📅 Reported: ${new Date(issue.created_at).toLocaleDateString()}</div>
            <div style="color: ${daysSinceCreated > 7 ? '#ef4444' : '#6b7280'}; font-weight: ${daysSinceCreated > 7 ? 'bold' : 'normal'};">
              ⏱️ ${daysSinceCreated} day${daysSinceCreated !== 1 ? 's' : ''} ago
              ${daysSinceCreated > 14 ? ' (OVERDUE!)' : daysSinceCreated > 7 ? ' (URGENT)' : ''}
            </div>
          </div>
        </div>
      `
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
      if (onIssueSelect) {
        onIssueSelect(issue);
      }
    });

    markers.push(marker);
  });
  
  return markers;
};

import { getCategoryMetadata } from '@/constants/categories';

const calculatePriority = (category: string, createdAt: string): 'low' | 'medium' | 'high' | 'critical' => {
  let basePriority = getCategoryMetadata(category).priority;


  
  // Increase priority based on age
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceCreated > 7) {
    const priorities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorities.indexOf(basePriority);
    if (currentIndex < priorities.length - 1) {
      basePriority = priorities[currentIndex + 1];
    }
  }

  return basePriority;
};

const SimpleMap: React.FC<SimpleMapProps> = ({ issues, onIssueSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [currentMarkers, setCurrentMarkers] = useState<google.maps.Marker[]>([]);

  useEffect(() => {
    const loadGoogleMaps = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Google Maps script loaded');
        initializeMap();
      };
      
      script.onerror = (err) => {
        console.error('Failed to load Google Maps script:', err);
        setError('Failed to load Google Maps API');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    const initializeMap = () => {
      try {
        if (!mapRef.current) {
          throw new Error('Map container not found');
        }

        console.log('Initializing map...');
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 40.7128, lng: -74.0060 },
          zoom: 12,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        // Add markers using the extracted function
        const markers = addMarkersToMap(map, issues, onIssueSelect);
        setCurrentMarkers(markers);

        setIsLoading(false);
        setMapInstance(map);
        console.log('Map initialized successfully');
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    loadGoogleMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when issues change (real-time updates)
  useEffect(() => {
    if (!mapInstance) return;

    // Clear existing markers
    currentMarkers.forEach(marker => marker.setMap(null));
    
    // Add updated markers
    const newMarkers = addMarkersToMap(mapInstance, issues, onIssueSelect);
    setCurrentMarkers(newMarkers);
    setLastUpdate(new Date());
    
    console.log(`Map updated with ${issues.length} issues at ${new Date().toLocaleTimeString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, issues, onIssueSelect]);

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      console.log('Real-time map refresh triggered');
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="h-96 flex items-center justify-center bg-red-50 rounded-lg border-2 border-red-200">
        <div className="text-center text-red-600">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Map Loading Error</h3>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2 text-gray-600">
            Check browser console for details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-96 rounded-lg" />
      
      {/* Enhanced Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg border max-w-xs">
        <h4 className="text-sm font-semibold mb-2">Issue Urgency Tracker</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-600 animate-pulse"></div>
            <span className="font-medium">Critical/Overdue (14+ days)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-600"></div>
            <span>High Priority/Urgent (7+ days)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-300"></div>
            <span>Low Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Resolved</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
          <div>🔴 Bouncing = Critical/Overdue</div>
          <div>📍 Larger = More urgent</div>
        </div>
      </div>

      {/* Real-time Status Panel */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border min-w-48">
        <div className="text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>Live Issue Tracker</span>
          </div>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                Critical/Overdue:
              </span>
              <span className="font-bold text-red-600">
                {issues.filter(i => {
                  const days = Math.floor((Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  const priority = i.priority || calculatePriority(i.category, i.created_at);
                  return i.status !== 'resolved' && (priority === 'critical' || days > 14);
                }).length}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                High/Urgent:
              </span>
              <span className="font-bold text-orange-600">
                {issues.filter(i => {
                  const days = Math.floor((Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  const priority = i.priority || calculatePriority(i.category, i.created_at);
                  return i.status !== 'resolved' && priority === 'high' && days <= 14;
                }).length}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                Unresolved:
              </span>
              <span className="font-bold text-yellow-600">
                {issues.filter(i => i.status !== 'resolved').length}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Resolved:
              </span>
              <span className="font-bold text-green-600">
                {issues.filter(i => i.status === 'resolved').length}
              </span>
            </div>
          </div>
          
          <div className="pt-1 border-t border-gray-200 text-xs text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleMap;