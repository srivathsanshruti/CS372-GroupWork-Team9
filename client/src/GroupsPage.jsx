import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPersonalApi } from './api';
import SiteHeader from './components/SiteHeader';
import GroupForm from './components/GroupForm';
import './style.css';

const SEARCH_DELAY = 250;

// Browse, search, create, join and leave study groups. onSignedOut runs when
// the server reports the session is gone so App can show the sign-in form.
export default function GroupsPage({ user, apiBase = '/api', onSignOut, onSignedOut }) {
  const api = useMemo(() => createPersonalApi(apiBase), [apiBase]);
  const [groups, setGroups] = useState(null), [courses, setCourses] = useState([]);
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [course, setCourse] = useState(''), [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false), [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const requestVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Wait for typing to pause before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [search]);

  const handleError = useCallback(e => {
    if (!mounted.current) return;
    if (e.status === 401) onSignedOut?.();
    else setError(e.message);
  }, [onSignedOut]);

  // Only the newest request may update the list, so slow responses for an
  // old search never overwrite a newer one.
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (course) params.set('course', course);
    if (mine) params.set('mine', '1');
    const [list, courseList] = await Promise.all([api('/groups?' + params), api('/groups/courses')]);
    if (mounted.current && version === requestVersion.current) { setGroups(list); setCourses(courseList); }
  }, [api, query, course, mine]);

  useEffect(() => {
    setLoading(true); setError('');
    reload().catch(handleError).finally(() => { if (mounted.current) setLoading(false); });
  }, [reload, handleError]);

  async function mutate(work, success, afterSave) {
    setSaving(true); setError(''); setNotice('');
    try {
      await work();
      if (mounted.current) { afterSave?.(); setNotice(success); }
      await reload();
    } catch (e) { handleError(e); }
    finally { if (mounted.current) setSaving(false); }
  }
  const join = group => mutate(() => api(`/groups/${group.id}/members`, { method: 'POST' }), `You joined ${group.name}.`);
  const leave = group => mutate(() => api(`/groups/${group.id}/members/me`, { method: 'DELETE' }), `You left ${group.name}.`);
  const remove = group => mutate(() => api(`/groups/${group.id}`, { method: 'DELETE' }), `${group.name} was deleted.`, () => setDeleting(null));
  const create = values => mutate(() => api('/groups', { method: 'POST', body: values }), 'Group created.', () => setCreating(false));
  const filtered = Boolean(query || course || mine);

  return <div className="personal-app">
    <SiteHeader current="groups" user={user} onSignOut={onSignOut} busy={saving} />
    <main className="page-width workspace">
      <div className="page-heading">
        <h1>Groups</h1>
        <button className="btn btn-primary" disabled={saving} onClick={() => { setCreating(true); setDeleting(null); setNotice(''); }}>+ New group</button>
      </div>
      {notice && <div className="feedback success" role="status">{notice}</div>}
      {error && <div className="feedback failure" role="alert">{error}</div>}
      <div className={'habits-layout' + (creating ? ' with-editor' : '')}><div>
        <div className="group-filters">
          <label className="visually-hidden" htmlFor="group-search">Search groups</label>
          <input id="group-search" type="search" className="form-control" placeholder="Search by name, course or description" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
          <label className="visually-hidden" htmlFor="group-course-filter">Course</label>
          <select id="group-course-filter" className="form-select" value={course} onChange={event => setCourse(event.target.value)}>
            <option value="">All courses</option>
            {courses.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <label className="group-mine"><input type="checkbox" checked={mine} onChange={event => setMine(event.target.checked)} /> My groups only</label>
        </div>
        {loading && !groups && <p className="loading-state" role="status">Loading groups...</p>}
        {groups && !groups.length && <div className="empty-state">
          <h3>{filtered ? 'No groups match' : 'No groups yet'}</h3>
          <p>{filtered ? 'Try a different search or clear the filters.' : 'Start one for a class, a floor or anything you want to keep up with together.'}</p>
        </div>}
        {groups && groups.length > 0 && <ul className="group-list" aria-label="Groups" aria-busy={loading || saving}>
          {groups.map(group => <li key={group.id}>
            <div className="group-body">
              <h3>{group.name} {group.course && <span className="group-tag">{group.course}</span>}</h3>
              {group.description && <p className="group-description">{group.description}</p>}
              <p className="event-meta">
                <span>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</span>
                <span>Created by {group.is_owner ? 'you' : group.creator_name}</span>
                {group.meeting_info && <span>{group.meeting_info}</span>}
              </p>
            </div>
            <div className="group-actions">
              {group.is_owner
                ? <button className="text-button danger-text" disabled={saving} onClick={() => { setDeleting(group); setCreating(false); }} aria-label={`Delete ${group.name}`}>Delete</button>
                : group.is_member
                  ? <button className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => leave(group)} aria-label={`Leave ${group.name}`}>Leave</button>
                  : <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => join(group)} aria-label={`Join ${group.name}`}>Join</button>}
            </div>
          </li>)}
        </ul>}
        {deleting && <section className="delete-confirm" role="alert" aria-labelledby="group-delete-heading">
          <h3 id="group-delete-heading">Delete {deleting.name}?</h3>
          <p>This removes the group for every member, along with its messages and events. This cannot be undone.</p>
          <div className="d-flex gap-2">
            <button className="btn btn-danger btn-sm" disabled={saving} onClick={() => remove(deleting)}>Delete group</button>
            <button className="btn btn-sm btn-link" disabled={saving} onClick={() => setDeleting(null)}>Cancel</button>
          </div>
        </section>}
      </div>{creating && <GroupForm saving={saving} onCancel={() => setCreating(false)} onSave={create} />}</div>
    </main>
  </div>;
}
