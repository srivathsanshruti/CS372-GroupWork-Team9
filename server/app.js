const express = require('express');
const session = require('express-session');
const crypto = require('node:crypto');
const path = require('node:path');
const { createPersonalRouter } = require('./personalRoutes');
const { query } = require('./lib/database');
const { summarize } = require('./lib/progress');
const { createAuthRouter } = require('./authRoutes');
const { SQLiteSessionStore } = require('./sessionStore');

function createApp(db, { sessionMiddleware, sessionSecret, authRouter } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Origin not allowed.' });
      const origin = req.get('origin');
      if (origin) {
        try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origin not allowed.' }); }
        catch { return res.status(403).json({ error: 'Origin not allowed.' }); }
      }
    }
    next();
  });
  app.use(sessionMiddleware || session({
    name: 'groupwork.sid',
    store: new SQLiteSessionStore(db),
    secret: sessionSecret || crypto.randomBytes(32).toString('hex'),
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 }
  }));
  // Teammates can replace this router while keeping the session userId contract.
  app.use('/api/auth', authRouter || createAuthRouter(db));
  app.use('/api', createPersonalRouter(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.use((error, req, res, next) => {
    const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    if (status === 500) console.error(error.message);
    res.status(status).json({ error: status === 400 ? 'Invalid JSON.' : status === 413 ? 'Request is too large.' : 'Something went wrong. Please try again.' });
  });
  return app;
}
module.exports = { createApp, query, summarize };
