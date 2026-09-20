import { supabase as defaultSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ISSUE_IMAGES_BUCKET = 'issue-images';
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit (aligned with Supabase Storage bucket limit)
export const MAX_ISSUE_IMAGES = 5;
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
}

export interface StorageUploadOptions extends CompressionOptions {
  client?: SupabaseClient;
}

export class StorageServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'StorageServiceError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, StorageServiceError.prototype);
  }
}

export class StorageService {
  /**
   * Compresses an image file in the browser using HTML5 Canvas.
   * Returns a compressed JPEG Blob.
   * In non-browser / test environments, returns the original File/Blob unchanged.
   */
  static async compressImageToBlob(
    file: File | Blob,
    options: CompressionOptions = {}
  ): Promise<Blob> {
    const { maxDimension = 1600, quality = 0.8 } = options;

    // Graceful fallback for non-browser environments or unsupported formats
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      typeof FileReader === 'undefined' ||
      !file.type.startsWith('image/') ||
      file.type === 'image/svg+xml'
    ) {
      return file;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(file);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                resolve(blob || file);
              },
              'image/jpeg',
              quality
            );
          } catch {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compresses an image file in the browser and returns a base64 Data URL.
   * Kept for local UI previews or legacy fallbacks.
   */
  static async compressImageToBase64(
    file: File,
    options: CompressionOptions = {}
  ): Promise<string> {
    const { maxDimension = 1200, quality = 0.75 } = options;

    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      typeof FileReader === 'undefined' ||
      !file.type.startsWith('image/') ||
      file.type === 'image/svg+xml'
    ) {
      return new Promise((resolve) => {
        if (typeof FileReader === 'undefined') {
          resolve('');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve((e.target?.result as string) || '');
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
          } catch {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  /**
   * Uploads multiple issue reporting images to the Supabase Storage bucket.
   * Path convention: issues/{userId}/{timestamp}_{index}_{random}.jpg
   * Returns array of public CDN URLs.
   * Includes automatic rollback: if any image in the batch fails, previously uploaded
   * images in the batch are removed from storage.
   */
  static async uploadIssueImages(
    files: File[],
    userId: string,
    options: StorageUploadOptions = {}
  ): Promise<string[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const sanitizedUserId = userId ? userId.trim() : '';
    if (!sanitizedUserId || !/^[a-zA-Z0-9_-]+$/.test(sanitizedUserId)) {
      throw new StorageServiceError('Valid userId is required to upload issue images', 400);
    }

    if (files.length > MAX_ISSUE_IMAGES) {
      throw new StorageServiceError(`Maximum ${MAX_ISSUE_IMAGES} images allowed per issue`, 400);
    }

    const client = options.client || defaultSupabase;
    const uploadedPaths: string[] = [];
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate strictly against allowed image MIME types (excludes SVG, HTML, exe, etc.)
        const normalizedMime = file.type ? file.type.toLowerCase() : '';
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as never)) {
          throw new StorageServiceError(
            `File "${file.name}" has unsupported type: "${file.type || 'unknown'}". Allowed types: JPEG, PNG, WebP, HEIC`,
            400
          );
        }

        // Validate file size (5MB limit)
        if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
          throw new StorageServiceError(
            `Image "${file.name}" exceeds maximum allowed size of 5MB`,
            400
          );
        }

        // Compress to JPEG blob
        const compressedBlob = await this.compressImageToBlob(file, options);

        // Derive safe extension from MIME type
        let ext = 'jpg';
        if (normalizedMime === 'image/png') ext = 'png';
        else if (normalizedMime === 'image/webp') ext = 'webp';
        else if (normalizedMime === 'image/heic') ext = 'heic';

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const filePath = `issues/${sanitizedUserId}/${timestamp}_${i}_${randomSuffix}.${ext}`;

        const { data, error } = await client.storage
          .from(ISSUE_IMAGES_BUCKET)
          .upload(filePath, compressedBlob, {
            contentType: compressedBlob.type || 'image/jpeg',
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw new StorageServiceError(
            `Failed to upload image "${file.name}": ${error.message}`,
            500
          );
        }

        uploadedPaths.push(data.path);

        const { data: publicUrlData } = client.storage
          .from(ISSUE_IMAGES_BUCKET)
          .getPublicUrl(data.path);

        if (!publicUrlData?.publicUrl) {
          throw new StorageServiceError('Failed to resolve public URL for uploaded image', 500);
        }

        uploadedUrls.push(publicUrlData.publicUrl);
      }

      return uploadedUrls;
    } catch (batchErr) {
      // Rollback: cleanup any images uploaded before the failure
      if (uploadedPaths.length > 0) {
        console.warn(`[StorageService] Batch upload failed. Rolling back ${uploadedPaths.length} uploaded files.`);
        try {
          await client.storage.from(ISSUE_IMAGES_BUCKET).remove(uploadedPaths);
        } catch (cleanupErr) {
          console.error('[StorageService] Rollback cleanup failed:', cleanupErr);
        }
      }
      throw batchErr;
    }
  }

  /**
   * Uploads a resolution photo for an issue (worker/official).
   * Path convention: resolutions/{issueId}/{timestamp}_{random}_after.jpg
   * Returns public CDN URL.
   */
  static async uploadResolutionImage(
    file: File,
    issueId: string,
    options: StorageUploadOptions = {}
  ): Promise<string> {
    if (!file) {
      throw new StorageServiceError('Image file is required for resolution upload', 400);
    }

    const sanitizedIssueId = issueId ? issueId.trim() : '';
    if (!sanitizedIssueId || !/^[a-zA-Z0-9_-]+$/.test(sanitizedIssueId)) {
      throw new StorageServiceError('Valid issueId is required to upload resolution image', 400);
    }

    // Validate strictly against allowed image MIME types
    const normalizedMime = file.type ? file.type.toLowerCase() : '';
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as never)) {
      throw new StorageServiceError(
        `File "${file.name}" has unsupported type: "${file.type || 'unknown'}". Allowed types: JPEG, PNG, WebP, HEIC`,
        400
      );
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      throw new StorageServiceError(
        `Resolution image exceeds maximum allowed size of 5MB`,
        400
      );
    }

    const client = options.client || defaultSupabase;
    const compressedBlob = await this.compressImageToBlob(file, options);

    let ext = 'jpg';
    if (normalizedMime === 'image/png') ext = 'png';
    else if (normalizedMime === 'image/webp') ext = 'webp';
    else if (normalizedMime === 'image/heic') ext = 'heic';

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filePath = `resolutions/${sanitizedIssueId}/${timestamp}_${randomSuffix}_after.${ext}`;

    const { data, error } = await client.storage
      .from(ISSUE_IMAGES_BUCKET)
      .upload(filePath, compressedBlob, {
        contentType: compressedBlob.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new StorageServiceError(
        `Failed to upload resolution image: ${error.message}`,
        500
      );
    }

    const { data: publicUrlData } = client.storage
      .from(ISSUE_IMAGES_BUCKET)
      .getPublicUrl(data.path);

    if (!publicUrlData?.publicUrl) {
      throw new StorageServiceError('Failed to resolve public URL for resolution image', 500);
    }

    return publicUrlData.publicUrl;
  }

  /**
   * Deletes an image from the storage bucket given its public URL or relative path.
   */
  static async deleteImage(
    publicUrlOrPath: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<void> {
    if (!publicUrlOrPath || typeof publicUrlOrPath !== 'string') {
      return;
    }

    let filePath = publicUrlOrPath.trim();
    // Extract path if a full public URL was provided
    const marker = `/${ISSUE_IMAGES_BUCKET}/`;
    const markerIndex = filePath.indexOf(marker);
    if (markerIndex !== -1) {
      filePath = filePath.substring(markerIndex + marker.length);
    }

    const { error } = await client.storage.from(ISSUE_IMAGES_BUCKET).remove([filePath]);
    if (error) {
      console.warn(`[StorageService] Failed to delete image at ${filePath}:`, error.message);
    }
  }

  /**
   * Backward-compatible alias for existing compressImage calls
   */
  static compressImage = StorageService.compressImageToBase64;
}

export default StorageService;
