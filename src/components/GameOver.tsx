import React, { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Home as HomeIcon, Send, Loader2, User, ChevronDown, ChevronUp, Music } from 'lucide-react';
import ParticleEffect from './ParticleEffect';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Song } from '../types';

interface GameOverProps {
  score: number;
  category: string;
  songs: Song[];
  onPlayAgain: () => void;
  onHome: () => void;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  timestamp: any;
  songs?: Song[];
}

export default function GameOver({ score, category, songs, onPlayAgain, onHome }: GameOverProps) {
  const [showParticles, setShowParticles] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    // Show particles on mount
    setShowParticles(true);
    const timer = setTimeout(() => setShowParticles(false), 3000);
    fetchLeaderboard();
    return () => clearTimeout(timer);
  }, [category]);

  const fetchLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const q = query(
        collection(db, 'leaderboards'),
        where('category', '==', category),
        orderBy('score', 'desc'),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as LeaderboardEntry);
      });
      setLeaderboard(entries);
    } catch (err) {
      console.error('Failed to fetch leaderboard', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const submitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting || hasSubmitted) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leaderboards'), {
        name: name.trim(),
        score: score,
        category: category,
        timestamp: serverTimestamp(),
        songs: songs.map(s => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          artworkUrl: s.artworkUrl
        }))
      });
      setHasSubmitted(true);
      fetchLeaderboard();
    } catch (err) {
      console.error('Failed to submit score', err);
      alert('Failed to submit score. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedEntry(expandedEntry === id ? null : id);
  };

  const particleCount = Math.min(250, Math.max(40, Math.floor(score / 10)));

  return (
    <div className="max-w-2xl mx-auto w-full px-6 py-8 sm:py-16 text-center relative flex flex-col items-center">
      <ParticleEffect active={showParticles} count={particleCount} />
      
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 sm:w-28 sm:h-28 bg-black border-4 border-primary rounded-none flex items-center justify-center mb-6 brutal-shadow relative overflow-hidden">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#10b981_5px,#10b981_10px)] opacity-20" />
          <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-primary relative z-10" />
        </div>
        
        <h2 className="text-4xl sm:text-7xl font-display uppercase tracking-widest text-white mb-2 glitch-text" data-text="Game Over">Game Over</h2>
        <p className="text-text-muted font-mono uppercase tracking-widest text-xs sm:text-lg bg-black border-2 border-white/10 p-3 sm:p-4 inline-block">
          You scored <span className="font-display text-primary text-xl sm:text-4xl mx-2">{score}</span> points in {category}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full items-start">
        {/* Leaderboard Section */}
        <div className="bg-black border-4 border-white/20 p-6 brutal-shadow w-full flex flex-col">
          <h3 className="text-xl font-display uppercase tracking-widest text-white mb-6 flex items-center gap-2 border-b-4 border-primary pb-2">
            <Trophy className="w-5 h-5 text-primary" />
            {category} Top 10
          </h3>
          
          {isLoadingLeaderboard ? (
            <div className="py-10 flex flex-col items-center justify-center text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
              <span className="text-xs font-mono uppercase tracking-widest">Loading...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-10 text-center text-text-muted font-mono uppercase tracking-widest text-xs">
              No scores yet. Be the first!
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={entry.id} className="flex flex-col">
                  <button 
                    onClick={() => toggleExpand(entry.id)}
                    className={`flex items-center justify-between p-2 border-2 ${index === 0 ? 'border-primary bg-primary/5' : 'border-white/10'} font-mono uppercase tracking-widest text-xs hover:bg-white/5 transition-colors w-full text-left`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center ${index === 0 ? 'bg-primary text-black' : 'bg-white/10 text-white'} font-bold`}>
                        {index + 1}
                      </span>
                      <span className="text-white truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">{entry.score}</span>
                      {entry.songs && entry.songs.length > 0 && (
                        expandedEntry === entry.id ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                  </button>
                  
                  {expandedEntry === entry.id && entry.songs && entry.songs.length > 0 && (
                    <div className="bg-white/5 border-x-2 border-b-2 border-white/10 p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2 text-[10px] text-text-muted mb-2 border-b border-white/10 pb-1">
                        <Music className="w-3 h-3" />
                        <span>Songs in this session</span>
                      </div>
                      {entry.songs.map((song, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 text-[10px] text-left">
                          <img src={song.artworkUrl} alt="" className="w-6 h-6 border border-white/20" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white truncate font-bold uppercase">{song.title}</p>
                            <p className="text-text-muted truncate uppercase">{song.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions & Submit Section */}
        <div className="flex flex-col gap-6 w-full">
          {!hasSubmitted && score > 0 && (
            <div className="bg-black border-4 border-primary p-6 brutal-shadow">
              <h3 className="text-lg font-display uppercase tracking-widest text-white mb-4 text-left">Submit Score</h3>
              <form onSubmit={submitScore} className="flex flex-col gap-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 20))}
                    placeholder="Your Name..."
                    className="w-full bg-black border-4 border-white/20 rounded-none pl-10 pr-4 py-3 text-white placeholder-text-muted focus:outline-none focus:border-primary transition-colors font-mono uppercase tracking-widest text-sm"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-black border-4 border-primary font-display uppercase tracking-widest hover:bg-black hover:text-primary transition-all brutal-shadow-hover disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {isSubmitting ? 'Submitting...' : 'Post Score'}
                </button>
              </form>
            </div>
          )}

          {hasSubmitted && (
            <div className="bg-primary/10 border-4 border-primary p-6 brutal-shadow animate-in zoom-in duration-300">
              <div className="flex items-center gap-3 text-primary mb-2">
                <Trophy className="w-6 h-6" />
                <span className="font-display uppercase tracking-widest text-lg">Score Posted!</span>
              </div>
              <p className="text-xs font-mono text-white uppercase tracking-widest text-left">
                Your score has been added to the {category} leaderboard.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 mt-auto">
            <button
              onClick={onPlayAgain}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-black border-4 border-white font-display uppercase tracking-widest hover:bg-transparent hover:text-white transition-all brutal-shadow-hover"
            >
              <RotateCcw className="w-5 h-5" />
              Play Again
            </button>
            <button
              onClick={onHome}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white border-4 border-white/30 font-display uppercase tracking-widest hover:border-white hover:bg-white/5 transition-all brutal-shadow-hover"
            >
              <HomeIcon className="w-5 h-5" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
