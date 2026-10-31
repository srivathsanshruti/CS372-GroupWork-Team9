const express = require('express');
const { query } = require('./lib/database');
const groups = require('./lib/groups');

const LIMITS = { name: 100, course: 40, description: 1000, meeting_info: 200 };
const invalidGroup = 'Enter a group name (up to 100 characters). Course (up to 40), description (up to 1000) and meeting info (up to 200) are optional.';

// Returns trimmed fields, or null when any field is missing, the wrong type or too long.
// Empty optional fields are stored as NULL.
function readGroupFields(body) {
  const fields = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = body[key];
    if (value === undefined || value === null) { fields[key] = null; continue; }
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length > max) return null;
    fields[key] = trimmed || null;
  }
  return fields.name ? fields : null;
}

// Route ids must be positive integers; anything else is treated as not found.
const parseId = value => /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

// Query strings can repeat keys (?q=a&q=b); only single string values are accepted.
const queryText = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : '';

// Mount after the session middleware and before the personal router, which
// would otherwise answer unauthenticated /api/groups requests itself.
function createGroupRouter(db) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    const userId = req.session?.userId;
    if (!Number.isSafeInteger(userId) || userId <= 0) return res.status(401).json({ error: 'Please sign in to view groups.' });
    const user = await query(db, 'get', 'SELECT id, name, email FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    req.currentUser = user;
    next();
  });
  router.param('id', (req, res, next, value) => {
    req.groupId = parseId(value);
    if (!req.groupId) return res.status(404).json({ error: 'Group not found.' });
    next();
  });

  router.get('/', async (req, res) => {
    const filters = {
      q: queryText(req.query.q, 100),
      course: queryText(req.query.course, LIMITS.course),
      mine: req.query.mine === '1' || req.query.mine === 'true'
    };
    res.json(await groups.listGroups(db, req.currentUser.id, filters));
  });
  router.get('/courses', async (req, res) => res.json(await groups.listCourses(db)));

  router.post('/', async (req, res) => {
    const fields = readGroupFields(req.body || {});
    if (!fields) return res.status(400).json({ error: invalidGroup });
    const id = await groups.createGroup(db, req.currentUser.id, fields);
    res.status(201).json(await groups.getGroup(db, req.currentUser.id, id));
  });

  // Anyone signed in can see a group's details; only members see who is in it.
  router.get('/:id', async (req, res) => {
    const group = await groups.getGroup(db, req.currentUser.id, req.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (group.is_member) group.members = await groups.listMembers(db, group.id);
    res.json(group);
  });

  router.put('/:id', async (req, res) => {
    const group = await groups.getGroup(db, req.currentUser.id, req.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (!group.is_owner) return res.status(403).json({ error: 'Only the group creator can edit this group.' });
    const fields = readGroupFields(req.body || {});
    if (!fields) return res.status(400).json({ error: invalidGroup });
    if (!await groups.updateGroup(db, req.currentUser.id, group.id, fields)) return res.status(404).json({ error: 'Group not found.' });
    res.json(await groups.getGroup(db, req.currentUser.id, group.id));
  });

  router.delete('/:id', async (req, res) => {
    const group = await groups.getGroup(db, req.currentUser.id, req.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (!group.is_owner) return res.status(403).json({ error: 'Only the group creator can delete this group.' });
    if (!await groups.deleteGroup(db, req.currentUser.id, group.id)) return res.status(404).json({ error: 'Group not found.' });
    res.status(204).end();
  });

  router.post('/:id/members', async (req, res) => {
    const group = await groups.getGroup(db, req.currentUser.id, req.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    try {
      if (!await groups.joinGroup(db, req.currentUser.id, group.id)) return res.status(409).json({ error: 'You are already a member of this group.' });
    } catch (error) {
      // The group was deleted between the lookup and the insert.
      if (error.code === 'SQLITE_CONSTRAINT') return res.status(404).json({ error: 'Group not found.' });
      throw error;
    }
    res.status(201).json(await groups.getGroup(db, req.currentUser.id, group.id));
  });

  router.delete('/:id/members/me', async (req, res) => {
    const group = await groups.getGroup(db, req.currentUser.id, req.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (group.is_owner) return res.status(409).json({ error: 'Group creators cannot leave. Delete the group instead.' });
    if (!await groups.leaveGroup(db, req.currentUser.id, group.id)) return res.status(404).json({ error: 'You are not a member of this group.' });
    res.status(204).end();
  });

  return router;
}

module.exports = { createGroupRouter, readGroupFields };
