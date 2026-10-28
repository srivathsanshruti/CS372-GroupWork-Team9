const session = require('express-session');
const { query } = require('./lib/database');

// Sessions contain only cookie metadata and userId, never passwords.
class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.ready = query(db, 'run', `CREATE TABLE IF NOT EXISTS auth_sessions (
      sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL
    )`);
  }
  get(sid, callback) {
    this.ready.then(async () => {
      const row = await query(this.db, 'get', 'SELECT data FROM auth_sessions WHERE sid = ? AND expires_at > ?', [sid, Date.now()]);
      return row ? JSON.parse(row.data) : null;
    }).then(value => callback(null, value), callback);
  }
  set(sid, value, callback = () => {}) {
    this.ready.then(async () => {
      const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 86400000;
      await query(this.db, 'run', `INSERT INTO auth_sessions(sid,data,expires_at) VALUES (?,?,?)
        ON CONFLICT(sid) DO UPDATE SET data=excluded.data, expires_at=excluded.expires_at`, [sid, JSON.stringify(value), expires]);
      await query(this.db, 'run', 'DELETE FROM auth_sessions WHERE expires_at <= ?', [Date.now()]);
    }).then(() => callback(null), callback);
  }
  touch(sid, value, callback) { this.set(sid, value, callback); }
  destroy(sid, callback = () => {}) {
    this.ready.then(() => query(this.db, 'run', 'DELETE FROM auth_sessions WHERE sid = ?', [sid]))
      .then(() => callback(null), callback);
  }
}
module.exports = { SQLiteSessionStore };
