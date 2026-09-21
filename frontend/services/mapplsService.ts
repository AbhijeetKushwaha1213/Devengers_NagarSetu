/**
 * MapMyIndia (Mappls) Service & SDK Integration
 * Supports official MapmyIndia Web SDK v3.0, Reverse Geocoding, Search, and Navigation.
 */

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  area?: string;
  city?: string;
  pincode?: string;
}

// Extract Mappls Key from Vite or Node env
export const getMapplsKey = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (
        import.meta.env.VITE_MAPPLS_KEY ||
        import.meta.env.VITE_MAPMYINDIA_MAP_KEY ||
        import.meta.env.VITE_MAPPLS_MAP_KEY ||
        ''
      );
    }
  } catch {
    // import.meta not accessible
  }
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.VITE_MAPPLS_KEY ||
      process.env.VITE_MAPMYINDIA_MAP_KEY ||
      process.env.VITE_MAPPLS_MAP_KEY ||
      process.env.MAPPLS_KEY ||
      ''
    );
  }
  return '';
};

// Default coordinates for India (Center / New Delhi)
export const DEFAULT_INDIA_CENTER: MapCoordinates = {
  lat: 28.6139,
  lng: 77.2090,
};

/**
 * Check if window.mappls or window.MapmyIndia is ready
 */
export const isMapplsLoaded = (): boolean => {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  const MapplsClass = win.mappls || win.MapmyIndia;
  return Boolean(MapplsClass && MapplsClass.Map);
};

/**
 * Wait for MapmyIndia SDK to be fully loaded and initialized
 * Polls reliably up to timeoutMs so maps never prematurely fallback
 */
export const waitForMapplsSDK = (timeoutMs = 6000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);

    if (isMapplsLoaded()) {
      return resolve(true);
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isMapplsLoaded()) {
        clearInterval(interval);
        return resolve(true);
      }
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        console.warn('MapMyIndia SDK load timed out after', timeoutMs, 'ms');
        return resolve(false);
      }
    }, 50);
  });
};

/**
 * Reverse geocode coordinates to human-readable address using Mappls with OpenStreetMap fallback
 */
export const reverseGeocodeCoords = async (coords: MapCoordinates): Promise<string> => {
  const key = getMapplsKey();

  // 1. Try MapMyIndia / Mappls Reverse Geocoding API
  if (key) {
    try {
      const response = await fetch(
        `https://apis.mappls.com/advancedmaps/v1/${key}/rev_geocode?lat=${coords.lat}&lng=${coords.lng}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.results && data.results.length > 0) {
          const res = data.results[0];
          const address = res.formatted_address || res.poi || `${res.subLocality || ''}, ${res.city || ''}, ${res.state || ''}`;
          if (address && address.trim()) {
            return address.trim();
          }
        }
      }
    } catch (err) {
      console.warn('Mappls reverse geocoding error:', err);
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim
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
    console.warn('OSM Nominatim reverse geocoding fallback failed:', err);
  }

  // 3. Coordinate fallback
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
};

/**
 * Forward Geocoding: Search places by name/query
 */
export const searchPlaces = async (query: string): Promise<GeocodeResult[]> => {
  if (!query || query.trim().length < 2) return [];

  const key = getMapplsKey();
  const trimmed = query.trim();

  // 1. Try MapMyIndia / Mappls Geocode API
  if (key) {
    try {
      const response = await fetch(
        `https://apis.mappls.com/advancedmaps/v1/${key}/geo_code?addr=${encodeURIComponent(trimmed)}`
      );
      if (response.ok) {
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = data.copResults || data.results || [];
        if (Array.isArray(items) && items.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return items.slice(0, 5).map((item: any) => ({
            formattedAddress: item.formatted_address || item.address || item.name || trimmed,
            lat: parseFloat(item.latitude || item.lat),
            lng: parseFloat(item.longitude || item.lng || item.lon),
            city: item.city,
            pincode: item.pincode,
          })).filter((item: GeocodeResult) => !isNaN(item.lat) && !isNaN(item.lng));
        }
      }
    } catch (err) {
      console.warn('Mappls search failed, falling back to OSM:', err);
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim Search
  try {
    const osmResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1&countrycodes=in`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    if (osmResponse.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const osmData = await osmResponse.json();
      if (Array.isArray(osmData) && osmData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return osmData.map((item: any) => ({
          formattedAddress: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          city: item.address?.city || item.address?.town || item.address?.village,
          pincode: item.address?.postcode,
        })).filter((item: GeocodeResult) => !isNaN(item.lat) && !isNaN(item.lng));
      }
    }
  } catch (err) {
    console.warn('OSM search fallback error:', err);
  }

  return [];
};

/**
 * Generate directions URL for MapMyIndia / Mappls
 */
export const getDirectionsUrl = (coords?: { lat: number; lng: number } | null, address?: string): string => {
  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return `https://maps.mappls.com/directions?destination=${coords.lat},${coords.lng}`;
  }
  if (address) {
    return `https://maps.mappls.com/directions?destination=${encodeURIComponent(address)}`;
  }
  return 'https://maps.mappls.com';
};
