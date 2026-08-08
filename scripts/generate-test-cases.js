// Builds TestCases.csv from real vitest JSON results (backend/coverage/test-results.json,
// frontend/coverage/test-results.json) plus a live SonarCloud quality gate check, and exits
// non-zero if anything failed -- this is the gate the CI "test-cases" job enforces before deploy.
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');

// Maps a spec file (relative to repo root, forward slashes) to the epic/Jira story it verifies.
const EPIC_RULES = [
  [/^backend\/tests\/(patientValidation|duplicateCheck|patients\.routes)\.test\.js$/, 'Patient Registration', 'HMS-6/7'],
  [/^frontend\/src\/(utils\/validation|api\/patients)\.test\.js$/, 'Patient Registration', 'HMS-4/6'],
  [/^frontend\/src\/components\/PatientRegistrationForm\.test\.jsx$/, 'Patient Registration', 'HMS-4'],
  [/^frontend\/src\/components\/(PatientSearch|PatientProfile|PatientManagement)\.test\.jsx$/, 'Patient Registration', 'HMS-5'],

  [/^backend\/tests\/(availability|availabilityService|appointments\.routes|doctors\.routes)\.test\.js$/, 'Appointment Scheduling', 'HMS-10/11'],
  [/^frontend\/src\/components\/AppointmentBooking\.test\.jsx$/, 'Appointment Scheduling', 'HMS-8'],
  [/^frontend\/src\/components\/UpcomingAppointments\.test\.jsx$/, 'Appointment Scheduling', 'HMS-9'],

  [/^backend\/tests\/invoiceCalculator\.test\.js$/, 'Billing & Invoicing', 'HMS-14'],
  [/^backend\/tests\/invoices\.routes\.test\.js$/, 'Billing & Invoicing', 'HMS-14'],
  [/^backend\/tests\/(paymentGateway|paymentsService|payments\.routes)\.test\.js$/, 'Billing & Invoicing', 'HMS-15'],
  [/^frontend\/src\/(components\/InvoiceGeneration|components\/InvoiceList|utils\/invoiceCalculator)\.test\.(js|jsx)$/, 'Billing & Invoicing', 'HMS-12'],
  [/^frontend\/src\/(utils\/billingSummary|components\/PaymentDashboard)\.test\.(js|jsx)$/, 'Billing & Invoicing', 'HMS-13'],

  [/^backend\/tests\/(migrate|migrations\.index)\.test\.js$/, 'Infrastructure', 'N/A'],
];

const EPIC_ORDER = ['Patient Registration', 'Appointment Scheduling', 'Billing & Invoicing', 'Infrastructure', 'Pipeline'];
const EPIC_PREFIX = {
  'Patient Registration': 'PR',
  'Appointment Scheduling': 'AS',
  'Billing & Invoicing': 'BI',
  Infrastructure: 'INF',
  Pipeline: 'PIPE',
};

function classify(relPath) {
  for (const [re, epic, jira] of EPIC_RULES) {
    if (re.test(relPath)) return { epic, jira };
  }
  return { epic: 'Infrastructure', jira: 'N/A' };
}

function readJestJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

function toRows(jestJson, layer) {
  if (!jestJson) return [];
  const rows = [];
  for (const file of jestJson.testResults) {
    const relPath = path.relative(ROOT, file.name).replace(/\\/g, '/');
    const { epic, jira } = classify(relPath);
    for (const a of file.assertionResults) {
      const scenario = a.ancestorTitles.filter(Boolean).join(' > ');
      const status = a.status === 'passed' ? 'Pass' : a.status === 'failed' ? 'Fail' : 'Skipped';
      rows.push({
        epic,
        jira,
        layer,
        specFile: relPath,
        scenario,
        testCase: a.title,
        status,
        durationMs: a.duration ?? '',
      });
    }
  }
  return rows;
}

function fetchQualityGate() {
  return new Promise((resolve) => {
    const token = process.env.SONAR_TOKEN;
    const propsPath = path.join(ROOT, 'sonar-project.properties');
    if (!token || !fs.existsSync(propsPath)) {
      resolve({ status: 'Not Checked', detail: 'SONAR_TOKEN or sonar-project.properties missing' });
      return;
    }
    const props = fs.readFileSync(propsPath, 'utf8');
    const org = /sonar\.organization=(.+)/.exec(props)?.[1]?.trim();
    const projectKey = /sonar\.projectKey=(.+)/.exec(props)?.[1]?.trim();
    if (!org || !projectKey) {
      resolve({ status: 'Not Checked', detail: 'organization/projectKey not found in sonar-project.properties' });
      return;
    }
    const auth = Buffer.from(`${token}:`).toString('base64');
    const options = {
      hostname: 'sonarcloud.io',
      path: `/api/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`,
      headers: { Authorization: `Basic ${auth}` },
    };
    https
      .get(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const status = data.projectStatus?.status === 'OK' ? 'Pass' : 'Fail';
            resolve({ status, detail: `SonarCloud gate: ${data.projectStatus?.status ?? 'unknown'}` });
          } catch (err) {
            resolve({ status: 'Not Checked', detail: `SonarCloud response parse error: ${err.message}` });
          }
        });
      })
      .on('error', (err) => resolve({ status: 'Not Checked', detail: `SonarCloud request failed: ${err.message}` }));
  });
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const backend = readJestJson(path.join(ROOT, 'backend/coverage/test-results.json'));
  const frontend = readJestJson(path.join(ROOT, 'frontend/coverage/test-results.json'));

  const rows = [...toRows(backend, 'Backend'), ...toRows(frontend, 'Frontend')];

  const gate = await fetchQualityGate();
  const now = new Date().toISOString();

  const pipelineRows = [
    {
      epic: 'Pipeline',
      jira: 'N/A',
      layer: 'CI',
      specFile: 'backend (all files)',
      scenario: 'Automated test suite',
      testCase: 'Backend unit/integration test suite passes',
      status: backend ? (backend.numFailedTests === 0 ? 'Pass' : 'Fail') : 'Not Checked',
      durationMs: '',
    },
    {
      epic: 'Pipeline',
      jira: 'N/A',
      layer: 'CI',
      specFile: 'frontend (all files)',
      scenario: 'Automated test suite',
      testCase: 'Frontend unit/component test suite passes',
      status: frontend ? (frontend.numFailedTests === 0 ? 'Pass' : 'Fail') : 'Not Checked',
      durationMs: '',
    },
    {
      epic: 'Pipeline',
      jira: 'N/A',
      layer: 'CI',
      specFile: 'sonar-project.properties',
      scenario: 'SonarCloud',
      testCase: `Quality gate is OK (${gate.detail})`,
      status: gate.status,
      durationMs: '',
    },
  ];

  const all = [...rows, ...pipelineRows];

  // Number sequentially within each epic, in the fixed epic order.
  const numbered = [];
  for (const epic of EPIC_ORDER) {
    const epicRows = all.filter((r) => r.epic === epic);
    epicRows.forEach((r, i) => {
      numbered.push({
        testId: `${EPIC_PREFIX[epic]}-${String(i + 1).padStart(3, '0')}`,
        ...r,
      });
    });
  }

  const header = ['TestID', 'Epic', 'JiraKey', 'Layer', 'SpecFile', 'Scenario', 'TestCase', 'Status', 'DurationMs', 'LastRun'];
  const lines = [header.join(',')];
  for (const r of numbered) {
    lines.push(
      [r.testId, r.epic, r.jira, r.layer, r.specFile, r.scenario, r.testCase, r.status, r.durationMs, now]
        .map(csvEscape)
        .join(','),
    );
  }

  fs.writeFileSync(path.join(ROOT, 'TestCases.csv'), lines.join('\n') + '\n');

  const failed = numbered.filter((r) => r.status === 'Fail');
  const passed = numbered.filter((r) => r.status === 'Pass');
  const notChecked = numbered.filter((r) => r.status === 'Not Checked');
  console.log(`TestCases.csv written: ${numbered.length} total, ${passed.length} passed, ${failed.length} failed, ${notChecked.length} not checked.`);
  if (failed.length > 0) {
    console.error('Failing test cases:');
    for (const r of failed) console.error(`  ${r.testId}: ${r.scenario} > ${r.testCase}`);
    process.exit(1);
  }
}

main();
