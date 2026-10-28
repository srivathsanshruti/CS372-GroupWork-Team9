const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { openDatabase } = require('../db');
const { createApp, query } = require('../app');
let db, app;
const account = {name:'Student One',email:'student1@example.test',password:'a-valid-password1'};
const secret = 'test-secret-with-at-least-thirty-two-bytes';
beforeEach(async () => {
  db = await openDatabase(':memory:');
  await new Promise((resolve,reject)=>db.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'),e=>e?reject(e):resolve()));
  app=createApp(db,{sessionSecret:secret});
});
afterEach(async () => new Promise((resolve,reject)=>db.close(e=>e?reject(e):resolve())));
test('registration hashes the password and creates a protected session', async () => {
  const agent=request.agent(app);
  const response=await agent.post('/api/auth/register').send(account);
  expect(response.status).toBe(201);
  expect(response.body.user).toEqual({id:1,name:account.name,email:account.email});
  expect(JSON.stringify(response.body)).not.toMatch(/password/);
  const stored=await query(db,'get','SELECT password_hash FROM users WHERE id=1');
  expect(stored.password_hash).not.toBe(account.password);
  expect(await bcrypt.compare(account.password,stored.password_hash)).toBe(true);
  const cookie=response.headers['set-cookie'][0];
  expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict');
  expect((await agent.get('/api/me')).body.id).toBe(1);
  expect((await agent.get('/api/me')).headers['cache-control']).toBe('no-store');
});
test('duplicate emails are normalized and rejected', async () => {
  await request(app).post('/api/auth/register').send(account);
  const response=await request(app).post('/api/auth/register').send({...account,email:' STUDENT1@EXAMPLE.TEST '});
  expect(response.status).toBe(409);
  expect((await query(db,'get','SELECT COUNT(*) AS n FROM users')).n).toBe(1);
});
test('invalid fields, short passwords and bcrypt byte truncation are rejected', async () => {
  for(const body of [{...account,email:'invalid'}, {...account,name:' '}, {...account,password:'short'}, {...account,password:'é'.repeat(37)}, {...account,name:'x'.repeat(101)}]) {
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(400);
  }
});
test('wrong password and unknown account return the same message', async () => {
  await request(app).post('/api/auth/register').send(account);
  const wrong=await request(app).post('/api/auth/login').send({email:account.email,password:'wrong-password'});
  const missing=await request(app).post('/api/auth/login').send({email:'absent@example.test',password:'wrong-password'});
  expect(wrong.status).toBe(401); expect(missing.status).toBe(401); expect(wrong.body).toEqual(missing.body);
});
test('logout invalidates the session, including a replayed old cookie', async () => {
  const agent=request.agent(app);
  const registration=await agent.post('/api/auth/register').send(account);
  const cookie=registration.headers['set-cookie'][0].split(';')[0];
  expect((await agent.post('/api/auth/logout')).status).toBe(204);
  expect((await agent.get('/api/me')).status).toBe(401);
  expect((await request(app).get('/api/me').set('Cookie',cookie)).status).toBe(401);
});
test('login rotates the old session and password login works after logout', async () => {
  const agent=request.agent(app);
  const registration=await agent.post('/api/auth/register').send(account);
  const oldCookie=registration.headers['set-cookie'][0].split(';')[0];
  const login=await agent.post('/api/auth/login').send({email:'STUDENT1@EXAMPLE.TEST',password:account.password});
  expect(login.status).toBe(200);
  expect(login.headers['set-cookie'][0].split(';')[0]).not.toBe(oldCookie);
  expect((await request(app).get('/api/me').set('Cookie',oldCookie)).status).toBe(401);
  await agent.post('/api/auth/logout');
  expect((await agent.post('/api/auth/login').send(account)).status).toBe(200);
});
test('saved SQLite sessions survive rebuilding the app and expiry revokes access', async () => {
  const registration=await request(app).post('/api/auth/register').send(account);
  const cookie=registration.headers['set-cookie'][0].split(';')[0];
  const restarted=createApp(db,{sessionSecret:secret});
  expect((await request(restarted).get('/api/me').set('Cookie',cookie)).body.id).toBe(1);
  await query(db,'run','UPDATE auth_sessions SET expires_at=0');
  expect((await request(restarted).get('/api/me').set('Cookie',cookie)).status).toBe(401);
});
test('two actual logins cannot access each other’s habits or history', async () => {
  const first=request.agent(app), second=request.agent(app);
  await first.post('/api/auth/register').send(account);
  await second.post('/api/auth/register').send({...account,email:'student2@example.test',name:'Student Two'});
  const created=await first.post('/api/habits').send({title:'Private habit',goal:'Read',frequency:'daily',start_date:'2026-01-01'});
  const id=created.body.id;
  expect((await first.post(`/api/habits/${id}/completions`).send({completed_date:'2026-01-01'})).status).toBe(201);
  const own=await first.get('/api/progress?asOf=2026-01-01');
  const other=await second.get('/api/progress?asOf=2026-01-01');
  expect(own.body.habits).toHaveLength(1); expect(own.body.history).toHaveLength(1);
  expect(other.body.habits).toEqual([]); expect(other.body.history).toEqual([]);
  expect((await second.delete('/api/habits/'+id)).status).toBe(404);
  expect((await second.post(`/api/habits/${id}/completions`).send({completed_date:'2026-01-02'})).status).toBe(404);
});
test('cross-origin login and logout are blocked before changing a session', async () => {
  const agent=request.agent(app);
  expect((await agent.post('/api/auth/register').set('Origin','https://untrusted.example').send(account)).status).toBe(403);
  await agent.post('/api/auth/register').send(account);
  expect((await agent.post('/api/auth/logout').set('Origin','https://untrusted.example')).status).toBe(403);
  expect((await agent.get('/api/me')).body.id).toBe(1);
});
test('repeated invalid auth attempts are rate limited', async () => {
  for(let n=0;n<20;n++) expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  const limited=await request(app).post('/api/auth/login').send({});
  expect(limited.status).toBe(429); expect(limited.headers['retry-after']).toBeDefined();
});
