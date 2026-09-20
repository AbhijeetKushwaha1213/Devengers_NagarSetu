import {
  StorageService,
  StorageServiceError,
  ISSUE_IMAGES_BUCKET,
  MAX_ISSUE_IMAGES,
} from '../../../backend/services/storage/storageService';
import type { SupabaseClient } from '@supabase/supabase-js';

// Simple test harness
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedMessageSubstring: string,
  message: string
) {
  try {
    await fn();
    failed++;
    console.error(`  ✗ FAIL: ${message} (did not reject)`);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes(expectedMessageSubstring)) {
      passed++;
      console.log(`  ✓ ${message}`);
    } else {
      failed++;
      console.error(
        `  ✗ FAIL: ${message} (expected "${expectedMessageSubstring}", got "${error.message}")`
      );
    }
  }
}

// Mock mockFile helper for Node environment
function createMockFile(name: string, size: number, type: string): File {
  const blob = new Blob(['a'.repeat(Math.min(size, 100))], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size, writable: false });
  return file;
}

// Mock Supabase storage client
function createMockStorageClient(options: {
  uploadError?: Error | null;
  removeError?: Error | null;
} = {}) {
  const uploadedPaths: string[] = [];
  const removedPaths: string[] = [];

  const mockClient = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _body: unknown, _uploadOptions: unknown) => {
          if (options.uploadError) {
            return { data: null, error: options.uploadError };
          }
          uploadedPaths.push(`${bucket}:${path}`);
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
        remove: async (paths: string[]) => {
          if (options.removeError) {
            return { data: null, error: options.removeError };
          }
          removedPaths.push(...paths);
          return { data: paths, error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;

  return { mockClient, uploadedPaths, removedPaths };
}

async function runTests() {
  console.log('\n=== RUNNING STORAGE SERVICE UNIT TESTS ===\n');

  // Test 1: Validation - userId required
  console.log('--- uploadIssueImages validation ---');
  await assertRejects(
    () => StorageService.uploadIssueImages([createMockFile('test.jpg', 100, 'image/jpeg')], ''),
    'Valid userId is required',
    'Rejects empty userId'
  );

  await assertRejects(
    () => StorageService.uploadIssueImages([createMockFile('test.jpg', 100, 'image/jpeg')], '   '),
    'Valid userId is required',
    'Rejects whitespace userId'
  );

  // Test 2: Empty files returns empty array
  const emptyResult = await StorageService.uploadIssueImages([], 'user-123');
  assert(Array.isArray(emptyResult) && emptyResult.length === 0, 'Returns empty array when files is empty');

  // Test 3: Exceeding max image count
  const tooManyFiles = Array.from({ length: MAX_ISSUE_IMAGES + 1 }, (_, i) =>
    createMockFile(`img_${i}.jpg`, 100, 'image/jpeg')
  );
  await assertRejects(
    () => StorageService.uploadIssueImages(tooManyFiles, 'user-123'),
    `Maximum ${MAX_ISSUE_IMAGES} images allowed`,
    `Rejects more than ${MAX_ISSUE_IMAGES} images`
  );

  // Test 4: Invalid MIME type
  await assertRejects(
    () =>
      StorageService.uploadIssueImages(
        [createMockFile('malware.pdf', 100, 'application/pdf')],
        'user-123'
      ),
    'has unsupported type',
    'Rejects non-image file type (application/pdf)'
  );

  // Test 4b: SVG MIME type rejection (prevents SVG XSS)
  await assertRejects(
    () =>
      StorageService.uploadIssueImages(
        [createMockFile('exploit.svg', 100, 'image/svg+xml')],
        'user-123'
      ),
    'has unsupported type',
    'Rejects SVG file type to prevent XSS'
  );

  // Test 5: File exceeding size limit (6 MB exceeds 5 MB limit)
  await assertRejects(
    () =>
      StorageService.uploadIssueImages(
        [createMockFile('huge.jpg', 6 * 1024 * 1024, 'image/jpeg')],
        'user-123'
      ),
    'exceeds maximum allowed size of 5MB',
    'Rejects file exceeding 5MB'
  );

  // Test 5b: Path traversal in userId
  await assertRejects(
    () =>
      StorageService.uploadIssueImages(
        [createMockFile('photo.jpg', 100, 'image/jpeg')],
        '../malicious'
      ),
    'Valid userId is required',
    'Rejects path traversal in userId'
  );

  // Test 6: Successful issue image upload
  console.log('\n--- uploadIssueImages successful upload ---');
  const { mockClient: successClient, uploadedPaths } = createMockStorageClient();
  const mockFiles = [
    createMockFile('photo1.jpg', 500, 'image/jpeg'),
    createMockFile('photo2.png', 800, 'image/png'),
  ];

  const urls = await StorageService.uploadIssueImages(mockFiles, 'user-uuid-456', {
    client: successClient,
  });

  assert(urls.length === 2, 'Returns 2 uploaded URLs');
  assert(
    urls[0].startsWith('https://mock.supabase.co/storage/v1/object/public/issue-images/issues/user-uuid-456/'),
    'First URL has correct storage path prefix'
  );
  assert(
    urls[1].startsWith('https://mock.supabase.co/storage/v1/object/public/issue-images/issues/user-uuid-456/'),
    'Second URL has correct storage path prefix'
  );
  assert(uploadedPaths.length === 2, 'Uploaded exactly 2 items to storage client');
  assert(uploadedPaths[0].startsWith('issue-images:issues/user-uuid-456/'), 'Targeted issue-images bucket');

  // Test 7: Upload storage error
  console.log('\n--- uploadIssueImages failure handling ---');
  const { mockClient: failureClient } = createMockStorageClient({
    uploadError: new Error('Bucket not found'),
  });
  await assertRejects(
    () =>
      StorageService.uploadIssueImages(
        [createMockFile('photo.jpg', 100, 'image/jpeg')],
        'user-123',
        { client: failureClient }
      ),
    'Failed to upload image "photo.jpg": Bucket not found',
    'Throws StorageServiceError on upload failure'
  );

  // Test 7b: Batch rollback cleans up previous uploads when subsequent upload fails
  let uploadCallCount = 0;
  const rollbackRemovedPaths: string[] = [];
  const partialFailClient = {
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string) => {
          uploadCallCount++;
          if (uploadCallCount === 2) {
            return { data: null, error: new Error('Network timeout on second image') };
          }
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/issue-images/${path}` },
        }),
        remove: async (paths: string[]) => {
          rollbackRemovedPaths.push(...paths);
          return { data: paths, error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;

  await assertRejects(
    () =>
      StorageService.uploadIssueImages(
        [createMockFile('img1.jpg', 100, 'image/jpeg'), createMockFile('img2.jpg', 100, 'image/jpeg')],
        'user-123',
        { client: partialFailClient }
      ),
    'Network timeout on second image',
    'Throws error on second image failure'
  );
  assert(rollbackRemovedPaths.length === 1, 'Batch rollback automatically cleaned up the first image');


  // Test 8: uploadResolutionImage validation & upload
  console.log('\n--- uploadResolutionImage ---');
  await assertRejects(
    () => StorageService.uploadResolutionImage(null as unknown as File, 'issue-789'),
    'Image file is required',
    'Rejects null file'
  );

  await assertRejects(
    () =>
      StorageService.uploadResolutionImage(
        createMockFile('after.jpg', 100, 'image/jpeg'),
        ''
      ),
    'Valid issueId is required',
    'Rejects empty issueId'
  );

  await assertRejects(
    () =>
      StorageService.uploadResolutionImage(
        createMockFile('doc.txt', 100, 'text/plain'),
        'issue-789'
      ),
    'has unsupported type',
    'Rejects non-image resolution file'
  );

  const { mockClient: resClient, uploadedPaths: resPaths } = createMockStorageClient();
  const resUrl = await StorageService.uploadResolutionImage(
    createMockFile('resolved.jpg', 500, 'image/jpeg'),
    'issue-abc-123',
    { client: resClient }
  );

  assert(
    resUrl.startsWith('https://mock.supabase.co/storage/v1/object/public/issue-images/resolutions/issue-abc-123/'),
    'Resolution URL has correct resolutions/{issueId} prefix'
  );
  assert(resPaths.length === 1, 'Uploaded exactly 1 resolution image');

  // Test 9: deleteImage path extraction
  console.log('\n--- deleteImage ---');
  const { mockClient: deleteClient, removedPaths } = createMockStorageClient();
  await StorageService.deleteImage(
    'https://mock.supabase.co/storage/v1/object/public/issue-images/issues/user-1/sample.jpg',
    deleteClient
  );
  assert(removedPaths.length === 1, 'Called remove with 1 path');
  assert(removedPaths[0] === 'issues/user-1/sample.jpg', 'Extracted relative path correctly from full URL');

  await StorageService.deleteImage('resolutions/issue-1/after.jpg', deleteClient);
  assert(removedPaths[1] === 'resolutions/issue-1/after.jpg', 'Handles relative path directly');

  // Test 10: Non-browser compressImageToBlob fallback
  console.log('\n--- compressImageToBlob fallback ---');
  const rawFile = createMockFile('node.jpg', 200, 'image/jpeg');
  const compressed = await StorageService.compressImageToBlob(rawFile);
  assert(compressed !== null, 'Returns Blob or File in non-browser environment');

  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
