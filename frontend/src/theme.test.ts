import { describe, expect, it } from 'vitest';
import { getInitialTheme, toggleTheme } from './theme';

describe('theme preferences', () => {
  it('toggles between light and dark themes', () => {
    expect(toggleTheme('dark')).toBe('light');
    expect(toggleTheme('light')).toBe('dark');
  });

  it('prefers a stored theme and otherwise follows the system preference', () => {
    expect(getInitialTheme('light', true)).toBe('light');
    expect(getInitialTheme(undefined, true)).toBe('dark');
    expect(getInitialTheme('invalid', false)).toBe('light');
  });
});
