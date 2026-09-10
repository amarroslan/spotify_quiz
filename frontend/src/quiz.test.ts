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

  it('always keeps each correct answer in its four choices', () => {
    const artists = Array.from({ length: 10 }, (_, index) => ({ id: `artist-${index}`, name: `Artist ${index}`, images: [] }));
    const tracks = artists.map((artist, index) => ({
      id: `track-${index}`,
      name: `Track ${index}`,
      artists: [artist],
      album: { id: `album-${index}`, name: `Album ${index}`, images: [] },
    }));
    const data = { profile: { id: '1', display_name: 'A', images: [] }, topArtists: artists, topTracks: tracks, recentlyPlayed: [] };

    for (let attempt = 0; attempt < 25; attempt += 1) {
      expect(buildQuestions(data).every((question) => question.choices.includes(question.answer))).toBe(true);
    }
  });
});
