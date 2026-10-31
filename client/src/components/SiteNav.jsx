import React from 'react';

// Hash links keep navigation dependency-free. If the team later adopts a router,
// swap these anchors for <Link> and the rest of the app doesn't change.
export const SITE_LINKS = [
  ['home', 'Home', '#/'],
  ['dashboard', 'My habits', '#/dashboard'],
  ['groups', 'Groups', '#/groups']
];

export default function SiteNav({ current }) {
  return <nav className="site-nav" aria-label="Main">
    {SITE_LINKS.map(([key, label, href]) => <a key={key} href={href} className={current === key ? 'current' : ''} aria-current={current === key ? 'page' : undefined}>{label}</a>)}
  </nav>;
}
