// sqlite3 callback adapters. All values must be supplied as bound parameters.
function query(db, method, sql, params = []) {
  return new Promise((resolve, reject) => {
    db[method](sql, params, function (error, rows) {
      if (error) reject(error);
      else resolve(method === 'run' ? { id: this.lastID, changes: this.changes } : rows);
    });
  });
}
module.exports = { query };
