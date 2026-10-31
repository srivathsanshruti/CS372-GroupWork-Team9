import React, { useState } from 'react';

const EMPTY = { name: '', course: '', description: '', meeting_info: '' };

export default function GroupForm({ saving, onSave, onCancel }) {
  const [values, setValues] = useState(EMPTY);
  const update = event => setValues({ ...values, [event.target.name]: event.target.value });
  return <section className="habit-editor" aria-labelledby="group-editor-title">
    <div className="section-heading">
      <h2 id="group-editor-title">New group</h2>
      <button className="btn btn-sm btn-link" disabled={saving} onClick={onCancel}>Cancel</button>
    </div>
    <form onSubmit={event => { event.preventDefault(); onSave(values); }}>
      <fieldset disabled={saving}>
        <label className="form-label" htmlFor="group-name">Name</label>
        <input autoFocus id="group-name" name="name" className="form-control mb-3" maxLength={100} required value={values.name} onChange={update} placeholder="Algorithms study crew" />
        <label className="form-label" htmlFor="group-course">Course (optional)</label>
        <input id="group-course" name="course" className="form-control mb-3" maxLength={40} value={values.course} onChange={update} placeholder="CS 372" />
        <label className="form-label" htmlFor="group-description">Description (optional)</label>
        <textarea id="group-description" name="description" className="form-control mb-3" rows={3} maxLength={1000} value={values.description} onChange={update} placeholder="What the group works on together" />
        <label className="form-label" htmlFor="group-meeting">Meeting info (optional)</label>
        <input id="group-meeting" name="meeting_info" className="form-control mb-3" maxLength={200} value={values.meeting_info} onChange={update} placeholder="Library 204, Tuesdays at 7pm" />
        <button className="btn btn-primary w-100" type="submit">{saving ? 'Saving...' : 'Create group'}</button>
      </fieldset>
    </form>
  </section>;
}
