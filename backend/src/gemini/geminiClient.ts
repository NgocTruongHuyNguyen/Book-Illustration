import fs from 'node:fs/promises';
import type {
  GeminiFile,
  InteractionResponse,
  CreateInteractionParams,
} from './types.js';

const BASE_URL = 'https://generativelanguage.googleapis.com';

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file — see .env.example.');
  }
  return key;
}

export async function uploadFile(filePath: string, mimeType: string): Promise<GeminiFile> {
  const apiKey = getApiKey();
  const bytes = await fs.readFile(filePath);
  const numBytes = bytes.byteLength;

  const startResponse = await fetch(`${BASE_URL}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(numBytes),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: filePath.split('/').pop() } }),
  });

  if (!startResponse.ok) {
    throw new Error(`Gemini file upload (start) failed: ${startResponse.status} ${await startResponse.text()}`);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini file upload did not return an upload URL.');
  }

  // Step 2: send the actual bytes, finalize.
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(numBytes),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Gemini file upload (finalize) failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
  }

  const result = (await uploadResponse.json()) as { file: { uri: string; name: string; mimeType: string } };
  return {
    uri: result.file.uri,
    name: result.file.name,
    mimeType: result.file.mimeType ?? mimeType,
  };
}

export async function createInteraction(params: CreateInteractionParams): Promise<InteractionResponse> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    model: params.model,
    input: params.input,
  };
  if (params.previousInteractionId) {
    body.previous_interaction_id = params.previousInteractionId;
  }
  if (params.responseFormat) {
    body.response_format = params.responseFormat;
  }

  const response = await fetch(`${BASE_URL}/v1beta/interactions`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini interaction failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as InteractionResponse;
}


export function extractText(interaction: InteractionResponse): string {
  for (let i = interaction.steps.length - 1; i >= 0; i--) {
    const step = interaction.steps[i];
    if (!step || step.type !== 'model_output' || !step.content) continue;
 
    for (let j = step.content.length - 1; j >= 0; j--) {
      const block = step.content[j];
      if (block && block.type === 'text' && block.text) {
        return block.text;
      }
    }
  }
  throw new Error('No text content found in interaction response.');
}
 
export function extractImage(interaction: InteractionResponse): { data: string; mimeType: string } {
  for (let i = interaction.steps.length - 1; i >= 0; i--) {
    const step = interaction.steps[i];
    if (!step || step.type !== 'model_output' || !step.content) continue;
 
    for (let j = step.content.length - 1; j >= 0; j--) {
      const block = step.content[j];
      if (block && block.type === 'image' && block.data) {
        return { data: block.data, mimeType: block.mime_type ?? 'image/png' };
      }
    }
  }
  throw new Error('No image content found in interaction response.');
}