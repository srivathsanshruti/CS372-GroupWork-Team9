import React from 'react';
import SiteNav from './SiteNav';

export default function SiteHeader({ current, user, onSignOut, busy = false }) {
  return <header className="app-header"><div className="page-width header-inner">
    <a className="wordmark" href="#/">Group Work<span className="wordmark-dot">.</span></a>
    <SiteNav current={current} />
    <div className="account-controls"><span className="account-name">{user?.name || ''}</span>{onSignOut && <button className="text-button" disabled={busy} onClick={onSignOut}>Sign out</button>}</div>
  </div></header>;
}
