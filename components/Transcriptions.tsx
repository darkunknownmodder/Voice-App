
import React, { useEffect, useRef } from 'react';
import { TranscriptionEntry } from '../types';

interface TranscriptionsProps {
  entries: TranscriptionEntry[];
}

const Transcriptions: React.FC<TranscriptionsProps> = ({ entries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Conversation History</h3>
        <span className="text-xs text-slate-500">{entries.length} segments</span>
      </div>
      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {entries.map((entry, idx) => (
          <div 
            key={idx} 
            className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              entry.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
            }`}>
              {entry.text}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">
              {entry.role === 'user' ? 'You' : 'ProfX'} • {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Transcriptions;
