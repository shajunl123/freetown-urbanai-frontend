import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FreetownMap } from './FreetownMap';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { ChatMessage } from './ChatMessage';
import { ProjectSelector } from './ProjectSelector';
import {
  fetchProjectDocuments,
  fetchProjects,
  queryPolicyIntelligence,
} from '../services/policyIntelligenceService';
import { AuthUser, EvidenceDocument, Message, PolicyIntelligenceMode, PortfolioProject, Role } from '../types';

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
  onOpenAdmin?: () => void;
}

export const PolicyConsole: React.FC<PolicyConsoleProps> = ({
  currentUser,
  onLogout,
  onOpenAdmin,
}) => {
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<PolicyIntelligenceMode>('briefing');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [showParticles, setShowParticles] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<EvidenceDocument[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
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

  useEffect(() => {
    setIsProjectsLoading(true);
    fetchProjects()
      .then(setProjects)
      .catch((err) => {
        console.error('Project registry unavailable:', err);
        setProjects([]);
      })
      .finally(() => setIsProjectsLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProjectIds.length === 0) {
      setProjectDocuments([]);
      return;
    }
    Promise.all(selectedProjectIds.map((projectId) => fetchProjectDocuments(projectId)))
      .then((results) => {
        const seen = new Set<string>();
        const deduped: EvidenceDocument[] = [];
        for (const doc of results.flat()) {
          if (seen.has(doc.id)) continue;
          seen.add(doc.id);
          deduped.push(doc);
        }
        setProjectDocuments(deduped);
      })
      .catch((err) => {
        console.error('Project documents unavailable:', err);
        setProjectDocuments([]);
      });
  }, [selectedProjectIds]);

  const submitPrompt = async () => {
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
      const response = await queryPolicyIntelligence(userMsg.text, selectedMode, selectedProjectIds);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPrompt();
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        void submitPrompt();
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setInput('');
        setMessages(initialMessages);
      }
      if (event.key === '/') {
        event.preventDefault();
        setShowHelp((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [input, isLoading, selectedMode]);

  const visibleMessages = historySearch.trim()
    ? messages.filter((message) =>
        message.text.toLowerCase().includes(historySearch.trim().toLowerCase())
      )
    : messages;
  const selectedProjects = selectedProjectIds
    .map((projectId) => projects.find((project) => project.id === projectId))
    .filter((project): project is PortfolioProject => Boolean(project));
  const projectMessages = selectedProjects.length === 0
    ? []
    : messages.filter((message) => {
        const text = message.text.toLowerCase();
        return selectedProjects.some((project) =>
          text.includes(project.name.toLowerCase()) ||
          text.includes(project.slug.replace(/-/g, ' '))
        );
      }).slice(-4);

  const exportMarkdown = () => {
    const content = messages
      .map((message) => {
        const role = message.role === Role.USER ? 'User' : 'UrbanAI';
        const sources = message.policyResponse?.sources
          ?.map((source) => `- ${source.title}${source.section ? `, ${source.section}` : ''}`)
          .join('\n');
        return [`## ${role}`, '', message.text, sources ? `\nSources:\n${sources}` : ''].join('\n');
      })
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `urbanai-chat-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const printable = window.open('', '_blank');
    if (!printable) return;
    const body = messages
      .map((message) => `<section><h2>${message.role === Role.USER ? 'User' : 'UrbanAI'}</h2><p>${message.text.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p></section>`)
      .join('');
    printable.document.write(`
      <html><head><title>UrbanAI Analysis Export</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:32px;color:#111}section{border-bottom:1px solid #ddd;padding:16px 0}h1{font-size:20px}h2{font-size:14px;text-transform:uppercase;color:#334155}p{font-size:13px;line-height:1.6}</style>
      </head><body><h1>Freetown UrbanAI Analysis</h1>${body}</body></html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
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
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="text-[10px] uppercase tracking-wider text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded px-2 py-1 bg-amber-500/10"
                >
                  Admin
                </button>
              )}
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

        <div className="flex-1 p-3 md:p-4 mt-2 md:mt-4 flex gap-3 lg:gap-4 overflow-hidden">
          <div
            onMouseEnter={handleUserAction}
            onClick={handleUserAction}
            className="pointer-events-auto h-full max-h-full w-72 lg:w-80 shrink-0 hidden md:block"
          >
            <LeftPanel
              canManageCorpus={canManageCorpus}
              isPlatformOwner={isPlatformOwner}
              selectedProjects={selectedProjects}
              projectDocuments={projectDocuments}
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

              <div className="flex flex-wrap gap-2">
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search chat history"
                  className="w-full sm:w-48 bg-black/25 border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-gray-500"
                />
                <button type="button" onClick={exportMarkdown} className="px-3 py-1.5 rounded border border-white/10 bg-white/5 text-xs text-gray-300 hover:text-white">
                  Export MD
                </button>
                <button type="button" onClick={exportPdf} className="px-3 py-1.5 rounded border border-white/10 bg-white/5 text-xs text-gray-300 hover:text-white">
                  Export PDF
                </button>
              </div>
            </div>

            <div className="border-b border-white/10 bg-slate-950/25 p-4">
              <ProjectSelector
                projects={projects}
                selectedProjectIds={selectedProjectIds}
                onChange={(ids) => {
                  setSelectedProjectIds(ids);
                  handleUserAction();
                }}
                isLoading={isProjectsLoading}
              />
            </div>

            <div
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative"
              onScroll={handleUserAction}
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-30" />

              {visibleMessages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {visibleMessages.length === 0 && (
                <div className="relative rounded border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                  No messages match this search.
                </div>
              )}

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
            className="pointer-events-auto h-full max-h-full w-80 shrink-0 hidden xl:block"
          >
            <RightPanel
              canManageCorpus={canManageCorpus}
              isPlatformOwner={isPlatformOwner}
              selectedProjects={selectedProjects}
              projectDocuments={projectDocuments}
              projectMessages={projectMessages}
            />
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-auto">
          <div className="glass-panel w-[min(420px,calc(100vw-32px))] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display font-bold uppercase tracking-widest text-white">Keyboard Help</h2>
              <button type="button" onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white">Close</button>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex justify-between gap-4"><span>Send message</span><span className="text-sky-200">Ctrl+Enter</span></div>
              <div className="flex justify-between gap-4"><span>Clear chat</span><span className="text-sky-200">Ctrl+K</span></div>
              <div className="flex justify-between gap-4"><span>Toggle help</span><span className="text-sky-200">Ctrl+/</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
