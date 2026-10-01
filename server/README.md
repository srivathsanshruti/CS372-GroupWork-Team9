# Group Work database

From this directory, run:

```sh
npm ci
npm run db:init
```

This creates `database/groupwork.db` with eight tables. Each teammate uses their
own local database; database files and dependencies are ignored by Git.
Initialization can be repeated without deleting data. It creates missing tables
and indexes, but does not migrate existing table definitions.

Use the connection helper in future Express code:

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

Only database setup is implemented. There is no Express HTTP server or
`npm start` command yet.

After these files are committed and pushed by the project owner, a teammate can
clone the repository (or run `git pull` in an existing checkout), then run the
commands above inside `server` to create their local database.
