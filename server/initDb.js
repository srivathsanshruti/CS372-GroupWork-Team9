const fs = require('node:fs/promises');
const path = require('node:path');
const { openDatabase, databasePath } = require('./db');

async function initializeDatabase() {
  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  const db = await openDatabase();
  const exec = (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (error) => error ? reject(error) : resolve());
  });
  try {
    await exec('BEGIN TRANSACTION;');
    await exec(schema);
    await exec('COMMIT;');
    console.log(`Database initialized: ${databasePath}`);
  } catch (error) {
    await exec('ROLLBACK;').catch(() => {});
    throw error;
  } finally {
    await new Promise((resolve, reject) => {
      db.close((error) => error ? reject(error) : resolve());
    });
  }
}

if (require.main === module) {
  initializeDatabase().catch((error) => {
    console.error('Database initialization failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { initializeDatabase };
