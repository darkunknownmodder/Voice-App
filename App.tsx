
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, encode, decodeAudioData } from './utils/audioUtils';
import { TranscriptionEntry } from './types';
import Header from './components/Header';
import AvatarVisualizer from './components/AvatarVisualizer';
import Transcriptions from './components/Transcriptions';

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio handling
  const sessionRef = useRef<any>(null);
  const audioContextInputRef = useRef<AudioContext | null>(null);
  const audioContextOutputRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Buffer transcriptions to avoid rapid state updates
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
      sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextInputRef.current) {
      audioContextInputRef.current.close();
      audioContextInputRef.current = null;
    }
    if (audioContextOutputRef.current) {
      audioContextOutputRef.current.close();
      audioContextOutputRef.current = null;
    }
    
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    
    setIsActive(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    nextStartTimeRef.current = 0;
  }, []);

  const createPCMData = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Initialize Audio Contexts immediately in response to user gesture
      // This is critical for mobile browsers (iOS Safari, Chrome on Android)
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      // Explicitly resume contexts - essential for mobile
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      audioContextInputRef.current = inputCtx;
      audioContextOutputRef.current = outputCtx;
      
      outputNodeRef.current = outputCtx.createGain();
      outputNodeRef.current.connect(outputCtx.destination);

      // 2. Request Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('ProfX Session opened');
            setIsActive(true);
            setIsConnecting(false);

            // Setup input audio stream
            const source = audioContextInputRef.current!.createMediaStreamSource(stream);
            // Using 4096 as a middle ground for performance vs latency on mobile
            scriptProcessorRef.current = audioContextInputRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPCMData(inputData);
              sessionPromise.then(session => {
                if (session) {
                  session.sendRealtimeInput({ media: pcmBlob });
                }
              }).catch(err => console.error("Failed to send input", err));
            };

            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextInputRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Data
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              const ctx = audioContextOutputRef.current!;
              
              // Ensure context is still running (mobile might suspend it if idle)
              if (ctx.state === 'suspended') await ctx.resume();
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              try {
                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current!);
                
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setIsSpeaking(false);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              } catch (decodeErr) {
                console.error("Audio decoding failed", decodeErr);
              }
            }

            // Handle Transcriptions
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscription.current.trim();
              const profText = currentOutputTranscription.current.trim();
              
              if (userText || profText) {
                setTranscriptions(prev => [
                  ...prev,
                  ...(userText ? [{ role: 'user', text: userText, timestamp: new Date() } as TranscriptionEntry] : []),
                  ...(profText ? [{ role: 'profx', text: profText, timestamp: new Date() } as TranscriptionEntry] : [])
                ]);
              }
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error('ProfX Session Error:', e);
            setError('Quantum link disrupted. Let\'s try reconnecting.');
            stopSession();
          },
          onclose: (e) => {
            console.log('ProfX Session Closed:', e);
            stopSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `Role: You are "ProfX", a world-class Physics Specialist and interactive Voice AI Agent. Your goal is to make physics engaging, intuitive, and easy to understand for everyone.
Tone & Personality: Professional yet friendly, witty, and highly encouraging. Use real-world analogies. You are patient.
Language Capabilities: Fully Bilingual: You must support both Bengali and English fluently. Respond in the language the user uses.
Core Functions: Accurate explanations for Mechanics, Quantum Physics, Thermodynamics, Relativity. Problem-solving step-by-step. Keep responses concise for voice interaction.
Signature Style: Occasionally use catchphrases like "Physics is the rhythm of the universe!" or "Let's dive into the atoms!"
Constraints: Only Physics/Science. No dangerous content. Admit if you don't know something.`,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Failed to start session:', err);
      let errorMessage = 'Could not access microphone or connect to ProfX.';
      if (err.name === 'NotAllowedError') errorMessage = 'Microphone permission denied. Please enable it in settings.';
      if (err.name === 'NotFoundError') errorMessage = 'No microphone found on this device.';
      setError(errorMessage);
      setIsConnecting(false);
      stopSession();
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header status={isActive ? 'active' : isConnecting ? 'connecting' : 'idle'} />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col items-center">
        {error && (
          <div className="w-full mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 animate-pulse">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        )}

        <AvatarVisualizer isActive={isActive} isSpeaking={isSpeaking} />

        <div className="w-full max-w-md mx-auto flex flex-col items-center mt-10">
          {!isActive && !isConnecting ? (
            <button
              onClick={startSession}
              className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold transition-all duration-300 shadow-xl shadow-indigo-600/30 flex items-center gap-3 overflow-hidden active:scale-95"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <i className="fa-solid fa-microphone text-xl"></i>
              <span>Start Physics Session</span>
            </button>
          ) : isConnecting ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex space-x-1 items-end h-8">
                <div className="w-2 bg-indigo-500 animate-[bounce_1s_infinite_0ms]"></div>
                <div className="w-2 bg-indigo-500 animate-[bounce_1s_infinite_100ms]"></div>
                <div className="w-2 bg-indigo-500 animate-[bounce_1s_infinite_200ms]"></div>
              </div>
              <p className="text-slate-400 font-medium text-sm">Synchronizing atoms...</p>
            </div>
          ) : (
            <button
              onClick={stopSession}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all duration-300 border border-white/10 flex items-center gap-3 active:scale-95"
            >
              <i className="fa-solid fa-stop text-xl text-red-500"></i>
              <span>End Dialogue</span>
            </button>
          )}
        </div>

        <Transcriptions entries={transcriptions} />
      </main>

      <footer className="p-8 text-center border-t border-white/5 bg-slate-950">
        <div className="max-w-md mx-auto">
          <p className="text-slate-500 text-xs italic">
            "Physics is the rhythm of the universe!"
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-1 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              <i className="fa-solid fa-language text-indigo-500/50"></i>
              English & Bengali
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              <i className="fa-solid fa-bolt text-yellow-500/50"></i>
              Gemini 2.5 Live
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
