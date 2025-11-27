import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GeneratedAudio } from '../types';

interface AudioPlayerProps {
  audio: GeneratedAudio | null;
  isGenerating: boolean;
  isStale?: boolean;
  layout?: 'card' | 'row' | 'tiny';
  fileName?: string;
  onGenerate?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
    audio, 
    isGenerating, 
    isStale,
    layout = 'card', 
    fileName,
    onGenerate 
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auto-play logic: Track if we were just generating
  const wasGeneratingRef = useRef(false);
  
  useEffect(() => {
    if (isGenerating) {
        wasGeneratingRef.current = true;
    } else if (wasGeneratingRef.current && audio) {
        wasGeneratingRef.current = false;
        // Attempt to auto-play after generation
        if (audioRef.current) {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(e => console.log("Auto-play prevented:", e));
        }
    }
  }, [isGenerating, audio]);

  useEffect(() => {
    if (audioRef.current && audio) {
      audioRef.current.src = audio.url;
      audioRef.current.load();
      // If not auto-playing via the logic above, reset state
      if (!wasGeneratingRef.current) {
          setIsPlaying(false);
          setProgress(0);
      }
    }
  }, [audio]);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();

    // If no audio and we have a generator, trigger generation
    if (!audio && onGenerate) {
        onGenerate();
        return;
    }

    if (!audioRef.current || !audio) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, audio, onGenerate]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      if (duration > 0) {
        setProgress((current / duration) * 100);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
    // Optional: Reset after a short delay
    setTimeout(() => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = 0;
        setProgress(0);
    }, 1000);
  };

  const downloadName = fileName 
    ? (fileName.endsWith('.wav') ? fileName : `${fileName}.wav`)
    : `gemini-speech-${Date.now()}.wav`;

  // --- TINY LAYOUT (Icon only) ---
  if (layout === 'tiny') {
    return (
        <>
            <audio 
                ref={audioRef} 
                onTimeUpdate={handleTimeUpdate} 
                onEnded={handleEnded} 
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                className="hidden" 
            />
            
            {isGenerating ? (
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                </div>
            ) : (
                <button 
                    onClick={togglePlay}
                    disabled={!audio && !onGenerate}
                    className={`
                        w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full transition-colors focus:outline-none
                        ${!audio 
                            ? (onGenerate ? 'bg-slate-700 hover:bg-indigo-600 text-slate-400 hover:text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed')
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                        }
                    `}
                    title={!audio ? "Generate & Play" : (isPlaying ? "Pause" : "Play")}
                >
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 9v6m4-6v6" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 pl-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                    )}
                </button>
            )}
        </>
    );
  }

  // --- LOADING STATE (Card/Row) ---
  if (isGenerating) {
    if (layout === 'row') {
        return (
            <div className="flex items-center space-x-2 text-indigo-400 py-2">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                <span className="text-xs font-medium">Generating...</span>
            </div>
        )
    }
    return (
      <div className="w-full bg-slate-800 rounded-xl p-6 border border-slate-700 animate-pulse flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
        <p className="text-indigo-400 font-medium">Generating speech...</p>
      </div>
    );
  }

  // --- EMPTY STATE (Card/Row) ---
  if (!audio) {
    if (layout === 'row') return null;
    
    return (
      <div className="w-full bg-slate-800/50 rounded-xl p-8 border border-slate-700 border-dashed flex flex-col items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <p>Generated audio will appear here</p>
      </div>
    );
  }

  // --- ROW LAYOUT ---
  if (layout === 'row') {
    return (
        <div className="flex items-center space-x-3 w-full bg-slate-800/50 rounded-lg p-2 border border-slate-700">
            <audio 
                ref={audioRef} 
                onTimeUpdate={handleTimeUpdate} 
                onEnded={handleEnded} 
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                className="hidden" 
            />
            
            <button 
                onClick={togglePlay}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 pl-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                )}
            </button>

            <div className="flex-grow bg-slate-700 h-1.5 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => {
                if (audioRef.current && audio.duration > 0) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percent = x / rect.width;
                    audioRef.current.currentTime = percent * audioRef.current.duration;
                }
            }}>
                <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-100 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

             <div className="text-xs text-slate-400 font-mono whitespace-nowrap min-w-[30px] text-right">
                {audioRef.current ? (
                    `${Math.floor(audioRef.current.currentTime / 60)}:${Math.floor(audioRef.current.currentTime % 60).toString().padStart(2, '0')}`
                ) : "0:00"}
            </div>

            <a 
                href={audio.url} 
                download={downloadName}
                className="text-slate-400 hover:text-white transition-colors"
                title={`Download ${downloadName}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </a>
        </div>
    );
  }

  // --- CARD LAYOUT (Default) ---
  return (
    <div className={`w-full bg-slate-800 rounded-xl p-6 border ${isStale ? 'border-amber-500/50' : 'border-slate-700'} shadow-xl transition-colors duration-300`}>
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={handleEnded} 
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden" 
      />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-200">Audio Result</h3>
            {isStale && (
                <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-medium border border-amber-500/20 uppercase tracking-wide">
                    Out of Sync
                </span>
            )}
        </div>
        <a 
          href={audio.url} 
          download={downloadName}
          className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download WAV
        </a>
      </div>

      <div className="flex items-center space-x-4">
        <button 
          onClick={togglePlay}
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          {isPlaying ? (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 pl-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        <div className="flex-grow bg-slate-700 h-2 rounded-full overflow-hidden relative group cursor-pointer" onClick={(e) => {
             if (audioRef.current && audio.duration > 0) {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const x = e.clientX - rect.left;
                 const percent = x / rect.width;
                 audioRef.current.currentTime = percent * audioRef.current.duration;
             }
        }}>
          <div 
            className="bg-indigo-500 h-full rounded-full transition-all duration-100 ease-out relative"
            style={{ width: `${progress}%` }}
          >
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>
        
        <div className="text-xs text-slate-400 font-mono min-w-[3.5rem] text-right">
           {audioRef.current ? (
               `${Math.floor(audioRef.current.currentTime / 60)}:${Math.floor(audioRef.current.currentTime % 60).toString().padStart(2, '0')}`
           ) : "0:00"}
        </div>
      </div>
    </div>
  );
};