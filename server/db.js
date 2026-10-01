const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');

const databasePath = path.join(__dirname, 'database', 'groupwork.db');

// Resolve only after foreign-key enforcement is enabled on this connection.
function openDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, (error) => {
      if (error) return reject(error);
      db.configure('busyTimeout', 5000);
      db.exec('PRAGMA foreign_keys = ON;', (pragmaError) => {
        if (pragmaError) {
          db.close(() => reject(pragmaError));
          return;
        }
        resolve(db);
      });
    });
  });
}

module.exports = { openDatabase, databasePath };
