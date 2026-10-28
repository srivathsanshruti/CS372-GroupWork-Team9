import React, { useState } from 'react';
import { localDate } from '../api';

export default function CompletionForm({ habits, saving, onSave }) {
  const [habitId, setHabitId] = useState('');
  const [date, setDate] = useState(localDate());
  const habit = habits.find(item => item.id === Number(habitId));
  return <section className="completion-editor" aria-labelledby="record-heading">
    <h2 id="record-heading">Record a completion</h2>
    <p className="field-note">Missed a check-in? Record it for the date you completed it.</p>
    <form className="row g-3 align-items-end" onSubmit={event => { event.preventDefault(); onSave(Number(habitId), date); }}>
      <div className="col-md-6"><label htmlFor="completion-habit" className="form-label">Habit</label><select id="completion-habit" required className="form-select" value={habitId} disabled={saving} onChange={event => setHabitId(event.target.value)}><option value="">Select a habit</option>{habits.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
      <div className="col-md-3"><label htmlFor="completion-date" className="form-label">Date</label><input id="completion-date" type="date" required className="form-control" min={habit?.start_date} max={localDate()} value={date} disabled={saving} onChange={event => setDate(event.target.value)} /></div>
      <div className="col-md-3"><button className="btn btn-outline-primary w-100" disabled={saving || !habit} type="submit">Save completion</button></div>
    </form>
  </section>;
}
