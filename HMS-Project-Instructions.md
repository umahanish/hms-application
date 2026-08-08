# HMS Application — Complete Project Setup & Development Guide

Consolidated reference: Jira storyboard → repo setup → Claude Code development → CI/CD → GitHub Pages hosting.

---

## 1. Jira Storyboard

**Site:** `awscognextrain2.atlassian.net`
**Project:** HMS-Project (key: `HMS`)

### Epic: Patient Registration — HMS-1
| Key | Story | Type | Assignee (placeholder) |
|---|---|---|---|
| HMS-4 | Build Patient Registration Form UI | Frontend | UI Dev |
| HMS-5 | Build Patient Search & Profile View UI | Frontend | UI Dev |
| HMS-6 | Develop Patient Registration REST API | Backend | Dev 1 |
| HMS-7 | Design Patient DB Schema & Validation Service | Backend | Dev 1 |

### Epic: Appointment Scheduling — HMS-2
| Key | Story | Type | Assignee (placeholder) |
|---|---|---|---|
| HMS-8 | Build Appointment Booking Calendar UI | Frontend | UI Dev |
| HMS-9 | Build Appointment Confirmation & Reminder UI | Frontend | UI Dev |
| HMS-10 | Develop Appointment Scheduling API | Backend | Dev 2 |
| HMS-11 | Build Doctor Availability & Conflict-Check Service | Backend | Dev 2 |

### Epic: Billing & Invoicing — HMS-3
| Key | Story | Type | Assignee (placeholder) |
|---|---|---|---|
| HMS-12 | Build Invoice Generation & Billing Summary UI | Frontend | UI Dev |
| HMS-13 | Build Payment Status Dashboard UI | Frontend | UI Dev |
| HMS-14 | Develop Billing & Invoice Generation API | Backend | Dev 1 |
| HMS-15 | Build Payment Processing Integration Service | Backend | Dev 2 |

**Workload split:** UI Dev = 6 stories · Dev 1 = 3 stories · Dev 2 = 3 stories
(Placeholder assignees — swap for real Jira account IDs once known and bulk-reassign.)

Every story includes full acceptance criteria directly in its Jira description — Claude Code should always fetch and read these before implementing.

---

## 2. Repository Setup

```bash
mkdir hms-application && cd hms-application
git init
# create repo on GitHub, then:
git remote add origin https://github.com/<username>/hms-application.git
```

**Expected folder structure** (required — CI workflow depends on this exact layout):
```
hms-application/
├── frontend/        # React app
├── backend/         # Node/Express app
├── .github/workflows/ci.yml
├── TASKS.md
└── CLAUDE.md
```

### `CLAUDE.md` (repo root — read automatically by Claude Code every session)
```markdown
# HMS Application

React frontend in /frontend, Node/Express backend in /backend.
Jira project key: HMS. Pull story details (summary, description, acceptance criteria)
from Jira before implementing.
Every story must include unit tests before being marked done.
Follow the existing .github/workflows/ci.yml structure — do not change folder layout.
```

---

## 3. Claude Code Setup

```bash
npm install -g @anthropic-ai/claude-code
cd hms-application
claude
```

Connect Jira as an MCP server inside Claude Code:
```bash
claude mcp add atlassian --transport sse https://mcp.atlassian.com/v1/sse
```
(OAuth login with the same Jira account used for the storyboard.)

### Permission mode — let Claude Code run without asking every time

Two options, depending on how much you want it to run unattended:

```bash
# Option A — acceptEdits: auto-approves file edits & basic filesystem commands only
claude --permission-mode acceptEdits

# Option B — auto (RECOMMENDED): auto-approves the full loop — edits, tests, commits, pushes —
# with a background classifier that still blocks risky actions (force push, secret leaks, etc.)
claude --permission-mode auto
```

| | `acceptEdits` | `auto` |
|---|---|---|
| File edits (code, tests) | ✅ Auto-approved | ✅ Auto-approved |
| `mkdir`, `mv`, `cp`, `touch`, etc. | ✅ Auto-approved | ✅ Auto-approved |
| `npm test`, `npm install`, `npm run build` | ❌ Still prompts | ✅ Auto-approved (classifier-reviewed) |
| `git commit`, `git push` to your repo | ❌ Still prompts | ✅ Auto-approved (classifier-reviewed) |
| Fetching Jira issues via MCP | ❌ Still prompts | ✅ Auto-approved |
| Safety net | None beyond scope | Classifier blocks force pushes, secret leaks, destructive deletes, unapproved PR merges, etc. |

**Recommended: `auto`.** This project needs the full loop (edit → test → commit → push) to run without interruption across 12 stories — `acceptEdits` only covers file writes, so every test run and push would still stop and ask. `auto` covers the whole pipeline while keeping a safety layer for genuinely risky actions.

**Requirement:** `auto` mode needs a supported model (Sonnet 5, Opus 4.6+, or Fable 5). If Claude Code reports it unavailable when cycling with `Shift+Tab`, your account/model doesn't currently support it — fall back to `acceptEdits` and manually approve test/push prompts as they come.

To make `auto` the session default permanently (user-level settings, not project-level — project-level `auto` is ignored for security), add to `~/.claude/settings.json`:
```json
{
  "permissions": {
    "defaultMode": "auto"
  }
}
```

---

## 4. TASKS.md (repo root — drives the full development run)

```markdown
# HMS Development Tasks — work through in order

Rules:
- Complete ONE task fully before starting the next: implement, write unit tests, run tests, fix failures.
- After each task, mark it [x] done in this file and commit with the Jira key in the message.
- Stop and summarize after each epic (Patient Registration / Appointments / Billing) before continuing.

## Epic: Patient Registration (HMS-1)
- [ ] HMS-7: DB schema & validation service (backend)
- [ ] HMS-6: Registration REST API (backend, depends on HMS-7)
- [ ] HMS-4: Registration form UI (frontend, depends on HMS-6)
- [ ] HMS-5: Search & profile view UI (frontend, depends on HMS-6)

## Epic: Appointment Scheduling (HMS-2)
- [ ] HMS-11: Doctor availability service (backend)
- [ ] HMS-10: Scheduling API (backend, depends on HMS-11)
- [ ] HMS-8: Booking calendar UI (frontend, depends on HMS-10)
- [ ] HMS-9: Confirmation & reminder UI (frontend, depends on HMS-10)

## Epic: Billing & Invoicing (HMS-3)
- [ ] HMS-14: Billing/invoice API (backend)
- [ ] HMS-15: Payment processing service (backend, depends on HMS-14)
- [ ] HMS-12: Invoice generation UI (frontend, depends on HMS-14)
- [ ] HMS-13: Payment status dashboard UI (frontend, depends on HMS-14, HMS-15)

## Final steps (after all above are checked off)
- [ ] Code review pass against all Jira acceptance criteria
- [ ] Push to main, verify ci.yml (including deploy job) passes
- [ ] Confirm live GitHub Pages URL loads correctly
```

### Kickoff prompt for Claude Code
```
Read TASKS.md in this repo. For each unchecked task, fetch the corresponding Jira
issue's full description and acceptance criteria, implement it, write unit tests,
run them, and fix any failures. Check the box in TASKS.md and commit with the Jira
key before moving to the next task. Pause and summarize progress after finishing each
epic so I can review before you continue.
```

### Individual per-issue prompts (use if working one story at a time instead)

**HMS-7:**
```
Pick up Jira issue HMS-7. Read its full description and acceptance criteria.
Implement the patient database schema, migration scripts, and the duplicate-check
validation service in /backend per the acceptance criteria. Write unit tests covering
schema constraints and duplicate-detection logic. Run the tests and fix any failures.
Report back what was built and the test results.
```

**HMS-6:**
```
Pick up Jira issue HMS-6. Read its full description and acceptance criteria.
Implement the patient registration REST API (POST/PUT/GET /patients) in /backend,
using the schema and validation service from HMS-7. Write unit tests covering create,
update, fetch, and validation-failure paths. Run the tests and fix any failures.
Report back what was built and the test results.
```

**HMS-4:**
```
Pick up Jira issue HMS-4. Read its full description and acceptance criteria.
Implement the patient registration form in /frontend, wiring it to the API built for
HMS-6. Write unit tests for form validation and submit behavior. Run the tests and fix
any failures. Report back what was built and the test results.
```

**HMS-5:**
```
Pick up Jira issue HMS-5. Read its full description and acceptance criteria.
Implement patient search and profile view in /frontend, wired to the HMS-6 API.
Write unit tests for search behavior and profile rendering, including empty/error
states. Run the tests and fix any failures. Report back what was built and the test results.
```

**HMS-11:**
```
Pick up Jira issue HMS-11. Read its full description and acceptance criteria.
Implement the doctor availability service in /backend per the acceptance criteria.
Write unit tests covering availability computation edge cases (leave, overlapping
slots, holidays). Run the tests and fix any failures. Report back what was built and
the test results.
```

**HMS-10:**
```
Pick up Jira issue HMS-10. Read its full description and acceptance criteria.
Implement the appointment scheduling API in /backend, using the availability service
from HMS-11. Write unit tests covering booking, conflict rejection, reschedule, and
cancellation. Run the tests and fix any failures. Report back what was built and the test results.
```

**HMS-8:**
```
Pick up Jira issue HMS-8. Read its full description and acceptance criteria.
Implement the appointment booking calendar in /frontend, wired to the HMS-10 API.
Write unit tests for booking flow and conflict handling in the UI. Run the tests and
fix any failures. Report back what was built and the test results.
```

**HMS-9:**
```
Pick up Jira issue HMS-9. Read its full description and acceptance criteria.
Implement appointment confirmation and reminder screens in /frontend, wired to the
HMS-10 API. Write unit tests for the reschedule/cancel actions and reminder logic.
Run the tests and fix any failures. Report back what was built and the test results.
```

**HMS-14:**
```
Pick up Jira issue HMS-14. Read its full description and acceptance criteria.
Implement the billing and invoice generation API in /backend per the acceptance
criteria, including idempotent invoice generation. Write unit tests covering
calculation accuracy, retrieval, and status transitions. Run the tests and fix any
failures. Report back what was built and the test results.
```

**HMS-15:**
```
Pick up Jira issue HMS-15. Read its full description and acceptance criteria.
Implement the payment processing integration service in /backend, updating invoice
status from HMS-14 on success. Write unit tests covering successful payment, failure,
and webhook reconciliation paths. Run the tests and fix any failures. Report back what
was built and the test results.
```

**HMS-12:**
```
Pick up Jira issue HMS-12. Read its full description and acceptance criteria.
Implement the invoice generation and billing summary UI in /frontend, wired to the
HMS-14 API, including PDF export. Write unit tests for calculation display and invoice
list rendering. Run the tests and fix any failures. Report back what was built and the test results.
```

**HMS-13:**
```
Pick up Jira issue HMS-13. Read its full description and acceptance criteria.
Implement the payment status dashboard in /frontend, wired to the HMS-14 and HMS-15
APIs. Write unit tests for filters, totals, and the record-payment action. Run the
tests and fix any failures. Report back what was built and the test results.
```

---

## 5. Code Review

```
Act as a code reviewer. Review all changes made for HMS-4 through HMS-15 against
their Jira acceptance criteria. Check for security issues, missing test coverage, and
code quality problems. List every finding, then fix them.
```

---

## 6. CI/CD — `.github/workflows/ci.yml`

```yaml
name: HMS CI

on:
  push:
    branches: [ main, develop, "feature/**" ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend:
    name: Backend - Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./backend
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: backend/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint --if-present
      - name: Run unit tests
        run: npm test -- --ci --coverage
      - name: Upload backend coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: backend/coverage

  frontend:
    name: Frontend (UI) - Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./frontend
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint --if-present
      - name: Run unit tests
        run: npm test -- --ci --coverage --watchAll=false
      - name: Build production bundle
        run: npm run build
      - name: Upload frontend coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: frontend/coverage
      - name: Upload frontend build
        uses: actions/upload-artifact@v4
        with:
          name: frontend-build
          path: frontend/build

  build-status:
    name: Build Gate
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    steps:
      - name: All checks passed
        run: echo "Backend and frontend tests/build succeeded. Safe to merge/deploy."

  deploy:
    name: Deploy to GitHub Pages
    needs: [backend, frontend]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Download frontend build artifact
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: ./build
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./build
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 7. GitHub Pages Hosting Setup

### One-time repo configuration
1. Repo → **Settings → Pages → Source** → select **GitHub Actions** (not "Deploy from a branch")
2. Ignore the suggested "GitHub Pages Jekyll" / "Static HTML" template cards — the custom `ci.yml` above already handles the build/deploy
3. Leave **Custom domain** blank unless you own a domain to point at it

### `frontend/package.json`
```json
"homepage": "https://<your-github-username>.github.io/hms-application"
```

### Push & verify
```
Add the GitHub Pages deploy job to .github/workflows/ci.yml exactly as specified,
set "homepage" in frontend/package.json to https://<username>.github.io/hms-application,
commit, push to main, then use `gh run watch` to confirm the deploy job succeeds,
and report back the live Pages URL.
```

Once deployed, the live site is reachable at:
```
https://<username>.github.io/hms-application
```

### GitHub Pages limits to be aware of
| Limit | Value |
|---|---|
| Published site size | 1 GB max |
| Source repo size | 1 GB recommended |
| Bandwidth | Soft limit, 100 GB/month |
| Builds per hour | 10 (does **not** apply — this repo uses a custom Actions workflow) |
| Deploy timeout | 10 minutes |
| Sites per account | 1 user/org site; **unlimited project sites** (one per repo) |

**Note:** GitHub Pages hosts static files only — it serves the React frontend, not the Node/Express backend. The backend APIs need separate hosting (e.g. Render, Railway) for the deployed UI to be fully functional beyond static screens. Not intended for production/commercial use — treat as demo/staging.

---

## 8. SonarQube/SonarCloud Quality Gate Integration

### One-time setup
1. Create the project on [SonarCloud](https://sonarcloud.io) under your organization, bound to the GitHub repo.
2. **Turn off Automatic Analysis**: Project → **Administration → Analysis Method** → disable "Automatic Analysis". SonarCloud's Automatic Analysis scans directly from GitHub with no CI step, but it can't run your test suites — so it never sees coverage data. CI-based analysis (below) is required to get coverage into the quality gate.
3. Generate a SonarCloud token (My Account → Security) and add it as a GitHub Actions secret:
   ```
   gh secret set SONAR_TOKEN --repo <username>/hms-application --body "<token>"
   ```

### `sonar-project.properties` (repo root)
```properties
sonar.organization=<your-org>
sonar.projectKey=<org>_hms-application
sonar.projectName=hms-application

sonar.sources=backend/src,frontend/src,shared
sonar.tests=backend/tests,frontend/src
sonar.test.inclusions=backend/tests/**,frontend/src/**/*.test.jsx,frontend/src/**/*.test.js
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/build/**

sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info,frontend/coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

### Coverage reporting
Both `backend/vitest.config.js` and `frontend/vite.config.js` need lcov output for the quality gate to evaluate coverage:
```js
coverage: {
  provider: 'v8',
  reporter: ['lcov', 'text'],
  reportsDirectory: './coverage',
  allowExternal: true, // needed if any source lives outside this package (e.g. shared/)
},
```

### Coverage path gotcha for shared/monorepo code
If frontend and backend share code (e.g. `shared/patientValidation.js`), each package's lcov report references it via a relative `../shared/...` path. SonarCloud's coverage sensor cannot resolve a leading `..` against its indexed source files, so that file silently reports 0% coverage and can fail the new-code coverage condition. Fix: rewrite each lcov report's `SF:` paths to be relative to the repo root before scanning — see `scripts/normalize-lcov.js`, run in CI right before the scan step.

### `.github/workflows/ci.yml` — `sonarcloud` job
Runs after backend/frontend tests, downloads their coverage artifacts, normalizes the lcov paths, scans, and fails the build if the quality gate doesn't pass. `deploy` depends on it, so a failing quality gate blocks the GitHub Pages deploy:
```yaml
sonarcloud:
  name: SonarCloud Quality Gate
  needs: [backend, frontend]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - uses: actions/download-artifact@v4
      with:
        name: backend-coverage
        path: backend/coverage
    - uses: actions/download-artifact@v4
      with:
        name: frontend-coverage
        path: frontend/coverage
    - name: Rewrite lcov paths relative to repo root
      run: |
        node scripts/normalize-lcov.js backend/coverage/lcov.info backend/
        node scripts/normalize-lcov.js frontend/coverage/lcov.info frontend/
    - uses: SonarSource/sonarqube-scan-action@v4
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: https://sonarcloud.io
    - name: Fail the build if the quality gate is not passed
      uses: SonarSource/sonarqube-quality-gate-action@master
      timeout-minutes: 5
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

The backend/frontend jobs also need `--coverage` on their test runs and an `upload-artifact` step for `coverage/lcov.info` so the `sonarcloud` job can download it.

### Kickoff prompt for Claude Code
```
Set up a SonarCloud quality gate for this repo: add lcov coverage reporting
to both vitest configs, create sonar-project.properties, wire a sonarcloud
job into ci.yml that scans and fails the build if the quality gate doesn't
pass (deploy should depend on it), then run the pipeline and fix whatever
the gate flags until it's green.
```

---

## 9. End-to-End Flow Summary

```
Jira story (HMS-4..15)
   → Claude Code reads acceptance criteria via Atlassian MCP
   → implements code + unit tests in /frontend or /backend
   → runs tests locally, fixes failures
   → code review pass against acceptance criteria
   → commit (referencing Jira key) + push to main
   → ci.yml runs: backend tests → frontend tests/build →
     SonarCloud scan + quality gate → deploy
   → GitHub Pages publishes frontend/build
   → live at https://<username>.github.io/hms-application
```
