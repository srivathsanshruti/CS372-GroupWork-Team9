import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Home from './Home';
import PersonalDashboard from './PersonalDashboard';
import AuthForm from './components/AuthForm';
import SiteHeader from './components/SiteHeader';
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

// TODO(groups): the groups page is owned by another teammate. Replace this stub with their
// component (e.g. <GroupsPage user={user} />) so the homepage's "Groups" links land somewhere.
function GroupsPlaceholder({ user, onSignOut }) {
  return <div className="personal-app"><SiteHeader current="groups" user={user} onSignOut={onSignOut} />
    <main className="page-width workspace"><div className="page-heading"><h1>Groups</h1></div><p className="muted">The groups page is coming soon.</p></main></div>;
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
  if (route === 'groups') return <GroupsPlaceholder user={user} onSignOut={logout}/>;
  return <Home key={user.id} user={user} onSignOut={logout}/>;
}
