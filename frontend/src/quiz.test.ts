import { describe, expect, it } from 'vitest';
import { buildQuestions, buildRound } from './quiz';

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

  it('builds five questions for a selected theme and uses a close fallback when needed', () => {
    const artists = Array.from({ length: 10 }, (_, index) => ({ id: `artist-${index}`, name: `Artist ${index}`, images: [], genres: [`genre-${index}`] }));
    const tracks = artists.map((artist, index) => ({ id: `track-${index}`, name: `Track ${index}`, artists: [artist], album: { id: `album-${index}`, name: `Album ${index}`, images: [], release_date: `${2010 + index}-01-01` } }));
    const data = { profile: { id: '1', display_name: 'A', images: [] }, topArtists: artists, topTracks: tracks, recentlyPlayed: [] };

    const artistRound = buildRound(data, 'artists');
    expect(artistRound.questions).toHaveLength(5);
    expect(artistRound.questions.every((item) => item.theme === 'artists')).toBe(true);

    const lyricRound = buildRound(data, 'lyrics');
    expect(lyricRound.questions).toHaveLength(5);
    expect(lyricRound.questions.every((item) => item.theme === 'tracks' || item.theme === 'artists')).toBe(true);
  });
});
