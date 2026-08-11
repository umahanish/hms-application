# HMS Development Tasks — work through in order

Rules:
- Complete ONE task fully before starting the next: implement, write unit tests, run tests, fix failures.
- After each task, mark it [x] done in this file and commit with the Jira key in the message.
- Stop and summarize after each epic (Patient Registration / Appointments / Billing) before continuing.

## Epic: Patient Registration (HMS-1)
- [x] HMS-7: DB schema & validation service (backend)
- [x] HMS-6: Registration REST API (backend, depends on HMS-7)
- [x] HMS-4: Registration form UI (frontend, depends on HMS-6)
- [x] HMS-5: Search & profile view UI (frontend, depends on HMS-6)

## Epic: Appointment Scheduling (HMS-2)
- [x] HMS-11: Doctor availability service (backend)
- [x] HMS-10: Scheduling API (backend, depends on HMS-11)
- [x] HMS-8: Booking calendar UI (frontend, depends on HMS-10)
- [x] HMS-9: Confirmation & reminder UI (frontend, depends on HMS-10)

## Epic: Billing & Invoicing (HMS-3)
- [x] HMS-14: Billing/invoice API (backend)
- [x] HMS-15: Payment processing service (backend, depends on HMS-14)
- [x] HMS-12: Invoice generation UI (frontend, depends on HMS-14)
- [x] HMS-13: Payment status dashboard UI (frontend, depends on HMS-14, HMS-15)

## SonarQube/SonarCloud Quality Gate Integration
- [x] Add lcov coverage reporting to backend/frontend vitest configs
- [x] Create sonar-project.properties (sources, tests, coverage report paths)
- [x] Add SONAR_TOKEN GitHub Actions secret
- [x] Wire a `sonarcloud` job into ci.yml that scans and enforces the quality
      gate; deploy now depends on it passing
- [x] Fix issues surfaced by the scan: insecure Math.random() fallback,
      array-index React keys, role="status" divs, nested ternaries, a
      ReDoS-prone email regex, a low-contrast status badge
- [x] Dedupe the frontend/backend patient validation logic into
      shared/patientValidation.js (fixes a new-code duplication gate failure
      caused by fixing the same regex in two near-identical files)
- [x] Normalize lcov coverage paths to repo-root-relative
      (scripts/normalize-lcov.js) so SonarCloud correctly measures coverage
      for shared/ (a leading "../" in the path broke file resolution)

## Final steps (after all above are checked off)
- [ ] Code review pass against all Jira acceptance criteria
- [x] Push to main, verify ci.yml (including deploy job and SonarCloud
      quality gate) passes
- [x] Confirm live GitHub Pages URL loads correctly

## SingleStore DB Integration (in progress, uncommitted)
- [x] Wire backend/src/db/pool.js (mysql2/promise pool, parameterized queries
      only) into the app; add a pingDatabase() health check
- [x] Document/create backend/db/setup/create_app_user.sql (DB user + grants
      for SingleStore Helios) — file is gitignored, keep it out of the repo
- [x] Commit backend/package.json, package-lock.json, .gitignore, and
      src/db/pool.js together once wired and tested
- [x] Unit tests for the db pool / health check

## SingleStore DB Integration — full persistence migration (scope expanded per user decision)
- [x] Replace better-sqlite3 with SingleStore across every repository
      (patients, doctors, appointments, invoices, payments); removed the old
      sqlite connection/migration files and the better-sqlite3 dependency
- [x] Versioned, reversible async migration runner
      (backend/src/db/migrateSingleStore.js) + 7 migrations under
      backend/src/migrations-singlestore/, mirroring the old sqlite schema
      history plus a new doctor_day_locks table
- [x] Replaced the old single-process synchronous-transaction booking-conflict
      guarantee (which only worked because better-sqlite3 ran in-process) with
      a real doctor/day row lock (SELECT ... FOR UPDATE on doctor_day_locks)
      so double-booking is still prevented against a real networked DB;
      invoice idempotency now relies on the DB UNIQUE constraint + duplicate-
      key catch instead of check-then-insert
- [x] Lightweight trusted-header RBAC (backend/src/middleware/rbac.js): gates
      patient/appointment endpoints to front-desk|admin and billing/payment
      endpoints to billing-staff|admin; payment webhook is secured by a
      shared secret (PAYMENT_WEBHOOK_SECRET) instead, since the caller is a
      gateway, not a logged-in user. NOT a real auth system — there is no
      login/session/identity model in this app; the frontend API clients
      currently hardcode the role header since there's no login screen to
      source it from. Follow-up: build real auth if this goes beyond a demo.
- [x] Backend test suite rewritten against a purpose-built in-memory fake of
      the mysql2 pool (backend/tests/helpers/fakePool.js) — including real
      per-key async lock queues so the FOR UPDATE-based concurrency tests
      (e.g. two simultaneous booking requests for the same slot) are
      faithful, not just mocked-away. A live-SingleStore smoke test for
      pingDatabase() exists (backend/tests/pool.integration.test.js) but is
      skipped unless DB_HOST is set — CI does not currently set DB secrets,
      so there is no automated test against the real database. Follow-up if
      that coverage is wanted: add DB_HOST/USER/PASSWORD as CI secrets.
- [x] Code review pass against Jira acceptance criteria + security checklist
      for this migration specifically (SQL injection, hardcoded secrets,
      missing validation, missing RBAC, test coverage gaps) — findings:
      all queries confirmed parameterized (no string-built SQL), no
      hardcoded secrets, RBAC covers every sensitive route; found and fixed
      a real gap where appointments/invoices/payments routes had no
      401/403 test coverage (only patients did) and rbac.js's "webhook not
      configured" 503 branch was untested — added tests for both

## HMS-16: Add "New Patient" entry point to Patient Management screen
- [x] Add an "Add New Patient" action to PatientManagement.jsx (create mode:
      renders PatientRegistrationForm with no patientId/initialValues) —
      the form and its POST /api/patients wiring already existed, but there
      was no reachable path to it in the live UI, only search -> edit
- [x] Unit tests for the create-mode entry point and successful create flow
- [x] Manually verified against the real hms-workspace-group SingleStore
      workspace, live browser (Playwright), not just mocks: clicked "Add
      New Patient", filled the form, submitted, confirmed the created
      patient's profile renders with the submitted data and no console
      errors. Also verified persistence directly via curl (POST then
      GET/search) before the browser pass.

## Live-DB verification fallout: this was the first real connection to a live SingleStore instance
Running the actual app against the real `hms-workspace-group` workspace (as
opposed to the fake-pool-backed test suite) surfaced several real bugs the
fake pool couldn't catch, since it doesn't model SingleStore's own
constraints. Fixed all of them:
- [x] `backend/.env`'s DB_HOST/DB_NAME were stale placeholders that never
      matched the actual provisioned workspace/database — corrected to the
      real endpoint (`hms-workspace-group`, database `hms_db`)
- [x] `hms_app_user` (backend/db/setup/create_app_user.sql) had never
      actually been run against the workspace, and its password didn't meet
      the workspace's password policy (min 14 chars incl. 1+ special char) —
      regenerated a compliant password and ran the script for real
- [x] `.env` values containing `#` need to be quoted — unquoted, dotenv
      treats `#` as a comment delimiter and silently truncates the value
      (this is why the password looked "wrong" even once it was correct)
- [x] Schema bug: SingleStore requires any UNIQUE KEY to be a superset of
      the table's shard key (defaults to the primary key). `holidays`'
      UNIQUE KEY on holiday_date and `invoices`' UNIQUE KEY on
      idempotency_key both violated this — the fake pool doesn't model the
      constraint, so it never caught it. Fixed: holidays now uses
      holiday_date as its natural primary key (no surrogate id, nothing
      referenced it); invoice idempotency uniqueness moved to a dedicated
      invoice_idempotency_keys guard table (migration 008), same pattern as
      doctor_day_locks, since idempotency_key is nullable and can't be
      folded into the id-based primary key
- [x] Architecture bug: `startServer.js` ran `migrateUp` (needs CREATE
      TABLE) on every boot using the app's own DB connection — but that
      connection is deliberately the least-privilege, DML-only
      `hms_app_user`, which can't run DDL. Migrations are now a separate
      step: `npm run migrate` (backend/src/runMigrations.js), meant to be
      run with elevated/admin credentials before starting the app; the app
      itself now only pings the DB and starts listening, no schema changes
- [x] SingleStore shared/starter-tier workspaces cap total table count —
      hit "max number of tables allowed" partway through migrations when
      briefly using the shared starter workspace instead of the dedicated
      one. Confirmed the dedicated `hms-workspace-group` workspace (no such
      cap) is the correct one for this app; not a code issue
