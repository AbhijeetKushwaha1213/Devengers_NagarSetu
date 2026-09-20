// Google Gemini & Vision AI service for civic issue image analysis

export interface VisionAnalysisResult {
  description: string;
  suggestedCategory: string;
  confidence: number;
  labels: string[];
}

const getApiKey = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (
        import.meta.env.VITE_GEMINI_API_KEY ||
        import.meta.env.VITE_GOOGLE_VISION_API_KEY ||
        ''
      );
    }
  } catch {
    // import.meta not available
  }
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.VITE_GEMINI_API_KEY ||
      process.env.VITE_GOOGLE_VISION_API_KEY ||
      ''
    );
  }
  return '';
};

// Convert file or blob to base64 (browser & Node compatible)
export const fileToBase64 = async (file: File | Blob): Promise<string> => {
  if (typeof (file as Blob).arrayBuffer === 'function') {
    const arrayBuffer = await file.arrayBuffer();
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(arrayBuffer).toString('base64');
    }
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  throw new Error('Unable to convert file to base64 in this environment');
};

/**
 * Primary analyzer: Google Gemini Multimodal API (gemini-2.5-flash / gemini-1.5-flash)
 */
const analyzeWithGemini = async (
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<VisionAnalysisResult | null> => {
  const prompt = `You are NagarSetu AI, an expert civic infrastructure and municipal issue analyzer.
Analyze the uploaded image of a civic issue reported by a citizen.
Identify:
1. The exact civic problem if present (e.g. road damage, garbage dump, littering, water leakage, drainage overflow, broken street light, dead animal carcass, sanitation hazard). If no civic problem is visible, describe the scene.
2. Suggested category: strictly one of ["cleanliness", "dead_animal", "garbage_dump", "littering", "stagnant_water", "street_light", "water_supply"].
3. A clear, concise, objective description suitable for municipal complaint submission (2-3 sentences).
4. Confidence score (number between 0.0 and 1.0).
5. Key descriptive labels (array of up to 10 keywords).

Return strictly JSON with keys: description, suggestedCategory, confidence, labels.`;

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          const validCategories: Record<string, string> = {
            cleanliness: 'cleanliness',
            dead_animal: 'dead_animal',
            garbage_dump: 'garbage_dump',
            littering: 'littering',
            stagnant_water: 'stagnant_water',
            street_light: 'street_light',
            water_supply: 'water_supply',
            roads: 'stagnant_water',
            infrastructure: 'stagnant_water',
            pothole: 'stagnant_water',
            drainage: 'stagnant_water',
            water: 'water_supply',
            electricity: 'street_light',
            streetlight: 'street_light',
            trash: 'garbage_dump',
            waste: 'garbage_dump',
            others: 'cleanliness',
          };
          const rawCat = String(parsed.suggestedCategory || 'cleanliness').toLowerCase().trim();
          const category = validCategories[rawCat] || 'cleanliness';

          return {
            description: parsed.description || 'Civic issue detected from photo.',
            suggestedCategory: category,

            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            labels: Array.isArray(parsed.labels) ? parsed.labels.slice(0, 10) : [],
          };
        }
      }
    } catch (err) {
      console.warn(`[NagarSetu AI] Gemini ${model} failed, attempting next model:`, err);
    }
  }

  return null;
};

/**
 * Secondary analyzer: Google Cloud Vision API
 */
const analyzeWithCloudVision = async (
  base64Image: string,
  apiKey: string
): Promise<VisionAnalysisResult | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 5 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              ],
            },
          ],
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const annotations = data.responses?.[0];
    if (!annotations) return null;

    const labels = annotations.labelAnnotations?.map((l: { description: string }) => l.description) || [];
    const textAnnotations = annotations.textAnnotations?.map((t: { description: string }) => t.description) || [];
    const objects = annotations.localizedObjectAnnotations?.map((o: { name: string }) => o.name) || [];

    return {
      description: generateFallbackDescription(labels, textAnnotations, objects),
      suggestedCategory: suggestCategoryFromLabels(labels, objects),
      confidence: annotations.labelAnnotations?.[0]?.score || 0.8,
      labels: [...labels, ...objects].slice(0, 10),
    };
  } catch (err) {
    console.warn('[NagarSetu AI] Cloud Vision API failed:', err);
    return null;
  }
};

// Analyze image using Gemini AI (with Cloud Vision & heuristic fallbacks)
export const analyzeImage = async (file: File | Blob): Promise<VisionAnalysisResult> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      description: `Photo documentation: ${(file as File).name || 'civic issue'}. Please review and update details if needed.`,
      suggestedCategory: 'others',
      confidence: 0,
      labels: [],
    };
  }

  try {
    const base64Image = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    // 1. Try Gemini Multimodal AI
    const geminiResult = await analyzeWithGemini(base64Image, mimeType, apiKey);
    if (geminiResult) {
      return geminiResult;
    }

    // 2. Try Google Cloud Vision
    const cloudVisionResult = await analyzeWithCloudVision(base64Image, apiKey);
    if (cloudVisionResult) {
      return cloudVisionResult;
    }

    // 3. Fallback heuristic
    return {
      description: `Visual evidence recorded for ${(file as File).name || 'reported issue'}. Please review and submit.`,
      suggestedCategory: 'others',
      confidence: 0.5,
      labels: ['civic_issue', 'photo_evidence'],
    };
  } catch (error) {
    console.error('[NagarSetu AI] Image analysis failed:', error);
    return {
      description: `Photo evidence provided. Please verify description and category.`,
      suggestedCategory: 'others',
      confidence: 0,
      labels: [],
    };
  }
};

// Batch analyze multiple images
export const analyzeMultipleImages = async (files: File[]): Promise<VisionAnalysisResult[]> => {
  const results = await Promise.allSettled(files.map(file => analyzeImage(file)));

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Failed to analyze image ${index + 1}:`, result.reason);
      return {
        description: `Image ${index + 1}: Visual evidence recorded. Please add description manually.`,
        suggestedCategory: 'others',
        confidence: 0,
        labels: [],
      };
    }
  });
};

// Combine multiple image analyses into a single comprehensive description
export const combineImageAnalyses = (
  analyses: VisionAnalysisResult[]
): { description: string; category: string } => {
  const validAnalyses = analyses.filter(analysis => analysis.confidence > 0.2);

  if (validAnalyses.length === 0) {
    return {
      description:
        'Multiple images uploaded showing civic issue documentation. Please review visual evidence and take remedial action.',
      category: 'others',
    };
  }

  // If top analysis has high confidence description, use it as primary summary
  const bestAnalysis = validAnalyses.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  let combinedDescription = bestAnalysis.description;

  if (validAnalyses.length > 1) {
    const additionalNotes = validAnalyses
      .filter(a => a !== bestAnalysis && a.description)
      .map((a, i) => `Additional angle ${i + 1}: ${a.description}`)
      .join(' ');

    if (additionalNotes) {
      combinedDescription += `\n\n${additionalNotes}`;
    }
  }

  return {
    description: combinedDescription.trim(),
    category: bestAnalysis.suggestedCategory,
  };
};

// Heuristic fallback description
const generateFallbackDescription = (
  labels: string[],
  _texts: string[],
  objects: string[]
): string => {
  const all = [...labels, ...objects].filter(Boolean);
  if (all.length === 0) {
    return 'Civic issue detected in uploaded photo. Please inspect and take appropriate action.';
  }
  return `Issue detected involving ${all.slice(0, 4).join(', ').toLowerCase()}. Requires municipal review and resolution.`;
};

// Heuristic fallback category
const suggestCategoryFromLabels = (labels: string[], objects: string[]): string => {
  const elements = [...labels, ...objects].map(e => e.toLowerCase());

  if (elements.some(e => e.includes('pothole') || e.includes('road') || e.includes('asphalt') || e.includes('crack'))) {
    return 'roads';
  }
  if (elements.some(e => e.includes('garbage') || e.includes('trash') || e.includes('waste') || e.includes('litter'))) {
    return 'cleanliness';
  }
  if (elements.some(e => e.includes('water') || e.includes('leak') || e.includes('drain') || e.includes('pipe'))) {
    return 'water_supply';
  }
  if (elements.some(e => e.includes('light') || e.includes('lamp') || e.includes('electric') || e.includes('wire'))) {
    return 'street_light';
  }

  return 'others';
};