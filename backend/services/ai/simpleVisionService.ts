// Simplified Vision & Gemini API service for description generation
import {
  analyzeImage,
  analyzeMultipleImages,
  combineImageAnalyses,
} from './visionService';

export { fileToBase64 } from './visionService';

// Simple image analysis function
export const analyzeImageSimple = async (
  file: File
): Promise<{ description: string; category: string }> => {
  try {
    const result = await analyzeImage(file);
    return {
      description: result.description,
      category: result.suggestedCategory,
    };
  } catch (error: unknown) {
    console.error('Image analysis failed:', error);
    return {
      description: `Visual evidence recorded for ${file.name || 'reported issue'}. Please review and update details if needed.`,
      category: 'others',
    };
  }
};

// Analyze multiple images and combine results
export const analyzeMultipleImagesSimple = async (
  files: File[]
): Promise<{ description: string; category: string }> => {
  if (files.length === 0) {
    throw new Error('No images to analyze');
  }

  try {
    const analyses = await analyzeMultipleImages(files);
    return combineImageAnalyses(analyses);
  } catch (error: unknown) {
    console.error('Multiple image analysis failed:', error);
    return {
      description: 'Multiple images uploaded showing civic issue documentation. Please review visual evidence.',
      category: 'others',
    };
  }
};