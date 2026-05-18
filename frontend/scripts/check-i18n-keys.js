/* eslint-disable */
/**
 * check-i18n-keys.js
 *
 * Compares zh-CN and en-US locale namespaces and reports any key drift.
 *
 * Run from the frontend/ directory:
 *   node scripts/check-i18n-keys.js
 *
 * Exits with code 1 if any keys differ between the two languages, so that CI
 * fails the build. Intended to prevent the kind of slow drift that produced
 * the original 3000-line monolith with mismatched section ordering.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'locales');

function loadLang(lang) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-check-'));
  execSync(
    `npx --no-install tsc --module commonjs --moduleResolution node \
     --target es2019 --esModuleInterop --skipLibCheck --resolveJsonModule \
     --outDir "${tmp}" --rootDir "${SRC}" \
     "${path.join(SRC, lang, 'index.ts')}"`,
    { stdio: 'inherit' }
  );
  const mod = require(path.join(tmp, lang, 'index.js'));
  return { merged: mod.default, namespaces: mod.namespaces };
}

function flatten(obj, prefix = '') {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}::${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const kk of flatten(v, full)) out.add(kk);
    } else {
      out.add(full);
    }
  }
  return out;
}

const zh = loadLang('zh-CN');
const en = loadLang('en-US');

let hasDrift = false;

console.log('\n=== Per-namespace key counts ===');
console.log('namespace          en-US   zh-CN  diff');
const nsSet = new Set([...Object.keys(zh.namespaces), ...Object.keys(en.namespaces)]);
for (const ns of [...nsSet].sort()) {
  const e = en.namespaces[ns] ? flatten(en.namespaces[ns]).size : 0;
  const z = zh.namespaces[ns] ? flatten(zh.namespaces[ns]).size : 0;
  const diff = z - e;
  console.log(`${ns.padEnd(18)} ${String(e).padStart(5)}  ${String(z).padStart(5)}  ${diff === 0 ? '   ok' : (diff > 0 ? `+${diff}` : `${diff}`)}`);

  // Per-namespace key diff
  if (en.namespaces[ns] && zh.namespaces[ns]) {
    const ek = flatten(en.namespaces[ns]);
    const zk = flatten(zh.namespaces[ns]);
    const onlyE = [...ek].filter(k => !zk.has(k));
    const onlyZ = [...zk].filter(k => !ek.has(k));
    if (onlyE.length || onlyZ.length) {
      hasDrift = true;
      if (onlyE.length) console.log(`   only in en-US/${ns}: ${onlyE.slice(0, 10).join(', ')}${onlyE.length > 10 ? ` … (+${onlyE.length - 10} more)` : ''}`);
      if (onlyZ.length) console.log(`   only in zh-CN/${ns}: ${onlyZ.slice(0, 10).join(', ')}${onlyZ.length > 10 ? ` … (+${onlyZ.length - 10} more)` : ''}`);
    }
  }
}

console.log('\n=== Flat (merged) totals ===');
const ekFlat = flatten(en.merged);
const zkFlat = flatten(zh.merged);
console.log(`en-US total: ${ekFlat.size}`);
console.log(`zh-CN total: ${zkFlat.size}`);
const onlyE = [...ekFlat].filter(k => !zkFlat.has(k));
const onlyZ = [...zkFlat].filter(k => !ekFlat.has(k));
if (onlyE.length) {
  hasDrift = true;
  console.log(`only in en-US: ${onlyE.length}`);
  console.log('   ', onlyE.slice(0, 20));
}
if (onlyZ.length) {
  hasDrift = true;
  console.log(`only in zh-CN: ${onlyZ.length}`);
  console.log('   ', onlyZ.slice(0, 20));
}

if (hasDrift) {
  console.error('\n❌ i18n key drift detected. Please align the two language trees before committing.');
  process.exit(1);
} else {
  console.log('\n✅ zh-CN and en-US are key-consistent.');
}
