import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useLocation } from '@/contexts/LocationContext';

interface LocationPickerProps {
  value: string;
  onChange: (location: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Helper to reverse geocode with Google Maps first, then OpenStreetMap Nominatim
export const resolveCoordinatesAddress = async (coords: { lat: number; lng: number }): Promise<string> => {
  // 1. Try Google Maps Geocoding
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          return data.results[0].formatted_address;
        }
      }
    }
  } catch (err) {
    console.warn('Google Maps geocoding failed, falling back to OSM Nominatim:', err);
  }

  // 2. OpenStreetMap Nominatim fallback
  try {
    const osmResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (osmResponse.ok) {
      const osmData = await osmResponse.json();
      if (osmData && osmData.display_name) {
        return osmData.display_name;
      }
    }
  } catch (err) {
    console.warn('OSM Nominatim geocoding failed:', err);
  }

  // 3. Fallback to readable coordinate string
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, placeholder }) => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapAddress, setMapAddress] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  
  // Use location context
  const { userLocation, isLocationAvailable, requestLocationUpdate } = useLocation();

  // Auto-fill location if available and field is empty
  useEffect(() => {
    if (isLocationAvailable && userLocation && !value) {
      onChange(userLocation.address, { lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [isLocationAvailable, userLocation, value, onChange]);

  // Get current location
  const getCurrentLocation = async () => {
    setIsLoading(true);
    
    try {
      // First try to use saved location if available and recent
      if (isLocationAvailable && userLocation) {
        const isLocationFresh = Date.now() - userLocation.timestamp < 5 * 60 * 1000; // 5 minutes
        if (isLocationFresh) {
          onChange(userLocation.address, { lat: userLocation.lat, lng: userLocation.lng });
          toast({
            title: "Location Retrieved",
            description: "Using your saved location.",
          });
          setIsLoading(false);
          return;
        }
      }

      // Request fresh location update
      const location = await requestLocationUpdate();
      if (location) {
        onChange(location.address, { lat: location.lat, lng: location.lng });
        toast({
          title: "Location Updated",
          description: "Your current location has been detected successfully!",
        });
      } else {
        toast({
          title: "Location Error",
          description: "Unable to detect your location. Please enter manually or use the map.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Location error:', error);
      toast({
        title: "Location Error",
        description: "Unable to detect your location. Please enter manually or use the map.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (coords: { lat: number; lng: number }) => {
    try {
      const address = await resolveCoordinatesAddress(coords);
      onChange(address, coords);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      onChange(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`, coords);
    }
  };

  // Initialize map
  const initializeMap = () => {
    console.log('Initializing map with new layout...');
    
    if (!mapRef.current) {
      console.error('Map container not found');
      return;
    }

    if (mapInstanceRef.current) {
      console.log('Map already exists, cleaning up...');
      mapInstanceRef.current = null;
    }

    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not loaded');
      return;
    }

    try {
      console.log('Creating Google Maps instance...');
      
      // Default to India center
      const defaultCenter = { lat: 20.5937, lng: 78.9629 };
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 6,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      mapInstanceRef.current = map;
      console.log('Map created successfully!');

      // Add click listener for map
      map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        
        const coords = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        };
        
        console.log('Map clicked at:', coords);
        setSelectedCoords(coords);
        
        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }
        
        // Add new marker with custom icon
        const marker = new window.google.maps.Marker({
          position: coords,
          map: map,
          title: 'Selected Location',
          animation: window.google.maps.Animation.DROP
        });
        
        markerRef.current = marker;
        
        // Get address for coordinates
        reverseGeocodeForMap(coords);
        
        toast({
          title: "Location Selected",
          description: "Scroll down to save this location.",
        });
      });

      // Set up search functionality
      setTimeout(() => {
        const searchInput = document.getElementById('map-search-input') as HTMLInputElement;
        if (searchInput && window.google.maps.places) {
          console.log('Setting up search functionality...');
          
          const searchBox = new window.google.maps.places.SearchBox(searchInput);

          // Bias results to map viewport
          map.addListener('bounds_changed', () => {
            searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
          });

          // Handle place selection
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            
            console.log('Places changed event fired, places:', places);
            
            if (!places || places.length === 0) {
              console.log('No places found');
              return;
            }

            const place = places[0];
            console.log('First place:', place);
            
            if (!place.geometry || !place.geometry.location) {
              console.log('Place has no geometry');
              toast({
                title: "Location Error",
                description: "Could not find coordinates for this location. Try another search.",
                variant: "destructive",
              });
              return;
            }

            const coords = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            };

            console.log('Place selected:', place.name, coords);
            setSelectedCoords(coords);

            // Remove existing marker
            if (markerRef.current) {
              markerRef.current.setMap(null);
            }

            // Add marker for searched place with bounce animation
            const marker = new window.google.maps.Marker({
              position: coords,
              map: map,
              title: place.name || 'Selected Location',
              animation: window.google.maps.Animation.BOUNCE
            });

            // Stop bounce after 2 seconds
            setTimeout(() => {
              marker.setAnimation(null);
            }, 2000);

            markerRef.current = marker;

            // Set address
            const address = place.formatted_address || place.name || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
            setMapAddress(address);

            // Center map on place with proper zoom
            if (place.geometry.viewport) {
              // If place has a viewport, fit to it
              map.fitBounds(place.geometry.viewport);
            } else {
              // Otherwise center and zoom
              map.setCenter(coords);
              map.setZoom(17); // Closer zoom for better visibility
            }

            // Clear search input
            searchInput.value = '';

            toast({
              title: "Location Found",
              description: `Selected: ${place.name || address}. Scroll down to save.`,
            });
          });
          
          console.log('Search functionality set up successfully!');
        } else {
          console.warn('Search input not found or Places API not available');
        }
      }, 500);

      // Try to center on user location if available
      if (isLocationAvailable && userLocation) {
        console.log('Centering map on user location');
        map.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
        map.setZoom(15);
      }

    } catch (error) {
      console.error('Error creating map:', error);
      toast({
        title: "Map Error",
        description: "Failed to create map. Please refresh and try again.",
        variant: "destructive",
      });
    }
  };

  // Reverse geocode for map selection
  const reverseGeocodeForMap = async (coords: { lat: number; lng: number }) => {
    try {
      const address = await resolveCoordinatesAddress(coords);
      setMapAddress(address);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      setMapAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    }
  };

  // Load Google Maps script
  useEffect(() => {
    if (!isMapOpen) return;

    console.log('Map modal opened, checking Google Maps API...');

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key not found');
      toast({
        title: "Configuration Error",
        description: "Google Maps API key is missing. Please check your environment variables.",
        variant: "destructive",
      });
      return;
    }

    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('Google Maps API already loaded');
      setTimeout(initializeMap, 100);
      return;
    }

    console.log('Loading Google Maps API...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;

    // Create global callback
    (window as unknown as { initMap?: () => void }).initMap = () => {
      console.log('Google Maps API loaded via callback');
      setTimeout(initializeMap, 100);
    };

    script.onerror = (error) => {
      console.error('Failed to load Google Maps API:', error);
      toast({
        title: "Map Loading Error",
        description: "Failed to load Google Maps. Please check your internet connection.",
        variant: "destructive",
      });
    };

    document.head.appendChild(script);

    // Cleanup
    return () => {
      const win = window as unknown as { initMap?: () => void };
      if (win.initMap) {
        delete win.initMap;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapOpen]);

  // Confirm map selection
  const confirmMapSelection = () => {
    if (selectedCoords && mapAddress) {
      onChange(mapAddress, selectedCoords);
      toast({
        title: "Location Saved",
        description: "Selected location has been saved successfully!",
      });
      setIsMapOpen(false);
      setSelectedCoords(null);
      setMapAddress('');
    } else if (selectedCoords && !mapAddress) {
      // If we have coordinates but no address yet, use coordinates
      const coordsString = `${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`;
      onChange(coordsString, selectedCoords);
      toast({
        title: "Location Saved",
        description: "Selected coordinates have been saved successfully!",
      });
      setIsMapOpen(false);
      setSelectedCoords(null);
      setMapAddress('');
    } else {
      toast({
        title: "No Location Selected",
        description: "Please click on the map or search for a location first.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      {/* Auto-location indicator */}
      {isLocationAvailable && userLocation && value === userLocation.address && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded">
          <MapPin className="h-4 w-4" />
          <span>Using your current location</span>
        </div>
      )}
      
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || (isLocationAvailable ? "Auto-detected location or enter manually" : "Enter location or use GPS/Map")}
            className="pr-20"
          />
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={getCurrentLocation}
          disabled={isLoading}
          className="flex-shrink-0"
          title="Get current location"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMapOpen(true)}
          className="flex-shrink-0"
          title="Select on map"
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Modal */}
      <Dialog open={isMapOpen} onOpenChange={(open) => {
        // Don't close on outside click or escape - only via buttons
        if (!open) return;
        setIsMapOpen(open);
      }}>
        <DialogContent 
          className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden"
          onInteractOutside={(e) => {
            // Prevent closing when clicking outside
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing on Escape key
            if (selectedCoords) {
              const confirmClose = window.confirm('Close without saving? Your selected location will be lost.');
              if (!confirmClose) {
                e.preventDefault();
              }
            }
          }}
        >
          {/* Header - Fixed at top */}
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Select Issue Location
              </h2>
              <p className="text-sm text-gray-600">
                Search for a location or click on the map to select
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Only close the popup, don't clear selection
                const confirmClose = !selectedCoords || window.confirm('Close without saving? Your selected location will be lost.');
                if (confirmClose) {
                  setIsMapOpen(false);
                  setSelectedCoords(null);
                  setMapAddress('');
                }
              }}
              title="Close map"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Map Container - Fixed height */}
            <div className="relative">
              <div 
                ref={mapRef} 
                className="w-full h-[400px] bg-gray-100"
                style={{ minHeight: '400px' }}
              />
              
              {/* Search Box - Positioned over map */}
              <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-md px-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Search for a location (e.g., Mumbai, India Gate, etc.)"
                    className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg shadow-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    id="map-search-input"
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">
                    Press Enter
                  </div>
                </div>
              </div>
            </div>
            
            {/* Selected Location Display */}
            <div className="p-4 bg-gray-50">
              {selectedCoords ? (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-800">Location Selected!</p>
                  </div>
                  <p className="text-green-700 mb-1">{mapAddress || 'Getting address...'}</p>
                  <p className="text-sm text-green-600">
                    Coordinates: {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                  </p>
                  <p className="text-sm text-green-500 mt-2">
                    ✓ Scroll down to save this location
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <p className="font-medium text-gray-600">No Location Selected</p>
                  </div>
                  <p className="text-gray-500">
                    Search for a location above or click anywhere on the map to select it
                  </p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="p-4 bg-blue-50 border-t">
              <h3 className="font-medium text-blue-800 mb-2">How to select a location:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Search:</strong> Type a location name in the search box above the map</li>
                <li>• <strong>Click:</strong> Click anywhere on the map to place a marker</li>
                <li>• <strong>Navigate:</strong> Use zoom controls to find the exact spot</li>
              </ul>
            </div>
            
            {/* Action Buttons - At bottom with scroll */}
            <div className="p-4 bg-white border-t sticky bottom-0">
              <div className="flex justify-between items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMapOpen(false);
                    setSelectedCoords(null);
                    setMapAddress('');
                  }}
                  className="px-8"
                >
                  Cancel
                </Button>
                
                <div className="flex items-center gap-3">
                  {selectedCoords && (
                    <div className="text-sm text-green-600 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                      Ready to save
                    </div>
                  )}
                  <Button
                    onClick={confirmMapSelection}
                    disabled={!selectedCoords}
                    className={`px-8 ${
                      selectedCoords 
                        ? 'bg-green-600 hover:bg-green-700 shadow-lg' 
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {selectedCoords ? (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Save Location
                      </>
                    ) : (
                      'Select Location First'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationPicker;