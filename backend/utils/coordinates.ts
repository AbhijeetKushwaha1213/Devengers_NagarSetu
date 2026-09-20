/**
 * Geographic calculation utilities (Haversine formula and coordinate extraction)
 */

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function extractCoordinates(location?: string | null): { lat: number; lng: number } | null {
  if (!location || typeof location !== 'string') return null;

  const patterns = [
    /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /lat:\s*(-?\d+\.?\d*),?\s*lng:\s*(-?\d+\.?\d*)/i,
    /latitude:\s*(-?\d+\.?\d*),?\s*longitude:\s*(-?\d+\.?\d*)/i,
    /\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/
  ];

  for (const pattern of patterns) {
    const match = location.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }

  return null;
}
