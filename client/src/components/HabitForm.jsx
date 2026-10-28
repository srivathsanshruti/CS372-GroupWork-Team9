import React, { useState } from 'react';
import { localDate } from '../api';

export default function HabitForm({ habit, saving, onSave, onCancel }) {
  const [values, setValues] = useState({
    title: habit?.title || '', goal: habit?.goal || '',
    frequency: habit?.frequency || 'daily', start_date: habit?.start_date || localDate()
  });
  const locked = Boolean(habit?.completion_count);
  const update = event => setValues({ ...values, [event.target.name]: event.target.value });
  return <section className="habit-editor" aria-labelledby="editor-title">
    <div className="section-heading"><h2 id="editor-title">{habit ? 'Edit habit' : 'New habit'}</h2><button className="btn btn-sm btn-link" disabled={saving} onClick={onCancel}>Cancel</button></div>
    <form onSubmit={event => { event.preventDefault(); onSave(values); }}>
      <fieldset disabled={saving}>
        <label className="form-label" htmlFor="habit-title">Name</label>
        <input autoFocus id="habit-title" name="title" className="form-control mb-3" maxLength={120} required value={values.title} onChange={update} placeholder="Review lecture notes" />
        <label className="form-label" htmlFor="habit-goal">Goal</label>
        <textarea id="habit-goal" name="goal" className="form-control mb-3" rows={3} maxLength={500} required value={values.goal} onChange={update} placeholder="Spend 20 minutes reviewing after class" />
        <label className="form-label" htmlFor="habit-frequency">Repeat</label>
        <select id="habit-frequency" name="frequency" className="form-select mb-3" value={values.frequency} onChange={update} disabled={locked} aria-describedby="schedule-help">
          <option value="daily">Every day</option><option value="weekly">Every week</option>
        </select>
        <label className="form-label" htmlFor="habit-start">Start date</label>
        <input id="habit-start" name="start_date" className="form-control mb-2" type="date" required disabled={locked} value={values.start_date} onChange={update} aria-describedby="schedule-help" />
        <p id="schedule-help" className="field-note">{locked ? 'The schedule stays fixed once completions are recorded, so your history remains accurate.' : 'Weekly habits repeat on the weekday of your start date.'}</p>
        <button className="btn btn-primary w-100" type="submit">{saving ? 'Saving…' : habit ? 'Save changes' : 'Add habit'}</button>
      </fieldset>
    </form>
  </section>;
}
