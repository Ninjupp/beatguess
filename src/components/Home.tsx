import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { Music, Mic2, Guitar, Radio, Shuffle, Play, Headphones, Clock, CheckCircle, Calendar, Lock } from 'lucide-react';

interface HomeProps {
  onStartGame: (category: Category, isEndless?: boolean) => void;
}

const CATEGORY_CONFIG: Record<Exclude<Category, 'Endless' | 'Daily'>, { icon: React.ReactNode; color: string; fallbackImage: string; imageUrl: string }> = {
  'Pop': { 
    icon: <Mic2 />, 
    color: 'text-rose-400', 
    fallbackImage: 'https://picsum.photos/seed/pop-music/600/600',
    imageUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?q=80&w=800&auto=format&fit=crop'
  },
  'Rock': { 
    icon: <Guitar />, 
    color: 'text-red-400', 
    fallbackImage: 'https://picsum.photos/seed/rock-music/600/600',
    imageUrl: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?q=80&w=800&auto=format&fit=crop'
  },
  'Hip Hop': { 
    icon: <Radio />, 
    color: 'text-purple-400', 
    fallbackImage: 'https://picsum.photos/seed/rap-music/600/600',
    imageUrl: 'https://images.unsplash.com/photo-1571453663438-709695679e05?q=80&w=800&auto=format&fit=crop'
  },
  'Country': { 
    icon: <Music />, 
    color: 'text-amber-400', 
    fallbackImage: 'https://picsum.photos/seed/country-music/600/600',
    imageUrl: 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?q=80&w=800&auto=format&fit=crop'
  },
  'Random': { 
    icon: <Shuffle />, 
    color: 'text-indigo-400', 
    fallbackImage: 'https://picsum.photos/seed/random-music/600/600',
    imageUrl: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?q=80&w=800&auto=format&fit=crop'
  },
};

export default function Home({ onStartGame }: HomeProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [isDailyCompleted, setIsDailyCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const completed = localStorage.getItem(`daily_completed_${today}`) === 'true';
    setIsDailyCompleted(completed);

    if (completed) {
      const timer = setInterval(() => {
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        const diff = tomorrow.getTime() - now.getTime();
        
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, []);

  const handleImageError = (catId: string, url: string) => {
    setImageErrors(prev => ({ ...prev, [catId]: url }));
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-12">
      <div className="mb-12 sm:mb-20 relative">
        <h1 className="text-6xl sm:text-8xl md:text-9xl font-display text-white tracking-widest uppercase mb-4 leading-none glitch-text" data-text="beatguesserr">
          beat<br/><span className="text-primary">guesserr</span>
        </h1>
        <div className="w-full bg-primary text-black font-mono uppercase tracking-widest text-xs sm:text-sm py-2 mt-6 border-y-2 border-black transform -rotate-1 marquee-container">
          <div className="marquee-content">
            <span className="mx-4">BEATGUESSERR</span> • <span className="mx-4">MINIMUM AUDIO</span> • <span className="mx-4">MAXIMUM SPEED</span> • <span className="mx-4">IDENTIFY THE TRACK</span> • <span className="mx-4">BEATGUESSERR</span> • <span className="mx-4">MINIMUM AUDIO</span> • <span className="mx-4">MAXIMUM SPEED</span> • <span className="mx-4">IDENTIFY THE TRACK</span> •
          </div>
        </div>
      </div>

      <div className="pb-20 sm:pb-0">
        <div className="mb-16">
          <h2 className="text-3xl sm:text-4xl font-display tracking-widest uppercase text-white mb-6 sm:mb-8">Select a Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {(Object.keys(CATEGORY_CONFIG) as Category[]).map((catId) => {
                const config = CATEGORY_CONFIG[catId as Exclude<Category, 'Endless' | 'Daily'>];
                const targetUrl = config.imageUrl;
                const useFallback = imageErrors[catId] === targetUrl;
                const imageUrl = useFallback ? config.fallbackImage : targetUrl;
                
                return (
                  <button
                    key={catId}
                    onClick={() => onStartGame(catId)}
                    className="group relative bg-bg-black p-3 sm:p-4 transition-all duration-200 flex flex-col items-start text-left overflow-hidden border-4 border-white/20 hover:border-primary brutal-shadow-hover"
                  >
                    <div className="w-full aspect-square mb-3 sm:mb-4 relative overflow-hidden bg-bg-highlight border-2 border-transparent group-hover:border-primary transition-colors">
                      <img 
                        key={imageUrl}
                        src={imageUrl} 
                        alt={catId} 
                        className="w-full h-full object-cover grayscale contrast-150 brightness-75 group-hover:grayscale-0 group-hover:contrast-100 group-hover:brightness-100 transition-all duration-500 mix-blend-luminosity"
                        onError={() => handleImageError(catId, targetUrl)}
                        loading="eager"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-primary/20 mix-blend-overlay group-hover:bg-transparent transition-colors" />
                      
                      {/* Icon overlay */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 opacity-100 bg-black p-1 border-2 border-white/20 group-hover:border-primary group-hover:text-primary transition-colors">
                        <div className="text-white group-hover:text-primary w-6 h-6 sm:w-8 sm:h-8">
                          {config.icon as React.ReactNode}
                        </div>
                      </div>
                      
                      {/* Play button overlay */}
                      <div className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 w-10 h-10 sm:w-12 sm:h-12 bg-primary flex items-center justify-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 brutal-shadow border-2 border-black">
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 text-black fill-black ml-1" />
                      </div>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-display tracking-wider uppercase text-white truncate w-full group-hover:text-primary transition-colors">{catId}</h3>
                    <p className="text-xs sm:text-sm font-mono text-text-muted mt-1 uppercase group-hover:text-white transition-colors">Select</p>
                  </button>
                );
              })}
            </div>
        </div>

        <div className="mb-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl font-display tracking-widest uppercase text-white">Challenges</h2>

          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daily Challenge */}
            <div 
              onClick={() => !isDailyCompleted && onStartGame('Daily')}
              className={`group relative bg-bg-black p-6 transition-all duration-200 flex flex-col justify-between overflow-hidden border-4 ${isDailyCompleted ? 'border-white/10 opacity-80 cursor-default' : 'border-primary hover:border-white brutal-shadow-hover cursor-pointer'}`}
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop')] opacity-10 grayscale contrast-150 mix-blend-screen bg-cover bg-center" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-widest ${isDailyCompleted ? 'bg-white/10 text-white/40' : 'bg-primary text-black'}`}>
                    {isDailyCompleted ? 'Completed' : 'Daily'}
                  </div>
                  <Calendar className={`w-5 h-5 ${isDailyCompleted ? 'text-white/20' : 'text-primary'}`} />
                </div>
                <h3 className={`text-2xl font-display tracking-widest uppercase mb-2 ${isDailyCompleted ? 'text-white/40' : 'text-white group-hover:text-primary transition-colors'}`}>
                  Daily Challenge
                </h3>
                <p className={`text-xs font-mono uppercase tracking-wider ${isDailyCompleted ? 'text-white/20' : 'text-text-muted'}`}>
                  5 Songs. 1 from each genre. Reset in:
                </p>
                {isDailyCompleted ? (
                  <div className="mt-4 flex items-center gap-2 text-primary font-mono text-lg font-bold">
                    <Clock className="w-5 h-5" />
                    {timeLeft}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 text-white/40 font-mono text-xs italic">
                    Ready for today's mix?
                  </div>
                )}
              </div>
              
              {!isDailyCompleted && (
                <div className="mt-6 relative z-10 w-full py-2 bg-primary text-black flex items-center justify-center font-display uppercase tracking-widest text-sm border-2 border-black group-hover:bg-white transition-colors">
                  Play Challenge
                </div>
              )}
              {isDailyCompleted && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <Lock className="w-8 h-8 text-white/20" />
                </div>
              )}
            </div>

            {/* Endless Mode */}
            <div 
              onClick={() => onStartGame('Random', true)}
              className="group relative bg-bg-black p-6 transition-all duration-200 flex flex-col justify-between overflow-hidden border-4 border-white/20 hover:border-primary brutal-shadow-hover cursor-pointer"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop')] opacity-10 grayscale contrast-200 mix-blend-screen bg-cover bg-center" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-white/10 text-white text-[10px] font-mono font-bold px-2 py-1 uppercase tracking-widest">Endless</div>
                  <Shuffle className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-2xl font-display tracking-widest uppercase text-white group-hover:text-primary transition-colors mb-2">Endless Mode</h3>
                <p className="text-xs font-mono text-text-muted uppercase group-hover:text-white transition-colors">
                  3 Lives. All genres. Survival of the fittest.
                </p>
              </div>
              <div className="mt-6 relative z-10 w-full py-2 bg-white/5 text-white flex items-center justify-center font-display uppercase tracking-widest text-sm border-2 border-white/20 group-hover:bg-primary group-hover:text-black group-hover:border-black transition-all">
                Start Survival
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play Section */}
      <div className="mt-16 sm:mt-24 border-t-4 border-white/20 pt-12 sm:pt-16 relative">
        <h2 className="text-4xl sm:text-5xl font-display text-white tracking-widest uppercase mb-8 sm:mb-12 text-center glitch-text" data-text="How to Play">How to Play</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 relative z-10">
          <div className="flex flex-col items-center text-center group">
            <div className="w-16 h-16 bg-black border-4 border-white/20 flex items-center justify-center mb-4 sm:mb-6 brutal-shadow group-hover:border-primary transition-colors">
              <Headphones className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-display tracking-widest uppercase text-white mb-2 sm:mb-3 group-hover:text-primary transition-colors">1. Listen</h3>
            <p className="text-sm sm:text-base font-mono text-text-muted uppercase">
              Each round starts with a very short snippet of a song. Listen carefully.
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-16 h-16 bg-black border-4 border-white/20 flex items-center justify-center mb-4 sm:mb-6 brutal-shadow group-hover:border-primary transition-colors">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-display tracking-widest uppercase text-white mb-2 sm:mb-3 group-hover:text-primary transition-colors">2. Guess Fast</h3>
            <p className="text-sm sm:text-base font-mono text-text-muted uppercase">
              The faster you guess, the more points you earn. Skip to hear more.
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-16 h-16 bg-black border-4 border-white/20 flex items-center justify-center mb-4 sm:mb-6 brutal-shadow group-hover:border-primary transition-colors">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-display tracking-widest uppercase text-white mb-2 sm:mb-3 group-hover:text-primary transition-colors">3. Score Big</h3>
            <p className="text-sm sm:text-base font-mono text-text-muted uppercase">
              Get 5 songs right to finish. Dominate the game.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 sm:mt-24 border-t-2 border-white/10 pt-8 pb-12 flex flex-col items-center gap-4">
        <p className="text-xs font-mono text-white/40 uppercase tracking-widest">
          v0.2.0 • Built for Speed
        </p>
      </div>
    </div>
  );
}
