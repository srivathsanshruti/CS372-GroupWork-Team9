# Team meeting handoff — October 28

Sprint 3: October 20–November 2. Feature branch: `shruti-auth-and-progress`.

Implemented:
- Shruti's progress dashboard, completion percentage/history and privacy checks (US06).
- Habit create/list/edit/delete and completion/undo prerequisites.
- Full real registration/login/logout integration to unblock the personal feature.
- bcrypt hashing, persistent SQLite sessions, auth middleware and React forms.
- 42 passing tests and a successful frontend build.

Original auth assignments in the document:
- Shruti: React/Bootstrap forms, navigation, validation and API connection.
- Brandon: registration/login/logout/current-user endpoints and bcrypt.
- Dhruvan: session configuration, protected routes and auth tests.

This branch includes the integrated authentication implementation. Review and
reconcile overlapping work before merging. Teammates' React pages can reuse the
API contract in README.md rather than duplicating authentication logic.

Groups (added on `brandon-homepage`, October 31):
- Group create, browse, search, course filter, join/leave, edit and delete APIs
  under `/api/groups`, with creator-only edits and member-only member lists.
- Reusable SQL helpers in `server/lib/groups.js`.
- Groups page at `#/groups` with search, filters, create form and join/leave.
- 79 passing tests (49 backend, 30 frontend) and a successful frontend build.

Remaining Sprint 3 work:
- Brandon: review the groups work above against the original plan.
- Dhruvan: integration support and demo-environment check.
- Homepage: replace sample data with real habits, groups and events.
- Everyone: integration, Jira updates and the midterm presentation/report.

No demo accounts or bypass login routes are shipped. Register a real local account
to use groupwork.db. Earlier demo.db, if present, remains ignored and unused.
Integration and local setup instructions are in README.md. This feature has not
been merged into main.
