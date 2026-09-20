#!/usr/bin/env node

/**
 * Authority Access Code Generator
 * 
 * This script helps generate secure access codes for the UrbanCare authority verification system.
 * Run with: node scripts/generate-access-code.js
 */

import crypto from 'crypto';

// Generate a secure random access code
function generateSecureCode(prefix = 'NAGAR_SETU', year = new Date().getFullYear()) {
  // Generate 16 random bytes and convert to uppercase hex
  const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  
  // Create a structured code with prefix, year, and random component
  return `${prefix}_${year}_${randomBytes}`;
}

// Generate multiple code options
function generateCodeOptions() {
  console.log('🔐 Authority Access Code Generator');
  console.log('=====================================\n');
  
  console.log('Generated secure access codes (choose one):\n');
  
  // Generate 5 different options
  for (let i = 1; i <= 5; i++) {
    const code = generateSecureCode();
    console.log(`${i}. ${code}`);
  }
  
  console.log('\n📋 Department-specific codes:\n');
  
  // Generate department-specific codes
  const departments = [
    'PUBLIC_WORKS',
    'HEALTH_DEPT', 
    'POLICE_DEPT',
    'FIRE_DEPT',
    'TRANSPORT'
  ];
  
  departments.forEach((dept, index) => {
    const code = generateSecureCode(`UC_${dept}`, new Date().getFullYear());
    console.log(`${index + 1}. ${dept}: ${code}`);
  });
  
  console.log('\n🔧 Usage Instructions:');
  console.log('1. Choose one of the codes above');
  console.log('2. Add it to your environment variables:');
  console.log('   VITE_AUTHORITY_ACCESS_CODE=YOUR_CHOSEN_CODE');
  console.log('3. Restart your application');
  console.log('4. Distribute the code securely to authority personnel');
  
  console.log('\n⚠️  Security Reminders:');
  console.log('- Keep codes confidential');
  console.log('- Rotate codes quarterly');
  console.log('- Use secure distribution methods');
  console.log('- Monitor authority account creation');
  
  console.log('\n📖 For detailed management instructions, see:');
  console.log('   AUTHORITY_ACCESS_CODE_MANAGEMENT.md');
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Authority Access Code Generator');
    console.log('Usage: node scripts/generate-access-code.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --single    Generate a single code');
    console.log('  --help, -h  Show this help message');
    console.log('');
    console.log('Default: Generate multiple code options');
    process.exit(0);
  }
  
  if (args.includes('--single')) {
    const code = generateSecureCode();
    console.log(code);
  } else {
    generateCodeOptions();
  }
}

export {
  generateSecureCode,
  generateCodeOptions
};