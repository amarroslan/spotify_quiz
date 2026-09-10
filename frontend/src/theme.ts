export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'spotify-quiz-theme';

export const toggleTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark');

export const getInitialTheme = (storedTheme: string | null | undefined, prefersDark: boolean): Theme => {
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  return prefersDark ? 'dark' : 'light';
};
