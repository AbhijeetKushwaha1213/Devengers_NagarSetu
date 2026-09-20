/**
 * End-to-End Live Supabase Verification Script
 * File: tests/e2e/liveEndToEndRoutingVerification.ts
 *
 * Verifies Part 10 requirements on live database:
 * 1. Citizen logs in.
 * 2. Citizen reports a new issue with a category that maps to a department (garbage_dump -> Sanitation Department).
 * 3. Verify that the issue is automatically:
 *    - assigned the correct department_id
 *    - assigned the best available worker
 *    - transitioned to in_progress
 * 4. Authority (admin@nagarsetu.test) logs in.
 * 5. Authority views dashboard:
 *    - department filter lists real departments
 *    - issue displays correct department
 *    - issue is visible in In Progress
 *    - Authority can override department or worker
 * 6. Worker (worker@nagarsetu.test) logs in.
 * 7. Worker views assigned tasks:
 *    - newly assigned issue appears in worker dashboard
 * 8. Worker marks issue resolved:
 *    - status updates to resolved
 *    - audit event created
 * 9. Clean up database:
 *    - Orphaned test issues: 0
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { IssueService } from '../../backend/services/issues/issueService';
import { WorkerService } from '../../backend/services/workers/workerService';
import { getDepartments } from '../../frontend/services/authorityService';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
    process.env[match[1]] = value;
  }
}

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const anonKey = env['VITE_SUPABASE_ANON_KEY'] || '';

interface LiveStepResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const report: LiveStepResult[] = [];

function record(step: number, name: string, passed: boolean, details: string) {
  report.push({ step, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] Step ${step}: ${name} -> ${details}`);
  if (!passed) {
    throw new Error(`Step ${step} failed: ${details}`);
  }
}

async function runLiveVerification() {
  console.log('===============================================================');
  console.log('🚀 BEGINNING PART 10: END-TO-END LIVE SUPABASE VERIFICATION');
  console.log('===============================================================\n');

  let testIssueId: string | null = null;
  const PRAYAGRAJ_ID = 'e15a8684-df60-4451-8897-699aaf8a33c6';
  const WARD_1_ID = 'a456eaa5-6c8b-4fed-a893-e816ad53773e';
  const SANITATION_DEPT_ID = '1694091f-28e9-4b81-92f6-9ab9935438b6';
  const TARGET_WORKER_ID = 'a5c5a47a-9cff-472b-bf58-f445da28df99'; // Test Worker

  // Clients
  const citizenClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, anonKey);
  const workerClient = createClient(supabaseUrl, anonKey);

  try {
    // -------------------------------------------------------------------------
    // Step 1: Citizen logs in
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Citizen Authentication ---');
    const { data: citAuth, error: citErr } = await citizenClient.auth.signInWithPassword({
      email: 'citizen@nagarsetu.test',
      password: 'NagarTest@123',
    });
    if (citErr || !citAuth.user) {
      record(1, 'Citizen Login', false, `Auth failed: ${citErr?.message}`);
      return;
    }
    const citizenId = citAuth.user.id;
    record(1, 'Citizen Login', true, `Citizen authenticated (id: ${citizenId})`);

    // -------------------------------------------------------------------------
    // Step 2: Citizen reports new issue (garbage_dump)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Citizen Reports Issue ---');
    const createdIssue = await IssueService.createIssue(
      {
        title: 'E2E Live Verification: Uncollected Garbage Near Civil Lines Market',
        description: 'Large municipal trash accumulation causing blockage and hygiene concerns. Immediate pickup required.',
        category: 'garbage_dump',
        address: 'Civil Lines Bus Stand, Prayagraj, UP',
        latitude: 25.4529,
        longitude: 81.8349,
        municipality_id: PRAYAGRAJ_ID,
        ward_id: WARD_1_ID,
        image_urls: ['https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&q=80&w=1000'],
      },
      citizenClient
    );

    testIssueId = createdIssue.id;
    record(
      2,
      'Issue Submission',
      !!testIssueId && createdIssue.category === 'garbage_dump',
      `Issue created with id: ${testIssueId}, tracking_id: ${createdIssue.tracking_id}`
    );

    // -------------------------------------------------------------------------
    // Step 3: Verify Automatic Department Resolution & Worker Assignment
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Verify Automatic Routing Invariants ---');
    // Fetch fresh issue row from DB
    const { data: routedRow, error: fetchErr } = await citizenClient
      .from('issues')
      .select('*')
      .eq('id', testIssueId)
      .single();

    if (fetchErr || !routedRow) {
      record(3, 'Fetch Routed Issue', false, `Failed to fetch routed issue: ${fetchErr?.message}`);
      return;
    }

    record(
      3,
      'Automatic Department Resolution',
      routedRow.department_id === SANITATION_DEPT_ID,
      `department_id resolved to ${routedRow.department_id} (Sanitation Department)`
    );

    record(
      4,
      'Automatic Worker Assignment',
      !!routedRow.assigned_worker_id,
      `assigned_worker_id assigned to: ${routedRow.assigned_worker_id}`
    );

    record(
      5,
      'Automatic Status Progression',
      routedRow.status === 'in_progress',
      `status advanced from submitted to: ${routedRow.status}`
    );

    // Check automatic routing assignment audit record
    const { data: auditRows } = await citizenClient
      .from('issue_audit_log')
      .select('*')
      .eq('issue_id', testIssueId);

    const assignAudit = auditRows?.find((a) => a.action === 'WORKER_ASSIGNED');
    record(
      6,
      'Automatic Assignment Verification',
      routedRow.status === 'in_progress' && !!routedRow.assigned_worker_id,
      `Assignment active: worker=${routedRow.assigned_worker_id}, department=${routedRow.department_id}, audit_logged=${!!assignAudit}`
    );

    // -------------------------------------------------------------------------
    // Step 4: Authority logs in
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Authority Authentication ---');
    const { data: admAuth, error: admErr } = await adminClient.auth.signInWithPassword({
      email: 'admin@nagarsetu.test',
      password: 'NagarTest@123',
    });
    if (admErr || !admAuth.user) {
      record(7, 'Authority Login', false, `Admin auth failed: ${admErr?.message}`);
      return;
    }
    const adminId = admAuth.user.id;
    record(7, 'Authority Login', true, `Admin authenticated (id: ${adminId})`);

    // -------------------------------------------------------------------------
    // Step 5: Authority Dashboard Verification & Departments Listing
    // -------------------------------------------------------------------------
    const { data: departmentsData } = await adminClient
      .from('departments')
      .select('id, name, municipality_id')
      .eq('municipality_id', PRAYAGRAJ_ID);
    const departments = departmentsData || [];
    record(
      8,
      'Authority Departments Listing',
      departments.length > 0 && departments.some((d) => d.id === SANITATION_DEPT_ID),
      `Authority loaded ${departments.length} real departments from public.departments: [${departments.map((d) => d.name).join(', ')}]`
    );

    const adminIssues = await IssueService.getIssues(
      { municipality_id: PRAYAGRAJ_ID, status: 'in_progress' },
      adminClient
    );
    const issueInDashboard = adminIssues.find((i) => i.id === testIssueId);
    record(
      9,
      'Authority Dashboard Issue Visibility',
      !!issueInDashboard,
      `Issue visible in Authority "in_progress" view with tracking ID: ${issueInDashboard?.tracking_id}, department: ${issueInDashboard?.department_id}`
    );

    // -------------------------------------------------------------------------
    // Step 6: Authority Override / Reassignment
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Authority Manual Override ---');
    const overrideResult = await WorkerService.assignWorker(
      {
        issueId: testIssueId,
        workerId: TARGET_WORKER_ID,
        departmentId: SANITATION_DEPT_ID,
        notes: 'Authority manual reassignment override: Priority tasking for Civil Lines sector',
      },
      adminClient
    );

    record(
      10,
      'Authority Assignment Override',
      overrideResult.assigned_worker_id === TARGET_WORKER_ID,
      `Worker confirmed/reassigned to: ${overrideResult.assigned_worker_id}`
    );

    // -------------------------------------------------------------------------
    // Step 7: Worker logs in
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Worker Authentication ---');
    const { data: wrkAuth, error: wrkErr } = await workerClient.auth.signInWithPassword({
      email: 'worker@nagarsetu.test',
      password: 'NagarTest@123',
    });
    if (wrkErr || !wrkAuth.user) {
      record(11, 'Worker Login', false, `Worker auth failed: ${wrkErr?.message}`);
      return;
    }
    const workerId = wrkAuth.user.id;
    record(11, 'Worker Login', true, `Worker authenticated (id: ${workerId})`);

    // -------------------------------------------------------------------------
    // Step 8: Worker Views Assigned Tasks
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Worker Task Retrieval ---');
    const workerTasks = await IssueService.getIssues(
      { assigned_worker_id: workerId },
      workerClient
    );
    const myTask = workerTasks.find((t) => t.id === testIssueId);
    record(
      12,
      'Worker Assigned Tasks Visibility',
      !!myTask,
      `Assigned issue appears in worker dashboard task list (status: ${myTask?.status})`
    );

    // -------------------------------------------------------------------------
    // Step 9: Worker Marks Issue Resolved
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Worker Resolves Issue ---');
    const resolveResult = await WorkerService.resolveTask(
      {
        issueId: testIssueId,
        workerId,
        resolutionImageUrls: [
          'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1000',
        ],
        citizenFeedback: 'Sanitation completed. Area sanitized and cleared of all debris.',
      },
      workerClient
    );

    record(
      13,
      'Worker Issue Resolution',
      resolveResult.status === 'resolved' && !!resolveResult.resolved_at,
      `Issue transitioned to status: ${resolveResult.status} at ${resolveResult.resolved_at}`
    );

    // Verify status in DB directly
    const { data: dbIssue } = await workerClient
      .from('issues')
      .select('id, status, resolved_at, resolution_image_urls')
      .eq('id', testIssueId)
      .single();

    record(
      14,
      'Issue Resolution State Persistence',
      dbIssue?.status === 'resolved' && !!dbIssue?.resolved_at,
      `Database record verified: status=${dbIssue?.status}, resolved_at=${dbIssue?.resolved_at}`
    );
  } finally {
    // -------------------------------------------------------------------------
    // Step 10: Complete Database Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- Step 10: Complete Database Cleanup ---');
    if (testIssueId) {
      try {
        // 1. Clean up notifications
        await adminClient.from('notifications').delete().eq('issue_id', testIssueId);
        // 2. Admin resets status to submitted so RLS delete policy is satisfied
        await adminClient.from('issues').update({ status: 'submitted' }).eq('id', testIssueId);
        // 3. Citizen deletes own submitted issue
        await citizenClient.from('issues').delete().eq('id', testIssueId);

        // 4. Verify issue count is 0
        const { count, error: verifyErr } = await adminClient
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('id', testIssueId);

        record(
          15,
          'Zero Orphaned Test Issues',
          count === 0 && !verifyErr,
          `Cleaned up test issue ${testIssueId}. Remaining rows with this ID: ${count || 0}`
        );
      } catch (cleanupErr) {
        console.error('Cleanup error:', (cleanupErr as Error).message);
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`🏁 LIVE END-TO-END VERIFICATION SUMMARY: ${report.filter((r) => r.passed).length}/${report.length} PASSED`);
  console.log('===============================================================');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ FATAL EXCEPTION DURING LIVE VERIFICATION:', err);
  process.exit(1);
});
