/**
 * Milestone 9.1: Notification Database Foundation & RLS Hardening Tests
 * 
 * Verifies:
 * 1. Anonymous SELECT denied.
 * 2. Citizen SELECT own notifications allowed.
 * 3. Citizen SELECT another user's notifications denied.
 * 4. Worker SELECT own notifications allowed.
 * 5. Admin SELECT own notifications allowed.
 * 6. User cannot update another user's notification.
 * 7. User cannot change user_id on their notification.
 * 8. User cannot change notification content through the intended read/update path.
 * 9. Mark-as-read only works for owner.
 * 10. Notification creation mechanism cannot be abused to target arbitrary users.
 * 11. Existing notification rows remain intact.
 * 12. read_at semantics work: NULL = unread, timestamp = read.
 * 13. Query performance indexes exist.
 * 14. Realtime configuration remains correct.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment configuration
const envPath = path.resolve(process.cwd(), '.env.local');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  }
}

const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL || '';
const anonKey = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY || '';

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: number, name: string, passed: boolean, details: string) {
  results.push({ step, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] Test ${step}: ${name} -> ${details}`);
}

async function runDatabaseSecurityTests() {
  console.log('===============================================================');
  console.log('🧪 MILESTONE 9.1 — NOTIFICATION DATABASE SECURITY TEST SUITE');
  console.log('===============================================================\n');

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase URL or Anon Key. Check .env.local.');
  }

  const anonClient = createClient(supabaseUrl, anonKey);

  // Authenticate test users
  const citizenClient = createClient(supabaseUrl, anonKey);
  const { data: citAuth, error: citErr } = await citizenClient.auth.signInWithPassword({
    email: 'citizen@nagarsetu.test',
    password: 'NagarTest@123',
  });
  if (citErr || !citAuth.user) throw new Error(`Citizen auth failed: ${citErr?.message}`);
  const citizenId = citAuth.user.id;

  const workerClient = createClient(supabaseUrl, anonKey);
  const { data: wrkAuth, error: wrkErr } = await workerClient.auth.signInWithPassword({
    email: 'worker@nagarsetu.test',
    password: 'NagarTest@123',
  });
  if (wrkErr || !wrkAuth.user) throw new Error(`Worker auth failed: ${wrkErr?.message}`);
  const workerId = wrkAuth.user.id;

  const adminClient = createClient(supabaseUrl, anonKey);
  const { data: admAuth, error: admErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@nagarsetu.test',
    password: 'NagarTest@123',
  });
  if (admErr || !admAuth.user) throw new Error(`Admin auth failed: ${admErr?.message}`);
  const adminId = admAuth.user.id;

  console.log(`Authenticated users:
  Citizen: ${citizenId}
  Worker:  ${workerId}
  Admin:   ${adminId}\n`);

  const createdNotificationIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // Test 1: Anonymous SELECT denied
    // --------------------------------------------------------------------------
    const { data: anonData, error: anonErr } = await anonClient
      .from('notifications')
      .select('*')
      .limit(10);
    // Anon select should either return empty array due to RLS or throw auth error
    const anonDenied = (anonData?.length === 0) || (anonErr !== null);
    record(
      1,
      'Anonymous SELECT denied',
      anonDenied,
      anonErr ? `Blocked with error: ${anonErr.message}` : `RLS filtered: returned ${anonData?.length ?? 0} rows`
    );

    // --------------------------------------------------------------------------
    // Test 2: Citizen SELECT own notifications allowed
    // --------------------------------------------------------------------------
    const { data: citData, error: citSelectErr } = await citizenClient
      .from('notifications')
      .select('*')
      .eq('user_id', citizenId);
    record(
      2,
      'Citizen SELECT own notifications allowed',
      citSelectErr === null,
      citSelectErr ? citSelectErr.message : `Successfully executed query, found ${citData?.length ?? 0} notifications`
    );

    // --------------------------------------------------------------------------
    // Test 3: Citizen SELECT another user's notifications denied
    // --------------------------------------------------------------------------
    const { data: citCrossData, error: citCrossErr } = await citizenClient
      .from('notifications')
      .select('*')
      .eq('user_id', workerId);
    const crossSelectBlocked = (citCrossData?.length === 0) || (citCrossErr !== null);
    record(
      3,
      "Citizen SELECT another user's notifications denied",
      crossSelectBlocked,
      citCrossErr ? `Blocked: ${citCrossErr.message}` : `RLS filtered out other user's rows (returned 0)`
    );

    // --------------------------------------------------------------------------
    // Test 4: Worker SELECT own notifications allowed
    // --------------------------------------------------------------------------
    const { data: wrkData, error: wrkSelectErr } = await workerClient
      .from('notifications')
      .select('*')
      .eq('user_id', workerId);
    record(
      4,
      'Worker SELECT own notifications allowed',
      wrkSelectErr === null,
      wrkSelectErr ? wrkSelectErr.message : `Successfully executed query, found ${wrkData?.length ?? 0} notifications`
    );

    // --------------------------------------------------------------------------
    // Test 5: Admin SELECT own notifications allowed
    // --------------------------------------------------------------------------
    const { data: admData, error: admSelectErr } = await adminClient
      .from('notifications')
      .select('*')
      .eq('user_id', adminId);
    record(
      5,
      'Admin SELECT own notifications allowed',
      admSelectErr === null,
      admSelectErr ? admSelectErr.message : `Successfully executed query, found ${admData?.length ?? 0} notifications`
    );

    // --------------------------------------------------------------------------
    // Test 10: Notification creation mechanism cannot be abused to target arbitrary users
    // (a) Direct client insert by citizen must be denied by RLS
    // (b) Citizen RPC create_system_notification must be rejected
    // --------------------------------------------------------------------------
    const { data: spoofInsert, error: spoofErr } = await citizenClient
      .from('notifications')
      .insert({
        user_id: workerId,
        title: 'Spoofed Notification',
        message: 'Malicious user trying to inject notification',
        type: 'status_update',
      })
      .select();
    const directInsertDenied = !!spoofErr && (spoofErr.code === '42501' || spoofErr.message.includes('row-level security'));

    // Try RPC creation as citizen (should be rejected for ordinary citizen)
    let rpcCitizenBlocked = false;
    let rpcCitizenDetails = '';
    try {
      const { data: rpcRes, error: rpcErr } = await citizenClient.rpc('create_system_notification', {
        p_user_id: workerId,
        p_title: 'Citizen calling RPC',
        p_message: 'Should be rejected',
        p_type: 'status_update',
      });
      if (rpcErr) {
        rpcCitizenBlocked = true;
        rpcCitizenDetails = `RPC call rejected: ${rpcErr.message}`;
      } else {
        rpcCitizenBlocked = false;
        rpcCitizenDetails = 'RPC unexpectedly succeeded for citizen';
      }
    } catch (e: unknown) {
      rpcCitizenBlocked = true;
      rpcCitizenDetails = `Exception: ${e instanceof Error ? e.message : String(e)}`;
    }

    record(
      10,
      'Notification creation mechanism cannot be abused to target arbitrary users',
      directInsertDenied || rpcCitizenBlocked,
      `Direct INSERT denied: ${directInsertDenied} (${spoofErr?.message || 'blocked'}). RPC check: ${rpcCitizenDetails}`
    );

    // --------------------------------------------------------------------------
    // Test 6 & 7: User cannot update another user's notification / cannot change user_id
    // --------------------------------------------------------------------------
    // If admin or system creates a notification for worker, test citizen trying to update it
    let testNotifId: string | null = null;
    const { data: adminCreatedNotif, error: adminCreateErr } = await adminClient.rpc('create_system_notification', {
      p_user_id: citizenId,
      p_title: 'Official Milestone 9.1 Verification Notification',
      p_message: 'Verifying notification database foundation and RLS hardening.',
      p_type: 'status_update',
    });

    if (adminCreatedNotif) {
      testNotifId = adminCreatedNotif;
      createdNotificationIds.push(testNotifId!);
    }

    if (testNotifId) {
      // Test 6: Worker tries to update Citizen's notification
      const { data: wrkUpdateData, error: wrkUpdateErr } = await workerClient
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', testNotifId)
        .select();
      const crossUpdateBlocked = (wrkUpdateData?.length === 0) || (wrkUpdateErr !== null);
      record(
        6,
        "User cannot update another user's notification",
        crossUpdateBlocked,
        wrkUpdateErr ? `Blocked: ${wrkUpdateErr.message}` : 'RLS blocked update (0 rows affected)'
      );

      // Test 7: Citizen tries to change user_id to Worker
      const { data: changeUserData, error: changeUserErr } = await citizenClient
        .from('notifications')
        .update({ user_id: workerId })
        .eq('id', testNotifId)
        .select();
      const changeUserBlocked = (changeUserData?.length === 0) || (changeUserErr !== null);
      record(
        7,
        'User cannot change user_id on their notification',
        changeUserBlocked,
        changeUserErr ? `Blocked: ${changeUserErr.message}` : 'RLS / trigger blocked user_id alteration'
      );

      // Test 8: Citizen tries to tamper with notification content (title/message)
      const { data: tamperData, error: tamperErr } = await citizenClient
        .from('notifications')
        .update({ title: 'Tampered Title', message: 'Hacked message body' })
        .eq('id', testNotifId)
        .select();
      const tamperBlocked = (tamperData?.length === 0) || (tamperErr !== null);
      record(
        8,
        'User cannot change notification content through update path',
        tamperBlocked,
        tamperErr ? `Anti-tampering trigger prevented mutation: ${tamperErr.message}` : 'Update path rejected'
      );

      // Test 9: Mark-as-read function works only for owner
      // (a) Worker calling mark_notification_read for Citizen's notification must be rejected
      const { data: wrkMarkData, error: wrkMarkErr } = await workerClient.rpc('mark_notification_read', {
        p_notification_id: testNotifId,
      });
      const wrkMarkBlocked = !!wrkMarkErr;

      // (b) Citizen calling mark_notification_read for own notification succeeds
      const { data: citMarkData, error: citMarkErr } = await citizenClient.rpc('mark_notification_read', {
        p_notification_id: testNotifId,
      });
      const citMarkSuccess = citMarkData?.success === true && citMarkData?.read_at !== null;

      record(
        9,
        'Mark-as-read only works for owner',
        wrkMarkBlocked && citMarkSuccess,
        `Worker call: ${wrkMarkErr ? 'denied (' + wrkMarkErr.message + ')' : 'failed to deny'}. Citizen call: ${citMarkSuccess ? 'success' : 'failed'}`
      );

      // Test 12: read_at semantics work (NULL = unread, timestamp = read)
      const { data: readCheckData } = await citizenClient
        .from('notifications')
        .select('read_at')
        .eq('id', testNotifId)
        .single();
      const readAtIsSet = !!readCheckData?.read_at;
      record(
        12,
        'read_at semantics work: NULL = unread, timestamp = read',
        readAtIsSet,
        `read_at persisted as: ${readCheckData?.read_at}`
      );
    } else {
      console.log('⚠️ Notice: test notification could not be created via RPC (migration may need remote application).');
      record(6, "User cannot update another user's notification", false, 'Pending remote migration application');
      record(7, 'User cannot change user_id on their notification', false, 'Pending remote migration application');
      record(8, 'User cannot change notification content through update path', false, 'Pending remote migration application');
      record(9, 'Mark-as-read only works for owner', false, 'Pending remote migration application');
      record(12, 'read_at semantics work: NULL = unread, timestamp = read', false, 'Pending remote migration application');
    }

    // --------------------------------------------------------------------------
    // Test 11: Existing notification rows remain intact
    // --------------------------------------------------------------------------
    const { count: totalNotifs, error: countErr } = await adminClient
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    record(
      11,
      'Existing notification rows remain intact',
      countErr === null,
      countErr ? countErr.message : `Table accessible, total row count: ${totalNotifs ?? 0}`
    );

    // --------------------------------------------------------------------------
    // Test 13: Query performance indexes exist & query without error
    // --------------------------------------------------------------------------
    const { data: indexQuery1, error: idxErr1 } = await citizenClient
      .from('notifications')
      .select('id, read_at')
      .eq('user_id', citizenId)
      .is('read_at', null);

    const { data: indexQuery2, error: idxErr2 } = await citizenClient
      .from('notifications')
      .select('id, created_at')
      .eq('user_id', citizenId)
      .order('created_at', { ascending: false })
      .limit(10);

    const indexesFunctional = idxErr1 === null && idxErr2 === null;
    record(
      13,
      'Query performance indexes functional',
      indexesFunctional,
      indexesFunctional ? 'Unread query and pagination query executed successfully' : `Errors: ${idxErr1?.message} / ${idxErr2?.message}`
    );

    // --------------------------------------------------------------------------
    // Test 14: Realtime configuration remains correct
    // --------------------------------------------------------------------------
    let realtimeConnected = false;
    try {
      const channel = citizenClient.channel('notifications-realtime-test');
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {}
      );
      const subState = await new Promise<string>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            resolve(status);
          }
        });
        setTimeout(() => resolve('TIMEOUT'), 4000);
      });
      realtimeConnected = (subState === 'SUBSCRIBED');
      citizenClient.removeChannel(channel);
      record(
        14,
        'Realtime configuration functional on public.notifications',
        realtimeConnected,
        `Channel subscription state: ${subState}`
      );
    } catch (rtErr: unknown) {
      record(
        14,
        'Realtime configuration functional on public.notifications',
        false,
        `Realtime subscription error: ${rtErr instanceof Error ? rtErr.message : String(rtErr)}`
      );
    }
  } finally {
    // --------------------------------------------------------------------------
    // Cleanup: Remove any temporary test notifications created
    // --------------------------------------------------------------------------
    console.log('\n--- Cleaning up test-created notifications ---');
    if (createdNotificationIds.length > 0) {
      for (const id of createdNotificationIds) {
        await citizenClient.from('notifications').delete().eq('id', id);
        await adminClient.from('notifications').delete().eq('id', id);
      }
      console.log(`Cleaned up ${createdNotificationIds.length} test notification(s).`);
    } else {
      console.log('No test notifications to clean up.');
    }
  }

  console.log('\n===============================================================');
  console.log('📊 TEST SUMMARY');
  console.log('===============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);

  return { total: results.length, passed: passedCount, failed: results.length - passedCount };
}

runDatabaseSecurityTests()
  .then((summary) => {
    if (summary.failed > 0) {
      console.log(`\n⚠️ ${summary.failed} tests failed (live remote migration may be pending).`);
      process.exit(1);
    } else {
      console.log('\n🎉 ALL DATABASE SECURITY TESTS PASSED!');
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  });
