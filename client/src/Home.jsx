import React, { useMemo, useState } from 'react';
import SiteHeader from './components/SiteHeader';
import { createSampleHomeData } from './homeData';
import './style.css';

const RSVP_OPTIONS = [['going', 'Going'], ['maybe', 'Maybe'], ['declined', "Can't go"]];
const RSVP_STATUS = { going: "You're going", maybe: "You're a maybe", declined: "You can't make it" };
const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayDiff = (date, now) => Math.round((dayStart(date) - dayStart(now)) / 864e5);
const initials = name => name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
const percent = (done, expected) => expected ? Math.min(100, Math.round(done / expected * 100)) : 0;

function updatedLabel(iso, now) {
  const date = new Date(iso), hours = Math.floor((now - date) / 36e5), days = -dayDiff(date, now);
  if (days <= 0) return hours < 1 ? 'Updated just now' : `Updated ${hours}h ago`;
  return days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`;
}
function eventDay(date, now) {
  const diff = dayDiff(date, now);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'long' });
}
const eventTime = event => {
  const time = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${time(event.startsAt)} – ${time(event.endsAt)}`;
};

function ProgressMeter({ label, done, expected }) {
  const value = percent(done, expected);
  return <div className="meter"><div className="progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{ width: value + '%' }} /></div><span className="meter-label">{done}/{expected}</span></div>;
}

// `data` has the shape produced by createSampleHomeData(); swap in API results later.
export default function Home({ user, onSignOut, data, now: nowProp }) {
  const [now] = useState(() => nowProp || new Date());
  const [home] = useState(() => data || createSampleHomeData(now));
  const [rsvps, setRsvps] = useState(() => Object.fromEntries(home.events.map(event => [event.id, event.myRsvp])));
  const [groupId, setGroupId] = useState('all');

  const groupName = id => home.groups.find(group => group.id === id)?.name || 'Group';
  const myGoals = useMemo(() => [...home.myGoals].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4), [home]);
  const groupGoals = useMemo(() => home.groupGoals.filter(goal => groupId === 'all' || goal.groupId === Number(groupId)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), [home, groupId]);
  const events = useMemo(() => home.events.filter(event => new Date(event.endsAt) >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)), [home, now]);

  const doneToday = home.myGoals.filter(goal => goal.completedToday).length;
  const awaiting = events.filter(event => !rsvps[event.id]).length;
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const setRsvp = (id, status) => setRsvps(current => ({ ...current, [id]: current[id] === status ? null : status }));

  return <div className="personal-app">
    <SiteHeader current="home" user={user} onSignOut={onSignOut} />
    <main className="page-width workspace">
      <div className="page-heading">
        <div><p className="page-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1></div>
        <a className="btn btn-primary" href="#/dashboard">Open my habits</a>
      </div>
      <p className="home-summary">{doneToday} of {home.myGoals.length} of your goals checked in today · {awaiting ? `${awaiting} ${awaiting === 1 ? 'event needs' : 'events need'} your RSVP` : 'You’re all caught up on RSVPs'}</p>

      <div className="home-layout">
        <div className="home-main">
          <section className="home-card" aria-labelledby="my-goals-heading">
            <div className="section-heading"><h2 id="my-goals-heading">My recent goals</h2><a className="text-button" href="#/dashboard">View all</a></div>
            {!myGoals.length ? <p className="empty-copy">You haven’t added any goals yet. <a href="#/dashboard">Add your first habit.</a></p> : <ul className="goal-list">{myGoals.map(goal => <li key={goal.id}>
              <div className="goal-main"><span className="goal-title">{goal.title}{goal.completedToday && <span className="status-tag done">Done today</span>}</span><span className="habit-goal">{goal.goal}</span><span className="goal-meta">{goal.frequency === 'weekly' ? 'Weekly' : 'Daily'} · {updatedLabel(goal.updatedAt, now)}</span></div>
              <ProgressMeter label={`${goal.title} progress`} done={goal.completed} expected={goal.expected} />
            </li>)}</ul>}
          </section>

          <section className="home-card" aria-labelledby="group-goals-heading">
            <div className="section-heading"><h2 id="group-goals-heading">Group goals</h2>
              <div className="heading-tools"><label htmlFor="group-filter" className="visually-hidden">Filter by group</label>
                <select id="group-filter" className="form-select form-select-sm" value={groupId} onChange={event => setGroupId(event.target.value)}><option value="all">All groups</option>{home.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
                <a className="text-button" href="#/groups">Manage groups</a></div>
            </div>
            {!groupGoals.length ? <p className="empty-copy">No goals shared in {groupId === 'all' ? 'your groups' : 'this group'} yet.</p> : <ul className="goal-list">{groupGoals.map(goal => <li key={goal.id}>
              <span className="avatar" aria-hidden="true">{initials(goal.member)}</span>
              <div className="goal-main"><span className="goal-title">{goal.member}<span className="group-tag">{groupName(goal.groupId)}</span></span><span className="habit-goal"><strong>{goal.title}</strong> — {goal.goal}</span><span className="goal-meta">{goal.frequency === 'weekly' ? 'Weekly' : 'Daily'} · {updatedLabel(goal.updatedAt, now)}</span></div>
              <ProgressMeter label={`${goal.member}: ${goal.title} progress`} done={goal.completed} expected={goal.expected} />
            </li>)}</ul>}
          </section>
        </div>

        <aside className="home-card events-card" aria-labelledby="events-heading">
          <div className="section-heading"><h2 id="events-heading">Upcoming events</h2><a className="text-button" href="#/groups">All events</a></div>
          {!events.length ? <p className="empty-copy">No upcoming events. Groups you join will post study sessions and meetups here.</p> : <ul className="event-list">{events.map(event => {
            const start = new Date(event.startsAt), status = rsvps[event.id], going = event.goingCount + (status === 'going' ? 1 : 0);
            return <li key={event.id} className="event">
              <div className="date-block" aria-hidden="true"><span>{start.toLocaleDateString(undefined, { month: 'short' })}</span><strong>{start.getDate()}</strong></div>
              <div className="event-body">
                <h3>{event.title}</h3>
                <p className="event-meta"><span className={'status-tag ' + event.type}>{event.type === 'study' ? 'Study session' : 'Get-together'}</span>{groupName(event.groupId)}</p>
                <p className="event-meta">{eventDay(start, now)}, {eventTime(event)}<br />{event.location} · {going} going</p>
                <div className="rsvp-group" role="group" aria-label={`RSVP for ${event.title}`}>{RSVP_OPTIONS.map(([value, label]) => <button key={value} type="button" className={'btn btn-sm ' + (status === value ? 'btn-primary' : 'btn-outline-secondary')} aria-pressed={status === value} onClick={() => setRsvp(event.id, value)}>{label}</button>)}</div>
                <p className="rsvp-status" role="status">{status ? RSVP_STATUS[status] : 'Not responded yet'}</p>
              </div>
            </li>;
          })}</ul>}
        </aside>
      </div>
    </main>
  </div>;
}
