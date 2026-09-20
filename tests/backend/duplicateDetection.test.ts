/**
 * Test script for duplicate detection functionality
 * Run with: npx tsx src/test-duplicate-detection.ts
 */

import { checkForDuplicates } from './services/duplicateDetectionService';

async function testDuplicateDetection() {
  console.log('🔍 Testing Duplicate Detection System');
  console.log('=====================================\n');

  // Test case 1: Similar descriptions
  console.log('Test 1: Similar text descriptions');
  const result1 = await checkForDuplicates(
    'Broken streetlight on Main Street causing safety issues',
    'Main Street, Downtown',
    { lat: 40.7128, lng: -74.0060 }
  );
  console.log('Result:', result1.isDuplicate ? 'DUPLICATE DETECTED' : 'NO DUPLICATES');
  console.log('Confidence:', Math.round(result1.confidence * 100) + '%');
  console.log('Duplicates found:', result1.duplicates.length);
  console.log('');

  // Test case 2: Same location, different description
  console.log('Test 2: Same location, different description');
  const result2 = await checkForDuplicates(
    'Pothole needs repair urgently',
    'Main Street, Downtown',
    { lat: 40.7128, lng: -74.0060 }
  );
  console.log('Result:', result2.isDuplicate ? 'DUPLICATE DETECTED' : 'NO DUPLICATES');
  console.log('Confidence:', Math.round(result2.confidence * 100) + '%');
  console.log('Duplicates found:', result2.duplicates.length);
  console.log('');

  // Test case 3: Different location and description
  console.log('Test 3: Different location and description');
  const result3 = await checkForDuplicates(
    'New park bench installation needed',
    'Park Avenue, Uptown',
    { lat: 40.7589, lng: -73.9851 }
  );
  console.log('Result:', result3.isDuplicate ? 'DUPLICATE DETECTED' : 'NO DUPLICATES');
  console.log('Confidence:', Math.round(result3.confidence * 100) + '%');
  console.log('Duplicates found:', result3.duplicates.length);
  console.log('');

  // Test case 4: Keyword-heavy description
  console.log('Test 4: Keyword-heavy description');
  const result4 = await checkForDuplicates(
    'Dangerous broken streetlight not working, urgent repair needed for safety',
    'Oak Street, Midtown',
    { lat: 40.7505, lng: -73.9934 },
    undefined,
    'Electricity'
  );
  console.log('Result:', result4.isDuplicate ? 'DUPLICATE DETECTED' : 'NO DUPLICATES');
  console.log('Confidence:', Math.round(result4.confidence * 100) + '%');
  console.log('Duplicates found:', result4.duplicates.length);
  console.log('');

  console.log('✅ Duplicate detection tests completed!');
  console.log('\nNote: Results depend on existing issues in your database.');
  console.log('For accurate testing, ensure you have some sample issues in the database.');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDuplicateDetection().catch(console.error);
}

export { testDuplicateDetection };