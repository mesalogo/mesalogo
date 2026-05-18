/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * split-locales.js
 *
 * One-off (idempotent) script that converts the monolithic
 *   frontend/src/locales/zh-CN.ts   (~3000 lines)
 *   frontend/src/locales/en-US.ts   (~3000 lines)
 * into per-namespace files:
 *   frontend/src/locales/zh-CN/<ns>.ts
 *   frontend/src/locales/en-US/<ns>.ts
 *   frontend/src/locales/zh-CN/index.ts   (merged default export, BACK-COMPAT)
 *   frontend/src/locales/en-US/index.ts   (merged default export, BACK-COMPAT)
 *
 * The split is driven by the EN file's `// ===== SECTION =====` comment
 * markers (because the zh file is internally misaligned starting from
 * section #42 — see git history). For each English section we record which
 * top-level keys it owns, then we pull THE SAME keys out of zh-CN by key
 * name (not by zh's own comments). This guarantees zh / en stay in sync.
 *
 * Run from the frontend/ directory:
 *   node scripts/split-locales.js
 *
 * The script is idempotent: running it again on already-split files is a
 * no-op (it requires the legacy single-file pair to exist).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOC = path.join(ROOT, 'src', 'locales');
const EN_FILE = path.join(LOC, 'en-US.ts');
const ZH_FILE = path.join(LOC, 'zh-CN.ts');

// -----------------------------------------------------------------------------
// 1. Map EN section title → short namespace slug
// -----------------------------------------------------------------------------
// Keep the slug short and ASCII so it's grep-friendly and matches frontend
// page subdir names (agents / actionspace / parallellab / settings / ...).
const SECTION_TO_NS = {
  'COMMON ACTIONS':                                'common',
  'STATUS & STATES':                               'common',
  'NAVIGATION MENU':                               'navigation',
  'BUSINESS TERMS & CONCEPTS':                     'business',
  'SUB MENUS':                                     'navigation',
  'COMPONENT SPECIFIC TRANSLATIONS':               'common',
  'HOME COMPONENT TRANSLATIONS':                   'home',
  'SYSTEM SETTINGS PAGE TRANSLATIONS':             'settings',
  'ACTION TASK MANAGEMENT PAGE TRANSLATIONS':      'actiontask',
  'PARALLEL LAB PAGE TRANSLATIONS':                'parallellab',
  'ACTION SPACE PAGE TRANSLATIONS':                'actionspace',
  'HISTORY PAGE TRANSLATIONS':                     'history',
  'AGENTS MANAGEMENT PAGE TRANSLATIONS':           'agents',
  'ONE-CLICK GENERATION COMPONENT TRANSLATIONS':   'oneclick',
  'ACTION TASK DETAIL PAGE TRANSLATIONS':          'actiontask',
  'ACTION SPACE DETAIL PAGE TRANSLATIONS':         'actionspace',
  'ROLE MANAGEMENT PAGE TRANSLATIONS':             'roles',
  'WORKSPACE BROWSER PAGE TRANSLATIONS':           'workspace',
  'CAPABILITIES AND TOOLS MANAGEMENT PAGE TRANSLATIONS': 'roles',
  'WORKSPACE EDITOR TRANSLATIONS':                 'workspace',
  'KNOWLEDGE BASE MANAGEMENT PAGE TRANSLATIONS':   'knowledgebase',
  'MEMORY MANAGEMENT PAGE TRANSLATIONS':           'memory',
  'MODEL CONFIGURATION PAGE TRANSLATIONS':         'models',
  'DEFAULT MODEL MODAL TRANSLATIONS':              'models',
  'MODEL CONFIG PAGE: ADDITIONAL TRANSLATIONS':    'models',
  'MODEL CONFIGURATION FORM TRANSLATIONS':         'models',
  'MODEL LIST VIEW TRANSLATIONS':                  'models',
  'MODEL MODALITY TRANSLATIONS':                   'models',
  'MODEL CAPABILITY TRANSLATIONS':                 'models',
  'MODEL PROVIDER TRANSLATIONS':                   'models',
  'COMMON ADDITIONS':                              'common',
  'USER MANAGEMENT PAGE TRANSLATIONS':             'users',
  'User Role Management':                          'users',
  'MCP SERVERS MANAGEMENT PAGE TRANSLATIONS':      'mcp',
  'IM INTEGRATION PAGE TRANSLATIONS':              'im',
  'GRAPH ENHANCEMENT SETTINGS PAGE TRANSLATIONS':  'graph',
  'LOGS PAGE TRANSLATIONS':                        'logs',
  'ABOUT PAGE TRANSLATIONS':                       'about',
  'RULES CARD COMPONENT TRANSLATIONS':             'actionspace',
  'ENVIRONMENT VARIABLES CARD COMPONENT TRANSLATIONS': 'actionspace',
  'AUTONOMOUS ACTIONS CARD COMPONENT TRANSLATIONS': 'actiontask',
  'CONVERSATION MANAGEMENT TRANSLATIONS':          'actiontask',
  'SUPERVISOR CARD COMPONENT TRANSLATIONS':        'actiontask',
  'AGENT DETAIL COMPONENT TRANSLATIONS':           'agents',
  'APP TOOLS CARD COMPONENT TRANSLATIONS':         'actiontask',
  'Batch Upload Dialog':                           'common',
  'Background Jobs Center':                        'common',
  'One-Click Generation EditModal additions':      'oneclick',
  'ACTION TASK CARD TRANSLATIONS':                 'actiontask',
  'Monitor Tab':                                   'actiontask',
  'Common Additions':                              'common',
  'Document Conversion Status':                    'knowledgebase',
  'Task Publishing':                               'actiontask',
  'Password Change':                               'account',
  'Memory Graph':                                  'memory',
  'Global Error Handling':                         'common',
  'Knowledge Base Search Settings':                'knowledgebase',
  'Subscription Management':                       'account',
};

// All distinct namespaces (preserve a stable order: most-used first).
const NS_ORDER = [
  'common',
  'navigation',
  'business',
  'home',
  'agents',
  'roles',
  'workspace',
  'actionspace',
  'actiontask',
  'parallellab',
  'knowledgebase',
  'memory',
  'models',
  'settings',
  'mcp',
  'im',
  'graph',
  'logs',
  'about',
  'oneclick',
  'users',
  'account',
  'history',
];

// -----------------------------------------------------------------------------
// 2. Parse a monolithic locale file into { sections: [{name, body}], keyToSection }
// -----------------------------------------------------------------------------
function readSource(file) {
  return fs.readFileSync(file, 'utf8');
}

/**
 * Walk the object literal in a TS locale file character by character and
 * return an array of top-level entries with their EXACT source text
 * (preserving whitespace, comments, trailing commas).
 *
 * Each entry is { key, raw, startLine, endLine }.
 *
 * The file is expected to look like:
 *   // header comment(s)
 *   export default {
 *     // comment lines / blank lines
 *     key: 'value',
 *     'quoted.key': '...',
 *     nested: { ... },
 *     ...
 *   };
 */
function parseTopLevelEntries(src) {
  // Find "export default {" and the matching closing "}".
  const headerMatch = src.match(/export default\s*\{/);
  if (!headerMatch) throw new Error('export default { not found');
  const bodyStart = headerMatch.index + headerMatch[0].length;

  // Walk to find matching brace, respecting strings + comments.
  let depth = 1;
  let i = bodyStart;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '/' && next === '/') {
      // line comment
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  const bodyEnd = i; // src[bodyEnd] === '}'

  // Now we have the BODY (between the two braces). Walk it linearly and
  // collect top-level entries.
  const body = src.slice(bodyStart, bodyEnd);

  const entries = []; // array of { key, raw, leading, sectionTitle }
  let cur = { lead: '', sectionTitle: null }; // accumulating non-entry leading whitespace+comments
  let activeSection = null;

  let p = 0;
  while (p < body.length) {
    const ch = body[p];
    const next = body[p + 1];
    // Skip / collect leading whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      cur.lead += ch;
      p++;
      continue;
    }
    // Line comment
    if (ch === '/' && next === '/') {
      let end = body.indexOf('\n', p);
      if (end === -1) end = body.length;
      const commentText = body.slice(p, end);
      const m = commentText.match(/=====\s*(.+?)\s*=====/);
      if (m) activeSection = m[1].trim();
      cur.lead += commentText;
      p = end;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      const end = body.indexOf('*/', p);
      const stop = end === -1 ? body.length : end + 2;
      cur.lead += body.slice(p, stop);
      p = stop;
      continue;
    }

    // Otherwise: start of an entry. Parse the key.
    const entryStart = p;
    let key;
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let q = p + 1;
      while (q < body.length) {
        if (body[q] === '\\') { q += 2; continue; }
        if (body[q] === quote) break;
        q++;
      }
      key = body.slice(p + 1, q);
      p = q + 1;
    } else {
      let q = p;
      while (q < body.length && /[A-Za-z0-9_$]/.test(body[q])) q++;
      key = body.slice(p, q);
      p = q;
    }
    // Skip whitespace then ':'
    while (p < body.length && /\s/.test(body[p])) p++;
    if (body[p] !== ':') throw new Error('Expected ":" after key ' + key + ' at offset ' + p);
    p++; // consume ':'

    // Now consume the VALUE: scan until top-level (relative to this entry) comma or end.
    let vDepth = 0;
    const valStart = p;
    while (p < body.length) {
      const c = body[p];
      const n = body[p + 1];
      if (c === '/' && n === '/') {
        while (p < body.length && body[p] !== '\n') p++;
        continue;
      }
      if (c === '/' && n === '*') {
        p += 2;
        while (p < body.length && !(body[p] === '*' && body[p + 1] === '/')) p++;
        p += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        p++;
        while (p < body.length) {
          if (body[p] === '\\') { p += 2; continue; }
          if (body[p] === quote) { p++; break; }
          p++;
        }
        continue;
      }
      if (c === '{' || c === '[' || c === '(') vDepth++;
      else if (c === '}' || c === ']' || c === ')') vDepth--;
      if (vDepth === 0 && c === ',') {
        p++; // consume comma
        break;
      }
      if (vDepth < 0) {
        // shouldn't happen
        throw new Error('Mismatched closers at offset ' + p);
      }
      p++;
    }
    const rawEntry = body.slice(entryStart, p); // includes trailing comma if any
    entries.push({
      key,
      lead: cur.lead,
      raw: rawEntry,
      section: activeSection,
    });
    cur = { lead: '' };
  }

  return { entries, header: src.slice(0, bodyStart), footer: src.slice(bodyEnd) };
}

// -----------------------------------------------------------------------------
// 3. Emit per-namespace files
// -----------------------------------------------------------------------------
function emitNs(lang, nsBuckets, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const namesUsed = [];
  for (const ns of NS_ORDER) {
    const bucket = nsBuckets[ns];
    if (!bucket || bucket.length === 0) continue;
    namesUsed.push(ns);

    const lines = [
      `// Auto-generated by scripts/split-locales.js — DO NOT EDIT THE BOILERPLATE.`,
      `// Namespace: ${ns}`,
      `// Language: ${lang}`,
      `// Add new keys for this namespace below. Keep keys consistent across`,
      `// languages — run \`node scripts/check-i18n-keys.js\` before commit.`,
      `// eslint-disable-next-line import/no-anonymous-default-export`,
      `export default {`,
    ];
    // Group entries by their original section, separated by the section comment.
    let prevSection = null;
    for (const e of bucket) {
      if (e.section && e.section !== prevSection) {
        lines.push('');
        lines.push(`  // ----- ${e.section} -----`);
        prevSection = e.section;
      }
      // Keep the leading whitespace/comments from the original entry, trimmed.
      const leadComments = (e.lead || '')
        .split('\n')
        .map(l => l.trimEnd())
        .filter(l => l.trim().startsWith('//') && !l.includes('====='))
        .map(l => l.trim());
      for (const c of leadComments) lines.push('  ' + c);
      // The raw entry already includes the comma; re-indent to 2 spaces.
      lines.push('  ' + e.raw.trim());
    }
    lines.push('};', '');
    fs.writeFileSync(path.join(outDir, `${ns}.ts`), lines.join('\n'));
  }
  return namesUsed;
}

// -----------------------------------------------------------------------------
// 4. Emit per-language index.ts that re-exports the merged object (back-compat)
//    AND exposes the per-namespace map.
// -----------------------------------------------------------------------------
function emitLangIndex(lang, namesUsed, outDir) {
  const imports = namesUsed
    .map(n => `import ${camel(n)} from './${n}';`)
    .join('\n');
  const nsObject = namesUsed.map(n => `  ${n}: ${camel(n)},`).join('\n');
  const flatSpread = namesUsed.map(n => `  ...${camel(n)},`).join('\n');
  const src = `// Auto-generated by scripts/split-locales.js — DO NOT EDIT BY HAND.
// Aggregates all namespaces for the "${lang}" locale.
// - \`namespaces\` exposes each namespace separately (modern useTranslation('ns')).
// - Default export is the FLAT merged object, preserved for backwards
//   compatibility with the legacy single \`translation\` namespace.

${imports}

export const namespaces = {
${nsObject}
};

const merged = {
${flatSpread}
};

export default merged;
`;
  fs.writeFileSync(path.join(outDir, 'index.ts'), src);
}

function camel(slug) {
  return slug.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}

// -----------------------------------------------------------------------------
// 5. Main
// -----------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(EN_FILE) || !fs.existsSync(ZH_FILE)) {
    console.error('Monolithic locale files not found — already split? Aborting.');
    process.exit(0);
  }

  const enSrc = readSource(EN_FILE);
  const zhSrc = readSource(ZH_FILE);

  const en = parseTopLevelEntries(enSrc);
  const zh = parseTopLevelEntries(zhSrc);

  // Build EN: key -> namespace
  const keyToNs = new Map();
  let unknownSection = new Set();
  for (const e of en.entries) {
    const ns = SECTION_TO_NS[e.section] || 'common';
    if (!SECTION_TO_NS[e.section]) {
      unknownSection.add(e.section || '<no-section>');
    }
    keyToNs.set(e.key, ns);
  }
  if (unknownSection.size > 0) {
    console.warn('Unmapped sections (fell back to "common"):',
      [...unknownSection]);
  }

  // EN buckets, preserving original order within each ns.
  const enBuckets = {};
  for (const e of en.entries) {
    const ns = keyToNs.get(e.key) || 'common';
    (enBuckets[ns] ||= []).push(e);
  }

  // ZH buckets: use EN's key→ns mapping. For keys ONLY in zh, fall back to 'common'.
  const zhBuckets = {};
  for (const e of zh.entries) {
    const ns = keyToNs.get(e.key) || 'common';
    (zhBuckets[ns] ||= []).push(e);
  }

  // Emit per-ns files for both languages, preserving NS_ORDER first then any extras.
  const allNs = new Set([
    ...Object.keys(enBuckets),
    ...Object.keys(zhBuckets),
  ]);
  for (const ns of allNs) {
    if (!NS_ORDER.includes(ns)) NS_ORDER.push(ns);
  }

  const enDir = path.join(LOC, 'en-US');
  const zhDir = path.join(LOC, 'zh-CN');
  const enNames = emitNs('en-US', enBuckets, enDir);
  const zhNames = emitNs('zh-CN', zhBuckets, zhDir);

  // Index files
  const allNames = NS_ORDER.filter(n => enNames.includes(n) || zhNames.includes(n));
  emitLangIndex('en-US', allNames, enDir);
  emitLangIndex('zh-CN', allNames, zhDir);

  // Done. Print a summary.
  console.log('Split complete. Per-namespace key counts (en-US / zh-CN):');
  for (const ns of allNames) {
    const e = (enBuckets[ns] || []).length;
    const z = (zhBuckets[ns] || []).length;
    console.log(`  ${ns.padEnd(15)} ${String(e).padStart(4)}  /  ${String(z).padStart(4)}`);
  }
  const totalE = en.entries.length;
  const totalZ = zh.entries.length;
  console.log(`  ${'TOTAL'.padEnd(15)} ${String(totalE).padStart(4)}  /  ${String(totalZ).padStart(4)}`);
  console.log('\nNow delete the legacy en-US.ts / zh-CN.ts and update locales/index.ts.');
}

main();
