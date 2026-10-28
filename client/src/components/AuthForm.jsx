import React, { useState } from 'react';

export default function AuthForm({ api, onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const registering = mode === 'register';
  const update = event => setValues({ ...values, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setError('');
    if (registering && values.password !== values.confirm) return setError('Passwords do not match.');
    if (new TextEncoder().encode(values.password).length > 72) return setError('Use a password no longer than 72 UTF-8 bytes.');
    setBusy(true);
    try {
      const result = await api('/auth/' + mode, { method: 'POST', body: {
        ...(registering ? { name: values.name.trim() } : {}), email: values.email.trim(), password: values.password
      } });
      setValues({ name: '', email: '', password: '', confirm: '' });
      onAuthenticated(result.user);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="personal-app">
    <header className="app-header"><div className="page-width header-inner"><a href="/" className="wordmark">Group Work<span className="wordmark-dot">.</span></a></div></header>
    <main className="auth-page">
      <h1>{registering ? 'Create an account' : 'Sign in'}</h1>
      <p className="muted">{registering ? 'Use your email to get started.' : 'Continue to your habits and progress.'}</p>
      {error && <div className="feedback failure" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {registering && <><label className="form-label" htmlFor="auth-name">Name</label><input id="auth-name" name="name" type="text" required maxLength={100} autoComplete="name" className="form-control mb-3" value={values.name} onChange={update}/></>}
          <label className="form-label" htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" required maxLength={254} autoComplete="email" className="form-control mb-3" value={values.email} onChange={update}/>
          <label className="form-label" htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" required minLength={registering ? 8 : undefined} autoComplete={registering ? 'new-password' : 'current-password'} className="form-control mb-3" value={values.password} onChange={update} aria-describedby={registering ? 'password-help' : undefined}/>
          {registering && <><p id="password-help" className="field-note">At least 8 characters; no more than 72 UTF-8 bytes.</p><label className="form-label" htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" name="confirm" type="password" required autoComplete="new-password" className="form-control mb-3" value={values.confirm} onChange={update}/></>}
          <button className="btn btn-primary w-100 mt-2" type="submit">{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</button>
        </fieldset>
      </form>
      <p className="auth-switch">{registering ? 'Already have an account?' : 'New to Group Work?'} <button className="text-button" disabled={busy} onClick={() => { setMode(registering ? 'login' : 'register'); setError(''); setValues({ name:'',email:values.email,password:'',confirm:'' }); }}>{registering ? 'Sign in' : 'Create an account'}</button></p>
    </main>
  </div>;
}
