/**
 * Gemini AI Image Processing Verification Test
 * 
 * Verifies that the Gemini API key in .env.local connects successfully,
 * processes civic issue images, and produces structured analysis.
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyzeImage, combineImageAnalyses } from '../../../backend/services/ai/visionService';
import { analyzeImageSimple } from '../../../backend/services/ai/simpleVisionService';

// Read env for test environment
for (const f of ['.env.local', '.env']) {
  const envPath = path.resolve(process.cwd(), f);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[match[1]] = value;
      }
    }
  }
}

async function runGeminiVisionTests() {
  console.log('===============================================================');
  console.log('🤖 GEMINI AI IMAGE PROCESSING VERIFICATION TEST');
  console.log('===============================================================\n');

  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error('No API key found in process.env, .env.local, or .env');
  }

  console.log(`Using API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-6)}`);

  // Load sample image
  const imgPath = path.resolve(process.cwd(), 'public/cityscape-bg.jpeg');
  if (!fs.existsSync(imgPath)) {
    throw new Error(`Test image not found at: ${imgPath}`);
  }

  const imgBuffer = fs.readFileSync(imgPath);
  const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
  const testFile = new File([blob], 'cityscape-bg.jpeg', { type: 'image/jpeg' });

  // Test 1: analyzeImage with Gemini
  console.log('\n--- Test 1: Calling analyzeImage with Gemini API ---');
  const startTime = Date.now();
  const analysis = await analyzeImage(testFile);
  const duration = Date.now() - startTime;

  console.log(`Analysis completed in ${duration}ms:`);
  console.log('Description:', analysis.description);
  console.log('Category:', analysis.suggestedCategory);
  console.log('Confidence:', analysis.confidence);
  console.log('Labels:', analysis.labels);

  if (!analysis.description || analysis.description.length < 10) {
    throw new Error('Analysis failed: Description is too short or empty');
  }

  if (!analysis.suggestedCategory) {
    throw new Error('Analysis failed: Suggested category is missing');
  }

  if (analysis.confidence <= 0) {
    throw new Error('Analysis failed: Confidence score should be > 0');
  }

  console.log('✅ TEST 1 PASSED: analyzeImage successfully connected to Gemini AI and analyzed image.');

  // Test 2: analyzeImageSimple
  console.log('\n--- Test 2: Calling analyzeImageSimple ---');
  const simpleResult = await analyzeImageSimple(testFile);
  console.log('Simple Result:', simpleResult);

  if (!simpleResult.description || !simpleResult.category) {
    throw new Error('Simple analysis failed to return description and category');
  }
  console.log('✅ TEST 2 PASSED: analyzeImageSimple successfully produced description and category.');

  // Test 3: combineImageAnalyses
  console.log('\n--- Test 3: Testing combineImageAnalyses ---');
  const combined = combineImageAnalyses([analysis]);
  console.log('Combined result:', combined);
  if (!combined.description || !combined.category) {
    throw new Error('combineImageAnalyses failed');
  }
  console.log('✅ TEST 3 PASSED: combineImageAnalyses works correctly.');

  console.log('\n===============================================================');
  console.log('🎉 ALL GEMINI AI IMAGE PROCESSING TESTS PASSED!');
  console.log('===============================================================');
}

runGeminiVisionTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
