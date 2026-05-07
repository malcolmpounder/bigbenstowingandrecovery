// Inline /css/critical.css into every HTML's <head> as a <style> block.
// Idempotent — replaces the previous block on re-runs (matched via marker).
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');
const CRITICAL_PATH = path.join(SITE, 'css', 'critical.css');
const critical = fs.readFileSync(CRITICAL_PATH, 'utf8');

// Trim long whitespace runs to keep inlined size small
const minified = critical
  .replace(/\/\*[\s\S]*?\*\//g, '')      // strip CSS comments
  .replace(/\s*\n\s*/g, '\n')           // collapse leading/trailing-line whitespace
  .replace(/^\s+|\s+$/g, '')             // trim
  .trim();

const MARKER = 'data-bb-critical="1"';
const tag = '<style ' + MARKER + '>\n' + minified + '\n</style>';

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else if (d.isFile() && d.name.endsWith('.html')) out.push(full);
  });
}

const files = [];
walk(SITE, files);

let touched = 0;
const re = /<style data-bb-critical="1">[\s\S]*?<\/style>\n?/;

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  // Strip any prior critical block first (idempotent)
  html = html.replace(re, '');

  // Insert just BEFORE the main stylesheet link so the browser parses
  // the inline rules first, then replaces them as the external file loads.
  const styleLinkRe = /<link\s+rel="stylesheet"\s+href="(?:\.\.\/)?css\/style\.css"\s*\/?>/;
  if (styleLinkRe.test(html)) {
    html = html.replace(styleLinkRe, tag + '\n$&');
    fs.writeFileSync(file, html);
    touched++;
  }
});

console.log('Critical CSS inlined into ' + touched + ' files (size: ' + minified.length + ' bytes minified)');
