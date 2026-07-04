/* eslint-disable */
/**
 * scan-hardcoded-cjk.js
 *
 * AST-based scanner for hard-coded CJK (Chinese) text that bypasses i18n.
 *
 * Why AST instead of regex: a line-based regex scanner cannot distinguish
 * `t('foo')` fallback text, trailing code comments, comparison operands
 * (`error.message.includes('网络')`), and `console.*`/`logger.*` debug
 * calls from strings the END USER actually sees. Those false positives
 * previously inflated the debt count ~15x (720 "violations" vs. ~46 real
 * ones) and made the report useless as a CI gate. This scanner parses each
 * file with the TypeScript compiler and only flags:
 *   - JSX text nodes containing CJK
 *   - JSX attribute string/template literals containing CJK
 *   - String/template literal call arguments containing CJK, EXCLUDING:
 *       - console.* / logger.* / *.log(...) calls (developer-only output)
 *       - comparison methods: .includes/.indexOf/.startsWith/.endsWith/
 *         .replace/.replaceAll/.split/.match/.search/.lastIndexOf
 *         (these compare against or transform backend-owned strings, they
 *         don't render translated UI text)
 *   - Object property values (display strings assigned to a key) and
 *     plain variable/return assignments containing CJK
 *   Equality/inequality comparisons (`x === '中文'`) are always excluded.
 *
 * Known-safe exceptions (backend lookup keys, native language names, test
 * fixtures) are listed in scripts/i18n-allowlist.json with a category and
 * justification — see that file before adding new entries.
 *
 * Run:
 *   node scripts/scan-hardcoded-cjk.js            # human-readable report
 *   node scripts/scan-hardcoded-cjk.js --check     # CI gate, exits 1 on any violation
 *   node scripts/scan-hardcoded-cjk.js --md > docs/agents/i18n-hardcoded-cjk-report.md
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const CJK = /[\u4e00-\u9fff]/;

const ALLOWLIST_PATH = path.join(__dirname, 'i18n-allowlist.json');
const allowlistRaw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const ALLOWED_TEXT = new Set(
  Object.entries(allowlistRaw)
    .filter(([k]) => !k.startsWith('_'))
    .flatMap(([, arr]) => arr)
);

const COMPARISON_METHODS = new Set([
  'includes', 'indexOf', 'lastIndexOf', 'startsWith', 'endsWith',
  'replace', 'replaceAll', 'split', 'match', 'search'
]);
const LOG_CALLEE = /^(console|logger|log)\.|(^|\.)(debug|trace)$/;

const mode = process.argv.includes('--check') ? 'check'
  : process.argv.includes('--md') ? 'md'
  : 'human';

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/(^|\/)(locales|__tests__|node_modules|build|dist)(\/|$)/.test(p)) continue;
      yield* walk(p);
    } else if (/\.(tsx|jsx|ts|js)$/.test(e.name)) {
      yield p;
    }
  }
}

function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return `${e.expression.getText()}.${e.name.text}`;
  return '<computed>';
}

function literalHasCjk(node) {
  if (ts.isTemplateExpression(node)) {
    return CJK.test(node.head.text) || node.templateSpans.some(s => CJK.test(s.literal.text));
  }
  return CJK.test(node.text || '');
}

function isEqualityComparison(node) {
  const p = node.parent;
  if (!p || !ts.isBinaryExpression(p)) return false;
  const eq = [
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken
  ];
  return eq.includes(p.operatorToken.kind);
}

/** @returns {{file:string,line:number,category:string,text:string}[]} */
function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (!CJK.test(src)) return [];
  const rel = path.relative(SRC, file);
  const sf = ts.createSourceFile(
    file, src, ts.ScriptTarget.Latest, true,
    /tsx?$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const lineOf = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const findings = [];

  // `checkValue` is the parsed literal value (no quotes) so it can be
  // matched against the allowlist; `displayText` is the raw source slice
  // shown in reports (keeps quotes/template syntax for readability).
  function record(node, category, checkValue, displayText) {
    if (ALLOWED_TEXT.has(checkValue.trim())) return;
    findings.push({ file: rel, line: lineOf(node), category, text: displayText.trim().slice(0, 100) });
  }

  function visit(node) {
    if (ts.isJsxText(node) && CJK.test(node.text)) {
      record(node, 'jsxText', node.text, node.text);
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      if (literalHasCjk(node) && !isEqualityComparison(node)) {
        const p = node.parent;
        const rawText = node.getText(sf);
        // For plain string literals, `.text` is the decoded value (no
        // quotes/escapes) — that's what the allowlist entries are written
        // against. Template expressions have no single decoded value, so
        // fall back to the raw source for the allowlist check too.
        const checkValue = (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : rawText;
        if (p && ts.isCallExpression(p)) {
          const name = calleeName(p);
          const method = name.split('.').pop();
          if (!LOG_CALLEE.test(name) && !COMPARISON_METHODS.has(method)) {
            record(node, 'callArg', checkValue, rawText);
          }
        } else if (p && ts.isJsxAttribute(p)) {
          record(node, 'jsxAttr', checkValue, rawText);
        } else if (p && ts.isJsxExpression(p)) {
          record(node, 'jsxExpr', checkValue, rawText);
        } else if (p && ts.isPropertyAssignment(p)) {
          record(node, 'objProp', checkValue, rawText);
        } else if (p && (ts.isVariableDeclaration(p) || ts.isReturnStatement(p) || ts.isBinaryExpression(p))) {
          record(node, 'assign', checkValue, rawText);
        }
        // Function default-parameter values, array elements, etc. fall
        // through unflagged deliberately: they are not proven user-visible
        // and produced noise in practice (e.g. mock/test default args).
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return findings;
}

const allFindings = [];
for (const file of walk(SRC)) {
  allFindings.push(...scanFile(file));
}

const perFile = new Map();
for (const f of allFindings) {
  if (!perFile.has(f.file)) perFile.set(f.file, []);
  perFile.get(f.file).push(f);
}
const files = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length);

if (mode === 'check') {
  if (allFindings.length === 0) {
    console.log('✅ No hard-coded user-visible CJK found.');
    process.exit(0);
  }
  console.error(`❌ Found ${allFindings.length} hard-coded CJK string(s) in ${files.length} file(s):\n`);
  for (const [file, items] of files) {
    console.error(`  ${file}`);
    for (const it of items) console.error(`    L${it.line} [${it.category}] ${it.text}`);
  }
  console.error('\nRoute these through useTranslation()/t(...), or add a justified exception to scripts/i18n-allowlist.json.');
  process.exit(1);
} else if (mode === 'md') {
  console.log('# Hard-coded CJK report (auto-generated, AST-based)\n');
  console.log('> Generated by `frontend/scripts/scan-hardcoded-cjk.js`. Only counts strings visible to end users (JSX text/attrs, non-comparison call args, object properties, assignments). Comments, `console.*`, and comparison operands are excluded by construction.\n');
  console.log(`- Files with hard-coded CJK: **${files.length}**`);
  console.log(`- Total violations: **${allFindings.length}**\n`);
  console.log('## Files\n');
  console.log('| File | Count |');
  console.log('|---|---:|');
  for (const [file, items] of files) console.log(`| \`${file}\` | ${items.length} |`);
  console.log('\n## Details\n');
  for (const [file, items] of files) {
    console.log(`### \`${file}\`\n`);
    for (const it of items) console.log(`- L${it.line} [${it.category}] \`${it.text.replace(/`/g, '\\`')}\``);
    console.log('');
  }
} else {
  console.log(`Files with hard-coded CJK: ${files.length}`);
  console.log(`Total violations         : ${allFindings.length}\n`);
  for (const [file, items] of files) {
    console.log(`${file} (${items.length})`);
    for (const it of items) console.log(`  L${it.line} [${it.category}] ${it.text}`);
  }
  if (allFindings.length === 0) console.log('✅ No hard-coded user-visible CJK found.');
}
