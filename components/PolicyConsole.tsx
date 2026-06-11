import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FreetownMap } from './FreetownMap';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { ChatMessage } from './ChatMessage';
import { queryPolicyIntelligence } from '../services/policyIntelligenceService';
import { AuthUser, Message, PolicyIntelligenceMode, Role } from '../types';

const modeOptions: Array<{ value: PolicyIntelligenceMode; label: string }> = [
  { value: 'briefing', label: 'Briefing' },
  { value: 'qa', label: 'Partner Q&A' },
  { value: 'claim_check', label: 'Claim Check' },
  { value: 'evidence_lookup', label: 'Evidence Lookup' },
];

const initialMessages: Message[] = [
  {
    id: 'intro',
    role: Role.MODEL,
    text: "Freetown UrbanAI is ready for Mayor's Office briefing support. Ask about climate portfolio evidence, AQS, Moyiba, CAP materials, or partner-facing claim language.",
    groundingChunks: [],
    mode: 'briefing',
    policyResponse: {
      answer:
        "Freetown UrbanAI is ready for Mayor's Office briefing support. Ask about climate portfolio evidence, AQS, Moyiba, CAP materials, or partner-facing claim language.",
      mode: 'briefing',
      claimSafety: {
        level: 'careful',
        explanation:
          'Responses should be treated as briefing support until checked against approved source material.',
      },
    },
  },
];

interface PolicyConsoleProps {
  currentUser: AuthUser;
  onLogout: () => Promise<void>;
}

export const PolicyConsole: React.FC<PolicyConsoleProps> = ({
  currentUser,
  onLogout,
}) => {
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<PolicyIntelligenceMode>('briefing');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [showParticles, setShowParticles] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActionTimeRef = useRef(Date.now());
  const isPlatformOwner = currentUser.role === 'admin';
  const canManageCorpus =
    isPlatformOwner || currentUser.role === 'operator';
  const roleLabel =
    currentUser.role === 'admin'
      ? 'Platform owner'
      : currentUser.role === 'operator'
        ? 'Corpus operator'
        : 'Briefing user';

  const handleUserAction = useCallback(() => {
    lastActionTimeRef.current = Date.now();
    setShowParticles((prev) => {
      if (prev === true) return false;
      return prev;
    });
  }, []);

  useEffect(() => {
    const checkIdle = setInterval(() => {
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
      if (timeSinceLastAction > 10000) {
        setShowParticles((prev) => {
          if (prev === false) return true;
          return prev;
        });
      }
    }, 1000);
    return () => clearInterval(checkIdle);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 1) handleUserAction();
  }, [messages, handleUserAction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleUserAction();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      mode: selectedMode,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        role: Role.MODEL,
        text: '',
        isThinking: true,
      },
    ]);

    try {
      const startedAt = performance.now();
      const response = await queryPolicyIntelligence(userMsg.text, selectedMode);
      const finishedAt = performance.now();
      setLastLatencyMs(Math.round(finishedAt - startedAt));

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                text: response.answer,
                isThinking: false,
                groundingChunks: [],
                policyResponse: response,
                mode: response.mode || selectedMode,
              }
            : msg
        )
      );
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message || 'Unable to verify policy data sources.'
          : 'Unable to verify policy data sources.';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, text: errMsg, isThinking: false } : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full text-white font-sans overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <FreetownMap showParticles={showParticles} />
      </div>

      <div className="relative z-10 flex flex-col h-full w-full pointer-events-none">
        <header className="h-16 mx-4 mt-4 flex items-center justify-between shrink-0">
          <div className="pointer-events-auto glass-panel rounded-lg px-6 py-2 flex items-center gap-4 bg-slate-950/45 backdrop-blur-sm shadow-lg">
            <div className="relative w-10 h-10 bg-slate-950/80 rounded flex items-center justify-center border border-white/20">
              <span className="font-bold text-xl tracking-tighter text-white">F</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-none tracking-wide text-white">
                FREETOWN <span className="font-light opacity-90 text-sky-200">URBANAI</span>
              </h1>
              <div className="text-[9px] text-emerald-200 uppercase tracking-[0.2em] mt-1 font-medium">
                MAYOR'S OFFICE POLICY INTELLIGENCE PILOT
              </div>
            </div>
          </div>

          <div className="pointer-events-auto glass-panel rounded-lg px-6 py-2 hidden md:flex items-center gap-6 bg-slate-950/45 backdrop-blur-sm">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-300 uppercase tracking-wider font-medium">
                Evidence Boundary
              </span>
              <span className="text-xs text-emerald-200 font-medium">
                Approved sources by default
              </span>
            </div>
            <div className="h-8 w-[1px] bg-white/20" />
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs text-white font-medium">{currentUser.name}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                  {roleLabel}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/30 flex items-center justify-center text-xs font-semibold uppercase">
                {currentUser.name?.[0] || currentUser.email[0]}
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="text-[10px] uppercase tracking-wider text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 mt-4 flex gap-4 overflow-hidden">
          <div
            onMouseEnter={handleUserAction}
            onClick={handleUserAction}
            className="pointer-events-auto h-full w-80 shrink-0 hidden md:block"
          >
            <LeftPanel
              canManageCorpus={canManageCorpus}
              isPlatformOwner={isPlatformOwner}
            />
          </div>

          <main
            className="pointer-events-auto flex-1 rounded-lg border border-white/10 flex flex-col overflow-hidden relative shadow-2xl bg-slate-950/35 backdrop-blur-[2px]"
            onClick={handleUserAction}
            onKeyDown={handleUserAction}
            onMouseMove={handleUserAction}
          >
            <div className="p-4 pt-6 border-b border-white/10 bg-slate-950/30 flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2 h-2 bg-emerald-300 rounded-full" />
                <span className="text-xs text-gray-200 shadow-black text-shadow font-medium uppercase tracking-wider">
                  Source-grounded response console
                </span>
                {lastLatencyMs !== null && (
                  <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 rounded px-2 py-1">
                    Last response: {lastLatencyMs} ms
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                {modeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedMode(option.value);
                      handleUserAction();
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      selectedMode === option.value
                        ? 'bg-white/15 text-white border border-white/15'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative"
              onScroll={handleUserAction}
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-30" />

              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {isLoading && !messages[messages.length - 1].text && (
                <div className="flex items-center space-x-2 ml-4 text-sky-200 animate-pulse">
                  <div className="w-1.5 h-1.5 bg-current rounded-full" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full animation-delay-200" />
                  <div className="w-1.5 h-1.5 bg-current rounded-full animation-delay-400" />
                  <span className="text-xs ml-2 uppercase opacity-80 tracking-wider">
                    Checking approved evidence...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-950/40 backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <div className="flex-1 relative group">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      handleUserAction();
                    }}
                    onFocus={handleUserAction}
                    placeholder="Ask about climate portfolio, AQS, Moyiba, CAP evidence, or partner briefing language..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-sky-200/60 transition-all font-light shadow-inner hover:bg-white/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={`p-3 rounded-lg transition-all duration-300 flex items-center justify-center border border-transparent ${
                    isLoading || !input.trim()
                      ? 'bg-white/10 text-gray-500'
                      : 'bg-freetown-blue hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(0,114,198,0.5)] hover:border-blue-300'
                  }`}
                >
                  <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </main>

          <div
            onMouseEnter={handleUserAction}
            onClick={handleUserAction}
            className="pointer-events-auto h-full w-80 shrink-0 hidden lg:block"
          >
            <RightPanel
              canManageCorpus={canManageCorpus}
              isPlatformOwner={isPlatformOwner}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
