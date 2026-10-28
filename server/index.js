const { openDatabase } = require('./db');
const { createApp } = require('./app');
const { sessionSecret } = require('./localSessionSecret');
async function start() {
  const db = await openDatabase();
  const app = createApp(db, { sessionSecret: sessionSecret() });
  const server = app.listen(process.env.PORT || 3001, process.env.HOST || '127.0.0.1', () => console.log('Group Work: http://localhost:' + (process.env.PORT || 3001)));
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(() => db.close());
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
start().catch(error => { console.error(error); process.exitCode = 1; });
