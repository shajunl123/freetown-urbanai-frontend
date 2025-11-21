import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FreetownMap } from './components/FreetownMap';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ChatMessage } from './components/ChatMessage';
import { queryFlowise } from './services/geminiService';
import { Message, Role } from './types';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      role: Role.MODEL,
      text: "Kushe! I am the FCC Urban Planning Assistant. I can analyze technical documents, cross-reference \"Freetown the Treetown\" initiatives, and retrieve live environmental data. How may I assist the policy team today?",
      groundingChunks: []
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- IDLE DETECTION FOR PARTICLES ---
  const [showParticles, setShowParticles] = useState(true);
  const lastActionTimeRef = useRef(Date.now());

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
  // -------------------------------------

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 1) {
        handleUserAction(); 
    }
  }, [messages, handleUserAction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleUserAction();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: Role.MODEL,
      text: '',
      isThinking: true
    }]);

    try {
      // Note: Switched to queryFlowise because it is the imported service
      const response = await queryFlowise(userMsg.text);

    setMessages(prev => prev.map(msg => 
    msg.id === aiMsgId 
    ? { ...msg, text: response, isThinking: false, groundingChunks: [] } 
    : msg
    ));

    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId 
          ? { ...msg, text: "Connection interrupted. Unable to verify policy data sources.", isThinking: false } 
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full text-white font-sans overflow-hidden bg-black">
      
      {/* Background Layer (Z-0) */}
      <div className="absolute inset-0 z-0">
        <FreetownMap showParticles={showParticles} />
      </div>

      {/* Foreground UI Layer (Z-10) */}
      <div className="relative z-10 flex flex-col h-full w-full pointer-events-none">
        
        {/* Top Banner / Header */}
        <header className="h-16 mx-4 mt-4 flex items-center justify-between shrink-0">
          
          {/* Left Block */}
          <div className="pointer-events-auto glass-panel rounded-xl px-6 py-2 flex items-center gap-4 bg-freetown-blue/5 backdrop-blur-sm shadow-[0_0_25px_rgba(68,244,255,0.15)]">
              <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-freetown-green to-freetown-blue rounded blur opacity-40"></div>
                  <div className="relative w-10 h-10 bg-black/40 rounded flex items-center justify-center border border-white/20">
                    <span className="font-bold text-xl tracking-tighter text-white">F</span>
                  </div>
              </div>
              <div>
                  <h1 className="font-display font-bold text-lg leading-none tracking-wide text-white">FREETOWN <span className="font-light opacity-90 text-freetown-neonBlue">URBAN AI</span></h1>
                  <div className="text-[9px] text-freetown-neonGreen uppercase tracking-[0.25em] mt-1 font-medium">DIGITAL ENVIRONMENT POLICY ASSISTANT</div>
              </div>
          </div>
          
          {/* Right Block */}
          <div className="pointer-events-auto glass-panel rounded-xl px-6 py-2 hidden md:flex items-center gap-6 bg-freetown-blue/5 backdrop-blur-sm">
              <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-300 uppercase tracking-wider font-medium">System Status</span>
                  <span className="text-xs text-freetown-neonGreen font-mono shadow-[0_0_10px_rgba(0,255,157,0.4)]">● OPERATIONAL</span>
              </div>
              <div className="h-8 w-[1px] bg-white/20"></div>
              <div className="flex items-center gap-3">
                  <span className="text-xs text-white font-medium">Planning Unit</span>
                  <div className="w-8 h-8 rounded-full bg-gray-700/50 border border-white/30 overflow-hidden ring-2 ring-freetown-neonBlue/30">
                      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=PolicyUser" alt="Profile" className="w-full h-full" />
                  </div>
              </div>
          </div>
        </header>

        {/* Main Grid Layout - Added mt-4 to push content below header */}
        <div className="flex-1 p-4 mt-4 flex gap-4 overflow-hidden">
          
          {/* LEFT PANEL */}
          <div onMouseEnter={handleUserAction} onClick={handleUserAction} className="pointer-events-auto h-full w-80 shrink-0 hidden md:block">
              <LeftPanel />
          </div>

          {/* CENTER PANEL (CHAT) */}
          <main 
              className="pointer-events-auto flex-1 rounded-xl border border-white/10 flex flex-col overflow-hidden relative shadow-2xl bg-transparent backdrop-blur-[1px]"
              onClick={handleUserAction}
              onKeyDown={handleUserAction}
              onMouseMove={handleUserAction}
          >
              {/* Chat Header - Now includes context dropdown */}
              <div className="p-4 pt-8 border-b border-white/10 bg-transparent flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-freetown-neonGreen rounded-full animate-pulse shadow-[0_0_8px_rgba(0,255,157,0.6)]"></span>
                      <span className="text-xs font-mono text-gray-300 shadow-black text-shadow font-medium">SECURE CHANNEL</span>
                  </div>
                  
                  {/* Context Dropdown */}
                  <div className="relative">
                    <select 
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-freetown-neonBlue/50 appearance-none pr-8"
                      defaultValue="FCC Air Quality Sensor Project"
                    >
                      <option value="FCC Air Quality Sensor Project">FCC Air Quality Sensor Project</option>
                      <option value="Urban Development Plan 2028">Urban Development Plan 2028</option>
                      <option value="Freetown Green Belt Initiative">Freetown Green Belt Initiative</option>
                      <option value="Waste Management System">Waste Management System</option>
                      <option value="Flood Risk Assessment">Flood Risk Assessment</option>
                    </select>
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
              </div>

              {/* Messages */}
              <div 
                  className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth relative"
                  onScroll={handleUserAction} 
              >
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-30"></div>

                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  
                  {isLoading && !messages[messages.length-1].text && (
                    <div className="flex items-center space-x-2 ml-4 text-freetown-neonBlue animate-pulse">
                      <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-full animation-delay-200"></div>
                      <div className="w-1.5 h-1.5 bg-current rounded-full animation-delay-400"></div>
                      <span className="text-xs font-mono ml-2 uppercase opacity-80">Processing Urban Data...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/10 bg-freetown-blue/5 backdrop-blur-sm">
                  <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                      <button type="button" className="p-3 rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-colors border border-white/5 hover:border-white/20">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      </button>
                      
                      <div className="flex-1 relative group">
                          <input
                              type="text"
                              value={input}
                              onChange={(e) => {
                                  setInput(e.target.value);
                                  handleUserAction();
                              }}
                              onFocus={handleUserAction}
                              placeholder="Query document archives, live data, or strategic plans..."
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-freetown-neonBlue/50 focus:border-freetown-neonBlue/50 transition-all font-light shadow-inner hover:bg-white/15"
                          />
                          <div className="absolute right-3 top-3 text-[10px] text-gray-400 border border-gray-600 rounded px-1 group-focus-within:border-freetown-neonBlue/50 group-focus-within:text-freetown-neonBlue">CMD + K</div>
                      </div>

                      <button 
                          type="submit"
                          disabled={isLoading || !input.trim()}
                          className={`p-3 rounded-lg transition-all duration-300 flex items-center justify-center border border-transparent
                              ${isLoading || !input.trim() 
                                  ? 'bg-white/10 text-gray-500' 
                                  : 'bg-freetown-blue hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(0,114,198,0.5)] hover:border-blue-300'
                              }`
                          }
                      >
                          <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                  </form>
              </div>
          </main>

          {/* RIGHT PANEL */}
          <div onMouseEnter={handleUserAction} onClick={handleUserAction} className="pointer-events-auto h-full w-80 shrink-0 hidden lg:block">
              <RightPanel />
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;