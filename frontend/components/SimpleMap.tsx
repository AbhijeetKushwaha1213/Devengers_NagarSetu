import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { getCategoryMetadata } from '@/constants/categories';
import { DEFAULT_INDIA_CENTER, waitForMapplsSDK } from '@/services/mapplsService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface SimpleMapProps {
  issues: Issue[];
  onIssueSelect?: (issue: Issue) => void;
}

const getUrgencyColor = (priority: string, status: string, daysSinceCreated: number) => {
  if (status === 'resolved') return '#10B981';
  if (status === 'reported' || status === 'in-progress') {
    switch (priority) {
      case 'critical':
        return daysSinceCreated > 3 ? '#DC2626' : '#EF4444';
      case 'high':
        return daysSinceCreated > 5 ? '#EA580C' : '#F97316';
      case 'medium':
        return daysSinceCreated > 7 ? '#D97706' : '#F59E0B';
      case 'low':
        return daysSinceCreated > 14 ? '#F59E0B' : '#FCD34D';
      default:
        return '#F59E0B';
    }
  }
  return '#6B7280';
};

const calculatePriority = (category: string, createdAt: string): 'low' | 'medium' | 'high' | 'critical' => {
  let basePriority = getCategoryMetadata(category).priority;
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

const getUrgencyLevel = (priority: string, daysSinceCreated: number) => {
  if (daysSinceCreated > 14) return 'OVERDUE';
  if (daysSinceCreated > 7) return 'URGENT';
  if (priority === 'critical') return 'CRITICAL';
  if (priority === 'high') return 'HIGH';
  return priority.toUpperCase();
};

const parseLocationToCoords = (issue: Issue): { lat: number; lng: number } => {
  if (typeof issue.latitude === 'number' && typeof issue.longitude === 'number' && !isNaN(issue.latitude) && !isNaN(issue.longitude)) {
    return { lat: issue.latitude, lng: issue.longitude };
  }

  if (issue.location) {
    const coordMatch = issue.location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    let hash = 0;
    for (let i = 0; i < issue.location.length; i++) {
      hash = ((hash << 5) - hash) + issue.location.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = ((hash % 1000) / 10000) * (hash > 0 ? 1 : -1);
    const lngOffset = (((hash * 3) % 1000) / 10000) * (hash > 0 ? 1 : -1);
    return {
      lat: DEFAULT_INDIA_CENTER.lat + latOffset,
      lng: DEFAULT_INDIA_CENTER.lng + lngOffset
    };
  }

  return DEFAULT_INDIA_CENTER;
};

const createSimpleMarkerIcon = (color: string, shouldPulse: boolean, size: number) => {
  return L.divIcon({
    className: 'simple-map-pin',
    html: `
      <div style="position: relative; width: ${size * 2}px; height: ${size * 2}px; display: flex; align-items: center; justify-content: center;">
        ${shouldPulse ? `
          <div style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: ${color};
            opacity: 0.5;
            animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        ` : ''}
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 4px; height: 4px; border-radius: 50%; background: white;"></div>
        </div>
      </div>
    `,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -size],
  });
};

const SimpleMap: React.FC<SimpleMapProps> = ({ issues, onIssueSelect }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapplsMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapplsMarkersRef = useRef<any[]>([]);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      const containerId = 'mappls-simple-map-canvas';
      const containerEl = document.getElementById(containerId);
      if (!containerEl || !isMounted) return;

      containerEl.innerHTML = '';

      // Wait reliably for MapMyIndia SDK
      const ready = await waitForMapplsSDK(5000);

      if (!isMounted) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const MapplsClass = win.mappls || win.MapmyIndia;

      if (ready && MapplsClass && MapplsClass.Map) {
        try {
          console.log('Mounting MapMyIndia Vector Map on #', containerId);
          containerEl.innerHTML = '';

          const map = new MapplsClass.Map(containerId, {
            center: [DEFAULT_INDIA_CENTER.lat, DEFAULT_INDIA_CENTER.lng],
            zoom: 11,
            zoomControl: true,
            hybrid: false,
            search: false,
          });

          mapplsMapRef.current = map;
          setIsLoading(false);
          return;
        } catch (sdkErr) {
          console.warn('MapMyIndia native SDK init failed for SimpleMap, fallback to Leaflet:', sdkErr);
        }
      }

      // Fallback: Leaflet
      try {
        containerEl.innerHTML = '';
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        const map = L.map(containerEl, {
          center: [DEFAULT_INDIA_CENTER.lat, DEFAULT_INDIA_CENTER.lng],
          zoom: 11,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.mappls.com">MapMyIndia</a> | &copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const markersGroup = L.layerGroup().addTo(map);
        markersGroupRef.current = markersGroup;
        leafletMapRef.current = map;
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing SimpleMap:', err);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    const timer = setTimeout(initMap, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (mapplsMapRef.current && typeof mapplsMapRef.current.remove === 'function') {
        try { mapplsMapRef.current.remove(); } catch (e) { console.debug(e); }
        mapplsMapRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update markers when issues change
  useEffect(() => {
    // 1. MapMyIndia Native Map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const MapplsClass = win.mappls || win.MapmyIndia;

    if (mapplsMapRef.current && MapplsClass && MapplsClass.Marker) {
      mapplsMarkersRef.current.forEach((m) => {
        if (m && typeof m.remove === 'function') {
          try { m.remove(); } catch (e) { console.debug(e); }
        }
      });
      mapplsMarkersRef.current = [];

      issues.forEach((issue) => {
        const coords = parseLocationToCoords(issue);
        try {
          const marker = new MapplsClass.Marker({
            map: mapplsMapRef.current,
            position: { lat: coords.lat, lng: coords.lng },
            title: issue.title,
          });
          marker.addListener('click', () => {
            if (onIssueSelect) onIssueSelect(issue);
          });
          mapplsMarkersRef.current.push(marker);
        } catch (e) {
          console.debug(e);
        }
      });
      setLastUpdate(new Date());
      return;
    }

    // 2. Leaflet Fallback
    if (!leafletMapRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    if (!issues || issues.length === 0) return;

    const bounds: L.LatLngBounds = L.latLngBounds([]);

    issues.forEach((issue) => {
      const coords = parseLocationToCoords(issue);
      const priority = issue.priority || calculatePriority(issue.category, issue.created_at);
      const daysSinceCreated = Math.floor(
        (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const color = getUrgencyColor(priority, issue.status, daysSinceCreated);
      const urgencyLevel = getUrgencyLevel(priority, daysSinceCreated);
      const shouldPulse = issue.status !== 'resolved' && (priority === 'critical' || daysSinceCreated > 7);
      const size = issue.status === 'resolved' ? 14 : priority === 'critical' ? 24 : 18;

      const marker = L.marker([coords.lat, coords.lng], {
        icon: createSimpleMarkerIcon(color, shouldPulse, size),
        title: `${urgencyLevel}: ${issue.title}`,
      });

      const popupHtml = `
        <div style="max-width: 260px; font-family: sans-serif; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></div>
            <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">
              ${issue.title}
            </h4>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; line-height: 1.4;">
            ${issue.description ? (issue.description.length > 90 ? issue.description.substring(0, 90) + '...' : issue.description) : 'No description'}
          </p>
          <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
            <span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600;">
              ${urgencyLevel}
            </span>
            <span style="background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 9999px; font-size: 10px;">
              ${issue.category}
            </span>
            <span style="background: ${issue.status === 'resolved' ? '#10b981' : issue.status === 'in-progress' ? '#f59e0b' : '#ef4444'}; color: white; padding: 2px 6px; border-radius: 9999px; font-size: 10px;">
              ${issue.status.replace('-', ' ').toUpperCase()}
            </span>
          </div>
          <div style="font-size: 11px; color: #64748b;">
            📍 ${issue.location || 'Location'}<br />
            ⏱️ ${daysSinceCreated} day${daysSinceCreated !== 1 ? 's' : ''} ago
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onIssueSelect) {
          onIssueSelect(issue);
        }
      });

      if (markersGroupRef.current) {
        markersGroupRef.current.addLayer(marker);
      }
      bounds.extend([coords.lat, coords.lng]);
    });

    if (issues.length > 0 && bounds.isValid() && leafletMapRef.current) {
      leafletMapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }

    setLastUpdate(new Date());
  }, [issues, onIssueSelect]);

  if (error) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-red-50 rounded-lg border border-red-200 p-6">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
        <h3 className="text-base font-semibold text-red-700">Map Loading Error</h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-slate-600">Loading MapMyIndia view...</p>
          </div>
        </div>
      )}

      <div id="mappls-simple-map-canvas" className="w-full h-96 bg-slate-100" />

      {/* Urgency Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md p-2.5 rounded-lg shadow-md border border-slate-200 z-[1000] text-xs">
        <h4 className="font-semibold text-slate-800 mb-1 text-[11px]">Issue Urgency</h4>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></div>
            <span>Critical / Overdue (14+ d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
            <span>High Priority / Urgent (7+ d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span>Resolved</span>
          </div>
        </div>
      </div>

      {/* Live Tracker Count Panel */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md p-2.5 rounded-lg shadow-md border border-slate-200 z-[1000] text-xs min-w-40">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1.5">
          <MapPin className="h-3.5 w-3.5 text-blue-600" />
          <span>Live Issue Tracker</span>
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-600">Total:</span>
            <span className="font-semibold text-slate-800">{issues.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600">Pending:</span>
            <span className="font-semibold text-amber-600">{issues.filter(i => i.status !== 'resolved').length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-600">Resolved:</span>
            <span className="font-semibold text-emerald-600">{issues.filter(i => i.status === 'resolved').length}</span>
          </div>
        </div>
        <div className="pt-1 mt-1 border-t border-slate-200 text-[10px] text-slate-400">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default SimpleMap;