const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { openDatabase } = require('../db');
const { createApp, query, summarize } = require('../app');
let db;
beforeEach(async () => {
  db = await openDatabase(':memory:');
  await new Promise((resolve,reject) => db.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'), e => e ? reject(e) : resolve()));
  await query(db,'run',"INSERT INTO users(id,name,email,password_hash) VALUES (1,'Alice','a@example.test','x'),(2,'Bob','b@example.test','x')");
  await query(db,'run',"INSERT INTO habits(id,user_id,title,goal,frequency,start_date) VALUES (1,1,'Alice private','Read','daily','2026-01-01'),(2,2,'Bob private','Write','daily','2026-01-01')");
  await query(db,'run',"INSERT INTO habit_completions(habit_id,completed_date) VALUES (1,'2026-01-01'),(2,'2026-01-02')");
});
afterEach(async () => new Promise((resolve,reject) => db.close(e => e ? reject(e) : resolve())));
const appFor = id => createApp(db,{sessionMiddleware:(req,res,next)=>{req.session = id ? {userId:id}:{};next();}});
test('all personal endpoints reject anonymous users', async () => {
  const app = appFor(null);
  for(const endpoint of ['/api/me','/api/habits','/api/progress?asOf=2026-01-02']) expect((await request(app).get(endpoint)).status).toBe(401);
  expect((await request(app).post('/api/habits').send({})).status).toBe(401);
  expect((await request(app).post('/api/habits/1/completions').send({})).status).toBe(401);
});
test('progress and history isolate both users despite forged userId query', async () => {
  for(const id of [1,2]) {
    const response = await request(appFor(id)).get('/api/progress?asOf=2026-01-02&userId='+(id === 1 ? 2 : 1));
    expect(response.status).toBe(200);
    expect(response.body.habits).toHaveLength(1);
    expect(response.body.habits[0].user_id).toBe(id);
    expect(response.body.history.map(h=>h.habit_id)).toEqual([id]);
    expect(response.body.percentage).toBe(50);
  }
});
test('creation uses session owner, ignoring forged body owner', async () => {
  const res = await request(appFor(1)).post('/api/habits').send({user_id:2,title:'New',goal:'Read',frequency:'daily',start_date:'2026-01-01'});
  expect(res.status).toBe(201); expect(res.body.user_id).toBe(1);
});
test('cross-user completions are hidden and cannot be written', async () => {
  const res=await request(appFor(1)).post('/api/habits/2/completions').send({completed_date:'2026-01-03'});
  expect(res.status).toBe(404);
  expect((await query(db,'get','SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id=2')).n).toBe(1);
});
test('completion is saved once and duplicates return 409', async () => {
  const app=appFor(1);
  expect((await request(app).post('/api/habits/1/completions').send({completed_date:'2026-01-03'})).status).toBe(201);
  expect((await request(app).post('/api/habits/1/completions').send({completed_date:'2026-01-03'})).status).toBe(409);
});
test('rejects invalid dates, future completions, and unsupported frequencies', async () => {
  const app=appFor(1);
  expect((await request(app).get('/api/progress?asOf=2026-02-30')).status).toBe(400);
  expect((await request(app).post('/api/habits').send({title:'x',goal:'x',frequency:'sometimes',start_date:'2026-01-01'})).status).toBe(400);
  expect((await request(app).post('/api/habits/1/completions').send({completed_date:'2099-01-01'})).status).toBe(400);
});
test('daily and weekly math, future starts and zero habits', () => {
  const habits=[{id:1,frequency:'daily',start_date:'2026-01-01'},{id:2,frequency:'weekly',start_date:'2026-01-01'},{id:3,frequency:'daily',start_date:'2026-02-01'}];
  const data=summarize(habits,[{habit_id:1,completed_date:'2026-01-01'},{habit_id:2,completed_date:'2026-01-01'},{habit_id:2,completed_date:'2026-01-02'}],'2026-01-08');
  expect(data.habits.map(h=>h.expected)).toEqual([8,2,0]);
  expect(data.completions).toBe(2); expect(data.percentage).toBe(20);
  expect(summarize([],[],'2026-01-01').percentage).toBe(0);
});
test('weekly completions must fall on the scheduled weekday', async () => {
  await query(db,'run',"UPDATE habits SET frequency='weekly' WHERE id=1");
  expect((await request(appFor(1)).post('/api/habits/1/completions').send({completed_date:'2026-01-02'})).status).toBe(400);
});
test('sample login endpoints do not exist', async () => {
  for(const route of ['/api/demo','/api/demo/users']) expect((await request(appFor(1)).get(route)).status).toBe(404);
  expect((await request(appFor(1)).post('/api/demo/session').send({userId:2})).status).toBe(404);
});
test('cross-origin writes are rejected', async () => {
  expect((await request(appFor(1)).post('/api/habits').set('Origin','https://other.example').send({})).status).toBe(403);
});

test('edit own habit, protect other users and prevent schedule/history mismatch', async () => {
  const body={title:'Revised title',goal:'Revised goal',frequency:'daily',start_date:'2026-01-01'};
  expect((await request(appFor(1)).put('/api/habits/2').send(body)).status).toBe(404);
  const own=await request(appFor(1)).put('/api/habits/1').send(body);
  expect(own.status).toBe(200); expect(own.body.title).toBe(body.title);
  expect((await request(appFor(1)).put('/api/habits/1').send({...body,frequency:'weekly'})).status).toBe(409);
  expect((await query(db,'get','SELECT frequency FROM habits WHERE id=1')).frequency).toBe('daily');
});
test('schedule can change before the first completion', async () => {
  const body={title:'New habit',goal:'Read',frequency:'daily',start_date:'2026-01-01'};
  const created=await request(appFor(1)).post('/api/habits').send(body);
  const changed=await request(appFor(1)).put('/api/habits/'+created.body.id).send({...body,frequency:'weekly',start_date:'2026-02-01'});
  expect(changed.status).toBe(200); expect(changed.body.frequency).toBe('weekly');
});
test('delete is owner scoped and cascades to completion history', async () => {
  expect((await request(appFor(1)).delete('/api/habits/2')).status).toBe(404);
  expect((await request(appFor(1)).delete('/api/habits/1')).status).toBe(204);
  expect((await query(db,'get','SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id=1')).n).toBe(0);
  expect((await query(db,'get','SELECT COUNT(*) AS n FROM habits WHERE user_id=2')).n).toBe(1);
});
test('undo is scoped to the owner and updates progress', async () => {
  expect((await request(appFor(1)).delete('/api/habits/2/completions/2026-01-02')).status).toBe(404);
  expect((await request(appFor(1)).delete('/api/habits/1/completions/2026-01-01')).status).toBe(204);
  const progress=await request(appFor(1)).get('/api/progress?asOf=2026-01-02');
  expect(progress.body.completions).toBe(0); expect(progress.body.history).toEqual([]);
});
test('period filtering uses inclusive dates for totals and history', async () => {
  const response=await request(appFor(1)).get('/api/progress?from=2026-01-02&asOf=2026-01-03');
  expect(response.status).toBe(200); expect(response.body.expected).toBe(2);
  expect(response.body.completions).toBe(0); expect(response.body.history).toEqual([]);
  const data=summarize([{id:1,frequency:'weekly',start_date:'2026-01-01'}],[{habit_id:1,completed_date:'2026-01-08'}],'2026-01-08','2026-01-02');
  expect(data.expected).toBe(1); expect(data.percentage).toBe(100);
});
test('invalid ranges, future report dates and stale sessions are rejected', async () => {
  expect((await request(appFor(1)).get('/api/progress?from=2026-01-03&asOf=2026-01-02')).status).toBe(400);
  expect((await request(appFor(1)).get('/api/progress?asOf=2099-01-01')).status).toBe(400);
  expect((await request(appFor(999)).get('/api/habits')).status).toBe(401);
  expect((await request(appFor(1)).get('/api/progress').set('X-Time-Zone','Invalid/Zone')).status).toBe(400);
});
test('all mutations require authentication', async () => {
  const app=appFor(null);
  expect((await request(app).put('/api/habits/1').send({})).status).toBe(401);
  expect((await request(app).delete('/api/habits/1')).status).toBe(401);
  expect((await request(app).delete('/api/habits/1/completions/2026-01-01')).status).toBe(401);
});
test('password hashes never appear in personal responses', async () => {
  const response=await request(appFor(1)).get('/api/me');
  expect(response.body).toEqual({id:1,name:'Alice',email:'a@example.test'});
});
