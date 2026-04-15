import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Loader2, Volume2 } from 'lucide-react';
import Hls from 'hls.js';

interface AudioPlayerProps {
  url: string; // This is now the API endpoint, e.g., /api/stream/123
  duration: number;
  autoPlay?: boolean;
  compact?: boolean;
  startTime?: number;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onProgress?: (progress: number) => void;
}

export default function AudioPlayer({ url, duration, autoPlay, compact, startTime, onPlayStart, onPlayEnd, onProgress }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startOffset, setStartOffset] = useState(0);
  const [showAutoPlayFallback, setShowAutoPlayFallback] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('audio_volume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const playFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const durationRef = useRef(duration);
  const prevAutoPlayRef = useRef(autoPlay);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    if (prevAutoPlayRef.current === true && autoPlay === false && isPlayingRef.current) {
      stopSnippet();
    }
    prevAutoPlayRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('audio_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    // Reset state
    setIsLoading(true);
    setIsPlaying(false);
    setError(null);
    setStartOffset(startTime ?? 0);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let isMounted = true;

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      // Ignore errors if the src is empty or it's just the base URL
      if (!target.src || target.src === window.location.href) return;
      
      // Ignore abort errors (e.g. when changing src while loading)
      if (target.error && target.error.code === 1) return;
      
      console.error('Audio element error:', target.error);
      if (isMounted) {
        setError('Failed to load audio');
        setIsLoading(false);
      }
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('error', handleError);
    }

    const initAudio = async (retryCount = 0) => {
      if (!url) {
        if (isMounted) {
          setError('No audio URL available');
          setIsLoading(false);
        }
        return;
      }

      try {
        // If it's a direct media URL (like iTunes), we don't need to fetch stream info
        if (url.includes('apple.com') || url.includes('.m4a') || url.includes('.mp3') || !url.startsWith('/api/')) {
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.load();
          }
          return;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch stream info: ${res.status}`);
        }
        const data = await res.json();
        
        if (!isMounted) return;
        if (startTime !== undefined) {
          setStartOffset(startTime);
        } else if (data.startOffset) {
          setStartOffset(data.startOffset);
        }

        if (data.protocol === 'hls') {
          if (Hls.isSupported()) {
            const hls = new Hls({
              autoStartLoad: true,
              startPosition: 0,
              // Add some HLS specific retry options
              manifestLoadingMaxRetry: 4,
              levelLoadingMaxRetry: 4,
            });
            hlsRef.current = hls;
            
            if (audioRef.current) {
              hls.attachMedia(audioRef.current);
              hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(data.url);
              });
              
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (isMounted) setIsLoading(false);
              });
              
              hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                  console.error('HLS fatal error:', data);
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.log('Fatal network error encountered, trying to recover...');
                      hls.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.log('Fatal media error encountered, trying to recover...');
                      hls.recoverMediaError();
                      break;
                    default:
                      if (isMounted) {
                        setError('Failed to load audio stream');
                        setIsLoading(false);
                      }
                      hls.destroy();
                      break;
                  }
                }
              });
            }
          } else if (audioRef.current && audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            audioRef.current.src = data.url;
            audioRef.current.addEventListener('loadedmetadata', () => {
              if (isMounted) setIsLoading(false);
            });
          } else {
            if (isMounted) {
              setError('HLS not supported in this browser');
              setIsLoading(false);
            }
          }
        } else {
          // Progressive (mp3)
          if (audioRef.current) {
            audioRef.current.src = data.url;
            audioRef.current.load();
          }
        }
      } catch (err: any) {
        console.error(`Error initializing audio (attempt ${retryCount + 1}):`, err);
        
        // Retry on network errors
        if (retryCount < 2 && isMounted) {
          const delay = 1000 * (retryCount + 1);
          console.log(`Retrying audio initialization in ${delay}ms...`);
          setTimeout(() => initAudio(retryCount + 1), delay);
          return;
        }

        if (isMounted) {
          setError('Failed to load audio');
          setIsLoading(false);
        }
      }
    };

    initAudio();

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.removeEventListener('error', handleError);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [url, startTime]);

  useEffect(() => {
    return () => {
      if (playFrameRef.current) cancelAnimationFrame(playFrameRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading && autoPlay && !isPlaying && !error) {
      console.log('Auto-play attempt for:', url);
      playSnippet();

      // If still not playing after 2.5 seconds, show fallback
      const fallbackTimer = setTimeout(() => {
        if (!isPlayingRef.current) {
          setShowAutoPlayFallback(true);
        }
      }, 2500);

      return () => {
        clearTimeout(fallbackTimer);
      };
    } else {
      setShowAutoPlayFallback(false);
    }
  }, [isLoading, url, duration, autoPlay]);

  const handleCanPlay = () => {
    console.log('Audio can play event triggered');
    if (!audioRef.current?.currentSrc && !audioRef.current?.getAttribute('src')) {
      console.log('Ignoring canplay event because source is empty');
      return;
    }
    if (isLoading && !error) {
      setIsLoading(false);
    }
  };

  async function playSnippet(retryCount = 0) {
    if (!audioRef.current || isPlaying || isLoading || error) {
      console.log('Cannot play snippet:', { 
        hasRef: !!audioRef.current, 
        isPlaying, 
        isLoading, 
        hasError: !!error 
      });
      return;
    }

    try {
      console.log(`Attempting to play snippet (attempt ${retryCount + 1}) at offset:`, startOffset);
      
      // Prevent playing if the source is empty or invalid
      if (!audioRef.current.currentSrc && !audioRef.current.getAttribute('src')) {
        console.log('Audio source is empty, skipping play');
        return;
      }

      // Ensure we are at the start offset
      audioRef.current.currentTime = startOffset;
      
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        await playPromise;
      }
      
      setIsPlaying(true);
      isPlayingRef.current = true;
      onPlayStart?.();

      const checkTime = () => {
        // Use ref to avoid stale closure issues
        if (!audioRef.current || !isPlayingRef.current) return;

        const currentPos = audioRef.current.currentTime;
        
        // If the audio hasn't reached the start offset yet (seeking), keep waiting
        if (currentPos < startOffset) {
          playFrameRef.current = requestAnimationFrame(checkTime);
          return;
        }

        const elapsed = currentPos - startOffset;
        const currentDuration = durationRef.current;
        const progress = Math.min(1, elapsed / currentDuration);
        onProgress?.(progress);

        if (currentPos >= (startOffset + currentDuration)) {
          stopSnippet();
          return;
        }

        playFrameRef.current = requestAnimationFrame(checkTime);
      };

      playFrameRef.current = requestAnimationFrame(checkTime);
    } catch (err: any) {
      // Handle AbortError silently as it's usually an intentional pause/stop
      if (err.name === 'AbortError') {
        console.log('Audio playback was interrupted (expected behavior when stopping/skipping)');
      } else {
        console.error("Audio playback failed or was prevented:", err);
      }
      
      setIsPlaying(false);
      isPlayingRef.current = false;
      
      // If it failed and we haven't retried too many times, try again after a short delay
      // But only if it wasn't an AbortError (which means we intentionally stopped)
      if (err.name !== 'AbortError' && retryCount < 3) {
        console.log('Retrying play in 500ms...');
        setTimeout(() => playSnippet(retryCount + 1), 500);
      }
    }
  };

  function stopSnippet() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = startOffset;
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (playFrameRef.current) cancelAnimationFrame(playFrameRef.current);
    onProgress?.(0);
    onPlayEnd?.();
  }

  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'space-y-2' : 'space-y-6'}`}>
      <audio 
        ref={audioRef} 
        onCanPlayThrough={handleCanPlay}
        onCanPlay={handleCanPlay}
        onLoadedData={handleCanPlay}
        onLoadedMetadata={handleCanPlay}
        preload="auto"
      />
      
      <div className="relative">
        {isPlaying && (
          <div className={`absolute inset-0 bg-primary rounded-full animate-ping opacity-20`} />
        )}
        <button
          onClick={isPlaying ? stopSnippet : () => playSnippet()}
          disabled={isLoading || !!error}
          className={`relative rounded-none border-4 border-primary flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 brutal-shadow ${
            compact ? 'w-16 h-16' : 'w-20 h-20 sm:w-28 sm:h-28'
          } ${
            isLoading || !!error ? 'bg-black text-text-muted border-white/20 cursor-not-allowed' : 
            isPlaying ? 'bg-primary text-black' : 'bg-black text-primary hover:bg-primary hover:text-black'
          }`}
          title={error || undefined}
        >
          {isLoading ? (
            <Loader2 className={`${compact ? 'w-6 h-6' : 'w-8 h-8 sm:w-10 sm:h-10'} animate-spin`} />
          ) : isPlaying ? (
            <Square className={`${compact ? 'w-6 h-6' : 'w-8 h-8 sm:w-10 sm:h-10'} fill-current`} />
          ) : (
            <Play className={`${compact ? 'w-8 h-8 ml-1' : 'w-10 h-10 sm:w-12 sm:h-12 ml-1 sm:ml-2'} fill-current`} />
          )}
        </button>
        
        {showAutoPlayFallback && !isPlaying && !isLoading && (
          <div className={`absolute ${compact ? '-top-8' : '-top-12'} left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-black text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-none border-2 border-black animate-bounce brutal-shadow`}>
            Tap to Play
          </div>
        )}
      </div>

      <div className="flex items-center justify-center relative w-32 sm:w-48 mt-2">
        <Volume2 className="w-4 h-4 text-text-muted absolute -left-6 sm:-left-8" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full h-2 bg-bg-highlight border border-white/20 rounded-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black cursor-pointer"
        />
      </div>
      
      {!compact && (
        <div className="text-sm font-mono text-text-muted text-center uppercase tracking-widest">
          {error ? (
            <span className="text-red-500">{error}</span>
          ) : isLoading ? (
            'Loading audio...'
          ) : (
            `Snippet: ${duration.toFixed(1)}s`
          )}
        </div>
      )}
    </div>
  );
}
