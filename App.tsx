import React, { useCallback, useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { PolicyConsole } from './components/PolicyConsole';
import {
  fetchCurrentUser,
  loginPolicyUser,
  logoutPolicyUser,
} from './services/policyIntelligenceService';
import { AuthUser } from './types';

type AuthState = 'checking' | 'anonymous' | 'authenticated';

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    setAuthState('checking');
    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);
      setAuthState(user ? 'authenticated' : 'anonymous');
    } catch {
      setCurrentUser(null);
      setAuthState('anonymous');
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      setAuthState('anonymous');
      setLoginError('Your access session has expired. Please sign in again.');
    };

    window.addEventListener('policy-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('policy-auth-expired', handleAuthExpired);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setLoginError(null);
    setIsLoginSubmitting(true);
    try {
      const session = await loginPolicyUser(email, password);
      setCurrentUser(session.user);
      setAuthState('authenticated');
    } catch (err) {
      setCurrentUser(null);
      setAuthState('anonymous');
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutPolicyUser();
    setCurrentUser(null);
    setAuthState('anonymous');
    setLoginError(null);
  };

  if (authState !== 'authenticated' || !currentUser) {
    return (
      <AuthGate
        status={authState === 'checking' ? 'checking' : 'ready'}
        error={loginError}
        isSubmitting={isLoginSubmitting}
        onLogin={handleLogin}
      />
    );
  }

  return <PolicyConsole currentUser={currentUser} onLogout={handleLogout} />;
};

export default App;
