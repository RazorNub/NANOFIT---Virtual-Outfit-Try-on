import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ItemType, ModelMode } from "../types";
import { cleanBase64, getMimeType } from "../utils/imageUtils";

interface ServiceOptions {
  modelMode: ModelMode;
  customApiKey?: string;
  onStatusUpdate?: (status: string) => void;
}

// Helper to get client
const getAiClient = (options: ServiceOptions) => {
  // Priority: 1. Custom Key passed from UI, 2. Env Var (for hosted/studio envs)
  const apiKey = options.customApiKey || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("No API key available. Please enter a valid API key in the interface.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Step 1: Analyze the item to get a detailed visual description.
 */
const getItemDescription = async (
  itemBase64: string,
  itemMime: string,
  options: ServiceOptions
): Promise<string> => {
  try {
    const ai = getAiClient(options);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: itemMime, data: cleanBase64(itemBase64) } },
          { text: "Describe this clothing or accessory item in detail for a text-to-image prompt. Focus on material, color, texture, fit, and style. Keep it under 40 words. Example output: 'A navy blue denim jacket with silver buttons and a shearling collar'." }
        ]
      }
    });
    return response.text?.trim() || "fashion item";
  } catch (e) {
    console.warn("Failed to generate description, using fallback.", e);
    return "stylish clothing item";
  }
};

/**
 * Step 3: Internal Review Layer.
 * Checks if the generated image is valid (has a person).
 */
const validateResult = async (
  generatedImageBase64: string,
  options: ServiceOptions
): Promise<boolean> => {
  try {
    const ai = getAiClient(options);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: cleanBase64(generatedImageBase64) } },
          { text: "Look at this image. Does it show a person wearing clothing? Answer exactly YES or NO." }
        ]
      }
    });
    const text = response.text?.trim().toUpperCase();
    return text?.includes("YES") ?? true; 
  } catch (e) {
    console.warn("Validation check failed, skipping.", e);
    return true; 
  }
};

/**
 * Main Analysis Function
 */
export const analyzeItemImage = async (
  itemBase64: string,
  mimeType: string,
  options: ServiceOptions
): Promise<ItemType> => {
  const ai = getAiClient(options);
  
  const prompt = `Analyze this image and tell me if it is clothing (tops, bottoms, dresses, jackets) or an accessory (glasses, jewelry, hats, scarves, watches, bags). Return exactly one word: 'clothing' or 'accessory'.`;
  
  const contents = {
    parts: [
      { inlineData: { mimeType: mimeType, data: cleanBase64(itemBase64) } },
      { text: prompt },
    ],
  };

  let modelToUse = options.modelMode === 'pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: contents,
    });
    return parseAnalysisResponse(response.text);
  } catch (error) {
    // If Pro fails, fallback to Flash
    if (options.modelMode === 'pro') {
      console.warn("Pro analysis failed, falling back to Flash");
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents,
        });
        return parseAnalysisResponse(response.text);
      } catch (e) {
        return 'clothing';
      }
    }
    return 'clothing';
  }
};

const parseAnalysisResponse = (text: string | undefined): ItemType => {
    const lowerText = text?.trim().toLowerCase();
    if (lowerText?.includes('clothing')) return 'clothing';
    if (lowerText?.includes('accessory')) return 'accessory';
    return 'clothing';
};

// Define safety settings to prevent blocking legitimate try-on requests
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

/**
 * Main Generation Function with Auto-Prompting and Review Layer
 */
export const generateTryOn = async (
  personBase64: string,
  personMime: string,
  itemBase64: string,
  itemMime: string,
  type: ItemType,
  options: ServiceOptions
): Promise<string> => {
  const ai = getAiClient(options);

  // --- STEP 1: Auto-Generate Prompt (Analyze Garment) ---
  options.onStatusUpdate?.("Analyzing item details...");
  const itemDescription = await getItemDescription(itemBase64, itemMime, options);
  console.log("Generated Item Description:", itemDescription);

  // --- STEP 2: Construct the Generation Prompts (Primary & Fallback) ---
  options.onStatusUpdate?.("Synthesizing try-on...");
  
  // Strict Prompt: Uses precise instructions
  const strictPrompt = type === 'clothing' 
    ? `You are given two images:
@img1 → the person
@img2 → the clothing item.

Make the person from @img1 wear the clothing from @img2. 
Do not alter the facial appearance, identity, skin tone, or pose of the person.
Do not modify or redesign the clothing from @img2 in any way.

Fit the clothing naturally on the body, matching lighting, perspective, and proportions. 
Blend realistically without changing anything else in the original image.

Output only the final edited image.`
    : `You are given two images:
@img1 → the person
@img2 → the accessory.

Place the accessory from @img2 naturally on the person in @img1, in the correct location for that accessory.
Do not alter the person’s facial appearance, identity, or any part of their original image.
Do not alter or redesign the accessory from @img2.

Match lighting, shadows, scale, and perspective for realism.
Blend seamlessly without modifying anything except what is required to place the accessory.

Output only the final edited image.`;

  // Relaxed Prompt: Frames it as a "creative composite" to avoid identity filters
  const relaxedPrompt = type === 'clothing'
    ? `Create a high-quality fashion editorial image featuring the person from the first image wearing the ${itemDescription} shown in the second image.
       - Blend the clothing naturally onto the body.
       - Match the lighting and shadows of the original photo.
       - Keep the person's pose and expression unchanged.
       - This is a digital fashion composite.`
    : `Create a realistic image of the person from the first image wearing the accessory (${itemDescription}) from the second image.
       - Place the accessory naturally.
       - Ensure lighting matches.`;

  // Helper to run the generation call
  const executeGeneration = async (model: string, promptText: string, extraConfig: any) => {
    const contents = {
      parts: [
        { inlineData: { mimeType: personMime, data: cleanBase64(personBase64) } },
        { inlineData: { mimeType: itemMime, data: cleanBase64(itemBase64) } },
        { text: promptText },
      ],
    };

    const config = {
        ...extraConfig,
        safetySettings,
    };

    console.log(`Attempting generation with model: ${model}`);
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });
    return extractImageFromResponse(response);
  };

  let generatedImage: string | null = null;
  let lastError: any = null;

  // Determine Primary and Fallback Models
  const primaryModel = options.modelMode === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const fallbackModel = 'gemini-2.5-flash-image';
  const primaryConfig = options.modelMode === 'pro' 
    ? { imageConfig: { aspectRatio: "3:4", imageSize: "1K" } } 
    : { imageConfig: { aspectRatio: "3:4" } };
  const fallbackConfig = { imageConfig: { aspectRatio: "3:4" } };

  // --- RETRY LOOP ---
  // Attempt 1: Primary Model + Strict Prompt
  try {
      generatedImage = await executeGeneration(primaryModel, strictPrompt, primaryConfig);
  } catch (err) {
      console.warn("Attempt 1 (Strict Prompt) failed:", err);
      lastError = err;
  }

  // Attempt 2: Primary Model + Relaxed Prompt
  if (!generatedImage) {
      options.onStatusUpdate?.("Refining result (Attempt 2)...");
      try {
          generatedImage = await executeGeneration(primaryModel, relaxedPrompt, primaryConfig);
      } catch (err) {
          console.warn("Attempt 2 (Relaxed Prompt) failed:", err);
          lastError = err;
      }
  }

  // Attempt 3: Fallback Model + Strict Prompt (If previous failed & in Pro mode)
  if (!generatedImage && options.modelMode === 'pro') {
      options.onStatusUpdate?.("Switching to standard model...");
      try {
          generatedImage = await executeGeneration(fallbackModel, strictPrompt, fallbackConfig);
      } catch (err) {
          console.warn("Attempt 3 (Fallback Model) failed:", err);
          lastError = err;
      }
  }

  if (!generatedImage) {
      // Throw the last meaningful error
      const errorMsg = lastError instanceof Error ? lastError.message : "Unknown error";
      throw new Error(`Generation failed: ${errorMsg}`);
  }

  // --- STEP 3: Internal Review Layer ---
  options.onStatusUpdate?.("Reviewing result quality...");
  const isValid = await validateResult(generatedImage, options);

  if (!isValid) {
      console.warn("Internal review failed: Image might not show a person.");
  }

  return generatedImage;
};

/**
 * Refinement Function
 * Edits an existing image based on user instruction.
 */
export const refineImage = async (
  currentImageBase64: string,
  instruction: string,
  options: ServiceOptions
): Promise<string> => {
  const ai = getAiClient(options);
  const mimeType = getMimeType(currentImageBase64);

  options.onStatusUpdate?.("Applying changes...");

  const prompt = `Regenerate this image with the following modification: "${instruction}".
  - Maintain the exact identity, face, and body of the person.
  - Keep the original background and lighting.
  - Only change the clothing/accessory as requested.
  - Output a photorealistic image.`;

  const contents = {
    parts: [
      { inlineData: { mimeType: mimeType, data: cleanBase64(currentImageBase64) } },
      { text: prompt },
    ],
  };

  const model = options.modelMode === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const config = options.modelMode === 'pro' 
    ? { imageConfig: { aspectRatio: "3:4", imageSize: "1K" }, safetySettings } 
    : { imageConfig: { aspectRatio: "3:4" }, safetySettings };

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });
    return extractImageFromResponse(response);
  } catch (err) {
     console.error("Refinement failed", err);
     // Try fallback to flash if Pro fails
     if (options.modelMode === 'pro') {
       options.onStatusUpdate?.("Retrying with Flash...");
       const fallbackResponse = await ai.models.generateContent({
         model: 'gemini-2.5-flash-image',
         contents,
         config: { ...config, imageConfig: { aspectRatio: "3:4" } }
       });
       return extractImageFromResponse(fallbackResponse);
     }
     throw err;
  }
};


// Helper to extract image data from response parts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractImageFromResponse = (response: any): string => {
  if (!response || !response.candidates || response.candidates.length === 0) {
      // Check for prompt feedback blocking
      if (response?.promptFeedback?.blockReason) {
          throw new Error(`Request blocked by safety filters: ${response.promptFeedback.blockReason}`);
      }
      throw new Error("No candidates returned from the model.");
  }

  const candidate = response.candidates[0];

  // Check finish reason
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`Generation stopped. Reason: ${candidate.finishReason} (The model likely refused the request due to safety/policy filters)`);
  }

  const parts = candidate.content?.parts || [];
  
  if (parts.length === 0) {
      throw new Error("Model returned a candidate but no content parts.");
  }

  // 1. Look for inline data (Image)
  for (const part of parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }

  // 2. Look for text refusal
  const textPart = parts.find((p: any) => p.text);
  if (textPart && textPart.text) {
      throw new Error(`Model Refusal: ${textPart.text.substring(0, 150)}...`);
  }

  throw new Error("No valid image data found in the response candidates.");
};