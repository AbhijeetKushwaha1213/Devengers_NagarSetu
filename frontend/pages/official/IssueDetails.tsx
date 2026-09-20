import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  AlertTriangle,
  Camera,
  Building,
  User,
  Shield,
  ExternalLink,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OfficialTaskCard, IssueStatus } from '@/types';
import { IssueService } from '@backend/services/issues/issueService';
import { StorageService } from '@backend/services/storage/storageService';
import { WorkerService } from '@backend/services/workers/workerService';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getDashboardRouteForRole } from '@/utils/roleRouting';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface AdministrativeContext {
  municipalityName: string | null;
  panchayatName: string | null;
  wardName: string | null;
  departmentName: string | null;
  assignedWorkerName: string | null;
}

const IssueDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [issue, setIssue] = useState<OfficialTaskCard | null>(null);
  const [adminContext, setAdminContext] = useState<AdministrativeContext>({
    municipalityName: null,
    panchayatName: null,
    wardName: null,
    departmentName: null,
    assignedWorkerName: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [afterPhotoPreview, setAfterPhotoPreview] = useState<string>('');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const effectiveRole = userProfile?.role || currentUser?.role;
  const dashboardUrl = getDashboardRouteForRole(effectiveRole);

  const fetchIssueDetails = useCallback(async () => {
    if (!id) return;
    try {
      const data = await IssueService.getIssueById(id);
      if (data) {
        const taskCard = data as unknown as OfficialTaskCard;
        // Normalize coordinates if stored in metadata
        if (taskCard.metadata && typeof taskCard.metadata === 'object') {
          const meta = taskCard.metadata as Record<string, unknown>;
          if (taskCard.latitude == null && typeof meta.latitude === 'number') {
            taskCard.latitude = meta.latitude;
          }
          if (taskCard.longitude == null && typeof meta.longitude === 'number') {
            taskCard.longitude = meta.longitude;
          }
        }
        setIssue(taskCard);

        // Fetch related jurisdiction and department labels in parallel
        const context: AdministrativeContext = {
          municipalityName: null,
          panchayatName: null,
          wardName: null,
          departmentName: null,
          assignedWorkerName: null,
        };

        const fetches: Promise<void>[] = [];

        if (taskCard.municipality_id) {
          fetches.push(
            supabase
              .from('municipalities')
              .select('name')
              .eq('id', taskCard.municipality_id)
              .maybeSingle()
              .then(({ data: m }) => {
                if (m?.name) context.municipalityName = m.name;
              })
          );
        }

        if (taskCard.panchayat_id) {
          fetches.push(
            supabase
              .from('panchayats')
              .select('name')
              .eq('id', taskCard.panchayat_id)
              .maybeSingle()
              .then(({ data: p }) => {
                if (p?.name) context.panchayatName = p.name;
              })
          );
        }

        if (taskCard.ward_id) {
          fetches.push(
            supabase
              .from('wards')
              .select('name, ward_number')
              .eq('id', taskCard.ward_id)
              .maybeSingle()
              .then(({ data: w }) => {
                if (w) {
                  context.wardName = w.name 
                    ? `${w.name} (Ward ${w.ward_number ?? ''})` 
                    : `Ward ${w.ward_number ?? ''}`;
                }
              })
          );
        }

        if (taskCard.department_id) {
          fetches.push(
            supabase
              .from('departments')
              .select('name')
              .eq('id', taskCard.department_id)
              .maybeSingle()
              .then(({ data: d }) => {
                if (d?.name) context.departmentName = d.name;
              })
          );
        }

        if (taskCard.assigned_worker_id) {
          fetches.push(
            supabase
              .from('user_profiles')
              .select('full_name')
              .eq('id', taskCard.assigned_worker_id)
              .maybeSingle()
              .then(({ data: u }) => {
                if (u?.full_name) context.assignedWorkerName = u.full_name;
              })
          );
        }

        await Promise.allSettled(fetches);
        setAdminContext(context);
      }
    } catch (error) {
      console.error('Error fetching issue details:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIssueDetails();
  }, [fetchIssueDetails]);

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!issue) return;
    setActionLoading(true);

    try {
      const updated = await IssueService.transitionStatus({
        issueId: issue.id,
        status: newStatus,
        notes: `Status updated via official details page to ${newStatus}`,
      });

      // Update local state
      setIssue({
        ...issue,
        status: newStatus,
        resolved_at: updated.resolved_at || issue.resolved_at,
      });

      alert(`Issue status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
    } catch (error) {
      console.error('Error updating status:', error);
      const err = error as Error;
      alert('Failed to update status: ' + (err.message || 'Please try again.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async () => {
    await handleStatusChange('in_progress');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      setAfterPhoto(file);
      setAfterPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadAfterPhoto = async () => {
    if (!afterPhoto || !issue) return;

    setUploadingPhoto(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      let imageUrl: string = '';

      // Upload resolution photo via canonical StorageService with base64 fallback
      try {
        imageUrl = await StorageService.uploadResolutionImage(afterPhoto, issue.id);
      } catch (storageErr) {
        console.warn('[IssueDetails] Storage upload unavailable, converting to base64 fallback:', storageErr);
        imageUrl = await StorageService.compressImageToBase64(afterPhoto);
      }

      const existingUrls = issue.resolution_image_urls || [];
      const updatedUrls = [...existingUrls, imageUrl];

      // Update database using canonical WorkerService
      await WorkerService.resolveTask({
        issueId: issue.id,
        workerId: authUser.id,
        resolutionImageUrls: updatedUrls,
      });

      // Refresh issue details
      await fetchIssueDetails();
      setAfterPhoto(null);
      setAfterPhotoPreview('');
      alert('Resolution photo uploaded successfully! Issue marked as resolved.');
    } catch (err) {
      console.error('Error in upload process:', err);
      const error = err as Error;
      alert('Failed to upload photo: ' + (error.message || 'Unknown error. Check console for details.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Google Maps navigation helper: prefers coordinates, falls back cleanly to address
  const handleNavigateToLocation = () => {
    const lat = issue?.latitude ?? (issue?.metadata?.latitude as number | undefined);
    const lng = issue?.longitude ?? (issue?.metadata?.longitude as number | undefined);
    const address = issue?.address || issue?.location;

    let url: string;
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (address && address !== 'Address not specified') {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    } else {
      alert('No location coordinates or address available for this issue.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLocation = async () => {
    const lat = issue?.latitude ?? (issue?.metadata?.latitude as number | undefined);
    const lng = issue?.longitude ?? (issue?.metadata?.longitude as number | undefined);
    const address = issue?.address || issue?.location;

    let directionsUrl: string;
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (address && address !== 'Address not specified') {
      directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    } else {
      alert('No location details available to copy');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(directionsUrl);
        alert('Directions link copied to clipboard!');
      } else {
        prompt('Copy this directions link:', directionsUrl);
      }
    } catch (err) {
      console.error('Copy failed:', err);
      prompt('Copy this directions link:', directionsUrl);
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'verified':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'escalated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'rejected':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'submitted':
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading issue report...</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md max-w-md">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Issue Not Found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            The requested issue could not be found or you may not have authorization to view it.
          </p>
          <button
            onClick={() => navigate(dashboardUrl)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Original images reported by citizen
  const originalReportImages: string[] = [];
  if (issue.image_urls && Array.isArray(issue.image_urls)) {
    issue.image_urls.forEach((url) => {
      if (url && typeof url === 'string') originalReportImages.push(url);
    });
  }
  if (originalReportImages.length === 0 && issue.image) {
    originalReportImages.push(issue.image);
  }

  // Resolution images
  const resolutionImages: string[] = [];
  if (issue.resolution_image_urls && Array.isArray(issue.resolution_image_urls)) {
    issue.resolution_image_urls.forEach((url) => {
      if (url && typeof url === 'string') resolutionImages.push(url);
    });
  }

  const displayAddress = issue.address || issue.location || 'Address not specified';
  const effectiveLat = issue.latitude ?? (issue.metadata?.latitude as number | undefined);
  const effectiveLng = issue.longitude ?? (issue.metadata?.longitude as number | undefined);
  const hasCoordinates = effectiveLat != null && effectiveLng != null && !isNaN(Number(effectiveLat)) && !isNaN(Number(effectiveLng));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(dashboardUrl)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Issue #{issue.tracking_id || issue.id.slice(0, 8).toUpperCase()}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${getStatusBadge(issue.status)}`}>
                  {issue.status.replace('_', ' ')}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${getUrgencyColor(issue.urgency)}`}>
                  {issue.urgency || 'NORMAL'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                <span>Category: <strong className="text-gray-700 dark:text-gray-300">{issue.category}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Reported {new Date(issue.created_at).toLocaleString()}
                </span>
              </p>
            </div>

            {/* Quick Action Button in Header */}
            {issue.status !== 'resolved' && (
              <div className="flex items-center gap-2">
                {issue.status !== 'in_progress' ? (
                  <button
                    onClick={handleStartWork}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Start Work</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      document.getElementById('resolution-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Upload Proof & Resolve</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left / Main Column (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Section 1: Original Citizen Report */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Original Citizen Report
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                  Tracking ID: {issue.tracking_id || issue.id.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {issue.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mt-2 leading-relaxed whitespace-pre-line">
                    {issue.description}
                  </p>
                </div>

                {/* Original Reported Photos Gallery */}
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Original Issue Images ({originalReportImages.length})
                  </h4>

                  {originalReportImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {originalReportImages.map((imgUrl, idx) => (
                        <div 
                          key={idx} 
                          className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 aspect-video cursor-pointer"
                          onClick={() => setSelectedPreviewImage(imgUrl)}
                        >
                          <img
                            src={imgUrl}
                            alt={`Citizen reported photo ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                            <ExternalLink className="w-4 h-4" />
                            Click to expand
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center gap-2">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span>No photos were attached to the citizen report.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Location & Navigation */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Location & Navigation
                </h2>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Reported Address</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {displayAddress}
                  </p>
                  {hasCoordinates && (
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      Coordinates: {effectiveLat?.toFixed(6)}, {effectiveLng?.toFixed(6)}
                    </p>
                  )}
                </div>

                {/* Interactive Leaflet Map if coordinates are present */}
                {hasCoordinates && (
                  <div className="h-64 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 relative z-0">
                    <MapContainer
                      center={[effectiveLat!, effectiveLng!]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <Marker position={[effectiveLat!, effectiveLng!]}>
                        <Popup>{issue.title}</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                )}

                {/* Primary Navigation Action Buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleNavigateToLocation}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg font-bold text-base group"
                  >
                    <Navigation className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    <span>Navigate to Location</span>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleCopyLocation}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>Copy Maps Link</span>
                    </button>
                    <button
                      onClick={handleNavigateToLocation}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in Maps</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Work Lifecycle & Resolution Proof */}
            <div id="resolution-section" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Resolution & Proof
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Document resolution with proof photos to complete the civic task.
                </p>
              </div>

              {/* If already resolved, show resolution photo and timestamp */}
              {issue.status === 'resolved' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Task Completed and Verified Resolved
                    </p>
                    {issue.resolved_at && (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        Resolved on: {new Date(issue.resolved_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {resolutionImages.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Resolution Proof Photo(s):
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {resolutionImages.map((resUrl, idx) => (
                          <div 
                            key={idx} 
                            className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-video cursor-pointer"
                            onClick={() => setSelectedPreviewImage(resUrl)}
                          >
                            <img
                              src={resUrl}
                              alt="Resolved proof"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Work in Progress / Resolution Upload Area */
                <div className="space-y-4">
                  {issue.status !== 'in_progress' ? (
                    <div className="p-6 text-center bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-700">
                      <Clock className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        Work Has Not Started Yet
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1 mb-4">
                        Transition this issue to "In Progress" when you begin active field work.
                      </p>
                      <button
                        onClick={handleStartWork}
                        disabled={actionLoading}
                        className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm inline-flex items-center gap-2"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Start Work Now</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
                        ⚡ Issue is currently in progress. Upload resolution proof below to complete the task.
                      </div>

                      {afterPhotoPreview ? (
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 max-w-md">
                          <img
                            src={afterPhotoPreview}
                            alt="Resolution preview"
                            className="w-full h-56 object-cover"
                          />
                          <button
                            onClick={() => {
                              setAfterPhoto(null);
                              setAfterPhotoPreview('');
                            }}
                            className="absolute top-2 right-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
                          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Upload After Photo (Resolution Proof)
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                            Photo must be JPEG, PNG, or WebP under 5MB
                          </p>
                          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm">
                            <Camera className="w-4 h-4" />
                            <span>Choose Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoSelect}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}

                      {afterPhoto && (
                        <button
                          onClick={handleUploadAfterPhoto}
                          disabled={uploadingPhoto}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-base transition-colors shadow-md disabled:opacity-50"
                        >
                          {uploadingPhoto ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              <span>Uploading Proof & Resolving...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5" />
                              <span>Upload Proof & Mark Resolved</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (1/3 width on desktop): Administrative & Jurisdiction Context */}
          <div className="space-y-6">
            
            {/* Status Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                Lifecycle Status
              </h3>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Current Phase</p>
                  <p className="font-semibold text-gray-900 dark:text-white mt-0.5 uppercase tracking-wide">
                    {issue.status.replace('_', ' ')}
                  </p>
                </div>

                {/* Status Override Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Authorized Status Transition
                  </label>
                  <select
                    value={issue.status}
                    onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium dark:bg-gray-700 dark:text-white disabled:opacity-50"
                  >
                    <option value="submitted">Submitted</option>
                    <option value="verified">Verified</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Administrative Context Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Administrative Scope
              </h3>

              <div className="space-y-3 text-sm">
                {/* Municipality */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Municipality</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                    {adminContext.municipalityName || (issue.municipality_id ? `Assigned (${issue.municipality_id.slice(0, 8)})` : 'Central Civic Area')}
                  </p>
                </div>

                {/* Ward */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ward</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                    {adminContext.wardName || (issue.ward_id ? `Ward (${issue.ward_id.slice(0, 8)})` : 'All Wards')}
                  </p>
                </div>

                {/* Panchayat (if applicable) */}
                {issue.panchayat_id && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Gram Panchayat</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                      {adminContext.panchayatName || issue.panchayat_id.slice(0, 8)}
                    </p>
                  </div>
                )}

                {/* Department */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Assigned Department</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                    {adminContext.departmentName || 'Public Works & Sanitation'}
                  </p>
                </div>

                {/* Assigned Worker */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Assigned Field Worker</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                    {adminContext.assignedWorkerName || (issue.assigned_worker_id ? `Worker #${issue.assigned_worker_id.slice(0, 8)}` : 'Unassigned')}
                  </p>
                </div>

                {/* Reporter (Privacy-Safe) */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Citizen Reporter</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>Verified Citizen Resident</span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Image Preview Modal */}
      {selectedPreviewImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-black">
            <img
              src={selectedPreviewImage}
              alt="Expanded preview"
              className="max-h-[85vh] max-w-full object-contain"
            />
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/60 hover:bg-black/90 text-white rounded-lg text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueDetails;
