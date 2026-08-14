import type { Project, ProjectStatus, StepKey } from '@book-studio/shared';

export interface StepDefinition {
  key: StepKey;
  fromStatus: ProjectStatus;
  toStatus: ProjectStatus;
  run(project: Project): Promise<Partial<Project>>;
}


// Each simulates a delay so the "no duplicate call while RUNNING" behavior is actually exercisable.
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    key: 'STYLE',
    fromStatus: 'CREATED',
    toStatus: 'STYLE_SET',
    async run() {
      await delay(50);
      return { style: 'MOCK STYLE (replace with real Gemini call' };
    },
  },
  {
    key: 'CHARACTERS',
    fromStatus: 'STYLE_SET',
    toStatus: 'CHARACTERS_GENERATED',
    async run() {
      await delay(50);
      return {
        characters: [
          { name: 'Mock Character A', prompt: 'placeholder prompt', portraitPath: null },
          { name: 'Mock Character B', prompt: 'placeholder prompt', portraitPath: null },
        ],
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