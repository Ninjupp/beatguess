export interface Song {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string;
  category: string;
  scUsername?: string;
  itunesPreviewUrl?: string;
  startTime?: number;
}

export type Category = 'Pop' | 'Rock' | 'Hip Hop' | 'Country' | 'Random' | 'Endless' | 'Daily';

export const ATTEMPT_DURATIONS = [0.5, 1.0, 2.0, 4.0, 8.0];
export const ATTEMPT_SCORES = [1000, 500, 250, 125, 62];
export const MAX_ROUNDS = 5;
