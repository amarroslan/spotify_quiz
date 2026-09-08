export interface SpotifyImage { url: string; height?: number; width?: number }
export interface SpotifyProfile { id: string; display_name?: string; images?: SpotifyImage[] }
export interface SpotifyArtist { id: string; name: string; images?: SpotifyImage[] }
export interface SpotifyAlbum { id: string; name: string; images?: SpotifyImage[] }
export interface SpotifyTrack { id: string; name: string; artists: SpotifyArtist[]; album: SpotifyAlbum }
export interface RecentlyPlayedItem { track: SpotifyTrack; played_at: string }
export interface QuizData { profile: SpotifyProfile; topArtists: SpotifyArtist[]; topTracks: SpotifyTrack[]; recentlyPlayed: RecentlyPlayedItem[] }
