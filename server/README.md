# Group Work database

From this directory, run:

```sh
npm ci
npm run db:init
```

This creates `database/groupwork.db` with eight product tables and an auth_sessions table. Each teammate uses their
own local database; database files and dependencies are ignored by Git.
Initialization can be repeated without deleting data. It creates missing tables
and indexes, but does not migrate existing table definitions.

Use the shared connection helper in Express code:

```js
const { openDatabase } = require('./db');
const db = await openDatabase();
// Use sqlite3's parameterized db.run/db.get/db.all methods.
// Close db when the application shuts down.
```

The helper enables foreign keys before returning the connection. Dates should
use `YYYY-MM-DD`, and event times should use `HH:MM` in 24-hour local time.
`frequency` and habit `status` are text fields for the team to define; habit
status defaults to `active`. RSVP status is restricted to `attending` or
`not_attending`. User deletion is restricted while referenced. Deleting a habit,
study group, or event cascades to its dependent records.

The personal progress API is implemented in `app.js`; `npm start` starts the
normal server. See `../README.md` for authentication, the dashboard, tests, and integration.

Check out `shruti-auth-and-progress` as described in the root README, then run
the commands above inside `server` to create your local database.
