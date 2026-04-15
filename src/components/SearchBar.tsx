import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Song } from '../types';

interface SearchBarProps {
  songs: Song[];
  onGuess: (song: Song) => void;
  disabled?: boolean;
}

const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export default function SearchBar({ songs, onGuess, disabled }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSongs = query.trim() === '' 
    ? [] 
    : songs.filter(song => {
        const searchTarget = normalizeText(`${song.title} ${song.artist}`).replace(/[^a-z0-9]/g, '');
        const searchTerms = normalizeText(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
        return searchTerms.every(term => searchTarget.includes(term));
      }).slice(0, 20);

  const handleSelect = (song: Song) => {
    onGuess(song);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md mx-auto">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-text-muted" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border-4 border-white/20 rounded-none leading-5 bg-black text-white placeholder-text-muted focus:outline-none focus:border-primary transition-all font-mono uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed brutal-shadow-hover"
          placeholder="What song is this?"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
      </div>

      {isOpen && filteredSongs.length > 0 && (
        <ul className="absolute z-20 bottom-full mb-2 w-full bg-black brutal-shadow max-h-80 rounded-none py-2 border-4 border-white/20 overflow-auto focus:outline-none sm:text-sm">
          {filteredSongs.map((song) => (
            <li
              key={song.id}
              className="cursor-pointer select-none relative py-3 px-4 hover:bg-primary hover:text-black transition-colors flex items-center gap-3 group border-b-2 border-white/10 last:border-b-0"
              onClick={() => handleSelect(song)}
            >
              <div className="w-10 h-10 rounded-none overflow-hidden flex-shrink-0 bg-black border-2 border-white/20 group-hover:border-black">
                <img src={song.artworkUrl} alt="" className="w-full h-full object-cover grayscale contrast-150 group-hover:grayscale-0 group-hover:contrast-100" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-display uppercase tracking-widest block truncate text-white group-hover:text-black">
                  {song.title}
                </span>
                <span className="text-text-muted font-mono uppercase tracking-widest truncate text-xs group-hover:text-black/70">
                  {song.artist}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
