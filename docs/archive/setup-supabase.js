#!/usr/bin/env node

/**
 * Supabase Setup Helper Script
 * 
 * This script helps you configure your Supabase credentials.
 * Run with: node setup-supabase.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 Supabase Setup Helper\n');
  console.log('This script will help you configure your Supabase credentials.\n');
  
  try {
    const supabaseUrl = await question('Enter your Supabase Project URL: ');
    const supabaseAnonKey = await question('Enter your Supabase Anon Key: ');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('❌ Both URL and Anon Key are required!');
      process.exit(1);
    }
    
    // Update the supabase.ts file
    const supabaseFilePath = path.join(__dirname, 'src', 'lib', 'supabase.ts');
    let supabaseFileContent = fs.readFileSync(supabaseFilePath, 'utf8');
    
    supabaseFileContent = supabaseFileContent
      .replace('YOUR_SUPABASE_URL', supabaseUrl)
      .replace('YOUR_SUPABASE_ANON_KEY', supabaseAnonKey);
    
    fs.writeFileSync(supabaseFilePath, supabaseFileContent);
    
    console.log('\n✅ Supabase configuration updated successfully!');
    console.log('\nNext steps:');
    console.log('1. Set up your database tables using the SQL in SUPABASE_SETUP.md');
    console.log('2. Configure authentication providers in your Supabase dashboard');
    console.log('3. Set up storage buckets if you need file uploads');
    console.log('4. Run: npm run dev');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

main();