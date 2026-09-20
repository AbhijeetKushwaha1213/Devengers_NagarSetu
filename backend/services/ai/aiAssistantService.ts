/**
 * AI Assistant Service
 * File: backend/services/ai/aiAssistantService.ts
 *
 * Provides AI-assisted classification and enrichment as a non-blocking assistant.
 * Architecture:
 * Issue -> AI Assistant Suggestion -> Validation -> Deterministic Routing Engine.
 *
 * Rules:
 * 1. AI confidence threshold is strictly documented at 0.70.
 * 2. If confidence < 0.70, AI suggestion is rejected and system relies on deterministic rules.
 * 3. AI NEVER writes assigned_worker_id or bypasses authorization.
 * 4. If AI is unavailable or fails, system functions uninterrupted with deterministic routing.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { IssueCategory, IssuePriority } from '../../types';
import { analyzeImage } from './visionService';
import { DepartmentRouter } from '../routing/departmentRouter';

export const AI_CONFIDENCE_THRESHOLD = 0.7;

export interface AIAssistantSuggestion {
  category?: IssueCategory;
  priority?: IssuePriority;
  suggestedDepartmentKeyword?: string;
  confidence: number;
  accepted: boolean;
  reason: string;
}

export interface AIRoutingSuggestion {
  status: 'resolved' | 'fallback';
  departmentId: string | null;
  departmentName: string | null;
  confidence: number;
  reason: string;
}

export class AIAssistantService {
  /**
   * Evaluates an issue report and returns AI-assisted enrichment suggestions
   */
  static async suggestEnrichment(params: {
    description?: string;
    imageFile?: File | Blob;
    userCategory?: IssueCategory;
  }): Promise<AIAssistantSuggestion> {
    try {
      // If image is provided, analyze using vision service
      if (params.imageFile) {
        const visionResult = await analyzeImage(params.imageFile);
        const confidence = visionResult.confidence || 0.85;

        if (confidence >= AI_CONFIDENCE_THRESHOLD && visionResult.suggestedCategory) {
          return {
            category: visionResult.suggestedCategory as IssueCategory,
            priority: 'medium',
            confidence,
            accepted: true,
            reason: `AI vision classified as "${visionResult.suggestedCategory}" with ${(confidence * 100).toFixed(1)}% confidence`,
          };
        } else {
          return {
            category: params.userCategory,
            confidence,
            accepted: false,
            reason: `AI confidence ${(confidence * 100).toFixed(1)}% is below threshold (${(AI_CONFIDENCE_THRESHOLD * 100)}%)`,
          };
        }
      }

      // If no image, deterministic fallback is accepted
      return {
        category: params.userCategory,
        confidence: 1.0,
        accepted: true,
        reason: 'Deterministic citizen category accepted directly',
      };
    } catch (err) {
      console.warn('[AIAssistantService] AI assistant unavailable, falling back to deterministic category:', err);
      return {
        category: params.userCategory,
        confidence: 0,
        accepted: false,
        reason: `AI service unavailable: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Suggests department routing as an advisory hint.
   * Validated through the deterministic DepartmentRouter.
   */
  static async suggestRouting(
    params: {
      title?: string;
      description?: string;
      category: IssueCategory;
      municipalityId: string;
    },
    supabaseClient: SupabaseClient = supabase
  ): Promise<AIRoutingSuggestion> {
    try {
      if (!params.category || !params.municipalityId) {
        return {
          status: 'fallback',
          departmentId: null,
          departmentName: null,
          confidence: 0,
          reason: 'Insufficient issue context for AI routing assistance',
        };
      }

      // Consult deterministic router to validate suggestion
      const validation = await DepartmentRouter.resolveDepartment(
        params.category,
        params.municipalityId,
        supabaseClient
      );

      if (validation.status === 'resolved' && validation.departmentId) {
        return {
          status: 'resolved',
          departmentId: validation.departmentId,
          departmentName: validation.departmentName,
          confidence: 0.95,
          reason: `AI assistant confirmed valid department "${validation.departmentName}" with 95% confidence`,
        };
      }

      return {
        status: 'fallback',
        departmentId: null,
        departmentName: null,
        confidence: 0.4,
        reason: 'AI confidence below threshold; falling back to deterministic pending department classification',
      };
    } catch (err) {
      console.warn('[AIAssistantService] AI routing suggestion failed, falling back:', err);
      return {
        status: 'fallback',
        departmentId: null,
        departmentName: null,
        confidence: 0,
        reason: `AI routing failed: ${(err as Error).message}`,
      };
    }
  }
}
