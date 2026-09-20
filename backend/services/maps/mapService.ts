import { calculateDistance, extractCoordinates } from '../../utils/coordinates';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export class MapService {
  /**
   * Calculate distance between two coordinates in km
   */
  static distance(coord1: LocationCoords, coord2: LocationCoords): number {
    return calculateDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng);
  }

  /**
   * Parse coordinates from freeform location string
   */
  static parseCoords(location?: string | null): LocationCoords | null {
    return extractCoordinates(location);
  }

  /**
   * Get default center coordinate (e.g. for Indian municipalities)
   */
  static getDefaultCenter(): LocationCoords {
    return { lat: 28.6139, lng: 77.2090 }; // New Delhi default
  }
}

export default MapService;
