const express = require('express');
const { query } = require('./lib/database');
const { validDate, dayNumber, currentDate, summarize } = require('./lib/progress');

function validHabit(body) {
  return typeof body.title === 'string' && body.title.trim().length > 0 && body.title.length <= 120 &&
    typeof body.goal === 'string' && body.goal.trim().length > 0 && body.goal.length <= 500 &&
    ['daily', 'weekly'].includes(body.frequency) && validDate(body.start_date);
}
const invalidHabit = 'Enter a title (up to 120 characters), goal (up to 500), daily or weekly schedule, and a valid start date.';

// Mount after the team's session middleware. This router never creates a login/session.
function createPersonalRouter(db) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    const userId = req.session?.userId;
    if (!Number.isSafeInteger(userId) || userId <= 0) return res.status(401).json({ error: 'Please sign in to view your habits.' });
    const user = await query(db, 'get', 'SELECT id, name, email FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    req.currentUser = user;
    try { req.today = currentDate(req.get('X-Time-Zone') || 'UTC'); }
    catch { return res.status(400).json({ error: 'Invalid time zone.' }); }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Origin not allowed.' });
      if (origin) {
        try {
          if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origin not allowed.' });
        } catch { return res.status(403).json({ error: 'Origin not allowed.' }); }
      }
    }
    next();
  });
  router.get('/me', (req, res) => res.json(req.currentUser));
  router.get('/habits', async (req, res) => res.json(await query(db, 'all',
    'SELECT * FROM habits WHERE user_id = ? ORDER BY id DESC', [req.currentUser.id])));
  router.post('/habits', async (req, res) => {
    if (!validHabit(req.body || {})) return res.status(400).json({ error: invalidHabit });
    const { title, goal, frequency, start_date } = req.body;
    const result = await query(db, 'run',
      'INSERT INTO habits(user_id,title,goal,frequency,start_date) VALUES (?,?,?,?,?)',
      [req.currentUser.id, title.trim(), goal.trim(), frequency, start_date]);
    res.status(201).json(await query(db, 'get', 'SELECT * FROM habits WHERE id = ? AND user_id = ?', [result.id, req.currentUser.id]));
  });
  router.put('/habits/:id', async (req, res) => {
    const habit = await query(db, 'get', 'SELECT * FROM habits WHERE id = ? AND user_id = ?', [req.params.id, req.currentUser.id]);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    if (!validHabit(req.body || {})) return res.status(400).json({ error: invalidHabit });
    const { title, goal, frequency, start_date } = req.body;
    // Guard inside the UPDATE so concurrent completion writes cannot invalidate history.
    const result = await query(db, 'run', `UPDATE habits SET title = ?, goal = ?, frequency = ?, start_date = ?
      WHERE id = ? AND user_id = ? AND (
        (frequency = ? AND start_date = ?) OR
        NOT EXISTS (SELECT 1 FROM habit_completions WHERE habit_id = habits.id)
      )`, [title.trim(), goal.trim(), frequency, start_date, habit.id, req.currentUser.id, frequency, start_date]);
    if (!result.changes) return res.status(409).json({ error: 'A habit with recorded completions keeps its original schedule and start date. Create a new habit for a different schedule.' });
    res.json(await query(db, 'get', 'SELECT * FROM habits WHERE id = ? AND user_id = ?', [habit.id, req.currentUser.id]));
  });
  router.delete('/habits/:id', async (req, res) => {
    const result = await query(db, 'run', 'DELETE FROM habits WHERE id = ? AND user_id = ?', [req.params.id, req.currentUser.id]);
    if (!result.changes) return res.status(404).json({ error: 'Habit not found.' });
    res.status(204).end();
  });
  router.get('/progress', async (req, res) => {
    const asOf = req.query.asOf || req.today;
    const from = req.query.from || null;
    if (!validDate(asOf) || asOf > req.today || (from && (!validDate(from) || from > asOf))) {
      return res.status(400).json({ error: 'Use valid YYYY-MM-DD dates, with from on or before asOf and asOf no later than today.' });
    }
    const habits = await query(db, 'all', 'SELECT h.*, (SELECT COUNT(*) FROM habit_completions c WHERE c.habit_id = h.id) AS completion_count FROM habits h WHERE user_id = ? ORDER BY id DESC', [req.currentUser.id]);
    const history = await query(db, 'all', `SELECT c.id, c.habit_id, c.completed_date, h.title
      FROM habit_completions c JOIN habits h ON h.id = c.habit_id
      WHERE h.user_id = ? AND c.completed_date <= ? ORDER BY c.completed_date DESC, c.id DESC`, [req.currentUser.id, asOf]);
    res.json(summarize(habits, history, asOf, from));
  });
  router.post('/habits/:id/completions', async (req, res) => {
    const habit = await query(db, 'get', 'SELECT * FROM habits WHERE id = ? AND user_id = ?', [req.params.id, req.currentUser.id]);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    const date = req.body?.completed_date;
    if (!validDate(date) || date < habit.start_date || date > req.today || habit.status !== 'active' ||
        !['daily', 'weekly'].includes(habit.frequency) ||
        (habit.frequency === 'weekly' && (dayNumber(date) - dayNumber(habit.start_date)) % 7 !== 0)) {
      return res.status(400).json({ error: 'Choose a scheduled date from the start date through today for an active habit.' });
    }
    try {
      const result = await query(db, 'run', `INSERT INTO habit_completions(habit_id,completed_date)
        SELECT id, ? FROM habits WHERE id = ? AND user_id = ?
        AND frequency = ? AND start_date = ? AND status = 'active'`,
      [date, habit.id, req.currentUser.id, habit.frequency, habit.start_date]);
      if (!result.changes) return res.status(409).json({ error: 'This habit changed. Refresh and try again.' });
      res.status(201).json({ id: result.id, habit_id: habit.id, completed_date: date });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'This habit is already completed on that date.' });
      throw error;
    }
  });
  router.delete('/habits/:id/completions/:date', async (req, res) => {
    const habit = await query(db, 'get', 'SELECT id FROM habits WHERE id = ? AND user_id = ?', [req.params.id, req.currentUser.id]);
    if (!habit) return res.status(404).json({ error: 'Habit not found.' });
    if (!validDate(req.params.date)) return res.status(400).json({ error: 'Use a valid YYYY-MM-DD date.' });
    const result = await query(db, 'run', `DELETE FROM habit_completions WHERE habit_id = ? AND completed_date = ?
      AND EXISTS (SELECT 1 FROM habits WHERE id = habit_id AND user_id = ?)`, [habit.id, req.params.date, req.currentUser.id]);
    if (!result.changes) return res.status(404).json({ error: 'Completion not found.' });
    res.status(204).end();
  });
  return router;
}
module.exports = { createPersonalRouter };
