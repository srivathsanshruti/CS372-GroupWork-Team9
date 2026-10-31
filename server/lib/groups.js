// Study group queries. Every function takes the sqlite3 handle first and the
// signed-in user's id where results depend on who is asking.
const { query } = require('./database');

const MAX_LIST = 100;

// Columns shared by list and detail reads. member_count, is_member and
// is_owner are computed for the viewer so the client never has to guess.
const GROUP_COLUMNS = `g.id, g.name, g.course, g.description, g.meeting_info, g.creator_id,
  u.name AS creator_name,
  (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
  EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = ?) AS is_member,
  (g.creator_id = ?) AS is_owner`;

const toGroup = row => row && {
  ...row,
  is_member: Boolean(row.is_member),
  is_owner: Boolean(row.is_owner)
};

// LIKE treats % and _ as wildcards; escape them so a search is literal.
const likePattern = text => '%' + text.replace(/[\\%_]/g, char => '\\' + char) + '%';

// Filters: q matches name, course or description; course is an exact,
// case-insensitive match; mine limits results to groups the viewer belongs to.
async function listGroups(db, viewerId, { q, course, mine } = {}) {
  const where = [], params = [viewerId, viewerId];
  if (q) {
    where.push("(g.name LIKE ? ESCAPE '\\' OR g.course LIKE ? ESCAPE '\\' OR g.description LIKE ? ESCAPE '\\')");
    const pattern = likePattern(q);
    params.push(pattern, pattern, pattern);
  }
  if (course) {
    where.push('g.course = ? COLLATE NOCASE');
    params.push(course);
  }
  if (mine) {
    where.push('EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = ?)');
    params.push(viewerId);
  }
  const rows = await query(db, 'all', `SELECT ${GROUP_COLUMNS}
    FROM study_groups g JOIN users u ON u.id = g.creator_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY g.name COLLATE NOCASE, g.id LIMIT ${MAX_LIST}`, params);
  return rows.map(toGroup);
}

async function getGroup(db, viewerId, groupId) {
  return toGroup(await query(db, 'get', `SELECT ${GROUP_COLUMNS}
    FROM study_groups g JOIN users u ON u.id = g.creator_id WHERE g.id = ?`, [viewerId, viewerId, groupId]));
}

function listMembers(db, groupId) {
  return query(db, 'all', `SELECT u.id, u.name, m.joined_at FROM group_members m
    JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.joined_at, m.id`, [groupId]);
}

function listCourses(db) {
  return query(db, 'all', `SELECT DISTINCT course FROM study_groups
    WHERE course IS NOT NULL AND course <> '' ORDER BY course COLLATE NOCASE`)
    .then(rows => rows.map(row => row.course));
}

// The creator is added as the first member. If that insert fails the group
// row is removed so no group is left without its owner.
async function createGroup(db, creatorId, fields) {
  const { id } = await query(db, 'run',
    'INSERT INTO study_groups(creator_id,name,course,description,meeting_info) VALUES (?,?,?,?,?)',
    [creatorId, fields.name, fields.course, fields.description, fields.meeting_info]);
  try {
    await query(db, 'run', 'INSERT INTO group_members(group_id,user_id) VALUES (?,?)', [id, creatorId]);
  } catch (error) {
    await query(db, 'run', 'DELETE FROM study_groups WHERE id = ?', [id]);
    throw error;
  }
  return id;
}

// Owner checks live in the WHERE clause so a non-owner can never write.
async function updateGroup(db, ownerId, groupId, fields) {
  const result = await query(db, 'run', `UPDATE study_groups SET name = ?, course = ?, description = ?, meeting_info = ?
    WHERE id = ? AND creator_id = ?`,
  [fields.name, fields.course, fields.description, fields.meeting_info, groupId, ownerId]);
  return result.changes > 0;
}

async function deleteGroup(db, ownerId, groupId) {
  const result = await query(db, 'run', 'DELETE FROM study_groups WHERE id = ? AND creator_id = ?', [groupId, ownerId]);
  return result.changes > 0;
}

// Returns false when the user is already a member.
async function joinGroup(db, userId, groupId) {
  try {
    await query(db, 'run', 'INSERT INTO group_members(group_id,user_id) VALUES (?,?)', [groupId, userId]);
    return true;
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT' && /UNIQUE/.test(error.message)) return false;
    throw error;
  }
}

// The owner cannot leave; they delete the group instead.
async function leaveGroup(db, userId, groupId) {
  const result = await query(db, 'run', `DELETE FROM group_members WHERE group_id = ? AND user_id = ?
    AND NOT EXISTS (SELECT 1 FROM study_groups WHERE id = ? AND creator_id = ?)`, [groupId, userId, groupId, userId]);
  return result.changes > 0;
}

module.exports = {
  MAX_LIST, listGroups, getGroup, listMembers, listCourses,
  createGroup, updateGroup, deleteGroup, joinGroup, leaveGroup
};
