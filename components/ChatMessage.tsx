import React from 'react';
import { Message, Role } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Avatar / Label */}
        <div className="flex items-center mb-2 space-x-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wider shadow-lg
            ${isUser ? 'bg-freetown-blue text-white' : 'bg-freetown-green text-black'}`}>
            {isUser ? 'YOU' : 'AI'}
          </div>
          <span className="text-xs text-gray-300 font-display uppercase tracking-widest drop-shadow-md">
            {isUser ? 'Policy Analyst' : 'UrbanAI System'}
          </span>
        </div>

        {/* Message Bubble - Adjusted Opacity for better readability */}
        <div className={`relative p-5 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-300
          ${isUser 
            ? 'bg-freetown-blue/40 border-freetown-blue/40 rounded-tr-sm text-white hover:bg-freetown-blue/50' 
            : 'bg-[#051024]/80 border-gray-600/40 rounded-tl-sm text-gray-100 hover:bg-[#051024]/90'
          }`}>
          
          {/* Content */}
          <div className="prose prose-invert prose-sm max-w-none font-light leading-relaxed whitespace-pre-wrap relative z-10">
            {message.text}
          </div>

          {/* Grounding / Citations (if any) */}
          {message.groundingChunks && message.groundingChunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
              <h4 className="text-[10px] uppercase tracking-widest text-freetown-green mb-2 flex items-center gap-1 shadow-black drop-shadow-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Live Sources Verified
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