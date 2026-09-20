/**
 * Deterministic Category-to-Department Routing Rules & Keyword Matching
 * File: backend/services/routing/routingRules.ts
 */

import { IssueCategory } from '../../types';

export const CATEGORY_DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  cleanliness: ['sanitation', 'waste', 'cleanliness', 'swm', 'health', 'public health'],
  dead_animal: ['sanitation', 'waste', 'swm', 'veterinary', 'health', 'animal'],
  garbage_dump: ['sanitation', 'waste', 'garbage', 'swm', 'cleanliness'],
  littering: ['sanitation', 'waste', 'swm', 'cleanliness'],
  stagnant_water: ['sanitation', 'public health', 'health', 'drainage', 'water'],
  street_light: ['electrical', 'electricity', 'street light', 'lighting', 'power'],
  water_supply: ['water supply', 'water', 'drainage', 'jal', 'wsd'],
  water_leakage: ['water supply', 'water', 'drainage', 'jal', 'wsd'],
  pothole: ['roads', 'infrastructure', 'public works', 'pwd', 'engineering'],
  traffic_light: ['electrical', 'traffic', 'lighting', 'signals'],
  drainage: ['water supply', 'drainage', 'sanitation', 'sewage'],
};

/**
 * Checks if a department's name matches the target category keywords
 */
export function matchesDepartmentCategory(departmentName: string, category: IssueCategory | string): boolean {
  const normalized = departmentName.toLowerCase();
  const keywords = CATEGORY_DEPARTMENT_KEYWORDS[category] || [];
  return keywords.some((kw) => normalized.includes(kw));
}

/**
 * Formats an explainable routing reason string
 */
export function formatRoutingReason(params: {
  category: string;
  departmentName: string;
  wardName?: string | null;
  activeWorkload: number;
  workerName: string;
}): string {
  const wardScope = params.wardName ? params.wardName : 'Municipality Scope';
  return `${params.category} → ${params.departmentName} → ${wardScope} → lowest active workload (${params.activeWorkload} active tasks, Worker: ${params.workerName})`;
}
