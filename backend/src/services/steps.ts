import type { Project, ProjectStatus, StepKey, Character, Chapter } from '@book-studio/shared';
import { createInteraction, extractText, extractJSON, extractImage } from '../gemini/geminiClient.js';
import { TEXT_MODEL, IMAGE_MODEL } from '../gemini/config.js';
import { MAX_CHARACTERS, MAX_CHAPTERS } from './caps.js';
import { writeImage } from '../storage/imageStorage.js';

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

const PROMPT_LIST_SCHEMA = {
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

interface PromptResult {
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
          schema: PROMPT_LIST_SCHEMA,
        },
      });

      const rawCharacters = extractJSON<PromptResult[]>(interaction);
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
      if (project.characters.length === 0) {
        throw new Error('Project has no characters to generate portraits for.');
      }

      let lastImageInteractionId = (
        await createInteraction({
          model: IMAGE_MODEL,
          input:
            `You are going to generate portrait images to illustrate this book. ` +
            `The style we want you to follow is: ${project.style ?? 'no specific style provided'}. ` +
            `Generate a portrait for each character as requested in the following messages.`,
        })
      ).id;

      const updatedCharacters: Character[] = [];

      for (const character of project.characters) {
        const interaction = await createInteraction({
          model: IMAGE_MODEL,
          input: `Create an illustration for ${character.name} following this description: ${character.prompt}`,
          previousInteractionId: lastImageInteractionId,
          responseModalities: ['Image'],
          aspectRatio: '9:16',
        });

        const image = extractImage(interaction);
        const portraitPath = await writeImage(
          project.id,
          `portrait-${character.name.replace(/\s+/g, '-').toLowerCase()}`,
          image.data,
          image.mimeType
        );

        updatedCharacters.push({ ...character, portraitPath });
        lastImageInteractionId = interaction.id;
      }

      return {
        characters: updatedCharacters,
        imageChainLastId: lastImageInteractionId,
      };
    },
  },
  {
    key: 'CHAPTERS',
    fromStatus: 'PORTRAITS_GENERATED',
    toStatus: 'CHAPTERS_GENERATED',
    async run(project) {
      if (!project.textChainLastId) {
        throw new Error('Project has no text chain to continue from — characters step may not have completed.');
      }

      const interaction = await createInteraction({
        model: TEXT_MODEL,
        input:
          'Now, for each chapter of the book, give me a prompt to illustrate what happens in it. ' +
          'It should be a single image, not a multi-tiled page. Be very descriptive, especially of ' +
          'the characters. Remember to tell their name and to reuse the character prompts if they ' +
          'appear in the images. Also list all characters who appear in it.',
        previousInteractionId: project.textChainLastId,
        responseFormat: {
          type: 'text',
          mime_type: 'application/json',
          schema: PROMPT_LIST_SCHEMA,
        },
      });

      const rawChapters = extractJSON<PromptResult[]>(interaction);

      const capped = rawChapters.slice(0, MAX_CHAPTERS);

      const chapters: Chapter[] = capped.map((c) => ({
        name: c.name,
        prompt: c.prompt,
        illustrationPath: null,
      }));

      return {
        chapters,
        textChainLastId: interaction.id,
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