import React from 'react';
import { AdminSecurityPanel } from './AdminSecurityPanel';
import { EvidenceDocument, Message, PortfolioProject } from '../types';

interface RightPanelProps {
  canManageCorpus?: boolean;
  isPlatformOwner?: boolean;
  selectedProjects?: PortfolioProject[];
  projectDocuments?: EvidenceDocument[];
  projectMessages?: Message[];
}

export const RightPanel: React.FC<RightPanelProps> = ({
  canManageCorpus = false,
  isPlatformOwner = false,
  selectedProjects = [],
  projectDocuments = [],
  projectMessages = [],
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
  const primaryProject = selectedProjects[0];

  const statusStyle = {
    on_track: 'text-emerald-200 border-emerald-300/25 bg-emerald-400/10',
    delayed: 'text-amber-200 border-amber-300/25 bg-amber-400/10',
    at_risk: 'text-red-200 border-red-300/25 bg-red-400/10',
  };

  const statusLabel = {
    on_track: 'On track',
    delayed: 'Delayed',
    at_risk: 'At risk',
  };

  return (
    <div className="flex flex-col w-full gap-4 h-full max-h-screen overflow-y-auto pr-1 pointer-events-auto">
      {primaryProject && (
        <div className="glass-panel rounded-xl p-4 backdrop-blur-sm hover:border-white/20 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xs font-display font-bold uppercase text-sky-200 tracking-widest">Project Detail</h3>
              <p className="mt-1 text-sm text-white font-medium">{primaryProject.displayName}</p>
            </div>
            <span className={`shrink-0 rounded border px-2 py-1 text-[10px] ${statusStyle[primaryProject.status]}`}>
              {statusLabel[primaryProject.status]}
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">{primaryProject.overview}</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded border border-white/10 bg-black/10 p-2">
              <p className="text-[9px] uppercase tracking-widest text-gray-500">Progress</p>
              <p className="text-lg text-white font-display">{primaryProject.progress}%</p>
            </div>
            <div className="rounded border border-white/10 bg-black/10 p-2">
              <p className="text-[9px] uppercase tracking-widest text-gray-500">Risk</p>
              <p className="text-lg text-white font-display capitalize">{primaryProject.riskLevel}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Key indicators</p>
            <div className="space-y-2">
              {primaryProject.keyMetrics.map((metric) => (
                <div key={metric} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-200 shrink-0" />
                  <span>{metric}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Related documents</p>
            <div className="space-y-2">
              {projectDocuments.slice(0, 4).map((doc) => (
                <div key={doc.id} className="rounded border border-white/5 bg-black/10 p-2">
                  <p className="text-xs text-gray-200 truncate">{doc.title}</p>
                  <p className="text-[10px] text-gray-500">
                    {doc.ingestionStatus || 'registered'} • {doc.chunkCount ?? 0} chunks
                  </p>
                </div>
              ))}
              {projectDocuments.length === 0 && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  No linked documents yet. Retrieval will use project context until portfolio evidence is linked.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Recent project chat</p>
            <div className="space-y-2">
              {projectMessages.length > 0 ? projectMessages.map((message) => (
                <div key={message.id} className="rounded border border-white/5 bg-black/10 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{message.role}</p>
                  <p className="text-xs text-gray-300 line-clamp-2">{message.text}</p>
                </div>
              )) : (
                <p className="text-xs text-gray-500 leading-relaxed">
                  No project-specific chat yet in this session.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedProjects.length > 1 && (
        <div className="glass-panel rounded-xl p-4 backdrop-blur-sm hover:border-white/20 transition-colors">
          <h3 className="text-xs font-display font-bold uppercase text-gray-400 tracking-widest mb-3">
            Project Comparison
          </h3>
          <div className="space-y-2">
            {selectedProjects.map((project) => (
              <div key={project.id} className="rounded border border-white/10 bg-black/10 p-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-white font-medium truncate">{project.name}</p>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] ${statusStyle[project.status]}`}>
                    {statusLabel[project.status]}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-300/70"
                    style={{ width: `${Math.max(5, Math.min(project.progress, 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-500">
                  {project.progress}% progress • {project.riskLevel} risk
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
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

      {isPlatformOwner && <AdminSecurityPanel />}
    </div>
  );
};
