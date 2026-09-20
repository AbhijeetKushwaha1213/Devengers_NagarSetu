import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { resolveCoordinatesAddress } from '@/components/LocationPicker';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationGranted: (location: { lat: number; lng: number; address: string }) => void;
}

const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  onClose,
  onLocationGranted
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Check current permission status
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
      });
    }
  }, []);

  // Reverse geocode coordinates to address
  const reverseGeocode = async (coords: { lat: number; lng: number }): Promise<string> => {
    try {
      return await resolveCoordinatesAddress(coords);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
  };

  // Request location permission
  const requestLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support location detection.",
        variant: "destructive",
      });
      return;
    }

    setIsRequesting(true);

    // Check if we're on HTTPS or localhost (required for geolocation)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      toast({
        title: "HTTPS Required",
        description: "Location access requires a secure connection (HTTPS).",
        variant: "destructive",
      });
      setIsRequesting(false);
      return;
    }

    try {
      // First check if permission is already granted
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('Current permission state:', permission.state);
        
        if (permission.state === 'denied') {
          toast({
            title: "Location Permission Denied",
            description: "Please enable location access in your browser settings and refresh the page.",
            variant: "destructive",
          });
          setIsRequesting(false);
          setPermissionStatus('denied');
          return;
        }
      }

      // Request location with high accuracy
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('Location obtained:', position.coords);
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          try {
            const address = await reverseGeocode(coords);
            
            // Store location in localStorage for future use
            localStorage.setItem('userLocation', JSON.stringify({
              ...coords,
              address,
              timestamp: Date.now()
            }));

            onLocationGranted({ ...coords, address });
            setPermissionStatus('granted');
            
            toast({
              title: "Location Access Granted",
              description: "Your location has been detected successfully!",
            });

            setTimeout(() => {
              onClose();
            }, 1500);
          } catch (error) {
            console.error('Error processing location:', error);
            toast({
              title: "Location Processing Error",
              description: "Could not process your location. Please try again.",
              variant: "destructive",
            });
          } finally {
            setIsRequesting(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsRequesting(false);
          setPermissionStatus('denied');
          
          let errorMessage = "Unable to detect your location.";
          let actionMessage = "";
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access was denied.";
              actionMessage = "Please click the location icon in your browser's address bar and allow location access, then try again.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              actionMessage = "Please check your internet connection and try again.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out.";
              actionMessage = "Please try again or enter location manually.";
              break;
          }
          
          toast({
            title: "Location Access Failed",
            description: `${errorMessage} ${actionMessage}`,
            variant: "destructive",
          });
        },
        { 
          enableHighAccuracy: true, 
          timeout: 20000, // Increased timeout
          maximumAge: 0 // Don't use cached location
        }
      );
    } catch (error) {
      console.error('Permission check error:', error);
      setIsRequesting(false);
      toast({
        title: "Permission Check Failed",
        description: "Could not check location permissions. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Skip location permission
  const skipLocation = () => {
    localStorage.setItem('locationPermissionAsked', 'true');
    localStorage.setItem('locationPermissionSkipped', 'true');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Enable Location Access
          </DialogTitle>
          <DialogDescription>
            Help us provide better service by allowing location access for precise issue reporting.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Benefits */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Benefits of enabling location:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Automatic location detection when reporting issues
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                More accurate issue tracking and resolution
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Better local community engagement
              </li>
            </ul>
          </div>

          {/* Permission Status */}
          {permissionStatus === 'denied' && (
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Location access was denied
                </span>
              </div>
              <div className="text-sm text-red-700">
                <p className="mb-2">To enable location access:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Look for the location icon (📍) in your browser's address bar</li>
                  <li>Click on it and select "Allow" or "Always allow"</li>
                  <li>Refresh the page and try again</li>
                  <li>Or go to browser Settings → Privacy → Location → Allow this site</li>
                </ol>
              </div>
            </div>
          )}

          {permissionStatus === 'granted' && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">
                  Location access granted! Your location will be used for better service.
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={skipLocation}
              className="flex-1"
              disabled={isRequesting}
            >
              Skip for Now
            </Button>
            <Button
              onClick={requestLocation}
              disabled={isRequesting || permissionStatus === 'granted'}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isRequesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Detecting...
                </>
              ) : permissionStatus === 'granted' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Granted
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4 mr-2" />
                  Enable Location
                </>
              )}
            </Button>
          </div>

          {/* Help for denied permissions */}
          {permissionStatus === 'denied' && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  // Open browser settings help
                  const userAgent = navigator.userAgent;
                  let helpUrl = '';
                  
                  if (userAgent.includes('Chrome')) {
                    helpUrl = 'chrome://settings/content/location';
                  } else if (userAgent.includes('Firefox')) {
                    helpUrl = 'about:preferences#privacy';
                  } else if (userAgent.includes('Safari')) {
                    helpUrl = 'x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices';
                  }
                  
                  if (helpUrl) {
                    window.open(helpUrl, '_blank');
                  } else {
                    toast({
                      title: "Browser Settings",
                      description: "Please check your browser's location settings and allow access for this site.",
                    });
                  }
                }}
                className="w-full text-sm"
              >
                Open Browser Location Settings
              </Button>
            </div>
          )}

          {/* Privacy Note */}
          <p className="text-xs text-gray-500 text-center">
            Your location data is only used for issue reporting and is not stored permanently.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPermissionModal;