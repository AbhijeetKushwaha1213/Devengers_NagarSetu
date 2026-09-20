import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
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
  latitude?: number;
  longitude?: number;
}

interface IssueMapProps {
  issues: Issue[];
  onIssueSelect?: (issue: Issue) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Color mapping based on priority/intensity
const getPriorityColor = (priority: string, status: string) => {
  if (status === 'resolved') return '#10B981'; // Green for resolved
  
  switch (priority) {
    case 'critical': return '#EF4444'; // Red
    case 'high': return '#F97316'; // Orange
    case 'medium': return '#F59E0B'; // Yellow
    case 'low': return '#3B82F6'; // Blue
    default: return '#6B7280'; // Gray
  }
};

import { getCategoryMetadata } from '@/constants/categories';

// Get priority icon based on category and age
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

// Cache for geocoded locations to avoid repeated parsing
const locationCache = new Map<string, { lat: number; lng: number }>();

// Parse location string to coordinates
const parseLocationToCoords = async (issue: Issue): Promise<{ lat: number; lng: number } | null> => {
  if (typeof issue.latitude === 'number' && typeof issue.longitude === 'number') {
    return { lat: issue.latitude, lng: issue.longitude };
  }

  if (!issue.location) return null;

  // Check cache first
  if (locationCache.has(issue.location)) {
    return locationCache.get(issue.location)!;
  }

  // Try to extract coordinates if they're in the format "lat, lng"
  const coordMatch = issue.location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (coordMatch) {
    const coords = {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2])
    };
    locationCache.set(issue.location, coords);
    return coords;
  }
  
  return null;
};

const IssueMap: React.FC<IssueMapProps> = ({ issues, onIssueSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        console.log('Initializing Google Maps with API key:', GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing');
        
        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error('Google Maps API key is missing');
        }

        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
          libraries: ['places', 'geometry']
        });

        console.log('Loading Google Maps API...');
        await loader.load();
        console.log('Google Maps API loaded successfully');

        if (mapRef.current) {
          console.log('Creating map instance...');
          const mapInstance = new google.maps.Map(mapRef.current, {
            center: { lat: 40.7128, lng: -74.0060 }, // NYC center
            zoom: 12,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ]
          });

          console.log('Map instance created successfully');
          setMap(mapInstance);
          setIsLoading(false);
        } else {
          throw new Error('Map container not found');
        }
      } catch (err) {
        console.error('Error loading Google Maps:', err);
        const error = err as Error;
        let errorMessage = 'Failed to load Google Maps';
        
        if (error.message?.includes('API key')) {
          errorMessage = 'Invalid or missing Google Maps API key';
        } else if (error.message?.includes('quota')) {
          errorMessage = 'Google Maps API quota exceeded';
        } else if (error.message?.includes('billing')) {
          errorMessage = 'Google Maps API billing not enabled';
        } else if (err.message) {
          errorMessage = `Google Maps Error: ${err.message}`;
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initMap();
  }, []);

  // Add markers for issues
  useEffect(() => {
    if (!map || !issues.length) return;

    const addMarkersAsync = async () => {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));
      const newMarkers: google.maps.Marker[] = [];

      for (const issue of issues) {
        const coords = await parseLocationToCoords(issue);
        if (!coords) continue;

        const priority = issue.priority || calculatePriority(issue.category, issue.created_at);
        const color = getPriorityColor(priority, issue.status);

        // Create custom marker icon
        const markerIcon = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: issue.status === 'resolved' ? 6 : priority === 'critical' ? 12 : priority === 'high' ? 10 : 8
        };

        const marker = new google.maps.Marker({
          position: coords,
          map: map,
          icon: markerIcon,
          title: issue.title,
          animation: priority === 'critical' ? google.maps.Animation.BOUNCE : undefined
        });

        // Create info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="max-width: 300px; padding: 8px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                ${issue.title}
              </h3>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #4b5563; line-height: 1.4;">
                ${issue.description.length > 100 ? issue.description.substring(0, 100) + '...' : issue.description}
              </p>
              <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                  ${priority.toUpperCase()}
                </span>
                <span style="background: #e5e7eb; color: #374151; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                  ${issue.category}
                </span>
                <span style="background: ${issue.status === 'resolved' ? '#10b981' : issue.status === 'in-progress' ? '#f59e0b' : '#6b7280'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                  ${issue.status.replace('-', ' ').toUpperCase()}
                </span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                📍 ${issue.location}<br>
                📅 ${new Date(issue.created_at).toLocaleDateString()}
              </p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
          if (onIssueSelect) {
            onIssueSelect(issue);
          }
        });

        newMarkers.push(marker);
      }

      setMarkers(newMarkers);

      // Fit map to show all markers
      if (newMarkers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        newMarkers.forEach(marker => {
          const position = marker.getPosition();
          if (position) bounds.extend(position);
        });
        map.fitBounds(bounds);
        
        // Ensure minimum zoom level
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 15) map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      }
    };

    addMarkersAsync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, issues, onIssueSelect]);

  if (error) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-red-50 rounded-lg border-2 border-red-200 p-6">
        <div className="text-center text-red-600 mb-6">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Map Loading Error</h3>
          <p className="text-sm mb-4">{error}</p>
          <p className="text-xs text-gray-600">
            Please check the browser console for more details.
          </p>
        </div>
        
        {/* Fallback: Simple list view of issues */}
        <div className="w-full max-w-md">
          <h4 className="text-sm font-semibold mb-3 text-gray-700">Issues List (Fallback View)</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {issues.slice(0, 5).map(issue => {
              const priority = issue.priority || calculatePriority(issue.category, issue.created_at);
              const color = getPriorityColor(priority, issue.status);
              
              return (
                <div 
                  key={issue.id} 
                  className="p-2 bg-white rounded border cursor-pointer hover:bg-gray-50"
                  onClick={() => onIssueSelect?.(issue)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-sm font-medium truncate">{issue.title}</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{issue.location}</p>
                </div>
              );
            })}
            {issues.length > 5 && (
              <p className="text-xs text-gray-500 text-center">
                ... and {issues.length - 5} more issues
              </p>
            )}
          </div>
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
            <p className="text-sm text-gray-600">Loading interactive map...</p>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-96 rounded-lg" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg border">
        <h4 className="text-sm font-semibold mb-2">Issue Priority</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Resolved</span>
          </div>
        </div>
      </div>

      {/* Issue count */}
      <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg border">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span className="font-semibold">{issues.length} Issues</span>
        </div>
      </div>
    </div>
  );
};

export default IssueMap;