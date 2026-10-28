const express = require('express');
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const { query } = require('./lib/database');
const dummyHash = bcrypt.hashSync('unrelated-account-comparison', 12);
const publicUser = user => ({ id: user.id, name: user.name, email: user.email });
const validEmail = email => typeof email === 'string' && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validPassword = password => typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72;
const establishSession = (req, userId) => new Promise((resolve, reject) => {
  req.session.regenerate(error => {
    if (error) return reject(error);
    req.session.userId = userId;
    req.session.save(error => error ? reject(error) : resolve());
  });
});
function createAuthRouter(db) {
  const router = express.Router();
  const attempts = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true,
    message: { error: 'Too many attempts. Please try again in 15 minutes.' } });
  router.post('/register', attempts, async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !validEmail(email) || !validPassword(password)) {
      return res.status(400).json({ error: 'Enter a name (up to 100 characters), valid email, and a password of at least 8 characters and no more than 72 UTF-8 bytes.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    let id;
    try {
      const result = await query(db, 'run', 'INSERT INTO users(name,email,password_hash) VALUES (?,?,?)', [name.trim(), normalizedEmail, passwordHash]);
      id = result.id;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
      throw error;
    }
    await establishSession(req, id);
    res.status(201).json({ user: { id, name: name.trim(), email: normalizedEmail } });
  });
  router.post('/login', attempts, async (req, res) => {
    const { email, password } = req.body || {};
    if (!validEmail(email) || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Enter a valid email and password.' });
    }
    const user = await query(db, 'get', 'SELECT id,name,email,password_hash FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    const matches = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await establishSession(req, user.id);
    res.json({ user: publicUser(user) });
  });
  router.post('/logout', (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('groupwork.sid', { path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
      res.status(204).end();
    });
  });
  return router;
}
module.exports = { createAuthRouter };
