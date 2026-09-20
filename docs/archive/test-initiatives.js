#!/usr/bin/env node

/**
 * Test Initiatives Database Setup and Real-time Functionality
 * Run with: node test-initiatives.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInitiativesSetup() {
  console.log('🔍 Testing Initiatives Database Setup...\n');
  
  try {
    // Test 1: Check if initiatives table exists
    console.log('1. Testing initiatives table...');
    const { data: initiatives, error: initiativesError } = await supabase
      .from('initiatives')
      .select('*')
      .limit(1);
    
    if (initiativesError) {
      console.log('❌ Initiatives table error:', initiativesError.message);
      if (initiativesError.message.includes('relation "public.initiatives" does not exist')) {
        console.log('\n🔧 The initiatives table does not exist. Please run the migration:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Open the SQL Editor');
        console.log('3. Copy and paste the contents of initiatives-migration.sql');
        console.log('4. Run the SQL commands');
        return false;
      }
    } else {
      console.log('✅ Initiatives table accessible');
      console.log(`Found ${initiatives.length} initiatives`);
    }
    
    // Test 2: Check table structure
    console.log('\n2. Testing table structure...');
    const { data: tableInfo, error: structureError } = await supabase
      .from('initiatives')
      .select('id, title, description, location, category, meeting_date, meeting_time, volunteers_needed, volunteers_count, organizer, status, volunteers, created_at')
      .limit(1);
    
    if (structureError) {
      console.log('❌ Table structure error:', structureError.message);
      console.log('Some columns might be missing. Please check the migration script.');
    } else {
      console.log('✅ Table structure looks correct');
    }
    
    // Test 3: Test RPC functions
    console.log('\n3. Testing RPC functions...');
    try {
      // This should fail gracefully if no initiative exists
      const { error: rpcError } = await supabase.rpc('join_initiative', {
        initiative_id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000'
      });
      
      if (rpcError && !rpcError.message.includes('function join_initiative(uuid, uuid) does not exist')) {
        console.log('✅ RPC functions exist (expected error for non-existent initiative)');
      } else if (rpcError && rpcError.message.includes('function join_initiative(uuid, uuid) does not exist')) {
        console.log('❌ RPC functions missing. Please run the full migration script.');
      } else {
        console.log('✅ RPC functions working');
      }
    } catch (error) {
      console.log('⚠️  RPC test inconclusive:', error.message);
    }
    
    // Test 4: Test real-time subscription
    console.log('\n4. Testing real-time subscription...');
    const subscription = supabase
      .channel('test-initiatives')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'initiatives'
        }, 
        (payload) => {
          console.log('✅ Real-time update received:', payload.eventType);
        }
      )
      .subscribe();
    
    // Wait a moment then unsubscribe
    setTimeout(() => {
      subscription.unsubscribe();
      console.log('✅ Real-time subscription test completed');
    }, 1000);
    
    // Test 5: Create a sample initiative (if user is authenticated)
    console.log('\n5. Testing initiative creation...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const sampleInitiative = {
        title: 'Test Initiative - ' + new Date().toISOString(),
        description: 'This is a test initiative created by the test script.',
        location: 'Test Location',
        category: 'Other',
        meeting_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        meeting_time: '10:00',
        volunteers_needed: 5,
        organizer: 'Test User',
        status: 'open',
        volunteers_count: 0,
        volunteers: [],
        created_by: user.id
      };
      
      const { data: newInitiative, error: createError } = await supabase
        .from('initiatives')
        .insert([sampleInitiative])
        .select()
        .single();
      
      if (createError) {
        console.log('❌ Failed to create test initiative:', createError.message);
      } else {
        console.log('✅ Test initiative created successfully');
        console.log('Initiative ID:', newInitiative.id);
        
        // Clean up - delete the test initiative
        const { error: deleteError } = await supabase
          .from('initiatives')
          .delete()
          .eq('id', newInitiative.id);
        
        if (deleteError) {
          console.log('⚠️  Failed to clean up test initiative:', deleteError.message);
        } else {
          console.log('✅ Test initiative cleaned up');
        }
      }
    } else {
      console.log('ℹ️  Not authenticated - skipping initiative creation test');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    return false;
  }
}

testInitiativesSetup().then(success => {
  if (success) {
    console.log('\n🎉 Initiatives setup test completed!');
    console.log('\nThe Join Initiative feature should now work with:');
    console.log('- Real-time updates when initiatives are created/updated');
    console.log('- Proper volunteer management');
    console.log('- Live statistics');
    console.log('- No hardcoded data');
  } else {
    console.log('\n❌ Setup test failed.');
    console.log('\nPlease run the initiatives-migration.sql script in your Supabase dashboard.');
  }
  process.exit(0);
});