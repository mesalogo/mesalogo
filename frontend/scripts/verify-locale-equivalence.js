/* eslint-disable */
/**
 * Validates that the newly-split per-namespace locale files, when merged via
 * locales/<lang>/index.ts, produce a flat object that is IDENTICAL to the
 * legacy single-file default export (`zh-CN.ts` / `en-US.ts`).
 *
 *   node scripts/verify-locale-equivalence.js
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'locales');

function tsToCjs(file) {
  // Compile a single TS file (and its imports) into a temp dir via tsc, then require.
  // We use --module commonjs --outDir to ensure require() works on the output.
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'verify-locale-'));
  execSync(
    `npx --no-install tsc --module commonjs --moduleResolution node --target es2019 \
     --esModuleInterop --skipLibCheck --resolveJsonModule \
     --outDir "${tmp}" --rootDir "${SRC}" \
     "${file}"`,
    { stdio: 'inherit' }
  );
  const rel = path.relative(SRC, file).replace(/\.ts$/, '.js');
  const out = path.join(tmp, rel);
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const mod = require(out);
  return mod.default || mod;
}

function flattenKeys(obj, prefix = '') {
  const out = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}::${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [kk, vv] of flattenKeys(v, full)) out.set(kk, vv);
    } else {
      out.set(full, v);
    }
  }
  return out;
}

function compare(lang) {
  const legacy = tsToCjs(path.join(SRC, `${lang}.ts`));
  const fresh = tsToCjs(path.join(SRC, lang, 'index.ts'));
  const a = flattenKeys(legacy);
  const b = flattenKeys(fresh);

  const onlyA = [...a.keys()].filter(k => !b.has(k));
  const onlyB = [...b.keys()].filter(k => !a.has(k));
  const valDiff = [];
  for (const [k, v] of a) {
    if (b.has(k) && b.get(k) !== v) {
      valDiff.push({ k, legacy: v, fresh: b.get(k) });
    }
  }

  console.log(`\n[${lang}] legacy total = ${a.size}, fresh total = ${b.size}`);
  console.log(`  only in legacy: ${onlyA.length}`);
  if (onlyA.length) console.log('   ', onlyA.slice(0, 20));
  console.log(`  only in fresh : ${onlyB.length}`);
  if (onlyB.length) console.log('   ', onlyB.slice(0, 20));
  console.log(`  value mismatches: ${valDiff.length}`);
  if (valDiff.length) console.log('   ', valDiff.slice(0, 10));

  return onlyA.length === 0 && onlyB.length === 0 && valDiff.length === 0;
}

const ok1 = compare('en-US');
const ok2 = compare('zh-CN');
process.exit(ok1 && ok2 ? 0 : 1);
