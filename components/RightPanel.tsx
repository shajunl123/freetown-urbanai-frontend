import React from 'react';

interface RightPanelProps {
  canManageCorpus?: boolean;
  isPlatformOwner?: boolean;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  canManageCorpus = false,
  isPlatformOwner = false,
}) => {
  const useCases = [
    { label: 'Briefing Support', value: 'Mayor / Chief of Staff' },
    { label: 'Claim Check', value: 'Safe public language' },
    { label: 'Partner Q&A', value: 'Donor and C40 material' },
    { label: 'Evidence Lookup', value: 'Approved corpus only' },
  ];

  const boundaries = [
    'Briefing support, not tracker replacement',
    'Uses curated evidence, not unrestricted FCC records',
    isPlatformOwner
      ? 'Platform-owner routes cover debug and session governance'
      : canManageCorpus
        ? 'Corpus-operator routes exclude owner-only debug and session inspection'
      : 'Admin and debug controls are not shown in normal briefing use',
    'Outputs require human review before external use',
  ];

  return (
    <div className="hidden lg:flex flex-col w-72 gap-4 h-full pointer-events-auto">
      
      {/* Project Stats - Transparent */}
      <div className="glass-panel rounded-xl p-4 backdrop-blur-sm hover:border-white/20 transition-colors">
        <h3 className="text-xs font-display font-bold uppercase text-gray-400 tracking-widest mb-4">Leadership Use Cases</h3>
        <div className="grid grid-cols-2 gap-3">
            {useCases.map((item) => (
                <div key={item.label} className="bg-black/10 p-2 rounded border border-white/5 hover:bg-black/20 transition-colors">
                    <span className="text-[9px] text-gray-500 uppercase block mb-1">{item.label}</span>
                    <span className="text-xs font-display text-white font-medium block shadow-black">{item.value}</span>
                </div>
            ))}
        </div>
      </div>

      {/* Team Status - Transparent */}
      <div className="flex-1 glass-panel rounded-xl p-4 flex flex-col backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-display font-bold uppercase text-gray-400 tracking-widest">Governance Notes</h3>
            <span className="bg-emerald-400/10 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded border border-emerald-300/20">
              {isPlatformOwner ? 'Owner' : canManageCorpus ? 'Operator' : 'Briefing'}
            </span>
        </div>
        
        <div className="space-y-3">
            {boundaries.map((boundary) => (
                <div key={boundary} className="flex items-start gap-3 p-2 rounded border border-white/5 bg-black/10">
                    <div className="mt-1 w-2 h-2 rounded-full bg-sky-200 shrink-0"></div>
                    <p className="text-xs text-gray-300 leading-relaxed">{boundary}</p>
                </div>
            ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
            <button className="w-full py-2 bg-freetown-blue/10 hover:bg-freetown-blue/20 text-freetown-blue border border-freetown-blue/20 rounded text-xs transition-colors flex items-center justify-center gap-2 group">
                 <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
                Prepare briefing note
            </button>
            {canManageCorpus && (
              <button className="w-full py-2 bg-transparent hover:bg-white/5 text-gray-400 border border-white/10 rounded text-xs transition-colors">
                  Review evidence gaps
              </button>
            )}
        </div>
      </div>
    </div>
  );
};
