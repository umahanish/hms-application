// Rewrites SF: paths in an lcov report to be relative to the repo root, so
// SonarCloud can resolve files outside the reporting package's own directory
// (e.g. shared/ imported from backend/ or frontend/ coverage runs).
const fs = require('fs');
const path = require('path').posix;

const [, , filePath, prefix] = process.argv;
if (!filePath || !prefix) {
  console.error('Usage: node normalize-lcov.js <lcov-file> <prefix>');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const rewritten = content.replace(/^SF:(.*)$/gm, (_, sf) => {
  const normalized = path.normalize(path.join(prefix, sf.replace(/\\/g, '/')));
  return `SF:${normalized}`;
});
fs.writeFileSync(filePath, rewritten);
