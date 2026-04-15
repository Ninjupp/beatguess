import React, { useState, useEffect, useRef } from 'react';
import { Category, Song, ATTEMPT_DURATIONS, ATTEMPT_SCORES, MAX_ROUNDS } from '../types';
import AudioPlayer from './AudioPlayer';
import SearchBar from './SearchBar';
import ParticleEffect from './ParticleEffect';
import { motion } from 'framer-motion';
import { SkipForward, CheckCircle2, XCircle, ArrowRight, Heart, X } from 'lucide-react';

export interface GameStats {
  gamesPlayed: number;
  totalTime: number;
  totalScore: number;
  genreScores: Record<string, number>;
  bestScore: number;
  totalGuesses: number;
  totalRounds: number;
}

export interface GameProps {
  category: Category;
  songs: Song[];
  allSongs: Song[];
  isEndless?: boolean;
  onGameEnd: (score: number, stats: { timeSpent: number, totalGuesses: number, totalRounds: number, songs: Song[] }) => void;
  onQuit: () => void;
}

export default function Game({ category, songs, allSongs, isEndless, onGameEnd, onQuit }: GameProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [roundStatus, setRoundStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [attemptStatuses, setAttemptStatuses] = useState<('incorrect' | 'artist_correct' | 'skipped')[]>([]);
  const [firstPlayTime, setFirstPlayTime] = useState<number | null>(null);
  const [roundTimeScore, setRoundTimeScore] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [gameStartTime] = useState(Date.now());
  const [totalGuesses, setTotalGuesses] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const [muteReveal, setMuteReveal] = useState(() => {
    return localStorage.getItem('mute_reveal') === 'true';
  });
  const [playedSongs, setPlayedSongs] = useState<Song[]>([]);

  const currentSong = songs[currentRound];
  const currentDuration = ATTEMPT_DURATIONS[attempt];

  useEffect(() => {
    localStorage.setItem('mute_reveal', muteReveal.toString());
  }, [muteReveal]);

  useEffect(() => {
    setPlaybackProgress(0);
  }, [attempt, currentRound]);

  useEffect(() => {
    if (roundStatus !== 'playing' && !playedSongs.find(s => s.id === currentSong.id)) {
      setPlayedSongs(prev => [...prev, currentSong]);
    }
  }, [roundStatus, currentSong, playedSongs]);

  const handleGuess = (guessedSong: Song) => {
    if (roundStatus !== 'playing') return;

    const isCorrect = guessedSong.id === currentSong.id;
    const isArtistCorrect = guessedSong.artist === currentSong.artist;
    
    setTotalGuesses(prev => prev + 1);

    if (isCorrect) {
      let calculatedTimeScore = 0;
      if (firstPlayTime) {
        const elapsed = Date.now() - firstPlayTime;
        if (elapsed <= 3000) {
          calculatedTimeScore = 500;
        } else if (elapsed >= 60000) {
          calculatedTimeScore = 0;
        } else {
          calculatedTimeScore = Math.round(500 * (1 - (elapsed - 3000) / 57000));
        }
      } else {
        calculatedTimeScore = 500;
      }
      
      setRoundTimeScore(calculatedTimeScore);
      setScore(score + ATTEMPT_SCORES[attempt] + calculatedTimeScore);
      setRoundStatus('won');
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 2000);
    } else {
      handleIncorrect(isArtistCorrect ? 'artist_correct' : 'incorrect');
    }
  };

  const handleSkip = () => {
    if (roundStatus !== 'playing') return;
    setTotalGuesses(prev => prev + 1);
    handleIncorrect('skipped');
  };

  const handleIncorrect = (status: 'incorrect' | 'artist_correct' | 'skipped' = 'incorrect') => {
    setAttemptStatuses(prev => [...prev, status]);
    if (attempt < ATTEMPT_DURATIONS.length - 1) {
      setAttempt(attempt + 1);
    } else {
      setRoundStatus('lost');
      if (isEndless) {
        setLives(prev => prev - 1);
      }
    }
  };

  const nextRound = () => {
    if (isEndless) {
      if (lives > 0 && currentRound < songs.length - 1) {
        setCurrentRound(currentRound + 1);
        setAttempt(0);
        setAttemptStatuses([]);
        setRoundStatus('playing');
        setFirstPlayTime(null);
        setRoundTimeScore(0);
      } else {
        const timeSpent = Date.now() - gameStartTime;
        onGameEnd(score, { timeSpent, totalGuesses, totalRounds: currentRound + 1, songs: playedSongs });
      }
    } else {
      if (currentRound < songs.length - 1) {
        setCurrentRound(currentRound + 1);
        setAttempt(0);
        setAttemptStatuses([]);
        setRoundStatus('playing');
        setFirstPlayTime(null);
        setRoundTimeScore(0);
      } else {
        const timeSpent = Date.now() - gameStartTime;
        onGameEnd(score, { timeSpent, totalGuesses, totalRounds: currentRound + 1, songs: playedSongs });
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-3 sm:py-8 flex flex-col flex-1 min-h-0 relative">
      <ParticleEffect active={showParticles} />
      <div className="flex items-start justify-between mb-4 sm:mb-8 shrink-0 border-b-2 border-white/10 pb-4">
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs font-mono text-text-muted uppercase tracking-widest">Category</span>
          <h2 className="text-lg sm:text-2xl font-display tracking-widest uppercase text-white truncate max-w-[100px] sm:max-w-[200px]">
            {isEndless ? 'Endless' : category}
          </h2>
        </div>
        <div className="text-center">
          <span className="text-[10px] sm:text-xs font-mono text-text-muted uppercase tracking-widest">Round</span>
          <div className="text-2xl sm:text-4xl font-display tracking-widest text-white leading-none mt-1">{currentRound + 1} {!isEndless && <span className="text-text-muted text-lg sm:text-2xl">/ {songs.length}</span>}</div>
        </div>
        {isEndless && (
          <div className="text-center hidden sm:block">
            <span className="text-[10px] sm:text-xs font-mono text-text-muted uppercase tracking-widest">Lives</span>
            <div className="flex items-center justify-center gap-2 mt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-3 h-6 sm:w-4 sm:h-8 ${i < lives ? 'bg-primary' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        )}
        <div className="text-right">
          <span className="text-[10px] sm:text-xs font-mono text-text-muted uppercase tracking-widest">Score</span>
          <div className="text-2xl sm:text-4xl font-display tracking-widest text-primary leading-none mt-1">{score}</div>
        </div>
        <button 
          onClick={onQuit} 
          className="ml-4 p-2 text-text-muted hover:text-primary transition-colors border-2 border-transparent hover:border-primary"
          title="Abort"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {isEndless && (
        <div className="flex items-center justify-center gap-2 mb-4 sm:hidden shrink-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`w-3 h-6 ${i < lives ? 'bg-primary' : 'bg-white/10'}`} />
          ))}
        </div>
      )}

      <div className="bg-black border-4 border-white/20 p-4 sm:p-8 mb-4 sm:mb-8 flex-1 flex flex-col justify-center min-h-0 overflow-y-auto brutal-shadow relative">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {roundStatus === 'playing' ? (
          <div className="flex flex-col h-full justify-center max-w-md mx-auto w-full relative z-10">
            <div className="mb-6 sm:mb-10 shrink-0">
              <AudioPlayer 
                url={currentSong.previewUrl} 
                duration={currentDuration} 
                autoPlay={false}
                startTime={currentSong.startTime}
                onPlayStart={() => {
                  if (!firstPlayTime) {
                    setFirstPlayTime(Date.now());
                  }
                }}
                onProgress={(p) => setPlaybackProgress(p)}
              />
            </div>
            
            <div className="mb-6 sm:mb-8 shrink-0">
              <div className="flex justify-between text-xs sm:text-sm font-mono uppercase tracking-widest text-text-muted mb-2 sm:mb-3">
                <span>Attempt {attempt + 1} of 5</span>
                <span>Potential: <span className="text-primary">{ATTEMPT_SCORES[attempt]}</span></span>
              </div>
              <div className="flex gap-1 sm:gap-2 h-4 sm:h-5 items-center">
                {ATTEMPT_DURATIONS.map((_, i) => {
                  let barColorClass = 'bg-white/10 border-2 border-transparent';
                  if (i < attempt) {
                    const status = attemptStatuses[i];
                    if (status === 'artist_correct') {
                      barColorClass = 'bg-yellow-500 border-2 border-yellow-400';
                    } else {
                      barColorClass = 'bg-red-500 border-2 border-red-400';
                    }
                  } else if (i === attempt) {
                    barColorClass = 'bg-black border-2 border-primary';
                  }

                  return (
                  <div 
                    key={i} 
                    className={`flex-1 h-full transition-all duration-300 relative overflow-hidden ${barColorClass}`}
                  >
                    {i === attempt && (
                      <div 
                        className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#10b981_5px,#10b981_10px)] transition-all duration-100 ease-linear"
                        style={{ width: `${playbackProgress * 100}%` }}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6 shrink-0">
              <SearchBar songs={allSongs} onGuess={handleGuess} disabled={roundStatus !== 'playing'} />
              
              <div className="flex justify-center">
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base text-text-muted font-mono uppercase tracking-widest hover:text-primary hover:bg-white/5 border-4 border-transparent hover:border-primary transition-colors brutal-shadow-hover bg-black"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  Skip (+{(attempt < 4 ? ATTEMPT_DURATIONS[attempt + 1] : ATTEMPT_DURATIONS[4]).toFixed(1)}s)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full justify-center relative z-10">
            <div className="flex flex-row items-center justify-center gap-4 sm:gap-10 mb-4 sm:mb-6 w-full max-w-2xl mx-auto">
              {/* Left: Album Art */}
              <div className="relative w-24 h-24 sm:w-48 sm:h-48 shrink-0 overflow-hidden border-2 sm:border-4 border-white/20 brutal-shadow">
                <img src={currentSong.artworkUrl} alt="Album Art" className="w-full h-full object-cover grayscale contrast-150 hover:grayscale-0 hover:contrast-100 transition-all" />
                <div className="absolute inset-0 bg-primary/20 mix-blend-overlay hover:bg-transparent transition-colors" />
              </div>
              
              {/* Right: Info */}
              <div className="flex flex-col justify-center items-start text-left flex-1 min-w-0">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-2"
                >
                  {roundStatus === 'won' ? (
                    <CheckCircle2 className="w-5 h-5 sm:w-8 sm:h-8 text-primary shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 sm:w-8 sm:h-8 text-red-500 shrink-0" />
                  )}
                  <h3 className={`text-2xl sm:text-5xl font-display uppercase tracking-widest truncate ${roundStatus === 'won' ? 'text-primary glitch-text' : 'text-red-500 glitch-text'}`} data-text={roundStatus === 'won' ? 'Correct' : 'Failed'}>
                    {roundStatus === 'won' ? 'Correct' : 'Failed'}
                  </h3>
                </motion.div>
                
                <div className="bg-black border-2 border-white/10 p-2 sm:p-4 mt-1 sm:mt-2 brutal-shadow w-full">
                  <p className="text-lg sm:text-3xl font-display uppercase tracking-wider text-white truncate">{currentSong.title}</p>
                  <p className="text-xs sm:text-xl font-mono uppercase tracking-widest text-text-muted truncate mt-0.5 sm:mt-1">{currentSong.artist}</p>
                </div>
              </div>
            </div>
            
            {roundStatus === 'won' && (
              <div className="mb-4 sm:mb-6 flex flex-col items-center gap-1 bg-black border-2 sm:border-4 border-primary p-2 sm:p-4 brutal-shadow max-w-md mx-auto w-full">
                <p className="text-[9px] sm:text-xs font-mono text-text-muted uppercase tracking-widest">Points Earned</p>
                <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-lg font-mono uppercase">
                  <span className="text-white">Guess: <span className="text-primary">+{ATTEMPT_SCORES[attempt]}</span></span>
                  <span className="text-white/30">•</span>
                  <span className="text-white">Time: <span className="text-primary">+{roundTimeScore}</span></span>
                </div>
                <p className="text-xl sm:text-4xl font-display text-primary mt-0.5 sm:mt-2 tracking-widest">+{ATTEMPT_SCORES[attempt] + roundTimeScore}</p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-2">
              <div className="shrink-0 w-full sm:w-auto flex flex-col items-center justify-center gap-2">
                <AudioPlayer 
                  url={currentSong.itunesPreviewUrl || currentSong.previewUrl} 
                  duration={30} 
                  autoPlay={!muteReveal}
                  compact={true}
                  startTime={currentSong.startTime}
                />
                <label className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-text-muted cursor-pointer hover:text-white transition-colors mt-2">
                  <input 
                    type="checkbox" 
                    checked={muteReveal} 
                    onChange={(e) => setMuteReveal(e.target.checked)}
                    className="accent-primary w-3 h-3 sm:w-4 sm:h-4"
                  />
                  Mute Auto-play (Creators)
                </label>
              </div>

              <button
                onClick={nextRound}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:px-10 sm:py-4 bg-primary text-black text-sm sm:text-base font-display uppercase tracking-widest hover:bg-transparent hover:text-primary border-2 sm:border-4 border-primary transition-all shrink-0 brutal-shadow-hover"
              >
                {isEndless ? (lives > 0 && currentRound < songs.length - 1 ? 'Next Round' : 'Finish Game') : (currentRound < songs.length - 1 ? 'Next Round' : 'Finish Game')}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
