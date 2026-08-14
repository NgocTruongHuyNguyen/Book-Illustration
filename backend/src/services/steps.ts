import type { Project, ProjectStatus, StepKey, Character } from '@book-studio/shared';
import { createInteraction, extractText, extractJSON } from '../gemini/geminiClient.js';
import { TEXT_MODEL } from '../gemini/config.js';
import { MAX_CHARACTERS } from './caps.js';

export interface StepOptions {
  userStyle?: string;
}

export interface StepDefinition {
  key: StepKey;
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  run(project: Project, options?: StepOptions): Promise<Partial<Project>>;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const CHARACTER_PROMPT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      prompt: { type: 'string' },
    },
    required: ['name', 'prompt'],
  },
} as const;

interface CharacterPromptResult {
  name: string;
  prompt: string;
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    key: 'STYLE',
    fromStatus: 'CREATED',
    toStatus: 'STYLE_SET',
    async run(project, options) {
      if (!project.textChainLastId) {
        throw new Error('Project has no text chain to continue from — book upload may have failed.');
      }

      const userStyle = options?.userStyle?.trim();

      const prompt = userStyle
        ? `The art style will be: "${userStyle}". Keep that in mind when generating future prompts. Keep quiet for now, instructions will follow.`
        : 'Can you define an art style that would fit the story but with a twist? Just give us the prompt for the art style that will be added to future prompts.';

      const interaction = await createInteraction({
        model: TEXT_MODEL,
        input: prompt,
        previousInteractionId: project.textChainLastId,
      });

      const style = userStyle ?? extractText(interaction);

      return {
        style: `Follow this style: "${style}"`,
        textChainLastId: interaction.id,
      };
    },
  },
  {
    key: 'CHARACTERS',
    fromStatus: 'STYLE_SET',
    toStatus: 'CHARACTERS_GENERATED',
    async run(project) {
      if (!project.textChainLastId) {
        throw new Error('Project has no text chain to continue from — style step may not have completed.');
      }

      const interaction = await createInteraction({
        model: TEXT_MODEL,
        input:
          'Can you describe the main characters (only the adults) and prepare a prompt ' +
          "describing them with as much detail as possible (use the descriptions from the book) " +
          'so Nano Banana can generate images of them? Each prompt should be at least 50 words.',
        previousInteractionId: project.textChainLastId,
        responseFormat: {
          type: 'text',
          mime_type: 'application/json',
          schema: CHARACTER_PROMPT_SCHEMA,
        },
      });

      const rawCharacters = extractJSON<CharacterPromptResult[]>(interaction);
      const capped = rawCharacters.slice(0, MAX_CHARACTERS);

      const characters: Character[] = capped.map((c) => ({
        name: c.name,
        prompt: c.prompt,
        portraitPath: null,
      }));

      return {
        characters,
        textChainLastId: interaction.id,
      };
    },
  },
  {
    key: 'PORTRAITS',
    fromStatus: 'CHARACTERS_GENERATED',
    toStatus: 'PORTRAITS_GENERATED',
    async run(project) {
      await delay(50);
      const characters = project.characters.map((c) => ({
        ...c,
        portraitPath: `/mock/portrait-${c.name}.png`,
      }));
      return { characters };
    },
  },
  {
    key: 'CHAPTERS',
    fromStatus: 'PORTRAITS_GENERATED',
    toStatus: 'CHAPTERS_GENERATED',
    async run() {
      await delay(50);
      return {
        chapters: [
          { name: 'Mock Chapter 1', prompt: 'placeholder prompt', illustrationPath: null },
        ],
      };
    },
  },
  {
    key: 'ILLUSTRATIONS',
    fromStatus: 'CHAPTERS_GENERATED',
    toStatus: 'DONE',
    async run(project) {
      await delay(50);
      const chapters = project.chapters.map((c) => ({
        ...c,
        illustrationPath: `/mock/illustration-${c.name}.png`,
      }));
      return { chapters };
    },
  },
];

export function getNextStep(status: ProjectStatus): StepDefinition | null {
  return STEP_DEFINITIONS.find((s) => s.fromStatus === status) ?? null;
}