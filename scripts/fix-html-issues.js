/* Idempotent fixes for the issues html-validate flags:
   - tel-non-breaking: replace "07754 984 147" with the &nbsp; version
   - no-raw-characters: escape "Tyne & Wear" / "Towing & Recovery" inside text content
   - no-implicit-button-type: add type="button" where missing
*/
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', 'site');

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
let fixesApplied = { tel: 0, ampersand: 0, buttonType: 0 };

files.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  // 1) Phone number — replace literal "07754 984 147" everywhere it appears
  //    as visible text. Skip the href= occurrences (which use +447754984147).
  const telBefore = (html.match(/07754 984 147/g) || []).length;
  html = html.replace(/07754 984 147/g, '07754&nbsp;984&nbsp;147');
  fixesApplied.tel += telBefore;

  // 2) Raw "&" in body text — common offender is "Tyne & Wear" in area pages.
  //    Use a targeted replace so we don't touch &amp; / &nbsp; / etc.
  //    The Service-page schema JSON-LD intentionally contains "Big Ben's Towing & Recovery"
  //    inside <script> tags; HTML rules don't apply inside <script>, so we
  //    must only touch outside-of-script text. Simplest: skip lines inside
  //    <script>…</script> blocks.
  html = html.replace(
    /(<script[\s\S]*?<\/script>)|([^<>]+)/g,
    function (match, scriptBlock, textRun) {
      if (scriptBlock) return scriptBlock; // leave untouched
      if (!textRun) return match;
      // Replace & only when it's clearly a literal (not the start of an entity)
      const replaced = textRun.replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;');
      if (replaced !== textRun) fixesApplied.ampersand += (textRun.match(/&(?!#?[a-zA-Z0-9]+;)/g) || []).length;
      return replaced;
    }
  );

  // 3) Add type="button" to <button> tags missing one and not part of a form's
  //    submit-button role. Heuristic: if the button's parent context isn't a
  //    submit, default to type="button". Buttons that DO submit forms have
  //    type="submit" in our codebase already, so anything missing is a button.
  html = html.replace(/<button(\s[^>]*)?>/g, function (full, attrs) {
    if (attrs && /\stype\s*=/.test(attrs)) return full;
    fixesApplied.buttonType++;
    const newAttrs = (attrs || '') + ' type="button"';
    return '<button' + newAttrs + '>';
  });

  if (html !== original) {
    fs.writeFileSync(file, html);
    touched++;
  }
});

console.log('HTML issue fixes:');
console.log('  Files touched:           ' + touched);
console.log('  tel-non-breaking fixes:  ' + fixesApplied.tel);
console.log('  raw-ampersand fixes:     ' + fixesApplied.ampersand);
console.log('  button[type] fixes:      ' + fixesApplied.buttonType);
