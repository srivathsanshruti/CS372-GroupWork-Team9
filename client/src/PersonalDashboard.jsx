import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPersonalApi, displayDate, localDate } from './api';
import SiteHeader from './components/SiteHeader';
import HabitForm from './components/HabitForm';
import CompletionForm from './components/CompletionForm';
import './style.css';

// Mount inside the team's authenticated route; onSignIn can open their login page.
export default function PersonalDashboard({ apiBase = '/api', onSignIn, onSignOut }) {
  const api = useMemo(() => createPersonalApi(apiBase), [apiBase]);
  const [user, setUser] = useState(null), [data, setData] = useState(null);
  const [tab, setTab] = useState('habits'), [period, setPeriod] = useState('all');
  const [editor, setEditor] = useState(null), [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [signedOut, setSignedOut] = useState(false);
  const [historyHabit, setHistoryHabit] = useState('');
  const [today, setToday] = useState(localDate());
  const requestVersion = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setToday(localDate()), 30000);
    const onFocus = () => setToday(localDate());
    window.addEventListener('focus', onFocus);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);
  const handleError = useCallback(e => {
    if (!mounted.current) return;
    if (e.status === 401) {
      setSignedOut(true); setUser(null); setData(null); setEditor(null); setDeleting(null);
      setError(''); setNotice('');
    } else setError(e.message);
  }, []);
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    const params = new URLSearchParams({ asOf: today });
    if (period !== 'all') {
      const from = new Date(today + 'T12:00:00');
      from.setDate(from.getDate() - Number(period) + 1);
      params.set('from', localDate(from));
    }
    try {
      const [me, progress] = await Promise.all([api('/me'), api('/progress?' + params)]);
      if (mounted.current && version === requestVersion.current) {
        setUser(me); setData(progress); setSignedOut(false);
      }
    } catch (e) {
      if (version === requestVersion.current) handleError(e);
      throw e;
    }
  }, [api, period, today, handleError]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    reload().catch(() => {}).finally(() => { if (mounted.current && active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  async function mutate(work, success, afterSave) {
    setSaving(true); setError(''); setNotice('');
    try {
      await work();
      if (mounted.current) { afterSave?.(); setNotice(success); }
      await reload();
    } catch (e) { handleError(e); }
    finally { if (mounted.current) setSaving(false); }
  }
  const due = data?.habits.filter(habit => habit.dueToday) || [];
  const done = due.filter(habit => habit.completedToday).length;
  const history = data?.history.filter(row => !historyHabit || row.habit_id === Number(historyHabit)) || [];
  const complete = (id, date) => mutate(() => api(`/habits/${id}/completions`, { method: 'POST', body: { completed_date: date } }), 'Completion saved.');
  const undo = (id, date) => mutate(() => api(`/habits/${id}/completions/${date}`, { method: 'DELETE' }), 'Completion removed.');
  const beginEdit = habit => { setEditor(habit); setDeleting(null); setError(''); setNotice(''); };

  return <div className="personal-app">
    <SiteHeader current="dashboard" user={user} onSignOut={onSignOut} busy={saving} />
    <main className="page-width workspace">
      <nav className="personal-nav" aria-label="Personal pages">{[['habits','My habits'], ['progress','Progress'], ['history','History']].map(([key,label]) => <button key={key} className={tab === key ? 'current' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setNotice(''); }} disabled={saving}>{label}</button>)}</nav>
      <div className="page-heading"><div><p className="page-date">{new Date(today + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{tab === 'habits' ? 'My habits' : tab === 'progress' ? 'Progress' : 'Completion history'}</h1></div>{user && <button className="btn btn-primary" disabled={saving} onClick={() => { setTab('habits'); beginEdit({}); }}>+ Add habit</button>}</div>
      {notice && <div className="feedback success" role="status">{notice}</div>}
      {error && <div className="feedback failure" role="alert">{error}<button className="btn btn-sm btn-link" onClick={() => { setError(''); reload().catch(() => {}); }} disabled={loading || saving}>Retry</button></div>}
      {loading && <p className="loading-state" role="status">Loading your habits…</p>}
      {signedOut && <section className="signed-out"><h2>Sign in to see your habits</h2><p>Your habits and completion history are private to your account.</p>{onSignIn && <button className="btn btn-primary" onClick={onSignIn}>Sign in</button>}</section>}
      {user && data && <div aria-busy={loading || saving}>
        {tab === 'habits' && <div className={'habits-layout' + (editor ? ' with-editor' : '')}><div>
          <section className="today-section" aria-labelledby="today-heading"><div className="section-heading"><h2 id="today-heading">Due today</h2><span className="count-label">{done} of {due.length} complete</span></div>
            {!due.length ? <p className="empty-copy">{data.habits.length ? 'Nothing scheduled for today.' : 'Add your first habit to start tracking it.'}</p> : <ul className="today-list">{due.map(habit => <li key={habit.id}><label className={'checkin' + (habit.completedToday ? ' checked' : '')}><input type="checkbox" checked={habit.completedToday} disabled={saving || loading} onChange={() => habit.completedToday ? undo(habit.id,today) : complete(habit.id,today)} /><span><strong>{habit.title}</strong><span className="habit-goal">{habit.goal}</span></span></label><span className="schedule-label">{habit.frequency === 'weekly' ? 'Weekly' : 'Daily'}</span></li>)}</ul>}
          </section>
          <section className="all-habits" aria-labelledby="all-heading"><div className="section-heading"><h2 id="all-heading">All habits</h2><span className="count-label">{data.habits.length}</span></div>
            {!data.habits.length ? <div className="empty-state"><h3>No habits yet</h3><p>Set a goal and choose when you want to work on it.</p><button className="btn btn-outline-primary" onClick={() => beginEdit({})}>Add a habit</button></div> : <div className="table-responsive"><table className="table habit-table"><thead><tr><th scope="col">Habit / goal</th><th scope="col">Schedule</th><th scope="col">Started</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{data.habits.map(habit => <tr key={habit.id}><th scope="row"><span className="habit-name">{habit.title}</span><span className="habit-goal">{habit.goal}</span>{habit.status !== 'active' && <small>{habit.status}</small>}</th><td>{habit.frequency === 'weekly' ? 'Weekly · ' + new Date(habit.start_date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'}) : 'Daily'}</td><td className="date-cell">{displayDate(habit.start_date)}</td><td><div className="row-actions"><button className="text-button" disabled={saving} onClick={() => beginEdit(habit)} aria-label={'Edit ' + habit.title}>Edit</button><button className="text-button danger-text" disabled={saving} onClick={() => { setDeleting(habit); setEditor(null); }} aria-label={'Delete ' + habit.title}>Delete</button></div></td></tr>)}</tbody></table></div>}
          </section>
          {deleting && <section className="delete-confirm" role="alert" aria-labelledby="delete-heading"><h3 id="delete-heading">Delete “{deleting.title}”?</h3><p>This also removes its completion history. This cannot be undone.</p><div className="d-flex gap-2"><button className="btn btn-danger btn-sm" disabled={saving} onClick={() => mutate(() => api('/habits/'+deleting.id,{method:'DELETE'}),'Habit deleted.',() => setDeleting(null))}>Delete habit</button><button className="btn btn-outline-secondary btn-sm" disabled={saving} onClick={() => setDeleting(null)}>Keep habit</button></div></section>}
        </div>{editor && <HabitForm key={editor.id || 'new'} habit={editor.id ? editor : null} saving={saving} onCancel={() => setEditor(null)} onSave={values => mutate(() => api(editor.id ? '/habits/'+editor.id : '/habits', { method: editor.id ? 'PUT' : 'POST', body: values }), editor.id ? 'Habit updated.' : 'Habit added.', () => setEditor(null))} />}</div>}
        {tab !== 'habits' && <>
          <div className="report-toolbar"><p className="muted">{tab === 'progress' ? 'Completed scheduled dates, through today.' : 'Your recorded completions, most recent first.'}</p><div><label htmlFor="period" className="visually-hidden">Reporting period</label><select id="period" className="form-select form-select-sm" disabled={saving || loading} value={period} onChange={event => setPeriod(event.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div></div>
          {tab === 'progress' ? <>
            <section className="progress-summary" aria-label="Overall completion"><div className="overall-value">{data.percentage}<span>%</span></div><div><h2>Overall completion</h2><p>{data.completions} of {data.expected} scheduled dates completed</p><div className="progress" role="progressbar" aria-label="Overall completion" aria-valuenow={data.percentage} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{width:data.percentage+'%'}} /></div></div></section>
            <div className="table-responsive"><table className="table progress-table"><thead><tr><th scope="col">Habit</th><th scope="col">Completed / scheduled</th><th scope="col">Completion</th></tr></thead><tbody>{data.habits.map(habit => <tr key={habit.id}><th scope="row">{habit.title}</th><td>{habit.completions} / {habit.expected}</td><td><div className="rate-cell"><div className="progress" role="progressbar" aria-label={habit.title+' completion'} aria-valuenow={habit.percentage} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{width:habit.percentage+'%'}} /></div><span>{habit.percentage}%</span></div></td></tr>)}</tbody></table></div>
            {!data.habits.length && <p className="empty-copy">Add a habit to begin tracking progress.</p>}
            <p className="calculation-note">Daily habits count once per day. Weekly habits count once on their scheduled weekday. Dates before the start date and future dates are excluded. Overall completion combines all scheduled dates in the selected period.</p>
          </> : <>
            <div className="history-filter"><label htmlFor="history-habit" className="form-label">Show habit</label><select id="history-habit" className="form-select form-select-sm" value={historyHabit} onChange={event => setHistoryHabit(event.target.value)}><option value="">All habits</option>{data.habits.map(habit => <option key={habit.id} value={habit.id}>{habit.title}</option>)}</select></div>
            {!history.length ? <p className="empty-copy">No completions in this period.</p> : <div className="table-responsive"><table className="table"><thead><tr><th scope="col">Date</th><th scope="col">Habit</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{history.map(row => <tr key={row.id}><td className="date-cell">{displayDate(row.completed_date)}</td><th scope="row">{row.title}</th><td className="text-end"><button className="text-button" disabled={saving} onClick={() => undo(row.habit_id,row.completed_date)} aria-label={'Undo '+row.title+' on '+row.completed_date}>Undo completion</button></td></tr>)}</tbody></table></div>}
            {data.habits.length > 0 && <CompletionForm habits={data.habits} saving={saving} onSave={complete} />}
          </>}
        </>}
      </div>}
    </main>
  </div>;
}
