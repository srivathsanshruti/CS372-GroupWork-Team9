import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PersonalDashboard from './PersonalDashboard';
import AuthForm from './components/AuthForm';
import { createPersonalApi } from './api';

export default function App() {
  const api = useMemo(() => createPersonalApi(), []);
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true), [error, setError] = useState('');
  const checkSession = useCallback(async () => {
    setChecking(true); setError('');
    try { setUser(await api('/me')); }
    catch (e) { if (e.status !== 401) setError(e.message); setUser(null); }
    finally { setChecking(false); }
  }, [api]);
  useEffect(() => { checkSession(); }, [checkSession]);
  async function logout() {
    setError('');
    try { await api('/auth/logout', { method:'POST' }); setUser(null); }
    catch (e) { setError(e.message); }
  }
  if (checking) return <div className="personal-app"><main className="page-width py-5" role="status">Checking your session…</main></div>;
  if (error) return <div className="personal-app"><main className="page-width py-5"><div className="feedback failure" role="alert">{error}</div><button className="btn btn-primary" onClick={checkSession}>Try again</button></main></div>;
  if (!user) return <AuthForm api={api} onAuthenticated={setUser}/>;
  return <PersonalDashboard key={user.id} onSignIn={() => setUser(null)} onSignOut={logout}/>;
}
