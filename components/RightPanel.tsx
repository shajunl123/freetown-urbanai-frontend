import React from 'react';
import { TeamMember, FreetownStats } from '../types';

export const RightPanel: React.FC = () => {
  const team: TeamMember[] = [
    { id: '1', name: 'Yvonne Aki-Sawyerr', role: 'Mayor', status: 'online', initials: 'YS' },
    { id: '2', name: 'Modupe Williams', role: 'Head of Urban Planning', status: 'busy', initials: 'MW' },
    { id: '3', name: 'Muyi Yang', role: 'Technical Policy Consultant', status: 'offline', initials: 'MY' },
  ];

  const stats: FreetownStats = {
    population: "1.2M+",
    area: "81.5 km²",
    wards: 48,
    activeProjects: 14
  };

  return (
    <div className="hidden lg:flex flex-col w-72 gap-4 h-full pointer-events-auto">
      
      {/* Project Stats - Transparent */}
      <div className="glass-panel rounded-xl p-4 backdrop-blur-sm hover:border-white/20 transition-colors">
        <h3 className="text-xs font-display font-bold uppercase text-gray-400 tracking-widest mb-4">City Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="bg-black/5 p-2 rounded border border-white/5 hover:bg-black/10 transition-colors">
                    <span className="text-[9px] text-gray-500 uppercase block mb-1">{key}</span>
                    <span className="text-sm font-display text-white font-bold block shadow-black">{value}</span>
                </div>
            ))}
        </div>
      </div>

      {/* Team Status - Transparent */}
      <div className="flex-1 glass-panel rounded-xl p-4 flex flex-col backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-display font-bold uppercase text-gray-400 tracking-widest">Active Personnel</h3>
            <span className="bg-freetown-blue/10 text-freetown-blue text-[10px] px-1.5 py-0.5 rounded border border-freetown-blue/20">3 ONLINE</span>
        </div>
        
        <div className="space-y-3">
            {team.map(member => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5 group">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700/50 to-gray-800/50 border border-white/10 flex items-center justify-center text-xs font-bold text-white group-hover:border-white/30 transition-colors">
                            {member.initials}
                        </div>
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black
                            ${member.status === 'online' ? 'bg-green-500' : member.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'}`} 
                        />
                    </div>
                    <div>
                        <h4 className="text-sm text-gray-200 font-medium leading-tight group-hover:text-white shadow-black">{member.name}</h4>
                        <span className="text-[10px] text-gray-300 uppercase tracking-wide group-hover:text-freetown-blue transition-colors">
                          {member.role}
                        </span>
                    </div>
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
                Schedule Site Inspection
            </button>
            <button className="w-full py-2 bg-transparent hover:bg-white/5 text-gray-400 border border-white/10 rounded text-xs transition-colors">
                Additional Requests
            </button>
        </div>
      </div>
    </div>
  );
};