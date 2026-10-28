const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function sessionSecret() {
  if (process.env.SESSION_SECRET) {
    if (Buffer.byteLength(process.env.SESSION_SECRET) < 32) throw new Error('SESSION_SECRET must contain at least 32 bytes.');
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Set SESSION_SECRET before starting in production.');
  const file = path.join(__dirname, 'database/.session-secret');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return fs.readFileSync(file, 'utf8').trim();
}
module.exports = { sessionSecret };
