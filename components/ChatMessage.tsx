import React from 'react';
import { Message, Role } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;
  const policyResponse = message.policyResponse;
  const sources = policyResponse?.sources || [];
  const caveats = policyResponse?.caveats || [];
  const claimSafety = policyResponse?.claimSafety;
  const claimSafetyLabel = claimSafety?.level === 'firm'
    ? 'Firm'
    : claimSafety?.level === 'careful'
      ? 'Careful'
      : claimSafety?.level === 'not_ready'
        ? 'Not ready'
        : undefined;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Avatar / Label */}
        <div className="flex items-center mb-2 space-x-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wider shadow-lg
            ${isUser ? 'bg-freetown-blue text-white' : 'bg-emerald-200 text-slate-950'}`}>
            {isUser ? 'YOU' : 'PI'}
          </div>
          <span className="text-xs text-gray-300 font-display uppercase tracking-widest drop-shadow-md">
            {isUser ? 'Policy Advisor' : 'Policy Intelligence'}
          </span>
          {message.mode && (
            <span className="text-[10px] text-gray-400 border border-white/10 rounded px-2 py-0.5 uppercase tracking-wider">
              {message.mode.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Message Bubble - Adjusted Opacity for better readability */}
        <div className={`relative p-5 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-300
          ${isUser 
            ? 'bg-freetown-blue/40 border-freetown-blue/40 rounded-tr-sm text-white hover:bg-freetown-blue/50' 
            : 'bg-slate-950/85 border-gray-600/40 rounded-tl-sm text-gray-100 hover:bg-slate-950/95'
          }`}>
          
          {/* Content */}
          <div className="prose prose-invert prose-sm max-w-none font-light leading-relaxed whitespace-pre-wrap relative z-10">
            {message.text}
          </div>

          {!isUser && claimSafety && (
            <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${
                  claimSafety.level === 'firm'
                    ? 'bg-emerald-400/10 text-emerald-200 border-emerald-300/30'
                    : claimSafety.level === 'careful'
                      ? 'bg-amber-400/10 text-amber-200 border-amber-300/30'
                      : 'bg-red-400/10 text-red-200 border-red-300/30'
                }`}>
                  Claim safety: {claimSafetyLabel}
                </span>
                {claimSafety.explanation && (
                  <span className="text-xs text-gray-300 leading-relaxed flex-1 min-w-[180px]">
                    {claimSafety.explanation}
                  </span>
                )}
              </div>
            </div>
          )}

          {!isUser && sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
              <h4 className="text-[10px] uppercase tracking-widest text-sky-200 mb-2 flex items-center gap-1 shadow-black drop-shadow-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Sources
              </h4>
              <div className="space-y-2">
                {sources.map((source, idx) => {
                  const details = [
                    source.type,
                    source.page ? `p. ${source.page}` : undefined,
                    source.section,
                    typeof source.chunkIndex === 'number' ? `chunk ${source.chunkIndex + 1}` : undefined,
                    source.approvalStatus,
                    source.sensitivityLevel,
                    source.confidence ? `${source.confidence} confidence` : undefined,
                    typeof source.retrievalScore === 'number' ? `score ${source.retrievalScore}` : undefined,
                  ].filter(Boolean).join(' • ');

                  const sourceBody = (
                    <>
                      <span className="text-xs text-gray-100">{source.title}</span>
                      {details && <span className="text-[10px] text-gray-500 block mt-0.5">{details}</span>}
                      {source.snippet && (
                        <span className="text-[11px] text-gray-400 block mt-2 leading-relaxed">
                          {source.snippet}
                        </span>
                      )}
                    </>
                  );

                  return source.url ? (
                    <a
                      key={`${source.title}-${idx}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-black/20 hover:bg-white/5 border border-white/10 rounded p-2 transition-colors"
                    >
                      {sourceBody}
                    </a>
                  ) : (
                    <div key={`${source.title}-${idx}`} className="bg-black/20 border border-white/10 rounded p-2">
                      {sourceBody}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isUser && caveats.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
              <h4 className="text-[10px] uppercase tracking-widest text-amber-200 mb-2">Caveats</h4>
              <ul className="space-y-1">
                {caveats.map((caveat, idx) => (
                  <li key={`${caveat}-${idx}`} className="text-xs text-gray-300 leading-relaxed flex gap-2">
                    <span className="text-amber-200">-</span>
                    <span>{caveat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grounding / Citations (if any) */}
          {message.groundingChunks && message.groundingChunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
              <h4 className="text-[10px] uppercase tracking-widest text-sky-200 mb-2 flex items-center gap-1 shadow-black drop-shadow-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Web Sources
              </h4>
              <div className="flex flex-wrap gap-2">
                {message.groundingChunks.map((chunk, idx) => (
                  chunk.web?.uri && (
                    <a 
                      key={idx}
                      href={chunk.web.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-black/20 hover:bg-freetown-blue/40 border border-white/10 rounded text-xs text-freetown-blue hover:text-white transition-colors truncate max-w-[200px] backdrop-blur-sm"
                    >
                      {chunk.web.title || new URL(chunk.web.uri).hostname}
                    </a>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
