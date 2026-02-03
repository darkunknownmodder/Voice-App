
import React from 'react';

interface AvatarVisualizerProps {
  isSpeaking: boolean;
  isActive: boolean;
}

const AvatarVisualizer: React.FC<AvatarVisualizerProps> = ({ isSpeaking, isActive }) => {
  return (
    <div className="relative flex flex-col items-center justify-center p-12">
      {/* Outer Rings */}
      <div className={`absolute w-64 h-64 rounded-full border border-indigo-500/20 ${isActive ? 'pulse-ring' : ''}`} />
      <div className={`absolute w-80 h-80 rounded-full border border-indigo-500/10 ${isActive ? 'pulse-ring' : ''}`} style={{ animationDelay: '0.5s' }} />
      
      {/* Central Avatar */}
      <div className={`relative z-10 w-48 h-48 rounded-full overflow-hidden border-4 transition-all duration-500 ${
        isSpeaking ? 'border-indigo-400 scale-105 shadow-[0_0_50px_rgba(79,70,229,0.4)]' : 
        isActive ? 'border-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-slate-800'
      }`}>
        <img 
          src="https://picsum.photos/seed/physics/400/400" 
          alt="ProfX Avatar" 
          className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'grayscale-0' : 'grayscale opacity-50'}`}
        />
        
        {/* Particle Overlay */}
        {isActive && (
          <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none mix-blend-overlay" />
        )}
      </div>

      <div className="mt-8 text-center">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-indigo-400">
          {isActive ? "I'm listening..." : "Ready when you are."}
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-xs">
          {isActive 
            ? "Ask me anything about mechanics, quantum physics, or the universe." 
            : "Click 'Start Session' to begin our interactive dialogue."}
        </p>
      </div>
    </div>
  );
};

export default AvatarVisualizer;
