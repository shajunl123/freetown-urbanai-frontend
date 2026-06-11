import React from 'react';

export const Sidebar: React.FC = () => {
  const modules = [
    'Briefing Support',
    'Approved Evidence Corpus',
    'Claim Safety Review',
  ];

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
            <span className="text-xs text-emerald-200 tracking-widest uppercase font-medium">UrbanAI</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400 leading-relaxed">
          Mayor's Office Policy Intelligence Pilot. <br/>
          <span className="text-sky-200">Source-grounded briefing support</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="p-6 grid grid-cols-2 gap-4">
        {['Curated evidence', 'Human review', 'Pilot status', 'Briefing use'].map((item) => (
          <div key={item} className="bg-black/20 p-3 rounded border border-white/5">
            <span className="block text-[10px] uppercase text-gray-500 tracking-wider mb-1">Boundary</span>
            <span className="block text-xs font-display text-white font-medium">{item}</span>
          </div>
        ))}
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        <div className="text-[10px] uppercase text-gray-600 font-bold tracking-widest px-2 mb-2 mt-4">Modules</div>
        
        {modules.map((module, index) => (
          <button
            key={module}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
              index === 0
                ? 'bg-freetown-blue/10 text-freetown-blue border border-freetown-blue/20 font-medium'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {module}
          </button>
        ))}
      </nav>

      {/* Footer Branding */}
      <div className="p-6 border-t border-white/10">
        <div className="flex items-center gap-2 opacity-50">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-xs text-gray-400">Prototype boundary active</span>
        </div>
      </div>
    </aside>
  );
};
