
export interface TranscriptionEntry {
  role: 'user' | 'profx';
  text: string;
  timestamp: Date;
}

export interface LiveSessionState {
  isActive: boolean;
  isConnecting: boolean;
  error: string | null;
}
