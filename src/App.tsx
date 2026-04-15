import React, { useState, useEffect } from 'react';
import { Category, Song, MAX_ROUNDS } from './types';
import { fetchSongsByCategory, getRandomSongs, fetchDailyChallengeSongs } from './services/musicApi';
import Home from './components/Home';
import Game, { GameStats } from './components/Game';
import GameOver from './components/GameOver';
import Admin from './components/Admin';
import { Loader2, Settings, LogIn, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

type Screen = 'home' | 'loading' | 'game' | 'gameover' | 'admin';

const brutalVariants = {
  initial: { 
    opacity: 0, 
    scaleY: 0.01,
    scaleX: 1.5,
    filter: "contrast(300%) brightness(200%) hue-rotate(90deg) blur(10px)"
  },
  in: { 
    opacity: [0, 1, 1, 1], 
    scaleY: [0.01, 1.2, 0.9, 1],
    scaleX: [1.5, 0.9, 1.05, 1],
    x: ["-5vw", "3vw", "-1vw", "0vw"],
    skewX: ["30deg", "-15deg", "5deg", "0deg"],
    filter: [
      "contrast(300%) brightness(200%) hue-rotate(90deg) blur(10px)", 
      "contrast(200%) invert(100%) saturate(300%) blur(5px)", 
      "contrast(150%) hue-rotate(-90deg) blur(2px)", 
      "contrast(100%) brightness(100%) invert(0%) saturate(100%) blur(0px)"
    ],
    transition: { duration: 0.6, times: [0, 0.4, 0.7, 1], ease: "anticipate" as any }
  },
  out: { 
    opacity: [1, 1, 0], 
    scaleY: [1, 0.01, 0],
    scaleX: [1, 2, 3],
    filter: [
      "contrast(100%) brightness(100%) blur(0px)",
      "contrast(300%) brightness(300%) invert(100%) blur(5px)",
      "contrast(500%) brightness(500%) blur(20px)"
    ],
    transition: { duration: 0.3, times: [0, 0.6, 1], ease: "easeIn" as any }
  }
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [category, setCategory] = useState<Category>('Pop');
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [gameSongs, setGameSongs] = useState<Song[]>([]);
  const [sessionSongs, setSessionSongs] = useState<Song[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [isEndless, setIsEndless] = useState(false);
  const [isDailyChallenge, setIsDailyChallenge] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const startGame = async (selectedCategory: Category, endless: boolean = false) => {
    console.log('DEBUG: startGame called with category:', selectedCategory, 'endless:', endless);
    setCategory(selectedCategory);
    setIsEndless(endless);
    setIsDailyChallenge(selectedCategory === 'Daily');
    setScreen('loading');
    
    let songs: Song[] = [];
    let searchPool: Song[] = [];
    
    if (selectedCategory === 'Daily') {
      songs = await fetchDailyChallengeSongs();
      // For Daily Challenge, we need the full library for the search bar to prevent cheesing
      searchPool = await fetchSongsByCategory('Random');
    } else {
      songs = await fetchSongsByCategory(selectedCategory);
      searchPool = songs;
    }
    
    console.log('DEBUG: fetchSongs returned', songs.length, 'songs');
    
    if (songs.length === 0) {
      console.error('DEBUG: No songs found for category:', selectedCategory);
      alert('No songs found for this category. Please try another one.');
      setScreen('home');
      return;
    }

    if (songs.length < MAX_ROUNDS && !endless && selectedCategory !== 'Daily') {
      console.error('DEBUG: Not enough songs for category:', selectedCategory, 'Count:', songs.length);
      alert('Not enough songs found for this category. Please try another one.');
      setScreen('home');
      return;
    }

    setAllSongs(searchPool);
    const rounds = (endless || selectedCategory === 'Daily') ? songs.length : MAX_ROUNDS;
    console.log('DEBUG: Setting game songs with', rounds, 'rounds');
    setGameSongs(selectedCategory === 'Daily' ? songs : getRandomSongs(songs, rounds));
    setSessionSongs([]);
    setScreen('game');
  };

  const handleGameEnd = (score: number, stats: { timeSpent: number, totalGuesses: number, totalRounds: number, songs: Song[] }) => {
    setFinalScore(score);
    setSessionSongs(stats.songs);
    
    // Save stats to localStorage
    const existingStatsStr = localStorage.getItem(`stats_local`);
    let existingStats: GameStats = {
      gamesPlayed: 0,
      totalTime: 0,
      totalScore: 0,
      genreScores: {},
      bestScore: 0,
      totalGuesses: 0,
      totalRounds: 0
    };
    if (existingStatsStr) {
      try {
        existingStats = JSON.parse(existingStatsStr);
      } catch (err) {
        console.error('Failed to parse existing stats', err);
      }
    }

    existingStats.gamesPlayed += 1;
    existingStats.totalTime += stats.timeSpent;
    existingStats.totalScore += score;
    existingStats.totalGuesses += stats.totalGuesses;
    existingStats.totalRounds += stats.totalRounds;
    
    if (score > existingStats.bestScore) {
      existingStats.bestScore = score;
    }

    if (isDailyChallenge) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`daily_completed_${today}`, 'true');
    }

    const catKey = isEndless ? 'Endless' : (isDailyChallenge ? 'Daily' : category);
    existingStats.genreScores[catKey] = (existingStats.genreScores[catKey] || 0) + score;

    localStorage.setItem(`stats_local`, JSON.stringify(existingStats));

    setScreen('gameover');
  };

  const handleQuit = () => {
    setScreen('home');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-black font-sans text-text-main selection:bg-primary/30 selection:text-text-main flex flex-col">
      <header className="bg-bg-black border-b-2 border-white/10 py-3 sm:py-4 px-4 sm:px-6 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div 
            className="text-2xl sm:text-3xl font-display tracking-widest uppercase cursor-pointer flex items-center gap-3 hover:text-primary transition-colors"
            onClick={() => setScreen('home')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary flex items-center justify-center brutal-shadow">
              <span className="text-black text-sm sm:text-base font-display">bge</span>
            </div>
            <span className="glitch-text" data-text="beatguesserr">beat<span className="text-primary">guesserr</span></span>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">
            {user ? (
              <>
                <div className="text-sm text-text-muted hidden sm:block">
                  {user.email}
                </div>
                <button 
                  onClick={logout}
                  className="flex items-center gap-2 p-1.5 sm:p-2 text-text-muted hover:text-primary transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                {(user.email === 'ninjupyt@yahoo.com' || user.email === 'admin@example.com') && (
                  <button 
                    onClick={() => setScreen(screen === 'admin' ? 'home' : 'admin')}
                    className="p-1.5 sm:p-2 text-text-muted hover:text-primary transition-colors"
                    title="Admin Panel"
                  >
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
              </>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="flex items-center gap-2 p-1.5 sm:p-2 text-text-muted hover:text-primary transition-colors"
                title="Login"
              >
                <LogIn className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {/* Ambient background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated/30 to-bg-black pointer-events-none" />
        
        <div className="relative z-10 flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {screen === 'home' && (
              <motion.div key="home" variants={brutalVariants} initial="initial" animate="in" exit="out" className="flex-1 flex flex-col">
                <Home onStartGame={startGame} />
              </motion.div>
            )}
            
            {screen === 'loading' && (
              <motion.div key="loading" variants={brutalVariants} initial="initial" animate="in" exit="out" className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium text-text-main">Loading tracks...</p>
                <p className="text-sm text-text-muted mt-2">This might take a few seconds if building the library for the first time.</p>
              </motion.div>
            )}

            {screen === 'game' && (
              <motion.div key="game" variants={brutalVariants} initial="initial" animate="in" exit="out" className="flex-1 flex flex-col">
                <Game 
                  category={category} 
                  songs={gameSongs} 
                  allSongs={allSongs} 
                  isEndless={isEndless}
                  onGameEnd={handleGameEnd}
                  onQuit={handleQuit}
                />
              </motion.div>
            )}

            {screen === 'gameover' && (
              <motion.div key="gameover" variants={brutalVariants} initial="initial" animate="in" exit="out" className="flex-1 flex flex-col">
                <GameOver 
                  score={finalScore} 
                  category={isEndless ? 'Endless' : category} 
                  songs={sessionSongs}
                  onPlayAgain={() => startGame(category, isEndless)}
                  onHome={handleQuit}
                />
              </motion.div>
            )}

            {screen === 'admin' && (
              <motion.div key="admin" variants={brutalVariants} initial="initial" animate="in" exit="out" className="flex-1 flex flex-col">
                <Admin />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
