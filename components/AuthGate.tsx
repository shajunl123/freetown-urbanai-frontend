import React, { useState } from 'react';
import { FreetownMap } from './FreetownMap';

interface AuthGateProps {
  status: 'checking' | 'ready';
  error: string | null;
  isSubmitting: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  status,
  error,
  isSubmitting,
  onLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(email, password);
    setPassword('');
  };

  return (
    <div className="relative h-screen w-full text-white font-sans overflow-hidden bg-black">
      <div className="absolute inset-0 z-0 opacity-45">
        <FreetownMap showParticles={false} />
      </div>
      <div className="absolute inset-0 z-[1] bg-slate-950/65" />

      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950/85 p-6 shadow-2xl backdrop-blur-md">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-200 mb-3">
              Internal Pilot Access
            </p>
            <h1 className="text-2xl font-display font-bold mb-2">
              Freetown UrbanAI
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Mayor's Office Policy Intelligence Pilot for approved evidence and briefing support.
            </p>
          </div>

          {status === 'checking' ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-gray-300">Checking internal access...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-sm text-white mb-4 focus:outline-none focus:border-sky-200/60"
                autoComplete="email"
                required
              />

              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-sm text-white mb-4 focus:outline-none focus:border-sky-200/60"
                autoComplete="current-password"
                required
              />

              {error && (
                <p className="text-xs text-amber-200 border border-amber-300/20 bg-amber-400/10 rounded p-3 mb-4">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-freetown-blue hover:bg-blue-500 disabled:bg-white/10 disabled:text-gray-500 py-3 text-sm font-medium transition-colors"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          <p className="text-[10px] text-gray-500 leading-relaxed mt-4">
            Access is limited to configured pilot users. Outputs remain briefing support and require human review before external use.
          </p>
        </section>
      </div>
    </div>
  );
};
