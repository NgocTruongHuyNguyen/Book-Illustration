// backend/src/services/steps.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { Project } from '@book-studio/shared';
import { STEP_DEFINITIONS } from './steps.js';
import * as geminiClient from '../gemini/geminiClient.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

vi.mock('../gemini/geminiClient.js', () => ({
  createInteraction: vi.fn(),
  extractText: vi.fn(),
  extractJSON: vi.fn(),
  extractImage: vi.fn(),
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
const portraitsStep = STEP_DEFINITIONS.find((s) => s.key === 'PORTRAITS')!;

afterEach(() => {
  vi.clearAllMocks();
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

  it("chains off the project's current textChainLastId and updates it to the new interaction", async () => {
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

describe('PORTRAITS step', () => {
  let tempDataDir: string;

  beforeEach(async () => {
    tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'book-studio-test-'));
    process.env.DATA_DIR = tempDataDir;
  });

  afterEach(async () => {
    await fs.rm(tempDataDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it('generates one portrait per character and saves real files to disk', async () => {
    vi.mocked(geminiClient.createInteraction)
      .mockResolvedValueOnce({ id: 'setup-interaction-id', status: 'completed', model: 'x', steps: [] })
      .mockResolvedValueOnce({ id: 'portrait-1-id', status: 'completed', model: 'x', steps: [] })
      .mockResolvedValueOnce({ id: 'portrait-2-id', status: 'completed', model: 'x', steps: [] });

    vi.mocked(geminiClient.extractImage).mockReturnValue({
      data: Buffer.from('fake image bytes').toString('base64'),
      mimeType: 'image/png',
    });

    const project = makeProject({
      status: 'CHARACTERS_GENERATED',
      characters: [
        { name: 'Mole', prompt: 'a mole', portraitPath: null },
        { name: 'Rat', prompt: 'a rat', portraitPath: null },
      ],
    });

    const result = await portraitsStep.run(project);

    expect(result.characters).toHaveLength(2);
    expect(result.characters?.[0]?.portraitPath).toMatch(/portrait-mole\.png$/);
    expect(result.characters?.[1]?.portraitPath).toMatch(/portrait-rat\.png$/);

    const savedBytes = await fs.readFile(result.characters![0]!.portraitPath!);
    expect(savedBytes.toString()).toBe('fake image bytes');
  });

  it('the setup call has no previousInteractionId — the image chain starts fresh', async () => {
    vi.mocked(geminiClient.createInteraction)
      .mockResolvedValueOnce({ id: 'setup-id', status: 'completed', model: 'x', steps: [] })
      .mockResolvedValueOnce({ id: 'portrait-1-id', status: 'completed', model: 'x', steps: [] });

    vi.mocked(geminiClient.extractImage).mockReturnValue({
      data: Buffer.from('x').toString('base64'),
      mimeType: 'image/png',
    });

    const project = makeProject({
      status: 'CHARACTERS_GENERATED',
      characters: [{ name: 'Solo', prompt: 'p', portraitPath: null }],
    });

    await portraitsStep.run(project);

    const firstCallArgs = vi.mocked(geminiClient.createInteraction).mock.calls[0]![0];
    expect(firstCallArgs.previousInteractionId).toBeUndefined();
  });

  it('each character portrait chains off the previous image interaction, sequentially', async () => {
    vi.mocked(geminiClient.createInteraction)
      .mockResolvedValueOnce({ id: 'setup-id', status: 'completed', model: 'x', steps: [] })
      .mockResolvedValueOnce({ id: 'portrait-1-id', status: 'completed', model: 'x', steps: [] })
      .mockResolvedValueOnce({ id: 'portrait-2-id', status: 'completed', model: 'x', steps: [] });

    vi.mocked(geminiClient.extractImage).mockReturnValue({
      data: Buffer.from('x').toString('base64'),
      mimeType: 'image/png',
    });

    const project = makeProject({
      status: 'CHARACTERS_GENERATED',
      characters: [
        { name: 'A', prompt: 'p', portraitPath: null },
        { name: 'B', prompt: 'p', portraitPath: null },
      ],
    });

    await portraitsStep.run(project);

    const calls = vi.mocked(geminiClient.createInteraction).mock.calls;
    expect(calls[1]![0].previousInteractionId).toBe('setup-id');
    expect(calls[2]![0].previousInteractionId).toBe('portrait-1-id');
  });

  it('returns imageChainLastId as the final portrait interaction id', async () => {
    vi.mocked(geminiClient.createInteraction)
      .mockResolvedValueOnce({ id: 'setup-id', status: 'completed', model: 'x', steps: [] })
      .mockResolvedValueOnce({ id: 'last-portrait-id', status: 'completed', model: 'x', steps: [] });

    vi.mocked(geminiClient.extractImage).mockReturnValue({
      data: Buffer.from('x').toString('base64'),
      mimeType: 'image/png',
    });

    const project = makeProject({
      status: 'CHARACTERS_GENERATED',
      characters: [{ name: 'Solo', prompt: 'p', portraitPath: null }],
    });

    const result = await portraitsStep.run(project);
    expect(result.imageChainLastId).toBe('last-portrait-id');
  });

  it('throws if the project has no characters to generate portraits for', async () => {
    const project = makeProject({ status: 'CHARACTERS_GENERATED', characters: [] });
    await expect(portraitsStep.run(project)).rejects.toThrow('no characters');
  });
});