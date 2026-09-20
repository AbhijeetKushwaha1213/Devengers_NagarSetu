import { supabase } from '@/lib/supabase';

export interface DuplicateIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  image?: string;
  created_at: string;
  created_by?: string;
  similarity_score: number;
  match_type: 'location' | 'image' | 'both';
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicates: DuplicateIssue[];
  confidence: number;
}

// Calculate distance between two coordinates in kilometers (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
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

// Extract coordinates from location/address string
function extractCoordinates(location?: string | null): { lat: number; lng: number } | null {
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

// Calculate text similarity using word overlap with keyword weighting
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const importantKeywords = [
    'broken', 'damaged', 'pothole', 'streetlight', 'trash', 'garbage', 'water', 'leak',
    'flooding', 'drainage', 'blocked', 'overflowing', 'faulty', 'not working', 'repair',
    'maintenance', 'urgent', 'dangerous', 'safety', 'hazard'
  ];

  let weightedScore = 0;
  let totalWeight = 0;

  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];

  const basicSimilarity = intersection.length / union.length;

  intersection.forEach(word => {
    const weight = importantKeywords.includes(word) ? 2 : 1;
    weightedScore += weight;
    totalWeight += weight;
  });

  union.forEach(word => {
    if (!intersection.includes(word)) {
      const weight = importantKeywords.includes(word) ? 2 : 1;
      totalWeight += weight;
    }
  });

  const weightedSimilarity = totalWeight > 0 ? weightedScore / totalWeight : 0;
  return Math.max(basicSimilarity, weightedSimilarity);
}

// Check for duplicate issues against database records with safety timeout
export async function checkForDuplicates(
  description: string,
  location: string,
  coordinates: { lat: number; lng: number } | null,
  _imageBase64?: string,
  category?: string
): Promise<DuplicateDetectionResult> {
  const checkPromise = async (): Promise<DuplicateDetectionResult> => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query only necessary columns with limit to prevent downloading large payloads
      const { data: existingIssues, error } = await supabase
        .from('issues')
        .select('id, title, description, address, category, created_at, reporter_id, image_urls, metadata')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(25);

      if (error || !existingIssues || existingIssues.length === 0) {
        return { isDuplicate: false, duplicates: [], confidence: 0 };
      }

      const duplicates: DuplicateIssue[] = [];

      for (const issue of existingIssues) {
        // 1. Check location proximity
        let locationSimilarity = 0;
        let issueCoords: { lat: number; lng: number } | null = null;

        if (issue.metadata && typeof issue.metadata === 'object') {
          const meta = issue.metadata as Record<string, unknown>;
          if (typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
            issueCoords = { lat: meta.latitude, lng: meta.longitude };
          }
        }

        if (!issueCoords) {
          issueCoords = extractCoordinates(issue.address);
        }

        if (coordinates && issueCoords) {
          const distance = calculateDistance(
            coordinates.lat,
            coordinates.lng,
            issueCoords.lat,
            issueCoords.lng
          );

          // Within 150 meters is considered potential duplicate location
          if (distance <= 0.15) {
            locationSimilarity = Math.max(0, 1 - distance / 0.15);
          }
        }

        // 2. Check text similarity
        const textSimilarity = calculateTextSimilarity(description, issue.description || issue.title || '');

        // 3. Check category similarity
        const categorySimilarity = category && issue.category === category ? 0.25 : 0;

        // Overall similarity score
        const similarityScore = locationSimilarity > 0
          ? locationSimilarity * 0.55 + textSimilarity * 0.35 + categorySimilarity * 0.1
          : textSimilarity * 0.75 + categorySimilarity * 0.25;

        // Consider it a potential duplicate if similarity > 55%
        if (similarityScore > 0.55) {
          duplicates.push({
            id: issue.id,
            title: issue.title,
            description: issue.description || '',
            location: issue.address || 'Local Community',
            image: issue.image_urls && issue.image_urls.length > 0 ? issue.image_urls[0] : undefined,
            created_at: issue.created_at,
            created_by: issue.reporter_id,
            similarity_score: Math.min(similarityScore, 1),
            match_type: locationSimilarity > 0.4 ? 'location' : 'image'
          });
        }
      }

      // Sort by similarity score (highest first)
      duplicates.sort((a, b) => b.similarity_score - a.similarity_score);

      const isDuplicate = duplicates.length > 0;
      const confidence = isDuplicate ? duplicates[0].similarity_score : 0;

      return {
        isDuplicate,
        duplicates: duplicates.slice(0, 3),
        confidence
      };
    } catch (error) {
      console.warn('Duplicate detection check bypassed due to error:', error);
      return { isDuplicate: false, duplicates: [], confidence: 0 };
    }
  };

  // Enforce a hard 2-second timeout so duplicate check can NEVER block submission
  const timeoutPromise = new Promise<DuplicateDetectionResult>((resolve) =>
    setTimeout(() => resolve({ isDuplicate: false, duplicates: [], confidence: 0 }), 2000)
  );

  return Promise.race([checkPromise(), timeoutPromise]);
}

// Format time ago for display
export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} week${Math.ceil(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}