export type StepKey = 'STYLE' | 'CHARACTERS' | 'PORTRAITS' | 'CHAPTERS' | 'ILLUSTRATIONS';

export type ProjectStatus =
  | 'CREATED'
  | 'STYLE_SET'
  | 'CHARACTERS_GENERATED'
  | 'PORTRAITS_GENERATED'
  | 'CHAPTERS_GENERATED'
  | 'DONE';

export type StepState = 'IDLE' | 'RUNNING' | 'FAILED';

export interface Character {
  name: string;
  prompt: string;
  portraitPath: string | null;
}

export interface Chapter {
  name: string;
  prompt: string;
  illustrationPath: string | null;
}

export interface Project {
  id: string;
  userEmail: string;
  title: string;
  bookTextPath: string;
  createdAt: string;

  status: ProjectStatus;
  stepState: StepState;
  stepStartedAt: string | null;
  stepError: string | null;

  textChainLastId: string | null;
  imageChainLastId: string | null;

  style: string | null;
  characters: Character[];
  chapters: Chapter[];
}