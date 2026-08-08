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
