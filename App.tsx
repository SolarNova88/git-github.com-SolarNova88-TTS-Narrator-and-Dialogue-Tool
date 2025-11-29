

import React, { useState, useCallback, useRef } from 'react';
import { VoiceName, AppMode, Character, ScriptLine, GeneratedAudio, Snippet, Subsection } from './types';
import { VoiceSelector } from './components/VoiceSelector';
import { AudioPlayer } from './components/AudioPlayer';
import { SectionEditor } from './components/SectionEditor';
import { TableOfContents } from './components/TableOfContents';
import { generateSingleVoice, generateDialogue, generateClonedSpeech, transcribeAudio } from './services/geminiService';
import { decodeAudioData, bufferToWavBlob } from './utils/audioUtils';

// Default initial state
const DEFAULT_CHARACTERS: Character[] = [
  { id: '1', name: 'Speaker 1', voice: VoiceName.Kore },
  { id: '2', name: 'Speaker 2', voice: VoiceName.Puck },
];

const DEFAULT_SCRIPT: ScriptLine[] = [
  { id: 's1', characterId: '1', text: 'Hello! I am the first speaker using the Kore voice.' },
  { id: 's2', characterId: '2', text: 'And I am the second speaker, using Puck. We can talk to each other!' },
];

const CALIBRATION_TEXT = "The quick brown fox jumps over the lazy dog. Voice cloning technology allows for creating realistic speech from just a short audio sample. I am reading this text to calibrate the system with my unique vocal tone, pacing, and speaking style. By analyzing the nuances of my speech patterns, the AI creates a digital voice that sounds just like me.";

const formatFileName = (parts: (string | undefined)[]) => {
  return parts
      .filter(p => p && p.trim())
      .map(p => p!.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, ''))
      .join('-');
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('NARRATION');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio | null>(null);
  const [lastGeneratedHash, setLastGeneratedHash] = useState<string>('');

  // App Metadata for Naming
  const [appName, setAppName] = useState("MyApp");
  const [featureName, setFeatureName] = useState("Tutorial");

  // Narration State
  const [narrationText, setNarrationText] = useState("Enter text here to generate speech...");
  const [narrationVoice, setNarrationVoice] = useState<VoiceName>(VoiceName.Kore);
  
  // Snippet/Section State
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Dialogue State
  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS);
  const [script, setScript] = useState<ScriptLine[]>(DEFAULT_SCRIPT);

  // Cloning State
  const [cloningText, setCloningText] = useState("Enter text to be spoken by the cloned voice...");
  const [cloningReference, setCloningReference] = useState<{name: string, data: string, mimeType: string} | null>(null);
  
  // Transcription State
  const [transcriptionFile, setTranscriptionFile] = useState<{name: string, data: string, mimeType: string} | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Helper to ensure AudioContext is ready
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  // Content Hashing to detect stale state
  const getContentHash = () => {
    if (mode === 'NARRATION') return JSON.stringify({ text: narrationText, voice: narrationVoice });
    if (mode === 'DIALOGUE') return JSON.stringify({ script, characters });
    if (mode === 'CLONING') return JSON.stringify({ text: cloningText, ref: cloningReference?.name });
    // Transcription doesn't use the audio player in the same way, so hash is less relevant for the main generate button
    return '';
  };

  const currentContentHash = getContentHash();
  const isStale = !!generatedAudio && currentContentHash !== lastGeneratedHash && mode !== 'TRANSCRIPTION';

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedAudio(null);

    try {
      let base64Audio = '';
      if (mode === 'NARRATION') {
        if (!narrationText.trim()) throw new Error("Please enter some text.");
        base64Audio = await generateSingleVoice({ text: narrationText, voice: narrationVoice });
      } else if (mode === 'DIALOGUE') {
        if (script.length === 0) throw new Error("Script cannot be empty.");
        base64Audio = await generateDialogue({ script, characters });
      } else if (mode === 'CLONING') {
        if (!cloningText.trim()) throw new Error("Please enter text for the cloned voice.");
        if (!cloningReference) throw new Error("Please upload a reference audio file.");
        base64Audio = await generateClonedSpeech({ 
            text: cloningText, 
            referenceAudio: cloningReference.data,
            mimeType: cloningReference.mimeType
        });
      } else if (mode === 'TRANSCRIPTION') {
        if (!transcriptionFile) throw new Error("Please upload an audio file to transcribe.");
        const text = await transcribeAudio(transcriptionFile.data, transcriptionFile.mimeType);
        setTranscriptionResult(text);
        setLoading(false);
        return; // Transcription handles its own result state, not the audio player
      }

      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await decodeAudioData(base64Audio, ctx);
      const wavBlob = bufferToWavBlob(audioBuffer);
      const url = URL.createObjectURL(wavBlob);

      setGeneratedAudio({
        blob: wavBlob,
        url,
        duration: audioBuffer.duration
      });
      setLastGeneratedHash(currentContentHash);

    } catch (err: any) {
      setError(err.message || "An error occurred during generation.");
    } finally {
      setLoading(false);
    }
  };

  // Generic File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: any) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setError("Please upload a valid audio file.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setter({
            data: base64Data,
            mimeType: file.type,
            name: file.name
        });
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCloningUpload = (e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, setCloningReference);
  const handleTranscriptionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTranscriptionResult(""); // Clear previous result
      handleFileUpload(e, setTranscriptionFile);
  };

  // Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            
            const fileData = {
                data: base64Data,
                mimeType: 'audio/webm',
                name: `recording-${Date.now()}.webm`
            };
            
            if (mode === 'CLONING') {
                setCloningReference(fileData);
            } else if (mode === 'TRANSCRIPTION') {
                setTranscriptionFile(fileData);
            }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop()); // Stop mic
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
      setError(null);

    } catch (err: any) {
        console.error(err);
        setError("Microphone access denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Section / Snippet Management
  const addSnippetFromSelection = () => {
    const textArea = textAreaRef.current;
    if (!textArea) return;

    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    
    if (start === end) return;

    const selectedText = textArea.value.substring(start, end);
    if (!selectedText.trim()) return;

    const newSnippet: Snippet = {
        id: crypto.randomUUID(),
        name: `Section ${snippets.length + 1}`,
        text: selectedText,
        voice: narrationVoice, // Inherit current voice settings
        audio: null,
        status: 'idle',
        error: null,
        subsections: []
    };

    setSnippets([...snippets, newSnippet]);
  };

  const removeSnippet = (id: string) => {
    setSnippets(snippets.filter(s => s.id !== id));
  };

  const updateSnippet = (updatedSnippet: Snippet) => {
    setSnippets(snippets.map(s => s.id === updatedSnippet.id ? updatedSnippet : s));
  };

  const processGeneration = async (text: string, voice: VoiceName): Promise<GeneratedAudio> => {
     const base64Audio = await generateSingleVoice({ text, voice });
     const ctx = getAudioContext();
     if (ctx.state === 'suspended') {
         await ctx.resume();
     }

     const audioBuffer = await decodeAudioData(base64Audio, ctx);
     const wavBlob = bufferToWavBlob(audioBuffer);
     const url = URL.createObjectURL(wavBlob);
     return { blob: wavBlob, url, duration: audioBuffer.duration };
  };

  const generateSnippet = async (id: string) => {
    const snippet = snippets.find(s => s.id === id);
    if (!snippet) return;

    setSnippets(prev => prev.map(s => s.id === id ? { ...s, status: 'generating', error: null } : s));

    try {
        const audio = await processGeneration(snippet.text, snippet.voice);
        setSnippets(prev => prev.map(s => s.id === id ? { ...s, status: 'success', audio } : s));
    } catch (err: any) {
        setSnippets(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: err.message } : s));
    }
  };

  const generateSubsection = async (sectionId: string, subsectionId: string) => {
    const snippet = snippets.find(s => s.id === sectionId);
    if (!snippet) return;
    const sub = snippet.subsections.find(sub => sub.id === subsectionId);
    if (!sub) return;

    // Update status to generating
    setSnippets(prev => prev.map(s => 
        s.id === sectionId 
            ? { ...s, subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, status: 'generating', error: null } : sub) } 
            : s
    ));

    try {
        const audio = await processGeneration(sub.text, sub.voice);
        setSnippets(prev => prev.map(s => 
            s.id === sectionId 
                ? { ...s, subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, status: 'success', audio } : sub) } 
                : s
        ));
    } catch (err: any) {
        setSnippets(prev => prev.map(s => 
            s.id === sectionId 
                ? { ...s, subsections: s.subsections.map(sub => sub.id === subsectionId ? { ...sub, status: 'error', error: err.message } : sub) } 
                : s
        ));
    }
  };

  // Dialogue Editors
  const updateCharacterName = (id: string, name: string) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const updateCharacterVoice = (id: string, voice: VoiceName) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, voice } : c));
  };

  const addScriptLine = () => {
    const lastCharId = script.length > 0 ? script[script.length - 1].characterId : characters[0].id;
    let nextCharId = lastCharId;
    if (characters.length > 1) {
        const currentIndex = characters.findIndex(c => c.id === lastCharId);
        const nextIndex = (currentIndex + 1) % characters.length;
        nextCharId = characters[nextIndex].id;
    }
    setScript([...script, { id: crypto.randomUUID(), characterId: nextCharId, text: '' }]);
  };

  const removeScriptLine = (id: string) => {
    setScript(prev => prev.filter(l => l.id !== id));
  };

  const updateScriptLine = (id: string, field: 'characterId' | 'text', value: string) => {
    setScript(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Gemini Voice Studio</h1>
              <p className="text-sm text-slate-400">Powered by Gemini 2.5 Flash TTS</p>
            </div>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => { setMode('NARRATION'); setGeneratedAudio(null); setError(null); setLastGeneratedHash(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'NARRATION' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Narration
            </button>
            <button
              onClick={() => { setMode('DIALOGUE'); setGeneratedAudio(null); setError(null); setLastGeneratedHash(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'DIALOGUE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dialogue
            </button>
             <button
              onClick={() => { setMode('CLONING'); setGeneratedAudio(null); setError(null); setLastGeneratedHash(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'CLONING' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Voice Cloning
            </button>
            <button
              onClick={() => { setMode('TRANSCRIPTION'); setGeneratedAudio(null); setError(null); setLastGeneratedHash(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'TRANSCRIPTION' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Transcription
            </button>
          </div>
        </header>

        {/* Global Metadata Inputs (Only for Narration/Snippets) */}
        {mode === 'NARRATION' && (
             <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">APP NAME</label>
                    <input 
                        type="text" 
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                        placeholder="e.g. MyApp"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">FEATURE / CHAPTER</label>
                    <input 
                        type="text" 
                        value={featureName}
                        onChange={(e) => setFeatureName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                        placeholder="e.g. Tutorial"
                    />
                 </div>
             </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {mode === 'NARRATION' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md">
                  <h2 className="text-lg font-semibold mb-4 text-slate-200">1. Select Voice</h2>
                  <VoiceSelector selectedVoice={narrationVoice} onSelect={setNarrationVoice} />
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 relative shadow-md">
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-slate-200">2. Master Text</h2>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-400 hidden sm:inline">Highlight text to create a section</span>
                        <button
                          onClick={addSnippetFromSelection}
                          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition-colors font-medium flex items-center shadow-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          Extract Section
                        </button>
                      </div>
                  </div>
                  <textarea
                    ref={textAreaRef}
                    value={narrationText}
                    onChange={(e) => setNarrationText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y min-h-[500px] leading-relaxed font-light shadow-inner"
                    placeholder="Paste your long-form text here. Highlight sections to create individual audio sections (snippets)..."
                  />
                  <div className="mt-2 text-right text-xs text-slate-500">
                    {narrationText.length} chars
                  </div>
                </div>

                {/* Sections List */}
                {snippets.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                             <h2 className="text-lg font-semibold text-slate-200">3. Audio Sections</h2>
                             <button onClick={() => setSnippets([])} className="text-xs text-red-400 hover:text-red-300">Clear All</button>
                        </div>
                        <div className="space-y-8">
                            {snippets.map((snippet, idx) => (
                                <SectionEditor
                                    key={snippet.id}
                                    index={idx}
                                    section={snippet}
                                    appName={appName}
                                    featureName={featureName}
                                    onUpdate={updateSnippet}
                                    onDelete={removeSnippet}
                                    onGenerateSection={generateSnippet}
                                    onGenerateSubsection={generateSubsection}
                                    generateFileName={formatFileName}
                                />
                            ))}
                        </div>
                    </div>
                )}
              </div>
            )}

            {mode === 'DIALOGUE' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Cast Section */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-slate-200">1. The Cast</h2>
                    {characters.length < 5 && (
                      <button 
                        onClick={() => setCharacters([...characters, { id: crypto.randomUUID(), name: `Speaker ${characters.length + 1}`, voice: VoiceName.Kore }])}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded-full transition-colors"
                      >
                        + Add Speaker
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {characters.map((char, idx) => (
                      <div key={char.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                         <div className="sm:col-span-4">
                           <label className="block text-xs text-slate-500 mb-1">Name</label>
                           <input 
                              type="text" 
                              value={char.name} 
                              onChange={(e) => updateCharacterName(char.id, e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                           />
                         </div>
                         <div className="sm:col-span-7">
                            <label className="block text-xs text-slate-500 mb-1">Voice</label>
                             <select 
                                value={char.voice}
                                onChange={(e) => updateCharacterVoice(char.id, e.target.value as VoiceName)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none appearance-none"
                             >
                               {Object.values(VoiceName).map(v => (
                                 <option key={v} value={v}>{v}</option>
                               ))}
                             </select>
                         </div>
                         <div className="sm:col-span-1 flex justify-end pt-6">
                            {characters.length > 1 && (
                              <button onClick={() => setCharacters(characters.filter(c => c.id !== char.id))} className="text-slate-500 hover:text-red-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Script Section */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h2 className="text-lg font-semibold mb-4 text-slate-200">2. The Script</h2>
                  <div className="space-y-4">
                    {script.map((line, index) => (
                      <div key={line.id} className="flex gap-4 group">
                        <div className="flex-shrink-0 pt-2 text-xs text-slate-600 font-mono w-6 text-right">
                          {index + 1}
                        </div>
                        <div className="flex-grow space-y-2">
                           <div className="flex items-center gap-2">
                             <select 
                                value={line.characterId}
                                onChange={(e) => updateScriptLine(line.id, 'characterId', e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded px-2 py-1 outline-none focus:border-indigo-500"
                             >
                               {characters.map(c => (
                                 <option key={c.id} value={c.id}>{c.name}</option>
                               ))}
                             </select>
                           </div>
                           <textarea
                             value={line.text}
                             onChange={(e) => updateScriptLine(line.id, 'text', e.target.value)}
                             rows={2}
                             className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-indigo-500 outline-none text-sm"
                             placeholder="Dialogue line..."
                           />
                        </div>
                        <div className="flex-shrink-0 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => removeScriptLine(line.id)} className="text-slate-600 hover:text-red-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                           </button>
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      onClick={addScriptLine}
                      className="w-full py-3 border-2 border-dashed border-slate-700 rounded-lg text-slate-500 hover:border-indigo-500 hover:text-indigo-400 transition-colors flex items-center justify-center font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add Line
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mode === 'CLONING' && (
               <div className="space-y-8 animate-fadeIn">
                 {/* Step 1: Reference Audio */}
                 <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md transition-all">
                    <h2 className="text-lg font-semibold mb-4 text-slate-200">1. Reference Voice</h2>
                    
                    {isRecording ? (
                        <div className="bg-slate-950 p-6 rounded-lg border-2 border-indigo-500/50 shadow-2xl relative overflow-hidden animate-fadeIn">
                            {/* Recording Pulse Effect Background */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
                            
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-2 text-red-400 animate-pulse">
                                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Recording in Progress</span>
                                </div>
                                <div className="font-mono text-xl font-bold text-slate-100">{formatTime(recordingTime)}</div>
                            </div>

                            <div className="text-center space-y-6">
                                <p className="text-sm text-slate-400 uppercase tracking-wide font-semibold">Please read the following aloud:</p>
                                <div className="text-xl md:text-2xl font-light leading-relaxed text-slate-100 max-w-2xl mx-auto font-serif italic">
                                    "{CALIBRATION_TEXT}"
                                </div>
                                <button
                                    onClick={stopRecording}
                                    className="inline-flex items-center px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
                                >
                                    <div className="w-4 h-4 bg-white rounded-sm mr-2"></div>
                                    Stop Recording
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 border-2 border-dashed border-slate-600 rounded-lg bg-slate-900/50 flex flex-col items-center justify-center text-center">
                            <div className="mb-4">
                                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-slate-300 font-medium">Upload an audio sample</p>
                                <p className="text-xs text-slate-500 mt-1">WAV or MP3, approx 10-30 seconds</p>
                            </div>
                            
                            <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">
                                Choose File
                                <input 
                                    type="file" 
                                    accept="audio/*" 
                                    onChange={handleCloningUpload}
                                    className="hidden" 
                                />
                            </label>

                            <div className="flex items-center w-full my-4 max-w-sm">
                                <div className="h-px bg-slate-700 flex-grow"></div>
                                <span className="px-3 text-slate-500 text-xs font-semibold uppercase">OR</span>
                                <div className="h-px bg-slate-700 flex-grow"></div>
                            </div>

                            <button
                                onClick={startRecording}
                                className="w-full max-w-sm py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                                <span>Record from Microphone</span>
                            </button>

                            {cloningReference && (
                                <div className="mt-6 w-full max-w-md bg-slate-800 p-3 rounded-lg flex items-center justify-between border border-slate-600 shadow-sm animate-fadeIn">
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 text-green-400 rounded flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs text-slate-400 uppercase font-bold">Reference Loaded</span>
                                            <span className="text-sm text-slate-200 truncate">{cloningReference.name}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setCloningReference(null)}
                                        className="text-slate-500 hover:text-red-400 p-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                            {cloningReference && (
                                <audio controls src={`data:${cloningReference.mimeType};base64,${cloningReference.data}`} className="mt-4 w-full max-w-md h-8" />
                            )}
                        </div>
                    )}
                 </div>

                 {/* Step 2: Text Input */}
                 <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md">
                    <h2 className="text-lg font-semibold mb-4 text-slate-200">2. Target Text</h2>
                     <textarea
                        value={cloningText}
                        onChange={(e) => setCloningText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y min-h-[200px] leading-relaxed font-light shadow-inner"
                        placeholder="Enter the text you want the cloned voice to speak..."
                      />
                 </div>
               </div>
            )}

            {mode === 'TRANSCRIPTION' && (
                <div className="space-y-8 animate-fadeIn">
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md">
                        <h2 className="text-lg font-semibold mb-4 text-slate-200">1. Upload Audio</h2>
                         {isRecording ? (
                            <div className="bg-slate-950 p-6 rounded-lg border-2 border-indigo-500/50 shadow-2xl relative overflow-hidden animate-fadeIn">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-2 text-red-400 animate-pulse">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span className="text-xs font-bold uppercase tracking-widest">Recording...</span>
                                    </div>
                                    <div className="font-mono text-xl font-bold text-slate-100">{formatTime(recordingTime)}</div>
                                </div>
                                <div className="text-center">
                                     <button
                                        onClick={stopRecording}
                                        className="inline-flex items-center px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
                                    >
                                        <div className="w-4 h-4 bg-white rounded-sm mr-2"></div>
                                        Stop Recording
                                    </button>
                                </div>
                            </div>
                         ) : (
                             <div className="p-6 border-2 border-dashed border-slate-600 rounded-lg bg-slate-900/50 flex flex-col items-center justify-center text-center">
                                <div className="mb-4">
                                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-300 font-medium">Upload audio to transcribe</p>
                                    <p className="text-xs text-slate-500 mt-1">WAV, MP3, WEBM supported</p>
                                </div>
                                
                                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">
                                    Choose File
                                    <input 
                                        type="file" 
                                        accept="audio/*" 
                                        onChange={handleTranscriptionUpload}
                                        className="hidden" 
                                    />
                                </label>

                                <div className="flex items-center w-full my-4 max-w-sm">
                                    <div className="h-px bg-slate-700 flex-grow"></div>
                                    <span className="px-3 text-slate-500 text-xs font-semibold uppercase">OR</span>
                                    <div className="h-px bg-slate-700 flex-grow"></div>
                                </div>

                                <button
                                    onClick={startRecording}
                                    className="w-full max-w-sm py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                    </svg>
                                    <span>Record from Microphone</span>
                                </button>
                                
                                {transcriptionFile && (
                                    <div className="mt-6 w-full max-w-md bg-slate-800 p-3 rounded-lg flex items-center justify-between border border-slate-600 shadow-sm animate-fadeIn">
                                        <div className="flex items-center space-x-3 overflow-hidden">
                                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-400 rounded flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs text-slate-400 uppercase font-bold">Audio Ready</span>
                                                <span className="text-sm text-slate-200 truncate">{transcriptionFile.name}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setTranscriptionFile(null)}
                                            className="text-slate-500 hover:text-red-400 p-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                {transcriptionFile && (
                                    <audio controls src={`data:${transcriptionFile.mimeType};base64,${transcriptionFile.data}`} className="mt-4 w-full max-w-md h-8" />
                                )}
                             </div>
                         )}
                    </div>

                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-200">2. Transcription Result</h2>
                            <button
                                onClick={() => navigator.clipboard.writeText(transcriptionResult)}
                                disabled={!transcriptionResult}
                                className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-3 py-1.5 rounded-full transition-colors font-medium flex items-center shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                                Copy Text
                            </button>
                        </div>
                        <textarea
                            value={transcriptionResult}
                            readOnly
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-y min-h-[300px] leading-relaxed font-mono text-sm shadow-inner"
                            placeholder="Transcription will appear here..."
                        />
                    </div>
                </div>
            )}
          </div>

          {/* Right Column: Actions & Preview */}
          <div className="space-y-6">
            <div className="sticky top-6">
              <button
                onClick={handleGenerate}
                disabled={loading || (mode === 'CLONING' && !cloningReference) || (mode === 'TRANSCRIPTION' && !transcriptionFile)}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
              >
                {loading ? (
                   <>
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     <span>{mode === 'TRANSCRIPTION' ? 'Transcribing...' : 'Generating...'}</span>
                   </>
                ) : (
                   <>
                     {mode === 'TRANSCRIPTION' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                     ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                     )}
                     <span>
                        {mode === 'TRANSCRIPTION' 
                            ? "Transcribe Audio" 
                            : (isStale ? "Update & Generate" : "Generate Audio")
                        }
                     </span>
                   </>
                )}
              </button>

              {mode !== 'TRANSCRIPTION' && (
                  <div className="mt-8 animate-fadeIn">
                     <h3 className="text-sm font-semibold text-slate-400 mb-2">Master Output</h3>
                     <AudioPlayer 
                        audio={generatedAudio} 
                        isGenerating={loading} 
                        isStale={isStale}
                        onGenerate={handleGenerate}
                        fileName={formatFileName([appName, featureName, mode === 'CLONING' ? 'Clone' : 'Master'])}
                     />
                  </div>
              )}

              {/* Table of Contents */}
              {mode === 'NARRATION' && (
                 <div className="mt-8">
                    <TableOfContents 
                        snippets={snippets} 
                        appName={appName}
                        featureName={featureName}
                        onGenerateSection={generateSnippet}
                        onGenerateSubsection={generateSubsection}
                    />
                 </div>
              )}

              <div className="mt-8 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Tips</h3>
                <ul className="text-sm text-slate-500 space-y-2 list-disc list-inside">
                  {mode === 'CLONING' ? (
                     <>
                        <li>The model analyzes the <strong>timbre, pitch, and prosody</strong> of your recording.</li>
                        <li>Read the script clearly for best results.</li>
                        <li><strong>Note:</strong> Voice cloning works best when the target text is in the same language as the reference.</li>
                     </>
                  ) : mode === 'TRANSCRIPTION' ? (
                     <>
                        <li>Supports common audio formats like <strong>WAV, MP3, WEBM</strong>.</li>
                        <li>Clear audio with minimal background noise yields the best accuracy.</li>
                        <li>You can also record directly from your microphone.</li>
                     </>
                  ) : (
                     <>
                        <li><strong>New:</strong> Set App & Feature name for organized file exports.</li>
                        <li>Highlight text in Master Text to create a <strong>Section</strong>.</li>
                        <li>Highlight text inside a Section to create a <strong>Subsection</strong>.</li>
                     </>
                  )}
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}