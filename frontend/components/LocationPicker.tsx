import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useLocation } from '@/contexts/LocationContext';
import { 
  reverseGeocodeCoords, 
  searchPlaces, 
  DEFAULT_INDIA_CENTER, 
  GeocodeResult,
  waitForMapplsSDK 
} from '@/services/mapplsService';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationPickerProps {
  value: string;
  onChange: (location: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

export const resolveCoordinatesAddress = async (coords: { lat: number; lng: number }): Promise<string> => {
  return reverseGeocodeCoords(coords);
};

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, placeholder }) => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapAddress, setMapAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapplsMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapplsMarkerRef = useRef<any>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);

  const { userLocation, isLocationAvailable, requestLocationUpdate } = useLocation();

  useEffect(() => {
    if (isLocationAvailable && userLocation && !value) {
      onChange(userLocation.address, { lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [isLocationAvailable, userLocation, value, onChange]);

  const getCurrentLocation = async () => {
    setIsLoading(true);
    try {
      if (isLocationAvailable && userLocation) {
        const isFresh = Date.now() - userLocation.timestamp < 5 * 60 * 1000;
        if (isFresh) {
          onChange(userLocation.address, { lat: userLocation.lat, lng: userLocation.lng });
          toast({
            title: "Location Retrieved",
            description: "Using your current detected location.",
          });
          setIsLoading(false);
          return;
        }
      }

      const location = await requestLocationUpdate();
      if (location) {
        onChange(location.address, { lat: location.lat, lng: location.lng });
        toast({
          title: "Location Updated",
          description: "Your location was detected successfully via GPS.",
        });
      } else {
        toast({
          title: "Location Error",
          description: "Unable to detect GPS location. Please select on the map or enter manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Location error:', error);
      toast({
        title: "Location Error",
        description: "Unable to detect location. Please use the map or type manually.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapCoordSelect = async (coords: { lat: number; lng: number }) => {
    setSelectedCoords(coords);
    setMapAddress('Fetching address from MapMyIndia...');
    try {
      const addr = await resolveCoordinatesAddress(coords);
      setMapAddress(addr);
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setMapAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    }
  };

  // Consistently initialize MapMyIndia Map
  useEffect(() => {
    if (!isMapOpen) {
      if (mapplsMapRef.current && typeof mapplsMapRef.current.remove === 'function') {
        try { mapplsMapRef.current.remove(); } catch (e) { console.debug(e); }
        mapplsMapRef.current = null;
      }
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch (e) { console.debug(e); }
        leafletMapRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const setupMap = async () => {
      const containerId = 'mappls-location-picker-canvas';
      const containerEl = document.getElementById(containerId);
      if (!containerEl || !isMounted) return;

      // Clean container DOM to prevent duplicate canvas/layers
      containerEl.innerHTML = '';

      const initialCenter = selectedCoords || 
        (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : DEFAULT_INDIA_CENTER);

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
            center: [initialCenter.lat, initialCenter.lng],
            zoom: userLocation || selectedCoords ? 15 : 6,
            zoomControl: true,
            hybrid: false,
            search: false,
          });

          map.addListener('load', () => {
            if (!isMounted) return;
            if (selectedCoords && MapplsClass.Marker) {
              const marker = new MapplsClass.Marker({
                map: map,
                position: { lat: selectedCoords.lat, lng: selectedCoords.lng },
                draggable: true,
              });
              marker.addListener('dragend', () => {
                const pos = marker.getPosition ? marker.getPosition() : selectedCoords;
                if (pos) handleMapCoordSelect({ lat: pos.lat, lng: pos.lng });
              });
              mapplsMarkerRef.current = marker;
            }
          });

          map.addListener('click', (e: { lngLat?: { lat: number; lng: number }; latlng?: { lat: number; lng: number } }) => {
            const coords = e.lngLat || e.latlng;
            if (!coords) return;

            if (mapplsMarkerRef.current && typeof mapplsMarkerRef.current.setPosition === 'function') {
              mapplsMarkerRef.current.setPosition(coords);
            } else if (MapplsClass.Marker) {
              const marker = new MapplsClass.Marker({
                map: map,
                position: coords,
                draggable: true,
              });
              marker.addListener('dragend', () => {
                const pos = marker.getPosition ? marker.getPosition() : coords;
                if (pos) handleMapCoordSelect({ lat: pos.lat, lng: pos.lng });
              });
              mapplsMarkerRef.current = marker;
            }

            handleMapCoordSelect(coords);
          });

          mapplsMapRef.current = map;
          return;
        } catch (err) {
          console.warn('MapMyIndia native map render exception, falling back:', err);
        }
      }

      // Emergency Fallback (Leaflet)
      try {
        containerEl.innerHTML = '';
        const map = L.map(containerEl, {
          center: [initialCenter.lat, initialCenter.lng],
          zoom: userLocation || selectedCoords ? 14 : 5,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.mappls.com">MapMyIndia</a> | &copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        leafletMapRef.current = map;

        if (selectedCoords) {
          const marker = L.marker([selectedCoords.lat, selectedCoords.lng], { draggable: true }).addTo(map);
          marker.on('dragend', (e) => {
            const latlng = e.target.getLatLng();
            handleMapCoordSelect({ lat: latlng.lat, lng: latlng.lng });
          });
          leafletMarkerRef.current = marker;
        }

        map.on('click', (e: L.LeafletMouseEvent) => {
          const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
          if (leafletMarkerRef.current) {
            leafletMarkerRef.current.setLatLng(e.latlng);
          } else {
            const marker = L.marker(e.latlng, { draggable: true }).addTo(map);
            marker.on('dragend', (dragEvt) => {
              const pos = dragEvt.target.getLatLng();
              handleMapCoordSelect({ lat: pos.lat, lng: pos.lng });
            });
            leafletMarkerRef.current = marker;
          }
          handleMapCoordSelect(coords);
        });

        map.invalidateSize();
      } catch (leafErr) {
        console.error('Leaflet fallback error:', leafErr);
      }
    };

    const timer = setTimeout(setupMap, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (mapplsMapRef.current && typeof mapplsMapRef.current.remove === 'function') {
        try { mapplsMapRef.current.remove(); } catch (e) { console.debug(e); }
        mapplsMapRef.current = null;
      }
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch (e) { console.debug(e); }
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchPlaces(searchQuery);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      if (results.length === 0) {
        toast({
          title: "No places found",
          description: "Try searching with a city or landmark name.",
        });
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: GeocodeResult) => {
    const coords = { lat: result.lat, lng: result.lng };
    setSelectedCoords(coords);
    setMapAddress(result.formattedAddress);
    setShowDropdown(false);
    setSearchQuery(result.formattedAddress);

    // Update MapMyIndia native map if active
    if (mapplsMapRef.current) {
      if (typeof mapplsMapRef.current.setCenter === 'function') {
        mapplsMapRef.current.setCenter([coords.lat, coords.lng]);
        if (typeof mapplsMapRef.current.setZoom === 'function') {
          mapplsMapRef.current.setZoom(16);
        }
      }
      if (mapplsMarkerRef.current && typeof mapplsMarkerRef.current.setPosition === 'function') {
        mapplsMarkerRef.current.setPosition(coords);
      }
    }

    // Update Leaflet fallback map if active
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([coords.lat, coords.lng], 16);
      if (leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([coords.lat, coords.lng]);
      } else {
        const marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(leafletMapRef.current);
        marker.on('dragend', (dragEvt) => {
          const pos = dragEvt.target.getLatLng();
          handleMapCoordSelect({ lat: pos.lat, lng: pos.lng });
        });
        leafletMarkerRef.current = marker;
      }
    }
  };

  const confirmMapSelection = () => {
    if (selectedCoords && mapAddress) {
      onChange(mapAddress, selectedCoords);
      toast({
        title: "Location Saved",
        description: "Selected location has been updated.",
      });
      setIsMapOpen(false);
    } else if (selectedCoords) {
      const coordsString = `${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`;
      onChange(coordsString, selectedCoords);
      toast({
        title: "Coordinates Saved",
        description: "Location coordinates updated.",
      });
      setIsMapOpen(false);
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
      {isLocationAvailable && userLocation && value === userLocation.address && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded">
          <MapPin className="h-4 w-4" />
          <span>Using your detected location</span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || (isLocationAvailable ? "Auto-detected location or enter manually" : "Enter location or use MapMyIndia Map")}
            className="pr-4"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={getCurrentLocation}
          disabled={isLoading}
          className="flex-shrink-0"
          title="Get current GPS location"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Navigation className="h-4 w-4 text-blue-600" />
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMapOpen(true)}
          className="flex-shrink-0 text-blue-600"
          title="Select on MapMyIndia"
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Modal */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent 
          className="max-w-4xl w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col bg-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-slate-50">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                <MapPin className="h-5 w-5 text-blue-600" />
                Select Issue Location on Map
              </h2>
              <p className="text-xs text-slate-500">
                Powered by MapMyIndia (Mappls). Search places or tap the map to drop a pin.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMapOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search bar over map */}
          <div className="p-3 bg-white border-b relative z-20">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search street, locality, landmark, or city in India..."
                  className="pr-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" disabled={isSearching} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                Search
              </Button>
            </form>

            {/* Suggestions dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto z-30 divide-y">
                {searchResults.map((res, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-start gap-2"
                  >
                    <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{res.formattedAddress}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map canvas */}
          <div className="relative flex-1 min-h-[300px] w-full">
            <div id="mappls-location-picker-canvas" className="absolute inset-0 w-full h-full" />
          </div>

          {/* Selected Location Info & Action Footer */}
          <div className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 text-left w-full">
              {selectedCoords ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Selected Location
                  </div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">
                    {mapAddress || 'Getting address details...'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Click or drag anywhere on the map to choose the exact coordinates.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMapOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmMapSelection}
                disabled={!selectedCoords}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <MapPin className="h-4 w-4 mr-1.5" />
                Confirm Location
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationPicker;