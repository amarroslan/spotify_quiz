import type { QuizQuestion } from './types/quiz';
import type { QuizData } from './types/spotify';

const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);
const unique = (items: string[]): string[] => [...new Map(items.map((item) => [item, item])).values()];
const choices = (answer: string, pool: string[]): string[] => shuffle(unique([answer, ...pool]).filter(Boolean)).slice(0, 4);

export function buildQuestions(data: QuizData): QuizQuestion[] {
  const { profile, topArtists = [], topTracks = [], recentlyPlayed = [] } = data;
  const artists = unique(topArtists.map((artist) => artist.name));
  const tracks = unique(topTracks.map((track) => track.name));
  const trackArtists = unique(topTracks.flatMap((track) => track.artists.map((artist) => artist.name)));
  const recentNames = unique(recentlyPlayed.map(({ track }) => track.name));
  const questions: QuizQuestion[] = [];
  if (artists.length >= 2) questions.push({ prompt: 'Who is your top artist over the last six months?', answer: artists[0], choices: choices(artists[0], artists.slice(1)), detail: 'Based on your Spotify top artists (medium-term affinity).' });
  if (tracks.length >= 2) questions.push({ prompt: 'Which of these is one of your top tracks?', answer: tracks[0], choices: choices(tracks[0], tracks.slice(1)), detail: 'Your top tracks are calculated from your listening affinity.' });
  if (topTracks[0]?.artists?.length && trackArtists.length >= 2) { const answer = topTracks[0].artists[0].name; questions.push({ prompt: `Who performs your #1 top track, "${topTracks[0].name}"?`, answer, choices: choices(answer, trackArtists.filter((artist) => artist !== answer)), detail: 'Pulled from your Spotify top tracks.' }); }
  if (recentNames.length >= 2) questions.push({ prompt: 'Which track appeared in your recent listening history?', answer: recentNames[0], choices: choices(recentNames[0], recentNames.slice(1)), detail: 'Based on your latest available recently played tracks.' });
  if (topTracks[0]?.album?.name && tracks.length >= 2) { const answer = topTracks[0].album.name; const albumChoices = topTracks.map((track) => track.album?.name).filter((value): value is string => Boolean(value)); questions.push({ prompt: `What album is your top track, "${topTracks[0].name}", from?`, answer, choices: choices(answer, albumChoices), detail: 'Album metadata comes from Spotify.' }); }
  if (profile?.display_name && artists.length >= 2) { const answer = artists[Math.min(4, artists.length - 1)]; questions.push({ prompt: `${profile.display_name}, which artist made your top five?`, answer, choices: choices(answer, artists), detail: 'A quick test of how closely you know your current rotation.' }); }
  return shuffle(questions).slice(0, 6);
}
