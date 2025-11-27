import React, { useRef } from 'react';
import { Snippet, Subsection, VoiceName } from '../types';
import { AudioPlayer } from './AudioPlayer';

interface SectionEditorProps {
    section: Snippet;
    index: number;
    appName: string;
    featureName: string;
    onUpdate: (updatedSection: Snippet) => void;
    onDelete: (id: string) => void;
    onGenerateSection: (id: string) => void;
    onGenerateSubsection: (sectionId: string, subsectionId: string) => void;
    generateFileName: (parts: string[]) => string;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({ 
    section, 
    index,
    appName,
    featureName, 
    onUpdate, 
    onDelete, 
    onGenerateSection, 
    onGenerateSubsection,
    generateFileName
}) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const handleExtractSubsection = () => {
        const textArea = textAreaRef.current;
        if (!textArea) return;

        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;

        if (start === end) return;

        const selectedText = textArea.value.substring(start, end);
        if (!selectedText.trim()) return;

        const newSubsection: Subsection = {
            id: crypto.randomUUID(),
            name: `Part ${section.subsections.length + 1}`,
            text: selectedText,
            voice: section.voice, // Default to parent voice
            audio: null,
            status: 'idle',
            error: null
        };

        onUpdate({
            ...section,
            subsections: [...section.subsections, newSubsection]
        });
    };

    const updateSubsection = (subId: string, updates: Partial<Subsection>) => {
        onUpdate({
            ...section,
            subsections: section.subsections.map(sub => 
                sub.id === subId ? { ...sub, ...updates } : sub
            )
        });
    };

    const deleteSubsection = (subId: string) => {
        onUpdate({
            ...section,
            subsections: section.subsections.filter(sub => sub.id !== subId)
        });
    };

    return (
        <div className="bg-slate-950 rounded-lg border-l-4 border-indigo-500 shadow-lg mb-8 overflow-hidden">
            {/* Header: Section Name and Controls */}
            <div className="bg-slate-900/50 p-4 border-b border-slate-800 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                    <div className="flex-grow space-y-2 w-full">
                        <div className="flex items-center gap-3">
                             <span className="text-xs font-mono text-indigo-400 font-bold whitespace-nowrap bg-indigo-400/10 px-2 py-1 rounded">SECTION {index + 1}</span>
                             <input 
                                type="text"
                                value={section.name}
                                onChange={(e) => onUpdate({...section, name: e.target.value})}
                                placeholder="Section Name (e.g., Intro)"
                                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-base font-semibold text-slate-100 focus:border-indigo-500 outline-none w-full sm:w-2/3 shadow-sm"
                             />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 pl-1 w-full">
                            <select 
                                value={section.voice}
                                onChange={(e) => onUpdate({...section, voice: e.target.value as VoiceName})}
                                className="bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-bold rounded px-2 py-1.5 outline-none focus:border-indigo-500 shadow-sm"
                            >
                                {Object.values(VoiceName).map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>

                            <button
                              onClick={handleExtractSubsection}
                              className="ml-auto text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded transition-colors font-medium flex items-center"
                              title="Highlight text in the box below to extract"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                 <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                              Extract Selection as Subsection
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={() => onDelete(section.id)}
                        className="text-slate-600 hover:text-red-400 p-2 hover:bg-red-500/10 rounded transition-colors self-start"
                        title="Delete Section"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Section Content */}
            <div className="p-4 space-y-4">
                {/* Text Area */}
                <div className="relative group">
                    <label className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono uppercase tracking-wider bg-slate-900/80 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Section Text</label>
                    <textarea 
                        ref={textAreaRef}
                        value={section.text}
                        onChange={(e) => onUpdate({...section, text: e.target.value})}
                        className="w-full bg-slate-900 text-sm text-slate-300 border border-slate-800 rounded p-4 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-y min-h-[300px] leading-relaxed font-light shadow-inner"
                        placeholder="Paste or type section text here. Highlight portions to extract subsections."
                    />
                </div>

                {/* Section Controls */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-2">
                    <div className="flex-grow pr-4">
                        {section.status === 'error' && (
                            <span className="text-xs text-red-400 block mb-1">Error: {section.error}</span>
                        )}
                        {section.audio ? (
                            <AudioPlayer 
                                audio={section.audio} 
                                isGenerating={section.status === 'generating'} 
                                layout="row"
                                fileName={generateFileName([appName, featureName, section.name])}
                            />
                        ) : (
                             <div className="text-xs text-slate-500 italic pl-1">Generate audio for this full section</div>
                        )}
                    </div>
                    <button
                        onClick={() => onGenerateSection(section.id)}
                        disabled={section.status === 'generating'}
                        className={`flex-shrink-0 text-xs px-4 py-2 rounded-md transition-colors flex items-center space-x-2 font-medium shadow-sm ${
                            section.status === 'generating' 
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                : 'bg-slate-800 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-slate-700 hover:border-indigo-500'
                        }`}
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                         </svg>
                         <span>{section.audio ? 'Regenerate Section' : 'Generate Full Section'}</span>
                    </button>
                </div>

                {/* Subsections List */}
                {section.subsections.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 py-2">
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Subsections</span>
                             <div className="h-px bg-slate-800 flex-grow"></div>
                        </div>
                        
                        {section.subsections.map((sub, sIdx) => (
                            <div key={sub.id} className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-md transition-all hover:border-slate-600">
                                <div className="flex flex-col gap-4">
                                    {/* Subsection Header */}
                                    <div className="flex justify-between items-start gap-4 border-b border-slate-700/50 pb-3">
                                         <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-grow">
                                            <span className="text-xs font-mono text-slate-400 whitespace-nowrap bg-slate-700/50 px-1.5 py-0.5 rounded">SUB {index + 1}.{sIdx + 1}</span>
                                            <input 
                                                type="text"
                                                value={sub.name}
                                                onChange={(e) => updateSubsection(sub.id, { name: e.target.value })}
                                                placeholder="Subsection Name"
                                                className="bg-transparent border-b border-slate-600 text-sm font-medium text-slate-200 focus:border-indigo-500 outline-none w-full sm:w-64 pb-0.5 transition-colors"
                                            />
                                            <select 
                                                value={sub.voice}
                                                onChange={(e) => updateSubsection(sub.id, { voice: e.target.value as VoiceName })}
                                                className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1 outline-none focus:border-indigo-500"
                                            >
                                                {Object.values(VoiceName).map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </select>
                                         </div>
                                         <button onClick={() => deleteSubsection(sub.id)} className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-700/50 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                         </button>
                                    </div>

                                    <textarea 
                                        value={sub.text}
                                        onChange={(e) => updateSubsection(sub.id, { text: e.target.value })}
                                        className="w-full bg-slate-900/50 text-sm text-slate-300 border border-slate-700/50 rounded p-4 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-y min-h-[300px] leading-relaxed shadow-inner"
                                    />

                                    <div className="flex items-center justify-between pt-1">
                                         <div className="flex-grow pr-4">
                                            {sub.status === 'error' && <span className="text-[10px] text-red-400 block mb-1">Error: {sub.error}</span>}
                                            {sub.audio && (
                                                <AudioPlayer 
                                                    audio={sub.audio} 
                                                    isGenerating={sub.status === 'generating'} 
                                                    layout="row"
                                                    fileName={generateFileName([appName, featureName, section.name, sub.name])}
                                                />
                                            )}
                                         </div>
                                         {!sub.audio && (
                                             <button
                                                onClick={() => onGenerateSubsection(section.id, sub.id)}
                                                disabled={sub.status === 'generating'}
                                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded shadow-md transition-colors whitespace-nowrap font-medium"
                                             >
                                                {sub.status === 'generating' ? 'Generating...' : 'Generate Subsection'}
                                             </button>
                                         )}
                                          {sub.audio && (
                                             <button
                                                onClick={() => onGenerateSubsection(section.id, sub.id)}
                                                disabled={sub.status === 'generating'}
                                                className="text-xs text-slate-500 hover:text-indigo-400 whitespace-nowrap ml-2 hover:underline"
                                             >
                                                Re-gen
                                             </button>
                                         )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};