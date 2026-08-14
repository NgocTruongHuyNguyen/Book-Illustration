export interface GeminiFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface InteractionContentBlock {
  type: 'text' | 'document' | 'image';
  text?: string;
  uri?: string;
  mime_type?: string;
  data?: string; 
}

export interface InteractionStep {
  type: 'user_input' | 'model_output' | 'thought';
  content?: InteractionContentBlock[];
}

export interface InteractionResponse {
  id: string;
  status: string;
  model: string;
  steps: InteractionStep[];
}

export interface ResponseFormat {
  type: 'text';
  mime_type: 'application/json';
  schema: Record<string, unknown>;
}

export interface CreateInteractionParams {
  model: string;
  input: string | InteractionContentBlock[];
  previousInteractionId?: string;
  responseFormat?: ResponseFormat;
  responseModalities?: string[]; 
  aspectRatio?: string; // e.g. '9:16' for portraits
}
 