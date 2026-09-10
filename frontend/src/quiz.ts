import type { QuizQuestion } from './types/quiz';
import type { QuizData, SpotifyAlbum, SpotifyArtist, SpotifyTrack } from './types/spotify';
import type { QuizTheme, QuizThemeOption } from './types/quiz';

export const THEME_OPTIONS: QuizThemeOption[] = [
  { id: 'artists', label: 'Artists', description: 'Your top names, rankings, and collaborations.', icon: '✦' },
  { id: 'albums', label: 'Albums', description: 'The records behind your favorite tracks.', icon: '◉' },
  { id: 'listening', label: 'Listening activity', description: 'Recent plays, repeats, and your listening trail.', icon: '↗' },
  { id: 'lyrics', label: 'Lyrics', description: 'Recognize lines from songs in your rotation.', icon: '≋' },
  { id: 'tracks', label: 'Tracks', description: 'Song titles, artists, and deep-cut clues.', icon: '♪' },
  { id: 'deep-cuts', label: 'Deep cuts', description: 'Genres, eras, popularity, and metadata only you know.', icon: '◇' },
];

export const THEME_FALLBACKS: Record<QuizTheme, QuizTheme[]> = {
  artists: ['albums', 'listening'],
  albums: ['artists', 'tracks'],
  listening: ['tracks', 'artists'],
  lyrics: ['tracks', 'artists'],
  tracks: ['artists', 'listening'],
  'deep-cuts': ['tracks', 'artists'],
};

const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);
const unique = (items: string[]): string[] => [...new Map(items.filter(Boolean).map((item) => [item, item])).values()];

const choices = (answer: string, pool: string[]): string[] => {
  const distractors = shuffle(unique(pool).filter((choice) => choice !== answer)).slice(0, 3);
  return shuffle([answer, ...distractors]);
};

const question = (theme: QuizTheme, prompt: string, answer: string, pool: string[], detail: string): QuizQuestion | null => {
  if (!answer || unique([answer, ...pool]).length < 2) return null;
  return { theme, prompt, answer, choices: choices(answer, pool), detail };
};

const add = (target: QuizQuestion[], item: QuizQuestion | null): void => { if (item) target.push(item); };
const artistNames = (artists: SpotifyArtist[]): string[] => unique(artists.map((artist) => artist.name));
const trackNames = (tracks: SpotifyTrack[]): string[] => unique(tracks.map((track) => track.name));
const albumNames = (tracks: SpotifyTrack[]): string[] => unique(tracks.map((track) => track.album?.name || ''));
const firstArtist = (track: SpotifyTrack): string => track.artists?.[0]?.name || '';
const releaseYear = (album: SpotifyAlbum): string => album.release_date?.slice(0, 4) || '';

function artistQuestions(data: QuizData): QuizQuestion[] {
  const artists = data.topArtists || [];
  const names = artistNames(artists);
  const tracks = data.topTracks || [];
  const result: QuizQuestion[] = [];
  names.slice(0, 10).forEach((answer, index) => add(result, question('artists', `Which artist is ranked #${index + 1} in your top rotation?`, answer, names, 'Based on your Spotify medium-term top artists.')));
  tracks.slice(0, 10).forEach((track) => add(result, question('artists', `Who performs "${track.name}"?`, firstArtist(track), names, 'Artist metadata comes directly from your Spotify top tracks.')));
  if (data.profile?.display_name && names.length > 2) add(result, question('artists', `${data.profile.display_name}, which artist appears in your top five?`, names[Math.min(4, names.length - 1)], names, 'A quick test of your current artist rotation.'));
  const recentArtists = unique((data.recentlyPlayed || []).map(({ track }) => firstArtist(track)));
  if (recentArtists.length > 1) add(result, question('artists', 'Which artist appeared in your recent listening?', recentArtists[0], recentArtists, 'Pulled from your recently played tracks.'));
  return result;
}

function albumQuestions(data: QuizData): QuizQuestion[] {
  const tracks = data.topTracks || [];
  const albums = albumNames(tracks);
  const result: QuizQuestion[] = [];
  tracks.slice(0, 12).forEach((track) => add(result, question('albums', `Which album is "${track.name}" from?`, track.album?.name || '', albums, 'Album metadata comes from Spotify.')));
  tracks.slice(0, 8).forEach((track) => add(result, question('albums', `Which track appears on "${track.album?.name || 'this album'}"?`, track.name, trackNames(tracks), 'Test your memory for the records in your top rotation.')));
  const albumCounts = new Map<string, number>();
  tracks.forEach((track) => { const name = track.album?.name; if (name) albumCounts.set(name, (albumCounts.get(name) || 0) + 1); });
  const mostPlayedAlbum = [...albumCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (mostPlayedAlbum) add(result, question('albums', 'Which album appears most often in your top tracks?', mostPlayedAlbum, albums, 'Based on repeated album appearances in your Spotify top tracks.'));
  return result;
}

function listeningQuestions(data: QuizData): QuizQuestion[] {
  const recent = data.recentlyPlayed || [];
  const recentTracks = trackNames(recent.map(({ track }) => track));
  const recentArtists = unique(recent.map(({ track }) => firstArtist(track)));
  const topTracks = data.topTracks || [];
  const result: QuizQuestion[] = [];
  recent.slice(0, 16).forEach(({ track }, index) => add(result, question('listening', index === 0 ? 'What was the most recent track in your listening history?' : 'Which track appeared in your recent listening history?', track.name, recentTracks, 'Based on your latest available Spotify listening activity.')));
  recent.slice(0, 10).forEach(({ track }) => add(result, question('listening', `Which artist did you recently play?`, firstArtist(track), recentArtists, 'Based on your recently played artists.')));
  if (topTracks.length > 1) add(result, question('listening', 'Which song is currently in your top listening rotation?', topTracks[0].name, trackNames(topTracks), 'Based on your Spotify medium-term top tracks.'));
  const overlap = recentTracks.filter((name) => topTracks.some((track) => track.name === name));
  if (overlap.length > 0) add(result, question('listening', 'Which top track did you revisit recently?', overlap[0], unique([...recentTracks, ...trackNames(topTracks)]), 'This clue compares your recent plays with your top-track affinity.'));
  return result;
}

function lyricExcerpt(value: string): string {
  const line = value.split(/\r?\n/).map((item) => item.replace(/\s+/g, ' ').trim()).find((item) => item.length >= 18 && !/^\[.*\]$/.test(item));
  if (!line) return '';
  return line.length > 90 ? `${line.slice(0, 87).trim()}...` : line;
}

function lyricQuestions(data: QuizData): QuizQuestion[] {
  const lyrics = data.lyricsByTrack || {};
  const tracks = data.topTracks || [];
  const names = trackNames(tracks);
  const artists = artistNames(data.topArtists || []);
  const result: QuizQuestion[] = [];
  tracks.forEach((track) => {
    const excerpt = lyricExcerpt(lyrics[track.id] || '');
    if (!excerpt) return;
    add(result, question('lyrics', `Which track includes this lyric: "${excerpt}"`, track.name, names, 'Lyrics are matched to your Spotify top-track rotation.'));
    add(result, question('lyrics', `Who performs the track with this lyric: "${excerpt}"`, firstArtist(track), artists, 'Artist metadata comes from Spotify; lyric availability depends on the lyrics provider.'));
  });
  return result;
}

function trackQuestions(data: QuizData): QuizQuestion[] {
  const tracks = data.topTracks || [];
  const names = trackNames(tracks);
  const result: QuizQuestion[] = [];
  tracks.slice(0, 15).forEach((track, index) => add(result, question('tracks', index === 0 ? 'Which song is your #1 top track?' : `Which song is ranked #${index + 1} in your top tracks?`, track.name, names, 'Based on your Spotify medium-term top tracks.')));
  tracks.slice(0, 10).forEach((track) => add(result, question('tracks', `Which track is by ${firstArtist(track)}?`, track.name, names, 'Artist and track metadata are pulled from Spotify.')));
  return result;
}

function deepCutQuestions(data: QuizData): QuizQuestion[] {
  const artists = data.topArtists || [];
  const tracks = data.topTracks || [];
  const result: QuizQuestion[] = [];
  const genrePairs = artists.flatMap((artist) => (artist.genres || []).slice(0, 2).map((genre) => ({ genre, artist: artist.name })));
  const genres = unique(genrePairs.map(({ genre }) => genre));
  genrePairs.slice(0, 12).forEach(({ genre, artist }) => add(result, question('deep-cuts', `Which artist in your rotation is associated with ${genre}?`, artist, artistNames(artists), 'Genre metadata is supplied by Spotify.')));
  const years = unique(tracks.map((track) => releaseYear(track.album)).filter(Boolean));
  tracks.slice(0, 10).forEach((track) => { const year = releaseYear(track.album); if (year) add(result, question('deep-cuts', `What release year belongs to the album "${track.album.name}"?`, year, years, 'Release-era metadata comes from the album record.')); });
  if (genres.length > 1) add(result, question('deep-cuts', 'Which genre appears in your top-artist metadata?', genres[0], genres, 'A deeper cut from Spotify artist metadata.'));
  const popularityTracks = tracks.filter((track) => typeof track.popularity === 'number');
  if (popularityTracks.length > 1) { const answer = popularityTracks.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0].name; add(result, question('deep-cuts', 'Which track has the highest Spotify popularity among these?', answer, trackNames(popularityTracks), 'Popularity is Spotify metadata, not a measure of your personal ranking.')); }
  return result;
}

export function buildQuestionBank(data: QuizData, theme: QuizTheme): QuizQuestion[] {
  switch (theme) {
    case 'artists': return artistQuestions(data);
    case 'albums': return albumQuestions(data);
    case 'listening': return listeningQuestions(data);
    case 'lyrics': return lyricQuestions(data);
    case 'tracks': return trackQuestions(data);
    case 'deep-cuts': return deepCutQuestions(data);
  }
}

export function buildQuestions(data: QuizData, theme?: QuizTheme): QuizQuestion[] {
  if (theme) return shuffle(buildQuestionBank(data, theme));
  return shuffle(THEME_OPTIONS.flatMap(({ id }) => buildQuestionBank(data, id))).slice(0, 6);
}

export function buildRound(data: QuizData, theme: QuizTheme): { questions: QuizQuestion[]; fallbackThemes: QuizTheme[] } {
  const sources = [theme, ...THEME_FALLBACKS[theme]];
  const questions: QuizQuestion[] = [];
  const usedFallbacks: QuizTheme[] = [];
  for (const source of sources) {
    const candidates = shuffle(buildQuestionBank(data, source));
    const before = questions.length;
    candidates.forEach((candidate) => {
      if (questions.length < 5 && !questions.some((item) => item.prompt === candidate.prompt)) questions.push(candidate);
    });
    if (source !== theme && questions.length > before) usedFallbacks.push(source);
    if (questions.length >= 5) break;
  }
  return { questions: shuffle(questions).slice(0, 5), fallbackThemes: usedFallbacks };
}
