import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Project } from '@book-studio/shared';
import { STEP_DEFINITIONS } from './steps.js';
import * as geminiClient from '../gemini/geminiClient.js';

vi.mock('../gemini/geminiClient.js', () => ({
  createInteraction: vi.fn(),
  extractText: vi.fn(),
  extractJSON: vi.fn(),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    userEmail: 'test@example.com',
    title: 'Test Book',
    bookTextPath: '/data/books/p1.txt',
    createdAt: new Date().toISOString(),
    status: 'STYLE_SET',
    stepState: 'IDLE',
    stepStartedAt: null,
    stepError: null,
    textChainLastId: 'mock-style-interaction-id',
    imageChainLastId: null,
    style: 'Follow this style: "watercolor"',
    characters: [],
    chapters: [],
    ...overrides,
  };
}

const charactersStep = STEP_DEFINITIONS.find((s) => s.key === 'CHARACTERS')!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CHARACTERS step', () => {
  it('caps characters at 2, even when Gemini returns more', async () => {
    vi.mocked(geminiClient.createInteraction).mockResolvedValue({
      id: 'characters-interaction-id',
      status: 'completed',
      model: 'gemini-3.6-flash',
      steps: [],
    });
    vi.mocked(geminiClient.extractJSON).mockReturnValue([
      { name: 'Mole', prompt: 'a mole, at least 50 words describing him in detail here' },
      { name: 'Rat', prompt: 'a rat, at least 50 words describing him in detail here' },
      { name: 'Toad', prompt: 'a toad, at least 50 words describing him in detail here' },
      { name: 'Badger', prompt: 'a badger, at least 50 words describing him in detail here' },
      { name: 'Otter', prompt: 'an otter, at least 50 words describing him in detail here' },
    ]);

    const project = makeProject();
    const result = await charactersStep.run(project);

    expect(result.characters).toHaveLength(2);
    expect(result.characters?.[0]?.name).toBe('Mole');
    expect(result.characters?.[1]?.name).toBe('Rat');
  });

  it('keeps all characters when Gemini returns fewer than the cap', async () => {
    vi.mocked(geminiClient.createInteraction).mockResolvedValue({
      id: 'characters-interaction-id',
      status: 'completed',
      model: 'gemini-3.6-flash',
      steps: [],
    });
    vi.mocked(geminiClient.extractJSON).mockReturnValue([
      { name: 'Solo Character', prompt: 'the only one, described here in detail for testing' },
    ]);

    const project = makeProject();
    const result = await charactersStep.run(project);

    expect(result.characters).toHaveLength(1);
  });

  it('sets portraitPath to null for every character — nothing generated yet', async () => {
    vi.mocked(geminiClient.createInteraction).mockResolvedValue({
      id: 'x',
      status: 'completed',
      model: 'gemini-3.6-flash',
      steps: [],
    });
    vi.mocked(geminiClient.extractJSON).mockReturnValue([
      { name: 'A', prompt: 'description of character a padded out to be long enough here' },
    ]);

    const project = makeProject();
    const result = await charactersStep.run(project);

    expect(result.characters?.[0]?.portraitPath).toBeNull();
  });

  it('chains off the project\'s current textChainLastId and updates it to the new interaction', async () => {
    vi.mocked(geminiClient.createInteraction).mockResolvedValue({
      id: 'brand-new-interaction-id',
      status: 'completed',
      model: 'gemini-3.6-flash',
      steps: [],
    });
    vi.mocked(geminiClient.extractJSON).mockReturnValue([
      { name: 'A', prompt: 'description of character a padded out to be long enough here' },
    ]);

    const project = makeProject({ textChainLastId: 'style-interaction-id' });
    const result = await charactersStep.run(project);

    expect(geminiClient.createInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ previousInteractionId: 'style-interaction-id' })
    );
    expect(result.textChainLastId).toBe('brand-new-interaction-id');
  });

  it('requests structured JSON output with the expected schema shape', async () => {
    vi.mocked(geminiClient.createInteraction).mockResolvedValue({
      id: 'x',
      status: 'completed',
      model: 'gemini-3.6-flash',
      steps: [],
    });
    vi.mocked(geminiClient.extractJSON).mockReturnValue([]);

    const project = makeProject();
    await charactersStep.run(project);

    expect(geminiClient.createInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: expect.objectContaining({
          mime_type: 'application/json',
          schema: expect.objectContaining({ type: 'array' }),
        }),
      })
    );
  });

  it('throws a clear error if the project has no text chain to continue from', async () => {
    const project = makeProject({ textChainLastId: null });
    await expect(charactersStep.run(project)).rejects.toThrow('text chain');
  });
});