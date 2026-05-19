/**
 * build.js
 * Run before deploying: node build.js
 *
 * What it does:
 * 1. Builds Tailwind CSS
 * 2. Injects a cache-busting ?v=TIMESTAMP into all JS script tags in HTML files
 * 3. Runs wrangler pages deploy
 *
 * Usage:
 *   node build.js          — build + deploy
 *   node build.js --dry    — build only, no deploy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DRY_RUN = process.argv.includes('--dry');
const VERSION = Date.now();

// JS files to version (add any new ones here)
const VERSIONED_FILES = [
  'state.js',
  'helpers.js',
  'ui.js',
  'auth.js',
  'api.js',
  'trips.js',
  'activities.js',
  'share.js',
  'members.js',
  'export.js',
  'init.js'
];

console.log(`\n🔨 CloudTrips build — v${VERSION}\n`);

// Step 1: Tailwind CSS build
console.log('📦 Building Tailwind CSS...');
try {
  execSync('npx tailwindcss -i src/input.css -o public/output.css --minify', {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ Tailwind done\n');
} catch (err) {
  console.error('❌ Tailwind build failed:', err.message);
  process.exit(1);
}

// Step 2: Inject version into HTML files
console.log('🔖 Injecting cache-busting versions into HTML...');

const htmlFiles = fs.readdirSync(PUBLIC_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(PUBLIC_DIR, f));

let updatedCount = 0;

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const jsFile of VERSIONED_FILES) {
    // Match src="/file.js" or src="/file.js?v=anything"
    const pattern = new RegExp(`(src="/${jsFile.replace('.', '\\.')})(\\?v=[^"]*)?(")`,'g');
    const replacement = `$1?v=${VERSION}$3`;
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  ✓ ${path.basename(file)}`);
    updatedCount++;
  }
}

console.log(`✅ Updated ${updatedCount} HTML files\n`);

// Step 3: Deploy
if (DRY_RUN) {
  console.log('🟡 Dry run — skipping deploy\n');
  console.log(`   To deploy manually: npx wrangler pages deploy public\n`);
} else {
  console.log('🚀 Deploying to Cloudflare Pages...');
  try {
    execSync('npx wrangler pages deploy public', {
      stdio: 'inherit',
      cwd: __dirname
    });
    console.log('\n✅ Deploy complete\n');
  } catch (err) {
    console.error('❌ Deploy failed:', err.message);
    process.exit(1);
  }
}
