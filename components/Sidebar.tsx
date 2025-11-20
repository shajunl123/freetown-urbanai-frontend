import React from 'react';
import { FreetownStats } from '../types';

export const Sidebar: React.FC = () => {
  // Mock stats for the digital twin look
  const stats: FreetownStats = {
    population: "1.2M+",
    area: "81.5 km²",
    wards: 48,
    activeProjects: 12
  };

  return (
    <aside className="hidden lg:flex w-80 h-screen flex-col glass-panel border-r border-white/10 z-20 relative">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1">
            {/* Abstract Logo */}
          <div className="w-10 h-10 bg-gradient-to-br from-freetown-green to-freetown-blue rounded flex items-center justify-center shadow-lg shadow-freetown-green/20">
            <span className="text-xl font-bold text-white">F</span>
          </div>
          <div>
            <h1 className="text-lg font-display font-bold tracking-tight leading-none text-white">FREETOWN</h1>
            <span className="text-xs text-freetown-green tracking-widest uppercase font-medium">City Council</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400 leading-relaxed">
          Urban Planning & Policy Intelligence Unit. <br/>
          <span className="text-freetown-blue">System Online v2.5</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="p-6 grid grid-cols-2 gap-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="bg-black/20 p-3 rounded border border-white/5">
            <span className="block text-[10px] uppercase text-gray-500 tracking-wider mb-1">{key}</span>
            <span className="block text-lg font-display text-white font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        <div className="text-[10px] uppercase text-gray-600 font-bold tracking-widest px-2 mb-2 mt-4">Modules</div>
        
        <button className="w-full flex items-center gap-3 px-3 py-3 bg-freetown-blue/10 text-freetown-blue border border-freetown-blue/20 rounded-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Policy Chat
        </button>
        
        <button className="w-full flex items-center gap-3 px-3 py-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Documents Library
        </button>
        
        <button className="w-full flex items-center gap-3 px-3 py-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-lg text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Live Geo-Data
        </button>
      </nav>

      {/* Footer Branding */}
      <div className="p-6 border-t border-white/10">
        <div className="flex items-center gap-2 opacity-50">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-xs text-gray-400">Freetown Grid: Stable</span>
        </div>
      </div>
    </aside>
  );
};