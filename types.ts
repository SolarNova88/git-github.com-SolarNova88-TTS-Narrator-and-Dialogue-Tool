
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Aoede = 'Aoede',
}

export const VOICE_OPTIONS = [
  { name: VoiceName.Kore, description: 'Balanced, calm', gender: 'Female' },
  { name: VoiceName.Puck, description: 'Energetic, youthful', gender: 'Male' },
  { name: VoiceName.Charon, description: 'Deep, authoritative', gender: 'Male' },
  { name: VoiceName.Fenrir, description: 'Rough, intense', gender: 'Male' },
  { name: VoiceName.Aoede, description: 'Classic, professional', gender: 'Female' },
];

export interface Character {
  id: string;
  name: string;
  voice: VoiceName;
}

export interface ScriptLine {
  id: string;
  characterId: string;
  text: string;
}

export type AppMode = 'NARRATION' | 'DIALOGUE' | 'CLONING';

export interface GeneratedAudio {
  blob: Blob;
  url: string;
  duration: number; // in seconds (estimated or actual)
}

export interface Subsection {
  id: string;
  name: string;
  text: string;
  voice: VoiceName;
  audio: GeneratedAudio | null;
  status: 'idle' | 'generating' | 'success' | 'error';
  error: string | null;
}

export interface Snippet {
  id: string;
  name: string; // Section Name
  text: string;
  voice: VoiceName;
  audio: GeneratedAudio | null;
  status: 'idle' | 'generating' | 'success' | 'error';
  error: string | null;
  subsections: Subsection[];
}
