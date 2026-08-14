import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractText, extractImage, createInteraction } from './geminiClient.js';
import type { InteractionResponse } from './types.js';

function makeInteraction(overrides: Partial<InteractionResponse> = {}): InteractionResponse {
  return {
    id: 'v1_test',
    status: 'completed',
    model: 'gemini-3.6-flash',
    steps: [],
    ...overrides,
  };
}

describe('extractText', () => {
  it('pulls text from the final model_output step', () => {
    const interaction = makeInteraction({
      steps: [
        { type: 'thought' },
        { type: 'model_output', content: [{ type: 'text', text: 'Hello there' }] },
      ],
    });

    expect(extractText(interaction)).toBe('Hello there');
  });

  it('throws when there is no text content anywhere', () => {
    const interaction = makeInteraction({ steps: [{ type: 'thought' }] });
    expect(() => extractText(interaction)).toThrow();
  });
});

describe('extractImage', () => {
  it('pulls image data and mime type from the final model_output step', () => {
    const interaction = makeInteraction({
      steps: [
        {
          type: 'model_output',
          content: [{ type: 'image', data: 'base64data==', mime_type: 'image/png' }],
        },
      ],
    });

    const result = extractImage(interaction);
    expect(result.data).toBe('base64data==');
    expect(result.mimeType).toBe('image/png');
  });

  it('throws when there is no image content', () => {
    const interaction = makeInteraction({
      steps: [{ type: 'model_output', content: [{ type: 'text', text: 'no image here' }] }],
    });
    expect(() => extractImage(interaction)).toThrow();
  });
});

describe('createInteraction', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  it('throws a clear error when GEMINI_API_KEY is not set, without making a network call', async () => {
    await expect(
      createInteraction({ model: 'gemini-3.6-flash', input: 'test' })
    ).rejects.toThrow('GEMINI_API_KEY is not set');
  });
});