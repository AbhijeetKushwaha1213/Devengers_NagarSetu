import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { resolveCoordinatesAddress } from '@/components/LocationPicker';

interface UserLocation {
  lat: number;
  lng: number;
  address: string;
  timestamp: number;
}

interface LocationContextType {
  userLocation: UserLocation | null;
  isLocationAvailable: boolean;
  isLocationPermissionAsked: boolean;
  showLocationModal: boolean;
  setShowLocationModal: (show: boolean) => void;
  updateUserLocation: (location: UserLocation) => void;
  clearUserLocation: () => void;
  requestLocationUpdate: () => Promise<UserLocation | null>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Check if location permission was already asked
  const isLocationPermissionAsked = localStorage.getItem('locationPermissionAsked') === 'true';
  const isLocationPermissionSkipped = localStorage.getItem('locationPermissionSkipped') === 'true';

  // Check if location is available
  const isLocationAvailable = userLocation !== null;

  // Load saved location on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        const location = JSON.parse(savedLocation);
        // Check if location is not too old (24 hours)
        const isLocationFresh = Date.now() - location.timestamp < 24 * 60 * 60 * 1000;
        if (isLocationFresh) {
          setUserLocation(location);
        } else {
          // Location is old, remove it
          localStorage.removeItem('userLocation');
        }
      } catch (error) {
        console.error('Error parsing saved location:', error);
        localStorage.removeItem('userLocation');
      }
    }

    // Show location modal if permission wasn't asked and not skipped
    if (!isLocationPermissionAsked && !isLocationPermissionSkipped && !savedLocation) {
      // Delay showing modal to let the app load first
      setTimeout(() => {
        setShowLocationModal(true);
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update user location
  const updateUserLocation = (location: UserLocation) => {
    setUserLocation(location);
    localStorage.setItem('userLocation', JSON.stringify(location));
    localStorage.setItem('locationPermissionAsked', 'true');
    localStorage.removeItem('locationPermissionSkipped');
  };

  // Clear user location
  const clearUserLocation = () => {
    setUserLocation(null);
    localStorage.removeItem('userLocation');
  };

  // Request fresh location update
  const requestLocationUpdate = async (): Promise<UserLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          try {
            // Reverse geocode to get human-readable address with fallbacks
            const address = await resolveCoordinatesAddress(coords);

            const location: UserLocation = {
              ...coords,
              address,
              timestamp: Date.now()
            };

            updateUserLocation(location);
            resolve(location);
          } catch (error) {
            console.error('Error processing location:', error);
            const location: UserLocation = {
              ...coords,
              address: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
              timestamp: Date.now()
            };
            updateUserLocation(location);
            resolve(location);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          resolve(null);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  const value: LocationContextType = {
    userLocation,
    isLocationAvailable,
    isLocationPermissionAsked,
    showLocationModal,
    setShowLocationModal,
    updateUserLocation,
    clearUserLocation,
    requestLocationUpdate
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export default LocationProvider;