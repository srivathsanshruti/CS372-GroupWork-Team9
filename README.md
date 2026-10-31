# Group Work

Local implementation of authentication and the personal habits/progress feature.
Uses React, Bootstrap, Express, SQLite, bcrypt, express-session, and Jest.
Feature branch: `shruti-auth-and-progress`.

## Get the branch

From an existing checkout with no uncommitted changes:

```sh
git fetch origin
git switch --track origin/shruti-auth-and-progress
```

If the branch already exists locally, use `git switch shruti-auth-and-progress`
and `git pull --ff-only`. Review and integrate through a pull request into `main`.

## Run locally

Use Node.js 22.12+ (tested on Node 24).

```sh
cd server
npm ci
npm run db:init
cd ../client
npm ci
npm run build
cd ../server
npm start
```

Open **http://127.0.0.1:3001**. Choose **Create an account**, register with your
name/email/password, and use the dashboard. Registration signs you in. There are
no seeded users, sample credentials, or demo login endpoints. Your data is saved
in `server/database/groupwork.db`. Initialization preserves existing records.

For frontend development, run `npm run dev` inside `client` in another terminal.
Vite proxies `/api` to the backend. Stop either server with Ctrl+C.

## Implemented

- Registration, email/password sign-in, session restoration, and sign-out.
- Unique normalized emails; bcrypt password hashes with work factor 12.
- New session IDs on registration/login; server-side session invalidation on logout.
- SQLite session persistence; HttpOnly/SameSite cookies, cross-origin mutation
  checks, no-store API responses, and rate limiting of failed auth attempts.
- Habit creation, editing, deletion, daily/weekly schedules, and completion/undo.
- Overall/per-habit progress and history with all-time, seven-day and thirty-day windows.
- Server-side user ownership checks on every personal read and write.
- Study groups: create, browse, search, filter by course, join, leave, edit and
  delete, with creator-only edits and member-only member lists.

## Integrating teammates' work

This branch includes authentication and the personal feature end to end. Review
any overlapping authentication or habit work before merging; keep one shared
implementation of each route and session middleware.

`client/src/App.jsx` is the auth entry point. `AuthForm.jsx` contains the real
forms; `PersonalDashboard.jsx` exports the personal feature. Teammates can adapt
their mock React pages while preserving API requests and real session handling.
Bootstrap is imported in `main.jsx`, and custom styles are scoped to `.personal-app`.

To integrate the social pages:

1. Start from this branch so the existing database, session, and client setup stay
   together. Bring in the group/event components from the teammate's branch.
2. Extend the authenticated part of `App.jsx` with navigation to those components.
   Keep `PersonalDashboard` as the habits/progress page. Pass its `onSignOut`
   callback through so logout continues to destroy the server session.
3. Reuse `createPersonalApi('/api')` from `client/src/api.js` for relative API
   requests and same-origin cookies. Use `GET /api/me` for the logged-in student;
   never use a browser-supplied user ID to authorize access.
4. Add event Express routers in `server/app.js` after the existing session
   middleware and before the `/api` 404 handler. The groups router
   (`server/groupRoutes.js`) is already mounted at `/api/groups`, before the
   personal router. Read `req.session.userId` and
   check group membership/ownership in every protected operation.
5. Keep the shared schema in `server/schema.sql`. Run `npm run db:init` on each
   teammate's machine; their database/session secret should remain local.
6. Run both test suites and the client build. Test registration, login, habits,
   group navigation, refresh, and logout together using two separate accounts.

The existing registration and login forms can be restyled or replaced with the
teammate's React pages while retaining the API contracts below. Do not reintroduce
static form submissions or duplicate login/session logic.

`server/app.js` exports `createApp(db, options)`. It configures JSON parsing,
sessions, `/api/auth`, the personal router, and static frontend assets. Future
social routers should use the same session middleware and `req.session.userId`.
Put them before the API 404 handler. `createPersonalRouter(db)` remains independently
mountable. An optional `authRouter` or `sessionMiddleware` can replace the default
implementation when combining existing teammate work; do not mount two session
middlewares or two auth routers.

## API contract

All responses are JSON except successful deletes/logout (204).
Errors use `{ "error": "message" }`.

| Method | Route | Request / response |
| --- | --- | --- |
| POST | `/api/auth/register` | `{name,email,password}` → `{user:{id,name,email}}`, 201; signs in |
| POST | `/api/auth/login` | `{email,password}` → `{user:{id,name,email}}`, 200 |
| POST | `/api/auth/logout` | No body; destroys session, 204 |
| GET | `/api/me` | Current `{id,name,email}`, or 401 |
| GET | `/api/habits` | Current user's habits |
| POST | `/api/habits` | `{title,goal,frequency,start_date}` → created habit, 201 |
| PUT | `/api/habits/:id` | Same habit fields → updated habit, 200 |
| DELETE | `/api/habits/:id` | Deletes owned habit and completions, 204 |
| GET | `/api/progress?asOf=YYYY-MM-DD&from=YYYY-MM-DD` | `{asOf,from,expected,completions,percentage,habits,history}` |
| POST | `/api/habits/:id/completions` | `{completed_date:"YYYY-MM-DD"}` → 201; duplicate → 409 |
| DELETE | `/api/habits/:id/completions/:date` | Undo owned completion, 204 |
| GET | `/api/groups?q=&course=&mine=1` | Groups sorted by name, at most 100 |
| GET | `/api/groups/courses` | Distinct course names, for filter menus |
| POST | `/api/groups` | `{name,course,description,meeting_info}`, returns the group, 201; creator joins |
| GET | `/api/groups/:id` | One group; includes `members` only for members |
| PUT | `/api/groups/:id` | Same fields as create, creator only, 200 |
| DELETE | `/api/groups/:id` | Creator only; removes members, messages and events, 204 |
| POST | `/api/groups/:id/members` | Join as the signed-in user, 201; already a member returns 409 |
| DELETE | `/api/groups/:id/members/me` | Leave, 204; the creator gets 409 |

Only registration/login/logout are public. All personal endpoints verify a
numeric `req.session.userId` and an existing user. A nonexistent or another user's
habit returns 404 on writes. Frontend requests use same-origin cookies; no user ID
or token is stored in localStorage. Logout/expiry removes access to private data.

Names are 1–100 trimmed characters; emails up to 254 characters are trimmed and
lowercased. Registration passwords are at least eight characters, at most 72
UTF-8 bytes (bcrypt's limit); password whitespace is not trimmed. The UI also
requires matching confirmation. Failed registration/login attempts are limited
to 20 per IP per 15 minutes; restart resets this single-process limiter.

## Group behavior

Every group response has `id, name, course, description, meeting_info,
creator_id, creator_name, member_count, is_member, is_owner`. The last two are
computed for the signed-in user. `GET /api/groups/:id` adds `members`
(`id, name, joined_at`, no emails) when the viewer is a member.

List filters can be combined. `q` matches the name, course or description as a
literal substring (`%` and `_` are not wildcards). `course` is an exact,
case-insensitive match. `mine=1` (or `true`) keeps only groups the viewer is in.

Names are 1 to 100 trimmed characters. Course (up to 40), description (up to
1000) and meeting info (up to 200) are optional; blank values are stored as null.
The creator is added as the first member and cannot leave; they delete the group
instead. Edits and deletes from anyone else return 403. Unknown or malformed
group ids return 404. Membership is always taken from the session, never from
the request body.

SQL lives in `server/lib/groups.js` (`listGroups`, `getGroup`, `listMembers`,
`listCourses`, `createGroup`, `updateGroup`, `deleteGroup`, `joinGroup`,
`leaveGroup`) so other routers, such as events or the homepage, can reuse it.

## Session storage and local secrets

`auth_sessions` is an additional infrastructure table; the original eight product
tables remain. Session data contains cookie settings and userId, not passwords.
Expired sessions are rejected, and expired rows are pruned when sessions are saved.

Local startup creates an ignored `server/database/.session-secret` with mode 0600.
Keeping it lets existing signed session cookies work after a restart. Do not
commit/share that file or either database. Set a stable SESSION_SECRET of at least
32 bytes for production; production startup fails if it is missing or too short.
Sessions expire after 24 hours of inactivity.

Deployment still needs the team's Render setup: a persistent SQLite disk path,
a stable secret, HTTPS, appropriate proxy configuration (`TRUST_PROXY=1` only
behind the expected single trusted proxy), and `HOST=0.0.0.0`. Production cookies
are Secure. Keep database and session storage on the same persistent volume.
Multiple replicas require a shared limiter/store design; the local implementation
is intended for a single Node process. Password resets/email verification are
outside the planned registration/login stories.

## Habit and progress behavior

Titles allow 1–120 characters, goals 1–500. Schedules are `daily` or `weekly`.
Weekly means the start weekday, every seven days. After any recorded completion,
the schedule/start date are fixed to preserve history; name/goal remain editable.
The UI confirms habit deletion, which permanently cascades to its history.

Percentage is completed scheduled dates divided by expected scheduled dates,
rounded. Overall progress weights all opportunities. Reporting boundaries are
inclusive, future dates and dates before start are excluded, and empty periods
show 0%. The frontend sends the student's IANA `X-Time-Zone`; the server defaults
to UTC without it. Existing inactive habits retain historical expected dates
because the schema has no pause periods. Streaks are not implemented; percentage
satisfies US06.

## Verification

```sh
cd server
npm test
cd ../client
npm test
npm run build
```

42 tests: 28 backend and 14 frontend. Tests use isolated in-memory databases and
synthetic form inputs, never the real local database. They cover auth cookies,
password hashing, invalid login, duplicate email, logout/cookie replay, persisted
sessions/expiry, real two-account data isolation, date math, habit CRUD, undo,
validation, reporting filters, and frontend error handling.

Manual check: register, add a habit, complete it, inspect progress/history,
refresh, sign out, sign in again, then register a second account and verify it
starts empty.
