/* =========================================================
   Pre-deploy build orchestrator.
   Runs all the codegen scripts in the correct order, then validates.
   Usage:
     node scripts/build.js          # full run
     node scripts/build.js --quick  # skip validation (faster local rebuilds)

   Order matters: schema scripts can be re-run idempotently, but the
   sitemap should run last because it picks up file mtimes.
   ========================================================= */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');

const STEPS = [
  // === Codegen — order matters ===
  { name: 'Image dimensions',           script: 'add-image-dimensions.js' },
  { name: 'WebP <picture> wrappers',    script: 'add-webp-variants.js'    },
  { name: 'Canonical URLs',             script: 'add-canonical-urls.js'   },
  { name: 'PWA tags + favicons',        script: 'add-pwa-tags.js'         },
  { name: 'Open Graph + Twitter cards', script: 'add-og-tags.js'          },
  { name: 'Area-page rich schema',      script: 'enrich-area-schema.js'   },
  { name: 'Area-page landmarks',        script: 'inject-area-landmarks.js'},
  { name: 'BreadcrumbList schema',      script: 'add-breadcrumb-schema.js'},
  { name: 'HTML issue auto-fixes',      script: 'fix-html-issues.js'      },
  { name: 'AggregateRating injection',  script: 'inject-aggregate-rating.js' },
  { name: 'Inline critical CSS',        script: 'inline-critical-css.js'  },

  // === Sitemap — must run last so it picks up the latest file mtimes ===
  { name: 'Sitemap',                    script: 'build-sitemap.js'        }
];

const VALIDATION = [
  { name: 'Internal link checker', script: 'check-links.js'    },
  { name: 'HTML validation',       script: 'validate-html.js'  }
];

function run(step) {
  process.stdout.write('▸ ' + step.name + '… ');
  const start = Date.now();
  try {
    execFileSync('node', [path.join('scripts', step.script)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8'
    });
    console.log('ok (' + (Date.now() - start) + 'ms)');
    return true;
  } catch (e) {
    console.log('FAILED');
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(e.stderr);
    return false;
  }
}

console.log('\nBig Ben\'s Towing — pre-deploy build');
console.log('='.repeat(40));

for (const step of STEPS) {
  if (!run(step)) {
    console.log('\nBuild aborted on: ' + step.name);
    process.exit(1);
  }
}

if (QUICK) {
  console.log('\n--quick: skipping validation. Run `node scripts/build.js` for the full pre-deploy check.\n');
  process.exit(0);
}

console.log('\nValidation');
console.log('-'.repeat(40));

let validationFailed = false;
for (const step of VALIDATION) {
  if (!run(step)) validationFailed = true;
}

if (validationFailed) {
  console.log('\nBuild succeeded but validation found issues — review above.\n');
  process.exit(1);
}

console.log('\n✓ Build clean. Ready to deploy.\n');
