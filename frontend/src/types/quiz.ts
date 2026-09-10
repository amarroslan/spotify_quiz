export type QuizTheme = 'artists' | 'albums' | 'listening' | 'lyrics' | 'tracks' | 'deep-cuts';

export interface QuizThemeOption { id: QuizTheme; label: string; description: string; icon: string }
export interface QuizQuestion { prompt: string; answer: string; choices: string[]; detail: string; theme: QuizTheme }
