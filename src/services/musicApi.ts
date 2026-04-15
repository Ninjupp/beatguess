import { Category, Song } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function fetchSongsByCategory(category: Category): Promise<Song[]> {
  try {
    let q;
    if (category === 'Random') {
      q = query(collection(db, 'songs'));
    } else {
      q = query(collection(db, 'songs'), where('category', '==', category));
    }
    
    const querySnapshot = await getDocs(q);
    const songs: Song[] = [];
    querySnapshot.forEach((doc) => {
      songs.push(doc.data() as Song);
    });

    if (songs.length === 0) return [];

    const filtered = songs.filter((track: Song) => {
      const title = track.title.toLowerCase();
      const artist = track.artist.toLowerCase();
      
      // Filter out non-original or live versions
      const isLive = title.includes('live') || title.includes('concert');
      const isRemix = title.includes('remix') || title.includes('mix');
      const isKaraoke = title.includes('karaoke') || artist.includes('karaoke');
      const isTribute = title.includes('tribute') || artist.includes('tribute');
      const isCover = title.includes('cover') || artist.includes('cover');
      const isInstrumental = title.includes('instrumental');
      
      return !isLive && !isRemix && !isKaraoke && !isTribute && !isCover && !isInstrumental;
    });

    // Remove duplicates based on title and artist
    const uniqueSongs = Array.from(new Map(filtered.map(s => [`${s.title}-${s.artist}`, s])).values());
    
    return uniqueSongs;
  } catch (error) {
    console.error('Error fetching songs from Firestore:', error);
    return [];
  }
}

export async function fetchDailyChallengeSongs(): Promise<Song[]> {
  const categories: Category[] = ['Pop', 'Rock', 'Hip Hop', 'Country', 'Random'];
  const dailySongs: Song[] = [];
  
  // Use current date as seed (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];
  // Simple hash of the date string
  let seed = 0;
  for (let i = 0; i < today.length; i++) {
    seed = ((seed << 5) - seed) + today.charCodeAt(i);
    seed |= 0; // Convert to 32bit integer
  }
  seed = Math.abs(seed);

  for (const cat of categories) {
    const songs = await fetchSongsByCategory(cat);
    if (songs.length > 0) {
      // Deterministic pick based on date seed
      // Sort by ID to ensure stable order across all clients
      const sorted = songs.sort((a, b) => a.id.localeCompare(b.id));
      const index = seed % sorted.length;
      dailySongs.push(sorted[index]);
    }
  }
  
  return dailySongs;
}

export function getRandomSongs(songs: Song[], count: number): Song[] {
  const shuffled = [...songs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
