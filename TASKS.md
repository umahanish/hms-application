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

## Final steps (after all above are checked off)
- [ ] Code review pass against all Jira acceptance criteria
- [ ] Push to main, verify ci.yml (including deploy job) passes
- [ ] Confirm live GitHub Pages URL loads correctly
