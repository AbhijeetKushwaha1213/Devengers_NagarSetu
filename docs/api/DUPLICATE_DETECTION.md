# Duplicate Issue Detection System

## Overview

Nagar Setu includes an intelligent duplicate detection system that prevents users from submitting duplicate issue reports. The system uses multiple analysis methods to identify potential duplicates before submission.

## How It Works

### 1. Multi-Factor Analysis

The system analyzes several factors to determine if an issue might be a duplicate:

- **Location Proximity** (40% weight): Issues within 100 meters are considered potentially duplicate
- **Text Similarity** (40% weight): Description comparison with keyword weighting
- **Image Similarity** (60% weight when available): Vision API analysis of uploaded images
- **Category Matching** (20% weight): Same category issues get bonus similarity

### 2. Detection Process

When a user submits an issue, the system:

1. **Fetches Recent Issues**: Retrieves issues from the last 30 days (excluding resolved ones)
2. **Location Analysis**: Calculates distance between coordinates
3. **Text Analysis**: Compares descriptions using weighted keyword matching
4. **Image Analysis**: Uses Google Vision API to compare image content
5. **Confidence Scoring**: Combines all factors into a confidence score
6. **Threshold Check**: Issues with 60%+ similarity are flagged as potential duplicates

### 3. User Experience

If potential duplicates are found:

- **Duplicate Modal**: Shows up to 3 most similar issues
- **Confidence Score**: Visual indicator of match strength
- **Match Types**: Badges showing what matched (location/image/both)
- **Issue Preview**: Title, description, location, and image of similar issues
- **User Options**:
  - View existing issue details
  - Cancel submission
  - Proceed anyway with submission

## Technical Implementation

### Location Matching

```typescript
// Distance calculation using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2): number {
  // Returns distance in kilometers
  // Issues within 0.1km (100m) are considered potentially duplicate
}
```

### Text Similarity

```typescript
// Weighted keyword matching
const importantKeywords = [
  'broken', 'damaged', 'pothole', 'streetlight', 'trash', 
  'water', 'leak', 'flooding', 'drainage', 'blocked'
];
// Important keywords get 2x weight in similarity calculation
```

### Image Analysis

- Uses Google Vision API to analyze image content
- Compares descriptions generated from images
- Considers category similarity from image analysis
- Combines with text similarity for overall score

### Confidence Scoring

```typescript
// Overall similarity calculation
similarityScore = Math.max(
  locationSimilarity * 0.4 + textSimilarity * 0.4 + categorySimilarity * 0.2,
  imageSimilarity * 0.6 + locationSimilarity * 0.2 + textSimilarity * 0.2
);
```

## Configuration

### Thresholds

- **Distance Threshold**: 100 meters (0.1 km)
- **Similarity Threshold**: 60% (0.6)
- **Time Window**: 30 days for checking duplicates
- **Max Results**: Top 3 most similar issues shown

### Customization

You can adjust these values in `src/services/duplicateDetectionService.ts`:

```typescript
// Adjust distance threshold
if (distance <= 0.1) { // Change 0.1 to desired km

// Adjust similarity threshold  
if (similarityScore > 0.6) { // Change 0.6 to desired threshold

// Adjust time window
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Change 30 to desired days
```

## Benefits

1. **Reduces Duplicate Reports**: Prevents community attention dilution
2. **Improves Issue Quality**: Encourages users to check existing reports
3. **Saves Resources**: Reduces processing of duplicate issues
4. **Better User Experience**: Helps users find existing discussions
5. **Data Integrity**: Maintains cleaner issue database

## Error Handling

- **API Failures**: System gracefully falls back to submission if duplicate check fails
- **Missing Data**: Handles cases where location or images are unavailable
- **Performance**: Optimized queries with time-based filtering
- **User Feedback**: Clear loading states and error messages

## Future Enhancements

- **Machine Learning**: Train models on historical duplicate patterns
- **Address Matching**: Use geocoding for better location matching
- **Semantic Analysis**: Advanced NLP for better text similarity
- **User Feedback**: Learn from user choices to improve accuracy
- **Batch Processing**: Background duplicate detection for existing issues

## Testing

The system includes comprehensive error handling and fallback mechanisms:

- Vision API failures don't block submission
- Database errors are handled gracefully
- Invalid coordinates are filtered out
- Performance is optimized with indexed queries

## Monitoring

Track duplicate detection effectiveness:

- Monitor false positive rates
- Track user behavior (proceed vs cancel)
- Analyze confidence score distribution
- Measure impact on duplicate submissions