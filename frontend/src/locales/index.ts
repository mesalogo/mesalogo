// i18n bootstrap for the frontend.
//
// Each language is now split into per-feature namespaces under
//   ./zh-CN/<ns>.ts  and  ./en-US/<ns>.ts
// (see scripts/split-locales.js). The aggregated default export from each
// language directory remains a FLAT merged object, registered here under the
// legacy `translation` namespace so that every existing `useTranslation()`
// (no-arg) call continues to work unchanged.
//
// New code SHOULD prefer scoped namespaces:
//   const { t } = useTranslation('agents');
//   t('agents.title');               // resolves against the 'agents' ns
//
// Adding a new feature?
// 1. Add an `<ns>.ts` in BOTH zh-CN/ and en-US/ (keep keys in sync).
// 2. Append the namespace name to NAMESPACES below.
// 3. Run `node scripts/check-i18n-keys.js` before committing.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN, { namespaces as zhCNNs } from './zh-CN';
import enUS, { namespaces as enUSNs } from './en-US';

/**
 * Keep this list in sync with the keys of `namespaces` in each language's
 * index.ts. Used both by i18next.init (so `useTranslation('agents')` works
 * out of the box) and by the key-consistency checker script.
 */
export const NAMESPACES = [
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
] as const;

/**
 * Build the i18next resources tree:
 *   resources[lang][ns] = { ...keys }
 * Plus a flat `translation` ns for back-compat with no-arg useTranslation().
 */
function buildResources() {
  const zhRes: Record<string, any> = { translation: zhCN };
  const enRes: Record<string, any> = { translation: enUS };
  for (const ns of NAMESPACES) {
    if ((zhCNNs as any)[ns]) zhRes[ns] = (zhCNNs as any)[ns];
    if ((enUSNs as any)[ns]) enRes[ns] = (enUSNs as any)[ns];
  }
  return { 'zh-CN': zhRes, 'en-US': enRes };
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: buildResources(),
    fallbackLng: 'zh-CN',
    // Default namespace stays 'translation' so existing useTranslation() with
    // no argument keeps resolving against the merged-flat object — this is the
    // only way to avoid touching the ~50 existing call sites in one go.
    defaultNS: 'translation',
    ns: ['translation', ...NAMESPACES],
    fallbackNS: 'translation',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
