import React, { useState } from 'react';
import { Snippet } from '../types';
import JSZip from 'jszip';
import { AudioPlayer } from './AudioPlayer';

interface TableOfContentsProps {
    snippets: Snippet[];
    appName: string;
    featureName: string;
    onGenerateSection: (id: string) => void;
    onGenerateSubsection: (sectionId: string, subsectionId: string) => void;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ 
    snippets, 
    appName, 
    featureName,
    onGenerateSection,
    onGenerateSubsection
}) => {
    const [isZipping, setIsZipping] = useState(false);

    const generateFileName = (parts: (string | undefined)[]) => {
        return parts
            .filter(p => p && p.trim())
            .map(p => p!.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, ''))
            .join('-');
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleDownloadAll = async () => {
        if (snippets.length === 0) return;
        setIsZipping(true);

        try {
            const zip = new JSZip();
            const folderName = generateFileName([appName, featureName]);
            const rootFolder = zip.folder(folderName);
            
            if (!rootFolder) throw new Error("Could not create zip folder");

            let markdownContent = `# ${appName} - ${featureName}\n\n`;
            markdownContent += `Generated: ${new Date().toLocaleString()}\n\n## Structure\n\n`;

            // Process Snippets
            for (let i = 0; i < snippets.length; i++) {
                const snippet = snippets[i];
                markdownContent += `${i + 1}. ${snippet.name} (${snippet.voice})\n`;
                
                // Add Section Audio
                if (snippet.audio) {
                    const fileName = generateFileName([appName, featureName, snippet.name]) + '.wav';
                    rootFolder.file(fileName, snippet.audio.blob);
                }

                // Process Subsections
                for (let j = 0; j < snippet.subsections.length; j++) {
                    const sub = snippet.subsections[j];
                    markdownContent += `   ${i + 1}.${j + 1}. ${sub.name} (${sub.voice})\n`;
                    
                    if (sub.audio) {
                        const subFileName = generateFileName([appName, featureName, snippet.name, sub.name]) + '.wav';
                        rootFolder.file(subFileName, sub.audio.blob);
                    }
                }
                markdownContent += '\n';
            }

            // Add Structure Markdown
            rootFolder.file("structure.md", markdownContent);

            // Generate Zip Blob
            const content = await zip.generateAsync({ type: "blob" });
            
            // Trigger Download
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${folderName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Failed to zip files", error);
            alert("Failed to create zip file. See console for details.");
        } finally {
            setIsZipping(false);
        }
    };

    if (snippets.length === 0) {
        return (
            <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50 text-center">
                <p className="text-sm text-slate-500 italic">Sections and subsections will appear here as you create them.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg sticky top-6">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-850">
                <h3 className="text-sm font-semibold text-slate-200">Table of Contents</h3>
                <button 
                    onClick={handleDownloadAll}
                    disabled={isZipping}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {isZipping ? (
                        <>
                             <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Zipping...</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <span>Download Project (ZIP)</span>
                        </>
                    )}
                </button>
            </div>
            
            <div className="p-0 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="py-2">
                    {snippets.map((snippet, idx) => (
                        <div key={snippet.id} className="group">
                            <div className="px-4 py-2 hover:bg-slate-700/30 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden mr-2">
                                    <span className="text-xs font-mono text-slate-500 flex-shrink-0 w-6">{idx + 1}.</span>
                                    <span className="text-sm text-slate-300 truncate" title={snippet.name}>{snippet.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                     {snippet.audio && (
                                         <span className="text-[10px] text-slate-500 font-mono">
                                             {formatDuration(snippet.audio.duration)}
                                         </span>
                                     )}
                                     <AudioPlayer 
                                        audio={snippet.audio} 
                                        isGenerating={snippet.status === 'generating'} 
                                        layout="tiny"
                                        onGenerate={() => onGenerateSection(snippet.id)}
                                     />
                                     <span className="text-[10px] text-slate-600 group-hover:text-slate-500 w-8 text-right">{snippet.text.length}ch</span>
                                </div>
                            </div>
                            
                            {snippet.subsections.map((sub, sIdx) => (
                                <div key={sub.id} className="px-4 py-1.5 pl-10 hover:bg-slate-700/20 transition-colors flex items-center justify-between relative">
                                    <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-800"></div>
                                    <div className="flex items-center gap-2 overflow-hidden w-full mr-2">
                                        <span className="text-[10px] font-mono text-slate-600 flex-shrink-0 w-6 text-right">{idx + 1}.{sIdx + 1}</span>
                                        <span className="text-xs text-slate-400 truncate" title={sub.name}>{sub.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {sub.audio && (
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {formatDuration(sub.audio.duration)}
                                            </span>
                                        )}
                                        <AudioPlayer 
                                            audio={sub.audio} 
                                            isGenerating={sub.status === 'generating'} 
                                            layout="tiny"
                                            onGenerate={() => onGenerateSubsection(snippet.id, sub.id)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-3 bg-slate-850 border-t border-slate-700 text-[10px] text-slate-500 text-center">
                Includes .wav files and structure.md
            </div>
        </div>
    );
};