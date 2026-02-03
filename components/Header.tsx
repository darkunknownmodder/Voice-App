
import React from 'react';

interface HeaderProps {
  status: 'idle' | 'connecting' | 'active';
}

const Header: React.FC<HeaderProps> = ({ status }) => {
  return (
    <header className="flex items-center justify-between p-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <i className="fa-solid fa-atom text-xl animate-spin-slow"></i>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">ProfX</h1>
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest">Physics Specialist</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'active' ? 'bg-green-500 animate-pulse' : 
            status === 'connecting' ? 'bg-yellow-500' : 'bg-slate-600'
          }`} />
          <span className="text-xs font-medium text-slate-300">
            {status === 'active' ? 'Live Session' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
