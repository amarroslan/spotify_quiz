export interface SpotifyImage { url: string; height?: number; width?: number }
export interface SpotifyProfile { id: string; display_name?: string; images?: SpotifyImage[] }
export interface SpotifyArtist { id: string; name: string; images?: SpotifyImage[]; genres?: string[]; popularity?: number }
export interface SpotifyAlbum { id: string; name: string; images?: SpotifyImage[]; release_date?: string; release_date_precision?: string; album_type?: string; total_tracks?: number }
export interface SpotifyTrack { id: string; name: string; artists: SpotifyArtist[]; album: SpotifyAlbum; popularity?: number; explicit?: boolean; duration_ms?: number }
export interface RecentlyPlayedItem { track: SpotifyTrack; played_at: string }
export interface QuizData { profile: SpotifyProfile; topArtists: SpotifyArtist[]; topTracks: SpotifyTrack[]; recentlyPlayed: RecentlyPlayedItem[]; lyricsByTrack?: Record<string, string> }
