import React from 'react';
import { VoiceName, VOICE_OPTIONS } from '../types';

interface VoiceSelectorProps {
  selectedVoice: VoiceName;
  onSelect: (voice: VoiceName) => void;
  className?: string;
  label?: string;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selectedVoice, onSelect, className, label }) => {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {VOICE_OPTIONS.map((option) => (
          <button
            key={option.name}
            onClick={() => onSelect(option.name)}
            className={`
              relative flex flex-col items-start p-3 rounded-lg border text-left transition-all
              ${selectedVoice === option.name 
                ? 'bg-indigo-600/20 border-indigo-500 shadow-sm shadow-indigo-500/20' 
                : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750'}
            `}
          >
            <span className={`text-sm font-semibold ${selectedVoice === option.name ? 'text-indigo-400' : 'text-slate-200'}`}>
              {option.name}
            </span>
            <span className="text-xs text-slate-400 mt-1">
              {option.gender} • {option.description}
            </span>
            {selectedVoice === option.name && (
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
