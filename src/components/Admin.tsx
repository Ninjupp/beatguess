import React, { useState, useEffect, useRef } from 'react';
import { Category, Song } from '../types';
import { 
  RefreshCw, 
  Loader2, 
  Trash2, 
  Plus, 
  ListPlus, 
  Play, 
  Square, 
  Volume2, 
  Shuffle, 
  Search, 
  Library, 
  CheckSquare,
  Trophy,
  ChevronDown,
  ChevronUp,
  Calendar,
  Music,
  Edit2,
  Save,
  X
} from 'lucide-react';
import Hls from 'hls.js';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  writeBatch, 
  deleteField,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';

function AdminAudioPlayer({ url, volume, startTime }: { url: string, volume: number, startTime?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setIsLoading(false);
    setError(null);
    setProgress(0);
    setDuration(0);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [url]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = async (retryCount = 0) => {
    if (!url) {
      setError('No audio URL available');
      return;
    }

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      if (!audioRef.current.getAttribute('src') && !hlsRef.current) {
        if (url.includes('apple.com') || url.includes('.m4a') || url.includes('.mp3') || !url.startsWith('/api/')) {
          const loadPromise = new Promise((resolve, reject) => {
            const onLoaded = () => {
              audioRef.current?.removeEventListener('error', onError);
              resolve(null);
            };
            const onError = () => {
              audioRef.current?.removeEventListener('loadedmetadata', onLoaded);
              reject(new Error('Failed to load audio'));
            };
            audioRef.current?.addEventListener('loadedmetadata', onLoaded, { once: true });
            audioRef.current?.addEventListener('error', onError, { once: true });
          });
          audioRef.current.src = url;
          audioRef.current.load();
          await loadPromise;
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch stream: ${res.status}`);
          const data = await res.json();

          if (data.protocol === 'hls') {
            if (Hls.isSupported()) {
              const hls = new Hls({
                manifestLoadingMaxRetry: 4,
                levelLoadingMaxRetry: 4,
              });
              hlsRef.current = hls;
              hls.attachMedia(audioRef.current);
              
              await new Promise((resolve, reject) => {
                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                  hls.loadSource(data.url);
                });
                hls.on(Hls.Events.MANIFEST_PARSED, resolve);
                hls.on(Hls.Events.ERROR, (e, data) => {
                  if (data.fatal) {
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                      default:
                        reject(new Error('HLS Fatal Error'));
                        break;
                    }
                  }
                });
              });
            } else if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
              const loadPromise = new Promise((resolve, reject) => {
                const onLoaded = () => {
                  audioRef.current?.removeEventListener('error', onError);
                  resolve(null);
                };
                const onError = () => {
                  audioRef.current?.removeEventListener('loadedmetadata', onLoaded);
                  reject(new Error('Failed to load HLS audio'));
                };
                audioRef.current?.addEventListener('loadedmetadata', onLoaded, { once: true });
                audioRef.current?.addEventListener('error', onError, { once: true });
              });
              audioRef.current.src = data.url;
              await loadPromise;
            } else {
              throw new Error('HLS not supported');
            }
          } else {
            const loadPromise = new Promise((resolve, reject) => {
              const onLoaded = () => {
                audioRef.current?.removeEventListener('error', onError);
                resolve(null);
              };
              const onError = () => {
                audioRef.current?.removeEventListener('loadedmetadata', onLoaded);
                reject(new Error('Failed to load audio'));
              };
              audioRef.current?.addEventListener('loadedmetadata', onLoaded, { once: true });
              audioRef.current?.addEventListener('error', onError, { once: true });
            });
            audioRef.current.src = data.url;
            audioRef.current.load();
            await loadPromise;
          }
        }
      }

      if (startTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = startTime;
      }

      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err: any) {
      console.error(`Playback error (attempt ${retryCount + 1}):`, err);
      
      if (retryCount < 2) {
        const delay = 1000 * (retryCount + 1);
        console.log(`Retrying playback in ${delay}ms...`);
        setTimeout(() => togglePlay(retryCount + 1), delay);
        return;
      }

      setError('Failed to play');
      if (audioRef.current) {
        audioRef.current.removeAttribute('src');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      <div className="flex items-center gap-2 ml-auto justify-end">
        <audio 
          ref={audioRef} 
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
        />
        {error ? (
          <span className="text-xs text-red-500">{error}</span>
        ) : null}
        <button
          onClick={() => togglePlay()}
          disabled={isLoading}
          className="p-2 bg-primary text-black rounded-none border-2 border-primary hover:bg-black hover:text-primary transition-colors disabled:opacity-50 brutal-shadow-hover"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Square className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>
      {(isPlaying || progress > 0) && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{formatTime(progress)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
            className="flex-1 h-2 bg-black border-2 border-white/20 rounded-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black cursor-pointer"
          />
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}

const CATEGORIES: Category[] = ['Pop', 'Rock', 'Hip Hop', 'Country', 'Random'];

export default function Admin() {
  console.log('DEBUG: Admin component rendered');
  const [activeCategory, setActiveCategory] = useState<Category | 'Leaderboards'>('Pop');
  const [songs, setSongs] = useState<Song[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newSongUrl, setNewSongUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [batchUrls, setBatchUrls] = useState('');
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'artist'>('default');
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('audio_volume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });

  useEffect(() => {
    localStorage.setItem('audio_volume', volume.toString());
  }, [volume]);
  
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  
  // New Admin Features state
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchLibrary = async (category: Category) => {
    setIsLoading(true);
    try {
      let q;
      if (category === 'Random') {
        q = query(collection(db, 'songs'));
      } else {
        q = query(collection(db, 'songs'), where('category', '==', category));
      }
      const querySnapshot = await getDocs(q);
      const data: Song[] = [];
      querySnapshot.forEach((doc) => {
        data.push(doc.data() as Song);
      });
      setSongs(data);
    } catch (err) {
      console.error('Failed to fetch library', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSong = async (songId: string) => {
    try {
      await deleteDoc(doc(db, 'songs', songId));
      setSongs(songs.filter(s => s.id !== songId));
    } catch (err) {
      console.error('Failed to delete song', err);
    }
  };

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongUrl.trim()) return;
    
    setIsAdding(true);
    try {
      const res = await fetch('/api/songs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newSongUrl, category: activeCategory })
      });
      
      if (!res.ok) {
        let err;
        try { err = await res.json(); } catch (e) { err = { error: 'Failed to add song' }; }
        alert(err.error || 'Failed to add song');
        return;
      }
      
      const newSong = await res.json();
      await setDoc(doc(db, 'songs', newSong.id), newSong);
      setSongs([newSong, ...songs.filter(s => s.id !== newSong.id)]);
      setNewSongUrl('');
    } catch (err) {
      console.error('Failed to add song', err);
      alert('Failed to add song');
    } finally {
      setIsAdding(false);
    }
  };

  const batchAddSongs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchUrls.trim()) return;
    
    setIsBatchAdding(true);
    try {
      const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
      
      const res = await fetch('/api/songs/batch-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, category: activeCategory })
      });
      
      if (!res.ok) {
        let err;
        try { err = await res.json(); } catch (e) { err = { error: 'Failed to batch add songs' }; }
        alert(err.error || 'Failed to batch add songs');
        return;
      }
      
      const data = await res.json();
      if (data.added && data.added.length > 0) {
        const batch = writeBatch(db);
        data.added.forEach((song: Song) => {
          batch.set(doc(db, 'songs', song.id), song);
        });
        await batch.commit();

        const newSongs = [...data.added, ...songs];
        // Deduplicate
        const unique = Array.from(new Map(newSongs.map(s => [s.id, s])).values());
        setSongs(unique);
        setBatchUrls('');
        alert(`Successfully added ${data.added.length} songs!`);
      } else {
        alert('No valid songs were added. Check the URLs.');
      }
    } catch (err) {
      console.error('Failed to batch add songs', err);
      alert('Failed to batch add songs');
    } finally {
      setIsBatchAdding(false);
    }
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongs(prev => 
      prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
    );
  };

  const bulkDeleteSongs = async () => {
    if (selectedSongs.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedSongs.length} songs?`)) return;

    try {
      const batch = writeBatch(db);
      selectedSongs.forEach(id => {
        batch.delete(doc(db, 'songs', id));
      });
      await batch.commit();
      setSongs(songs.filter(s => !selectedSongs.includes(s.id)));
      setSelectedSongs([]);
    } catch (err) {
      console.error('Failed to bulk delete', err);
    }
  };

  const saveSongEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;
    
    try {
      const updateData: any = {
        category: activeCategory,
        title: editingSong.title,
        artist: editingSong.artist,
        artworkUrl: editingSong.artworkUrl
      };

      if (editingSong.startTime !== undefined) {
        updateData.startTime = editingSong.startTime;
      } else {
        updateData.startTime = deleteField();
      }

      await updateDoc(doc(db, 'songs', editingSong.id), updateData);
      
      setSongs(songs.map(s => s.id === editingSong.id ? editingSong : s));
      setEditingSong(null);
    } catch (err) {
      console.error('Failed to edit song', err);
    }
  };

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'leaderboards'), orderBy('timestamp', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const entries: any[] = [];
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      setLeaderboardEntries(entries);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLeaderboardEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'leaderboards', id));
      setLeaderboardEntries(prev => prev.filter(entry => entry.id !== id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error deleting leaderboard entry:', error);
      alert('Failed to delete score');
    }
  };

  useEffect(() => {
    if (activeCategory === 'Leaderboards') {
      fetchLeaderboard();
    } else {
      fetchLibrary(activeCategory as Category);
    }
  }, [activeCategory]);

  const sortedSongs = [...songs]
    .filter(song => 
      song.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) || 
      song.artist.toLowerCase().includes(librarySearchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'artist') {
        return a.artist.localeCompare(b.artist);
      }
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-12 flex flex-col md:flex-row gap-8">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0">
        <div className="sticky top-8">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white tracking-tighter">Admin Panel</h1>
            <p className="text-text-muted mt-2 font-medium text-sm">Manage the song library.</p>
          </div>

          <div className="flex flex-col space-y-2">
            <div className="px-4 py-3 rounded-none font-mono uppercase tracking-widest transition-all border-4 flex items-center gap-3 bg-primary text-black border-primary">
              <Library className="w-5 h-5" /> Library Admin
            </div>
          </div>

          <div className="mt-8 pt-8 border-t-4 border-white/20">
            <div className="flex items-center gap-2 bg-black border-4 border-white/20 px-4 py-3 rounded-none brutal-shadow">
              <Volume2 className="w-5 h-5 text-text-muted" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
              {[...CATEGORIES, 'Leaderboards'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as any)}
                  className={`px-5 py-2 rounded-none border-4 font-display uppercase tracking-widest whitespace-nowrap transition-colors brutal-shadow-hover ${
                    activeCategory === cat 
                      ? 'bg-primary text-black border-primary' 
                      : 'bg-black text-white border-white/20 hover:border-primary hover:text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

      {activeCategory === 'Leaderboards' ? (
        <div className="space-y-6">
          <div className="bg-black p-6 rounded-none border-4 border-primary/30 brutal-shadow mb-8 flex items-center gap-4">
            <Trophy className="w-8 h-8 text-primary shrink-0" />
            <p className="text-text-muted font-mono uppercase tracking-widest text-xs">
              <span className="text-primary font-bold">Leaderboard Management:</span> View and manage player scores. Click an entry to see the songs played in that session.
            </p>
          </div>

          <div className="bg-black rounded-none border-4 border-white/20 brutal-shadow overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-white/10 bg-white/5">
                  <th className="p-5 font-display uppercase tracking-widest text-xs text-primary">Player</th>
                  <th className="p-5 font-display uppercase tracking-widest text-xs text-primary">Score</th>
                  <th className="p-5 font-display uppercase tracking-widest text-xs text-primary">Genre</th>
                  <th className="p-5 font-display uppercase tracking-widest text-xs text-primary">Date</th>
                  <th className="p-5 font-display uppercase tracking-widest text-xs text-primary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                      <p className="font-mono uppercase tracking-widest text-text-muted">Loading leaderboard...</p>
                    </td>
                  </tr>
                ) : leaderboardEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <p className="font-mono uppercase tracking-widest text-text-muted">No scores found.</p>
                    </td>
                  </tr>
                ) : (
                  leaderboardEntries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      <tr 
                        className={`group hover:bg-white/5 transition-colors cursor-pointer ${expandedEntry === entry.id ? 'bg-white/5' : ''}`}
                        onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                      >
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/10 flex items-center justify-center font-bold text-xs">
                              {entry.name.charAt(0)}
                            </div>
                            <span className="text-white font-mono uppercase tracking-widest text-sm font-bold">{entry.name}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className="text-primary font-display text-lg">{entry.score}</span>
                        </td>
                        <td className="p-5">
                          <span className="text-xs font-bold px-2 py-1 bg-white/10 rounded text-white uppercase tracking-wider">
                            {entry.category}
                          </span>
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-2 text-text-muted font-mono text-xs uppercase">
                            <Calendar className="w-3 h-3" />
                            {entry.timestamp instanceof Timestamp ? entry.timestamp.toDate().toLocaleDateString() : 'Recent'}
                          </div>
                        </td>
                        <td className="p-5 text-right">
                          {confirmDeleteId === entry.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteLeaderboardEntry(entry.id);
                                }}
                                className="px-3 py-1 bg-red-500 text-black text-[10px] font-bold uppercase tracking-widest border-2 border-red-500 hover:bg-black hover:text-red-500 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-3 py-1 bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest border-2 border-white/20 hover:bg-white/20 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(entry.id);
                              }}
                              className="p-2 text-text-muted hover:text-red-500 transition-colors"
                              title="Delete Score"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedEntry === entry.id && entry.songs && (
                        <tr>
                          <td colSpan={5} className="p-0 bg-white/5">
                            <div className="p-6 border-t-2 border-white/10 animate-in slide-in-from-top-2 duration-200">
                              <h4 className="text-xs font-display uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                                <Music className="w-4 h-4" />
                                Songs Played in this Session
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {entry.songs.map((song: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-3 bg-black/40 p-2 border border-white/10">
                                    <img src={song.artworkUrl} alt="" className="w-10 h-10 border border-white/20" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-[10px] font-bold uppercase truncate">{song.title}</p>
                                      <p className="text-text-muted text-[10px] uppercase truncate">{song.artist}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-black p-6 rounded-none border-4 border-white/20 brutal-shadow flex flex-col">
          <h2 className="text-xl font-display uppercase tracking-widest text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add Single Song to {activeCategory}
          </h2>
          <form onSubmit={addSong} className="flex gap-2 mt-auto">
            <input
              type="url"
              value={newSongUrl}
              onChange={(e) => setNewSongUrl(e.target.value)}
              placeholder="SoundCloud track URL..."
              className="flex-1 bg-black border-4 border-white/20 rounded-none px-4 py-3 text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors font-mono"
              required
            />
            <button
              type="submit"
              disabled={isAdding || !newSongUrl.trim()}
              className="px-6 py-3 bg-primary text-black rounded-none border-4 border-primary font-display uppercase tracking-widest hover:bg-black hover:text-primary disabled:opacity-50 transition-colors flex items-center justify-center min-w-[100px] brutal-shadow-hover"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add'}
            </button>
          </form>
        </div>

        <div className="bg-black p-6 rounded-none border-4 border-white/20 brutal-shadow flex flex-col">
          <h2 className="text-xl font-display uppercase tracking-widest text-white mb-4 flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-primary" />
            Batch Add to {activeCategory}
          </h2>
          <form onSubmit={batchAddSongs} className="flex flex-col gap-3">
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder="Paste multiple SoundCloud URLs here (one per line)..."
              className="w-full h-24 bg-black border-4 border-white/20 rounded-none px-4 py-3 text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors resize-none custom-scrollbar font-mono"
              required
            />
            <button
              type="submit"
              disabled={isBatchAdding || !batchUrls.trim()}
              className="w-full py-3 bg-primary text-black rounded-none border-4 border-primary font-display uppercase tracking-widest hover:bg-black hover:text-primary disabled:opacity-50 transition-colors flex items-center justify-center gap-2 brutal-shadow-hover"
            >
              {isBatchAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <ListPlus className="w-5 h-5" />}
              {isBatchAdding ? 'Processing Batch...' : 'Add All Songs'}
            </button>
          </form>
        </div>
      </div>

      {activeCategory === 'Random' && (
        <div className="bg-black p-6 rounded-none border-4 border-primary/30 brutal-shadow mb-8 flex items-center gap-4">
          <Shuffle className="w-8 h-8 text-primary shrink-0" />
          <p className="text-text-muted font-mono uppercase tracking-widest text-xs">
            <span className="text-primary font-bold">Note:</span> The Random category aggregates all songs from all genres. 
            You can also add miscellaneous songs directly to this category.
          </p>
        </div>
      )}

      <div className="bg-black rounded-none border-4 border-white/20 brutal-shadow overflow-hidden">
        <div className="p-6 border-b-4 border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-display uppercase tracking-widest text-white">Songs in {activeCategory}</h2>
            <span className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest bg-white/10 px-3 py-1 rounded-none border-2 border-white/20">
              Total: {sortedSongs.length}
            </span>
            {selectedSongs.length > 0 && (
              <button
                onClick={bulkDeleteSongs}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-500 rounded-none border-2 border-red-500 text-sm font-mono uppercase tracking-widest hover:bg-red-500 hover:text-black transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedSongs.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search songs..."
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                className="bg-black border-4 border-white/20 rounded-none pl-10 pr-4 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors w-full sm:w-64 font-mono uppercase tracking-widest"
              />
            </div>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'default' | 'artist')}
              className="bg-black border-4 border-white/20 rounded-none px-4 py-2 text-sm font-display uppercase tracking-widest text-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="default" className="text-black">Default Order</option>
              <option value="artist" className="text-black">Sort by Artist</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-text-muted">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p className="font-medium">Loading library...</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="p-16 text-center text-text-muted">
            <p className="mb-6 text-lg">No songs found in this library. Add some using the search above!</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-bold text-text-muted uppercase tracking-widest">
                  <th className="p-5 w-12">
                    <button 
                      onClick={() => {
                        if (selectedSongs.length === sortedSongs.length) {
                          setSelectedSongs([]);
                        } else {
                          setSelectedSongs(sortedSongs.map(s => s.id));
                        }
                      }}
                      className="text-text-muted hover:text-white transition-colors"
                    >
                      <CheckSquare className={`w-4 h-4 ${selectedSongs.length === sortedSongs.length ? 'text-primary' : ''}`} />
                    </button>
                  </th>
                  <th className="p-5 font-bold">#</th>
                  <th className="p-5 font-bold">Title</th>
                  {activeCategory === 'Random' && <th className="p-5 font-bold">Genre</th>}
                  <th className="p-5 font-bold">SoundCloud Source</th>
                  <th className="p-5 font-bold text-right">Preview</th>
                  <th className="p-5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedSongs.map((song, i) => (
                  <tr key={`${song.id}-${i}`} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5 w-12">
                      <button 
                        onClick={() => toggleSongSelection(song.id)}
                        className="text-text-muted hover:text-white transition-colors"
                      >
                        <CheckSquare className={`w-4 h-4 ${selectedSongs.includes(song.id) ? 'text-primary' : ''}`} />
                      </button>
                    </td>
                    <td className="p-5 w-16 text-text-muted font-medium text-center">
                      {i + 1}
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <img 
                          src={song.artworkUrl} 
                          alt={song.title} 
                          className="w-12 h-12 rounded-none bg-black object-cover border-2 border-white/20 grayscale hover:grayscale-0 transition-all"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1">
                          {editingSong?.id === song.id ? (
                            <form onSubmit={saveSongEdit} className="flex flex-col gap-2">
                              <input 
                                type="text" 
                                value={editingSong.title} 
                                onChange={e => setEditingSong({...editingSong, title: e.target.value})}
                                className="bg-white/10 border border-white/20 text-white px-2 py-1 rounded text-sm focus:outline-none focus:border-primary"
                                placeholder="Title"
                                autoFocus
                              />
                              <input 
                                type="text" 
                                value={editingSong.artist} 
                                onChange={e => setEditingSong({...editingSong, artist: e.target.value})}
                                className="bg-white/10 border border-white/20 text-white px-2 py-1 rounded text-sm focus:outline-none focus:border-primary"
                                placeholder="Artist"
                              />
                              <input 
                                type="number" 
                                value={editingSong.startTime !== undefined ? editingSong.startTime : ''} 
                                onChange={e => setEditingSong({...editingSong, startTime: e.target.value ? parseFloat(e.target.value) : undefined})}
                                className="bg-white/10 border border-white/20 text-white px-2 py-1 rounded text-sm focus:outline-none focus:border-primary"
                                placeholder="Start Time (seconds)"
                                step="0.1"
                                min="0"
                              />
                              <div className="flex gap-2 mt-1">
                                <button type="submit" className="text-xs bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded font-bold transition-colors">Save</button>
                                <button type="button" onClick={() => setEditingSong(null)} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded font-bold transition-colors">Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <div className="cursor-pointer group/text" onClick={() => setEditingSong(song)} title="Click to edit">
                              <div className="font-bold text-white group-hover/text:text-primary transition-colors max-w-[200px] sm:max-w-xs truncate">{song.title}</div>
                              <div className="text-sm text-text-muted flex items-center gap-1 mt-0.5 max-w-[200px] sm:max-w-xs truncate">
                                {song.artist}
                              </div>
                              {song.startTime !== undefined && (
                                <div className="text-xs text-primary/80 mt-0.5 font-medium">Start: {song.startTime}s</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {activeCategory === 'Random' && (
                      <td className="p-5">
                        <span className="text-xs font-bold px-2 py-1 bg-white/10 rounded text-white uppercase tracking-wider">
                          {song.category}
                        </span>
                      </td>
                    )}
                    <td className="p-5">
                      <div className="text-sm text-text-muted flex items-center gap-1.5">
                        {song.scUsername || 'Unknown'}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <AdminAudioPlayer url={song.previewUrl} volume={volume} startTime={song.startTime} />
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity">
                        <button 
                          onClick={() => deleteSong(song.id)}
                          className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-none border-2 border-transparent hover:border-red-500 transition-colors"
                          title="Remove song from library"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  </div>
  );
}
