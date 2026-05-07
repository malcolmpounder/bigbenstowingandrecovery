/* HTML validation — runs html-validate against every HTML file in /site/.
   Uses .htmlvalidate.json at the project root for rule config.
   Prints a summary by severity. Exit 0 if no errors, 1 if errors. */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

const files = [];
walk(SITE, files);

// Use paths relative to cwd so spaces in the project directory don't break
// shell argument parsing (we run with shell:true so the npm .cmd shim works).
const relFiles = files.map(f => path.relative(ROOT, f).replace(/\\/g, '/'));

console.log('Validating ' + relFiles.length + ' HTML files…');

// Run in chunks to keep stdout buffer below the cap. html-validate exits
// non-zero when issues are found and writes the JSON report to stdout.
function runChunk(chunk) {
  let stdout = '';
  try {
    stdout = execFileSync(
      'html-validate',
      ['--formatter=json', ...chunk],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        shell: true       // Windows: use shell so the npm .cmd shim is found
      }
    );
  } catch (e) {
    if (e.stdout) stdout = typeof e.stdout === 'string' ? e.stdout : e.stdout.toString('utf8');
  }
  stdout = (stdout || '').trim();
  if (!stdout) return [];
  // html-validate prints `null` (no problems) sometimes
  if (stdout === 'null') return [];
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse chunk output (' + chunk.length + ' files): ' + e.message);
    console.error('First 200 chars: ' + stdout.slice(0, 200));
    return [];
  }
}

const CHUNK = 12;
let report = [];
for (let i = 0; i < relFiles.length; i += CHUNK) {
  const chunk = relFiles.slice(i, i + CHUNK);
  report = report.concat(runChunk(chunk));
}

let errors = 0;
let warnings = 0;
const byRule = new Map();

report.forEach(file => {
  (file.messages || []).forEach(m => {
    if (m.severity === 2) errors++;
    else if (m.severity === 1) warnings++;
    const key = (m.severity === 2 ? 'E ' : 'W ') + (m.ruleId || '?');
    byRule.set(key, (byRule.get(key) || 0) + 1);
  });
});

console.log('\nSummary');
console.log('-------');
console.log('Errors:   ' + errors);
console.log('Warnings: ' + warnings);
if (byRule.size) {
  console.log('\nBreakdown:');
  Array.from(byRule.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([rule, count]) => console.log('  ' + count.toString().padStart(4) + '  ' + rule));
}

if (errors > 0) {
  console.log('\nFirst 10 errors:');
  let shown = 0;
  for (const file of report) {
    for (const m of (file.messages || [])) {
      if (m.severity !== 2) continue;
      if (shown >= 10) break;
      const rel = path.relative(ROOT, file.filePath);
      console.log('  ' + rel + ':' + m.line + ':' + m.column + '  [' + m.ruleId + ']  ' + (m.message || '').slice(0, 100));
      shown++;
    }
    if (shown >= 10) break;
  }
}

process.exit(errors > 0 ? 1 : 0);
