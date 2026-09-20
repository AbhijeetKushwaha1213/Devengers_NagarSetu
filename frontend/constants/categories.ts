import { ISSUE_CATEGORIES, IssueCategory } from '@backend/validators/issueValidator';

export { ISSUE_CATEGORIES };
export type { IssueCategory };

export interface CategoryMetadata {
  id: IssueCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export const CATEGORY_DEFINITIONS: Record<IssueCategory, CategoryMetadata> = {
  cleanliness: {
    id: 'cleanliness',
    label: 'Sanitation & Cleanliness',
    description: 'Public toilet cleanliness, general area sanitization, hygiene hazards',
    icon: '🧹',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    priority: 'low',
  },
  dead_animal: {
    id: 'dead_animal',
    label: 'Dead Animal Removal',
    description: 'Removal of animal carcasses from roads, public spaces or drains',
    icon: '🐾',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    priority: 'critical',
  },
  garbage_dump: {
    id: 'garbage_dump',
    label: 'Garbage Dump & Waste',
    description: 'Overflowing bins, illegal garbage dumping, uncollected trash heaps',
    icon: '🗑️',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    priority: 'medium',
  },
  littering: {
    id: 'littering',
    label: 'Littering',
    description: 'Scattered plastic, street litter, debris along public pathways',
    icon: '🚯',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    priority: 'low',
  },
  stagnant_water: {
    id: 'stagnant_water',
    label: 'Drainage & Stagnant Water',
    description: 'Clogged drains, standing water pools, mosquito breeding hazards',
    icon: '🌊',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    priority: 'high',
  },
  street_light: {
    id: 'street_light',
    label: 'Street Light',
    description: 'Broken, malfunctioning, flickering, or missing street lights',
    icon: '💡',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    priority: 'medium',
  },
  water_supply: {
    id: 'water_supply',
    label: 'Water Supply & Leakage',
    description: 'Pipe leaks, contamination, broken public taps, low water pressure',
    icon: '💧',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    priority: 'high',
  },
};

export const CATEGORY_LIST: CategoryMetadata[] = ISSUE_CATEGORIES.map(
  (id) => CATEGORY_DEFINITIONS[id]
);

/**
 * Normalizes any category string (including legacy values) to canonical CategoryMetadata
 */
export const getCategoryMetadata = (category?: string): CategoryMetadata => {
  if (!category) return CATEGORY_DEFINITIONS.cleanliness;

  // Direct match
  if (category in CATEGORY_DEFINITIONS) {
    return CATEGORY_DEFINITIONS[category as IssueCategory];
  }

  // Legacy fallback mapping
  const lower = category.toLowerCase();
  if (lower.includes('light') || lower.includes('electr')) return CATEGORY_DEFINITIONS.street_light;
  if (lower.includes('water') && !lower.includes('stagnant')) return CATEGORY_DEFINITIONS.water_supply;
  if (lower.includes('drain') || lower.includes('flood') || lower.includes('stagnant') || lower.includes('pothole') || lower.includes('infra')) {
    return CATEGORY_DEFINITIONS.stagnant_water;
  }
  if (lower.includes('animal') || lower.includes('carcass')) return CATEGORY_DEFINITIONS.dead_animal;
  if (lower.includes('litter')) return CATEGORY_DEFINITIONS.littering;
  if (lower.includes('dump') || lower.includes('trash') || lower.includes('waste') || lower.includes('garbage')) {
    return CATEGORY_DEFINITIONS.garbage_dump;
  }

  return CATEGORY_DEFINITIONS.cleanliness;
};
