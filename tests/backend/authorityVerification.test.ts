/**
 * Simple test script to verify authority access code validation
 * This can be run in the browser console to test the functionality
 */

import { validateAuthorityAccessCode, sanitizeAccessCode, isAuthorityAccessCodeConfigured } from './utils/authValidation';

// Test the validation functions
export const testAuthorityVerification = async () => {
  console.log('Testing Authority Verification System...');
  
  // Test 1: Check if access code is configured
  console.log('1. Checking if access code is configured:', isAuthorityAccessCodeConfigured());
  
  // Test 2: Test valid access code
  const validCode = 'NAGAR_SETU_AUTH_2024_SECURE';
  const isValid = await validateAuthorityAccessCode(validCode);
  console.log('2. Valid code test:', isValid ? 'PASS' : 'FAIL');
  
  // Test 3: Test invalid access code
  const invalidCode = 'WRONG_CODE';
  const isInvalid = await validateAuthorityAccessCode(invalidCode);
  console.log('3. Invalid code test:', !isInvalid ? 'PASS' : 'FAIL');
  
  // Test 4: Test code sanitization
  const dirtyCode = '  NAGAR_SETU_AUTH_2024_SECURE  ';
  const cleanCode = sanitizeAccessCode(dirtyCode);
  console.log('4. Sanitization test:', cleanCode === 'NAGAR_SETU_AUTH_2024_SECURE' ? 'PASS' : 'FAIL');
  
  // Test 5: Test empty code
  const emptyResult = await validateAuthorityAccessCode('');
  console.log('5. Empty code test:', !emptyResult ? 'PASS' : 'FAIL');
  
  console.log('Authority Verification System tests completed!');
};

// Export for use in browser console
(window as unknown as { testAuthorityVerification?: typeof testAuthorityVerification }).testAuthorityVerification = testAuthorityVerification;