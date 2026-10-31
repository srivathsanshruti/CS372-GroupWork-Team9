const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { openDatabase } = require('../db');
const { createApp, query } = require('../app');
const groups = require('../lib/groups');

let db;
beforeEach(async () => {
  db = await openDatabase(':memory:');
  await new Promise((resolve, reject) => db.exec(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'), e => e ? reject(e) : resolve()));
  await query(db, 'run', "INSERT INTO users(id,name,email,password_hash) VALUES (1,'Alice','a@example.test','x'),(2,'Bob','b@example.test','x'),(3,'Cara','c@example.test','x')");
  await query(db, 'run', `INSERT INTO study_groups(id,creator_id,name,course,description,meeting_info) VALUES
    (1,1,'Algorithms Crew','CS 372','Weekly problem sets','Library 204, Tue 7pm'),
    (2,2,'Morning Runners',NULL,'Easy pace 100% fun',NULL),
    (3,2,'Data Structures','cs 260',NULL,NULL)`);
  await query(db, 'run', 'INSERT INTO group_members(group_id,user_id) VALUES (1,1),(2,2),(3,2),(1,2)');
});
afterEach(async () => new Promise((resolve, reject) => db.close(e => e ? reject(e) : resolve())));
const appFor = id => createApp(db, { sessionMiddleware: (req, res, next) => { req.session = id ? { userId: id } : {}; next(); } });
const memberIds = async groupId => (await query(db, 'all', 'SELECT user_id FROM group_members WHERE group_id = ? ORDER BY user_id', [groupId])).map(r => r.user_id);

test('every group endpoint rejects anonymous users', async () => {
  const app = appFor(null);
  for (const url of ['/api/groups', '/api/groups/courses', '/api/groups/1']) {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Please sign in to view groups.');
  }
  expect((await request(app).post('/api/groups').send({ name: 'x' })).status).toBe(401);
  expect((await request(app).put('/api/groups/1').send({ name: 'x' })).status).toBe(401);
  expect((await request(app).delete('/api/groups/1')).status).toBe(401);
  expect((await request(app).post('/api/groups/1/members')).status).toBe(401);
  expect((await request(app).delete('/api/groups/1/members/me')).status).toBe(401);
});

test('sessions for deleted users are rejected', async () => {
  expect((await request(appFor(99)).get('/api/groups')).status).toBe(401);
});

test('lists groups sorted by name with viewer specific flags', async () => {
  const res = await request(appFor(3)).get('/api/groups');
  expect(res.status).toBe(200);
  expect(res.body.map(g => g.name)).toEqual(['Algorithms Crew', 'Data Structures', 'Morning Runners']);
  const algo = res.body[0];
  expect(algo).toMatchObject({ creator_name: 'Alice', member_count: 2, is_member: false, is_owner: false });
  expect(algo.members).toBeUndefined();
  const mine = (await request(appFor(1)).get('/api/groups')).body.find(g => g.id === 1);
  expect(mine).toMatchObject({ is_member: true, is_owner: true });
});

test('search matches name, course and description and treats wildcards literally', async () => {
  const app = appFor(1);
  expect((await request(app).get('/api/groups?q=crew')).body.map(g => g.id)).toEqual([1]);
  expect((await request(app).get('/api/groups?q=372')).body.map(g => g.id)).toEqual([1]);
  expect((await request(app).get('/api/groups?q=problem')).body.map(g => g.id)).toEqual([1]);
  expect((await request(app).get('/api/groups?q=100%25')).body.map(g => g.id)).toEqual([2]);
  expect((await request(app).get('/api/groups?q=%25')).body.map(g => g.id)).toEqual([2]);
  expect((await request(app).get('/api/groups?q=_')).body).toEqual([]);
});

test('filters by course case insensitively and by membership', async () => {
  const app = appFor(2);
  expect((await request(app).get('/api/groups?course=CS%20260')).body.map(g => g.id)).toEqual([3]);
  expect((await request(app).get('/api/groups?mine=1')).body.map(g => g.id).sort()).toEqual([1, 2, 3]);
  expect((await request(appFor(1)).get('/api/groups?mine=true')).body.map(g => g.id)).toEqual([1]);
  expect((await request(appFor(3)).get('/api/groups?mine=1')).body).toEqual([]);
  expect((await request(appFor(1)).get('/api/groups?mine=1&q=runners')).body).toEqual([]);
});

test('repeated query keys are ignored instead of crashing', async () => {
  const res = await request(appFor(1)).get('/api/groups?q=a&q=b&course=x&course=y');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(3);
});

test('lists distinct non-empty courses', async () => {
  await query(db, 'run', "INSERT INTO study_groups(creator_id,name,course) VALUES (1,'Another','CS 372'),(1,'Blank','')");
  expect((await request(appFor(1)).get('/api/groups/courses')).body).toEqual(['cs 260', 'CS 372']);
});

test('creating a group uses the session user and adds them as a member', async () => {
  const res = await request(appFor(3)).post('/api/groups').send({
    creator_id: 1, name: '  Chem Lab  ', course: ' CHEM 101 ', description: '', meeting_info: 'Fridays'
  });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: 'Chem Lab', course: 'CHEM 101', description: null, meeting_info: 'Fridays', creator_id: 3, is_owner: true, is_member: true, member_count: 1 });
  expect(await memberIds(res.body.id)).toEqual([3]);
});

test('rejects invalid group fields', async () => {
  const app = appFor(1);
  for (const body of [{}, { name: '   ' }, { name: 5 }, { name: 'x'.repeat(101) }, { name: 'ok', course: 'x'.repeat(41) },
    { name: 'ok', description: 'x'.repeat(1001) }, { name: 'ok', meeting_info: ['a'] }]) {
    expect((await request(app).post('/api/groups').send(body)).status).toBe(400);
  }
  expect((await query(db, 'get', 'SELECT COUNT(*) AS n FROM study_groups')).n).toBe(3);
});

test('group detail shows members only to members', async () => {
  const member = await request(appFor(2)).get('/api/groups/1');
  expect(member.status).toBe(200);
  expect(member.body.members.map(m => m.name)).toEqual(['Alice', 'Bob']);
  expect(member.body.members[0]).not.toHaveProperty('email');
  const outsider = await request(appFor(3)).get('/api/groups/1');
  expect(outsider.status).toBe(200);
  expect(outsider.body.members).toBeUndefined();
  expect(outsider.body.member_count).toBe(2);
});

test('unknown and malformed ids return 404', async () => {
  const app = appFor(1);
  for (const id of ['999', 'abc', '0', '-1', '1.5', '99999999999999999999']) {
    expect((await request(app).get('/api/groups/' + id)).status).toBe(404);
    expect((await request(app).post(`/api/groups/${id}/members`)).status).toBe(404);
  }
});

test('only the creator can edit a group', async () => {
  const body = { name: 'Renamed', course: 'CS 372', description: 'New', meeting_info: null };
  expect((await request(appFor(2)).put('/api/groups/1').send(body)).status).toBe(403);
  expect((await request(appFor(3)).put('/api/groups/1').send(body)).status).toBe(403);
  expect((await request(appFor(1)).put('/api/groups/1').send({ name: '' })).status).toBe(400);
  const res = await request(appFor(1)).put('/api/groups/1').send(body);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ name: 'Renamed', description: 'New', meeting_info: null });
  expect((await request(appFor(1)).put('/api/groups/999').send(body)).status).toBe(404);
});

test('only the creator can delete a group, which removes its members', async () => {
  expect((await request(appFor(2)).delete('/api/groups/1')).status).toBe(403);
  expect((await request(appFor(1)).delete('/api/groups/1')).status).toBe(204);
  expect((await request(appFor(1)).get('/api/groups/1')).status).toBe(404);
  expect(await memberIds(1)).toEqual([]);
  expect((await request(appFor(1)).delete('/api/groups/1')).status).toBe(404);
});

test('join and leave a group', async () => {
  const app = appFor(3);
  const joined = await request(app).post('/api/groups/1/members');
  expect(joined.status).toBe(201);
  expect(joined.body).toMatchObject({ is_member: true, member_count: 3 });
  expect((await request(app).post('/api/groups/1/members')).status).toBe(409);
  expect((await request(app).get('/api/groups?mine=1')).body.map(g => g.id)).toEqual([1]);
  expect((await request(app).delete('/api/groups/1/members/me')).status).toBe(204);
  expect((await request(app).delete('/api/groups/1/members/me')).status).toBe(404);
  expect(await memberIds(1)).toEqual([1, 2]);
});

test('joining ignores any user id in the body', async () => {
  expect((await request(appFor(3)).post('/api/groups/2/members').send({ user_id: 1 })).status).toBe(201);
  expect(await memberIds(2)).toEqual([2, 3]);
});

test('the creator cannot leave their own group', async () => {
  const res = await request(appFor(1)).delete('/api/groups/1/members/me');
  expect(res.status).toBe(409);
  expect(await memberIds(1)).toEqual([1, 2]);
  expect(await groups.leaveGroup(db, 1, 1)).toBe(false);
});

test('cross-origin group writes are rejected', async () => {
  const app = appFor(1);
  expect((await request(app).post('/api/groups').set('Origin', 'https://other.example').send({ name: 'x' })).status).toBe(403);
  expect((await request(app).post('/api/groups/2/members').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  expect((await query(db, 'get', 'SELECT COUNT(*) AS n FROM study_groups')).n).toBe(3);
});

test('createGroup removes the group if the creator membership insert fails', async () => {
  await query(db, 'run', "CREATE TEMP TRIGGER fail_join BEFORE INSERT ON group_members BEGIN SELECT RAISE(ABORT, 'join failed'); END");
  await expect(groups.createGroup(db, 3, { name: 'Ghost', course: null, description: null, meeting_info: null })).rejects.toThrow('join failed');
  expect((await query(db, 'get', "SELECT COUNT(*) AS n FROM study_groups WHERE name = 'Ghost'")).n).toBe(0);
});

test('personal routes still work alongside the groups router', async () => {
  expect((await request(appFor(1)).get('/api/me')).body.name).toBe('Alice');
  expect((await request(appFor(null)).get('/api/habits')).status).toBe(401);
  expect((await request(appFor(1)).get('/api/groupsx')).status).toBe(404);
});
