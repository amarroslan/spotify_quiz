import { describe, expect, it } from 'vitest';
import { buildQuestions } from './quiz';

describe('quiz generation', () => {
  it('creates answerable questions from Spotify data', () => {
    const questions = buildQuestions({
      profile: { id: '1', display_name: 'A', images: [] },
      topArtists: [{ id: 'a', name: 'Artist', images: [] }, { id: 'b', name: 'Other Artist', images: [] }],
      topTracks: [
        { id: 't', name: 'Track', artists: [{ id: 'a', name: 'Artist' }], album: { id: 'album', name: 'Album', images: [] } },
        { id: 'u', name: 'Other Track', artists: [{ id: 'b', name: 'Other Artist' }], album: { id: 'album2', name: 'Other Album', images: [] } },
      ],
      recentlyPlayed: [],
    });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((question) => question.choices.includes(question.answer))).toBe(true);
  });
});
