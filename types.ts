export type ItemType = 'clothing' | 'accessory' | null;
export type ModelMode = 'pro' | 'flash';

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface AnalysisResult {
  type: ItemType;
  confidence?: number;
}

export interface AppState {
  personImage: ImageFile | null;
  itemImage: ImageFile | null;
  generatedImage: string | null;
  isAnalyzing: boolean;
  isGenerating: boolean;
  loadingStatus: string | null; // New field for granular status updates
  detectedType: ItemType;
  manualTypeOverride: ItemType;
  error: string | null;
  // UI State for API Key
  hasApiKey: boolean;
  showKeyGuide: boolean;
  modelMode: ModelMode;
  flashApiKey: string;
}
