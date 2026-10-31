import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Home from './Home';
import PersonalDashboard from './PersonalDashboard';
import GroupsPage from './GroupsPage';
import AuthForm from './components/AuthForm';
import { createPersonalApi } from './api';

// Minimal hash routing (#/, #/dashboard, #/groups) so no new dependency is needed.
const readRoute = () => window.location.hash.replace(/^#\/?/, '').split('?')[0];
function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const api = useMemo(() => createPersonalApi(), []);
  const route = useRoute();
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
  if (route === 'dashboard') return <PersonalDashboard key={user.id} onSignIn={() => setUser(null)} onSignOut={logout}/>;
  if (route === 'groups') return <GroupsPage key={user.id} user={user} onSignOut={logout} onSignedOut={() => setUser(null)}/>;
  return <Home key={user.id} user={user} onSignOut={logout}/>;
}
