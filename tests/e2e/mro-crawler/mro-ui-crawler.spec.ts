import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

type Verbosity = 'debug' | 'info' | 'warn' | 'error';

type CrawlerConfig = {
  runLabel: string;
  auth: {
    baseUrl: string;
    loginPath: string;
    username: string;
    password: string;
    tenantContext: string;
    usernameEnv: string;
    passwordEnv: string;
    tenantEnv: string;
    baseUrlEnv: string;
  };
  timeouts: {
    navigationMs: number;
    actionMs: number;
    ajaxWaitMs: number;
    popupWaitMs: number;
  };
  retries: {
    maxAttempts: number;
    initialDelayMs: number;
    backoffMultiplier: number;
  };
  limits: {
    maxDepth: number;
    maxNodes: number;
    maxActionsPerNode: number;
    maxFailures: number;
  };
  output: {
    directory: string;
    captureScreenshotsOnFailure: boolean;
  };
  discovery: {
    seedPaths: string[];
    collectFromNetwork: boolean;
  };
  session?: {
    reauthenticateOnLoginRedirect?: boolean;
    maxReauthAttempts?: number;
  };
  rateLimit?: {
    actionDelayMs?: number;
    jitterMs?: number;
  };
  verbosity: Verbosity;
  selectors: {
    usernameInputs: string[];
    tenantInputs: string[];
    usernameNextButtons: string[];
    passwordInputs: string[];
    submitButtons: string[];
    navCandidates: string[];
    tabCandidates: string[];
    accordionCandidates: string[];
    modalTriggers: string[];
    modalCloseCandidates: string[];
    expandCandidates?: string[];
    recoveryCandidates?: string[];
    formContainerCandidates: string[];
  };
};

type NavCandidate = {
  key: string;
  text: string;
  css: string;
  xpath: string;
  type: string;
  visible: boolean;
  disabled: boolean;
  href: string;
  onClick: string;
};

type UiElementMetadata = {
  tag: string;
  role: string;
  id: string;
  name: string;
  className: string;
  text: string;
  fieldLabel: string;
  inputType: string;
  value: string;
  defaultValue: string;
  placeholder: string;
  required: boolean;
  ariaRequired: string;
  min: string;
  max: string;
  minLength: string;
  maxLength: string;
  pattern: string;
  disabled: boolean;
  readOnly: boolean;
  checked: boolean;
  helpText: string;
  errorText: string;
  cssSelector: string;
  xpath: string;
  sectionHint: string;
  menuHint: string;
  visible: boolean;
};

type PageNode = {
  id: string;
  depth: number;
  timestamp: string;
  url: string;
  title: string;
  menuPath: string[];
  signature: string;
  frameworkHints: {
    react: boolean;
    angular: boolean;
    vue: boolean;
    jquery: boolean;
  };
  performance: {
    actionDurationMs: number;
    beforeUrl: string;
    afterUrl: string;
  };
  discovered: {
    navigationCandidates: NavCandidate[];
    tabs: NavCandidate[];
    accordions: NavCandidate[];
    modalTriggers: NavCandidate[];
  };
  elements: {
    all: UiElementMetadata[];
    forms: UiElementMetadata[];
    navigation: UiElementMetadata[];
  };
};

type FailureRecord = {
  timestamp: string;
  stage: string;
  message: string;
  menuPath: string[];
  url: string;
  attempt: number;
  screenshot?: string;
};

type CrawlReport = {
  runId: string;
  runLabel: string;
  startedAt: string;
  endedAt?: string;
  authContext: {
    baseUrl: string;
    username: string;
    tenantContext: string;
  };
  configSnapshot: {
    maxDepth: number;
    maxNodes: number;
    maxActionsPerNode: number;
    timeouts: CrawlerConfig['timeouts'];
    retries: CrawlerConfig['retries'];
  };
  metrics: {
    visitedNodes: number;
    visitedActions: number;
    failures: number;
    elapsedMs: number;
  };
  nodes: PageNode[];
  failuresLog: FailureRecord[];
  navigationGraph: Array<{
    fromNodeId: string;
    toNodeId: string;
    actionKey: string;
    label: string;
    type: string;
  }>;
  inaccessibleElements: Array<{
    timestamp: string;
    actionKey: string;
    type: string;
    label: string;
    url: string;
    menuPath: string[];
    reason: string;
    recovered: boolean;
    recoveryActions: string[];
  }>;
  hierarchy: {
    modules: Array<{
      nodeId: string;
      depth: number;
      module: string;
      parentModule: string;
      menuPath: string[];
      url: string;
      title: string;
    }>;
    relationships: Array<{
      fromNodeId: string;
      toNodeId: string;
      label: string;
      type: string;
    }>;
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nowIso = () => new Date().toISOString();

const timestampKey = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
};

const safeText = (value: unknown) => String(value ?? '').trim();

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

const toAbsoluteUrl = (baseUrl: string, pathOrUrl: string) => {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${normalizeBaseUrl(baseUrl)}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
};

const normalizeInternalRouteCandidate = (raw: string, baseUrl: string): string | null => {
  const value = safeText(raw);
  if (!value) return null;
  try {
    const url = new URL(value, toAbsoluteUrl(baseUrl, '/'));
    const base = new URL(toAbsoluteUrl(baseUrl, '/'));
    if (url.origin !== base.origin) return null;
    if (!/\.aspx(?:$|\?)/i.test(`${url.pathname}${url.search}`)) return null;
    if (!/\/flypaldeccan\//i.test(url.pathname)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const logger = (verbosity: Verbosity, level: Verbosity, message: string) => {
  const rank: Record<Verbosity, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };
  if (rank[level] >= rank[verbosity]) {
    process.stdout.write(`[${level.toUpperCase()}] ${message}\n`);
  }
};

const loadConfig = (): CrawlerConfig => {
  const configPath = process.env.MRO_CRAWLER_CONFIG
    ? path.resolve(process.cwd(), process.env.MRO_CRAWLER_CONFIG)
    : path.resolve(__dirname, 'mro-crawler.config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as CrawlerConfig;
  const baseUrl = process.env[parsed.auth.baseUrlEnv] || process.env.MRO_BASE_URL || parsed.auth.baseUrl;
  const username = process.env[parsed.auth.usernameEnv] || parsed.auth.username;
  const password = process.env[parsed.auth.passwordEnv] || parsed.auth.password;
  const tenantContext = process.env[parsed.auth.tenantEnv] || parsed.auth.tenantContext;
  return {
    ...parsed,
    discovery: {
      seedPaths: Array.isArray(parsed.discovery?.seedPaths) ? parsed.discovery.seedPaths.map((item) => safeText(item)).filter(Boolean) : [],
      collectFromNetwork: parsed.discovery?.collectFromNetwork !== false,
    },
    auth: {
      ...parsed.auth,
      baseUrl: safeText(baseUrl),
      username: safeText(username),
      password: safeText(password),
      tenantContext: safeText(tenantContext),
    },
    session: {
      reauthenticateOnLoginRedirect: parsed.session?.reauthenticateOnLoginRedirect !== false,
      maxReauthAttempts: Math.max(1, Number(parsed.session?.maxReauthAttempts ?? 2)),
    },
    rateLimit: {
      actionDelayMs: Math.max(0, Number(parsed.rateLimit?.actionDelayMs ?? 250)),
      jitterMs: Math.max(0, Number(parsed.rateLimit?.jitterMs ?? 150)),
    },
  };
};

const retryWithBackoff = async <T>(
  label: string,
  retries: CrawlerConfig['retries'],
  fn: (attempt: number) => Promise<T>,
): Promise<T> => {
  let attempt = 1;
  let delay = retries.initialDelayMs;
  let lastError: unknown;
  while (attempt <= retries.maxAttempts) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries.maxAttempts) break;
      await sleep(delay);
      delay = Math.round(delay * retries.backoffMultiplier);
      attempt += 1;
    }
  }
  throw new Error(`${label} failed after ${retries.maxAttempts} attempts: ${safeText((lastError as Error)?.message)}`);
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const sanitizeKey = (value: string) => value.replace(/[^\w.-]+/g, '_').slice(0, 180);

const expandSelectorsFallback = [
  '.hamburger',
  '[aria-label*="menu" i]',
  '[class*="hamburger" i]',
  '[class*="menu-toggle" i]',
  '[data-bs-toggle="dropdown"]',
  '[data-toggle="dropdown"]',
  '[data-bs-toggle="collapse"]',
  '[data-toggle="collapse"]',
  '[aria-haspopup="menu"]',
  '[aria-haspopup="true"]',
  '[aria-expanded="false"]',
  '.collapsed',
  'summary',
  'button:has-text("Menu")',
];

const recoverySelectorsFallback = [
  '[data-bs-dismiss="modal"]',
  '[aria-label="Close"]',
  '[class*="close" i]',
  '.modal .btn-close',
  'button:has-text("Cancel")',
  'a:has-text("Cancel")',
  'button:has-text("Close")',
  'a:has-text("Close")',
  'button:has-text("Back")',
];

const waitForDynamicContent = async (page: import('@playwright/test').Page, config: CrawlerConfig) => {
  if (page.isClosed()) return;
  await page.waitForLoadState('domcontentloaded', { timeout: config.timeouts.navigationMs }).catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: config.timeouts.ajaxWaitMs }).catch(() => null);
  await page.waitForTimeout(Math.min(config.timeouts.ajaxWaitMs, 2500));
};

const getFrameworkHints = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return {
      react: Boolean(document.querySelector('[data-reactroot]') || w.__REACT_DEVTOOLS_GLOBAL_HOOK__),
      angular: Boolean(document.querySelector('[ng-version]') || w.ng),
      vue: Boolean(document.querySelector('[data-v-app]') || w.__VUE__ || w.__VUE_DEVTOOLS_GLOBAL_HOOK__),
      jquery: Boolean(w.jQuery || w.$),
    };
  });

const collectCandidates = async (
  page: import('@playwright/test').Page,
  selectors: string[],
  type: string,
): Promise<NavCandidate[]> =>
  page.evaluate(
    ({ selectors: selectorInput, type: candidateType }) => {
      const dedupe = new Set<string>();
      const results: NavCandidate[] = [];
      const buildCss = (el: Element): string => {
        const segments: string[] = [];
        let current: Element | null = el;
        while (current && current.nodeType === 1 && segments.length < 7) {
          const tag = current.tagName.toLowerCase();
          const id = current.id ? `#${CSS.escape(current.id)}` : '';
          if (id) {
            segments.unshift(`${tag}${id}`);
            break;
          }
          const className = safeClass(current.getAttribute('class') || '');
          if (className) {
            segments.unshift(`${tag}.${className}`);
          } else {
            const index = siblingIndex(current);
            segments.unshift(`${tag}:nth-of-type(${index})`);
          }
          current = current.parentElement;
        }
        return segments.join(' > ');
      };
      const siblingIndex = (el: Element): number => {
        let index = 1;
        let sibling = el.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === el.tagName) index += 1;
          sibling = sibling.previousElementSibling;
        }
        return index;
      };
      const safeClass = (raw: string) =>
        raw
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((c) => CSS.escape(c))
          .join('.');
      const buildXpath = (el: Element): string => {
        const segments: string[] = [];
        let current: Element | null = el;
        while (current && current.nodeType === 1) {
          const tag = current.tagName.toLowerCase();
          if (current.id) {
            segments.unshift(`//*[@id="${current.id.replace(/"/g, '\\"')}"]`);
            break;
          }
          let index = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName.toLowerCase() === tag) index += 1;
            sibling = sibling.previousElementSibling;
          }
          segments.unshift(`/${tag}[${index}]`);
          current = current.parentElement;
        }
        return segments[0]?.startsWith('//*') ? segments.join('') : `/${segments.join('')}`;
      };
      const elementVisible = (el: Element) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      for (const selector of selectorInput) {
        let elements: Element[] = [];
        try {
          elements = Array.from(document.querySelectorAll(selector));
        } catch {
          continue;
        }
        for (const element of elements) {
          const htmlElement = element as HTMLElement;
          const text = (htmlElement.innerText || htmlElement.textContent || '').trim().replace(/\s+/g, ' ');
          const visible = elementVisible(element);
          const disabled = htmlElement.hasAttribute('disabled') || htmlElement.getAttribute('aria-disabled') === 'true';
          const css = buildCss(element);
          const xpath = buildXpath(element);
          const href = (htmlElement as HTMLAnchorElement).href || '';
          const onClick = htmlElement.getAttribute('onclick') || '';
          const key = `${candidateType}|${selector}|${text}|${href}|${css}`;
          if (dedupe.has(key)) continue;
          dedupe.add(key);
          results.push({
            key,
            text: text || htmlElement.getAttribute('aria-label') || htmlElement.getAttribute('title') || css,
            css,
            xpath,
            type: candidateType,
            visible,
            disabled,
            href,
            onClick,
          });
        }
      }
      return results;
    },
    { selectors, type },
  );

const collectHrefCandidates = async (
  page: import('@playwright/test').Page,
  baseUrl: string,
): Promise<NavCandidate[]> => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  return page.evaluate(({ normalizedBaseInput }) => {
    const dedupe = new Set<string>();
    const results: NavCandidate[] = [];
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const anchor of anchors) {
      const el = anchor as HTMLAnchorElement;
      const href = (el.href || '').trim();
      if (!href) continue;
      if (!href.startsWith(normalizedBaseInput)) continue;
      if (/^javascript:/i.test(href)) continue;
      if (/#$/.test(href)) continue;
      const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
      const key = `link-href|${href}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      results.push({
        key,
        text: text || href,
        css: 'a[href]',
        xpath: '',
        type: 'link-href',
        visible: true,
        disabled: false,
        href,
        onClick: '',
      });
    }
    return results;
  }, { normalizedBaseInput: normalizedBase });
};

const collectRouteCandidatesFromHtml = async (
  page: import('@playwright/test').Page,
  baseUrl: string,
): Promise<NavCandidate[]> => {
  return page.evaluate(({ baseUrlInput }) => {
    const source = [
      document.documentElement?.outerHTML || '',
      ...Array.from(document.querySelectorAll('script'))
        .map((script) => script.textContent || '')
        .filter(Boolean),
      ...Array.from(document.querySelectorAll('[onclick]'))
        .map((element) => (element as HTMLElement).getAttribute('onclick') || '')
        .filter(Boolean),
    ].join('\n');
    const routeMatches = source.match(/(?:https?:\/\/[^\s"'`<>]+?\.aspx(?:\?[^\s"'`<>]*)?|\/[^\s"'`<>]+?\.aspx(?:\?[^\s"'`<>]*)?|\.{1,2}\/[^\s"'`<>]+?\.aspx(?:\?[^\s"'`<>]*)?)/gi) || [];
    const dedupe = new Set<string>();
    const results: NavCandidate[] = [];
    for (const route of routeMatches) {
      let href = '';
      try {
        const url = new URL(route, window.location.href);
        const base = new URL(baseUrlInput);
        if (url.origin !== base.origin) continue;
        if (!/\.aspx(?:$|\?)/i.test(`${url.pathname}${url.search}`)) continue;
        if (!/\/flypaldeccan\//i.test(url.pathname)) continue;
        url.hash = '';
        href = url.toString();
      } catch {
        continue;
      }
      const key = `route-href|${href}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      results.push({
        key,
        text: href,
        css: '',
        xpath: '',
        type: 'route-href',
        visible: true,
        disabled: false,
        href,
        onClick: '',
      });
    }
    return results;
  }, { baseUrlInput: toAbsoluteUrl(baseUrl, '/') });
};

const collectRouteCandidatesFromSeeds = (
  seedPaths: string[],
  baseUrl: string,
): NavCandidate[] => {
  const dedupe = new Set<string>();
  const results: NavCandidate[] = [];
  for (const seedPath of seedPaths) {
    const href = normalizeInternalRouteCandidate(seedPath, baseUrl);
    if (!href) continue;
    const key = `seed-href|${href}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    results.push({
      key,
      text: href,
      css: '',
      xpath: '',
      type: 'seed-href',
      visible: true,
      disabled: false,
      href,
      onClick: '',
    });
  }
  return results;
};

const collectRouteCandidatesFromNetwork = (
  discoveredRouteUrls: Set<string>,
  currentUrl: string,
): NavCandidate[] => {
  const results: NavCandidate[] = [];
  for (const href of discoveredRouteUrls) {
    if (!safeText(href) || href === currentUrl) continue;
    results.push({
      key: `network-href|${href}`,
      text: href,
      css: '',
      xpath: '',
      type: 'network-href',
      visible: true,
      disabled: false,
      href,
      onClick: '',
    });
  }
  return results;
};

const collectElements = async (
  page: import('@playwright/test').Page,
  menuPath: string[],
): Promise<UiElementMetadata[]> =>
  page.evaluate(({ menuPathInput }) => {
    const buildCss = (el: Element): string => {
      const parts: string[] = [];
      let current: Element | null = el;
      let depth = 0;
      while (current && depth < 8) {
        const tag = current.tagName.toLowerCase();
        if (current.id) {
          parts.unshift(`${tag}#${CSS.escape(current.id)}`);
          break;
        }
        const className = (current.getAttribute('class') || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((value) => CSS.escape(value))
          .join('.');
        if (className) {
          parts.unshift(`${tag}.${className}`);
        } else {
          let index = 1;
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === current.tagName) index += 1;
            sibling = sibling.previousElementSibling;
          }
          parts.unshift(`${tag}:nth-of-type(${index})`);
        }
        current = current.parentElement;
        depth += 1;
      }
      return parts.join(' > ');
    };

    const buildXpath = (el: Element): string => {
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current.nodeType === 1) {
        if (current.id) {
          parts.unshift(`//*[@id="${current.id.replace(/"/g, '\\"')}"]`);
          break;
        }
        let index = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) index += 1;
          sibling = sibling.previousElementSibling;
        }
        parts.unshift(`/${current.tagName.toLowerCase()}[${index}]`);
        current = current.parentElement;
      }
      return parts[0]?.startsWith('//*') ? parts.join('') : `/${parts.join('')}`;
    };

    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const getLabel = (el: Element): string => {
      const html = el as HTMLElement;
      const attrLabel = html.getAttribute('aria-label') || '';
      if (attrLabel) return attrLabel.trim();
      const id = html.id;
      if (id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const text = (byFor?.textContent || '').trim();
        if (text) return text;
      }
      const wrappedLabel = html.closest('label');
      if (wrappedLabel) {
        const text = (wrappedLabel.textContent || '').trim();
        if (text) return text;
      }
      const previousLabel = html.previousElementSibling?.matches('label') ? html.previousElementSibling : null;
      if (previousLabel) {
        const text = (previousLabel.textContent || '').trim();
        if (text) return text;
      }
      return '';
    };

    const getHelpText = (el: Element): string => {
      const html = el as HTMLElement;
      const describedBy = html.getAttribute('aria-describedby') || '';
      const referenced = describedBy
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean)
        .join(' | ');
      const title = html.getAttribute('title') || '';
      return [referenced, title].filter(Boolean).join(' | ');
    };

    const getErrorText = (el: Element): string => {
      const html = el as HTMLElement;
      const ownInvalid = html.getAttribute('aria-invalid') === 'true';
      const nearestInvalid = html.closest('.error, [aria-invalid="true"], .invalid, .field-error');
      const nearMessage = nearestInvalid?.textContent?.trim() || '';
      if (ownInvalid && nearMessage) return nearMessage;
      if (ownInvalid) return 'aria-invalid=true';
      return nearMessage;
    };

    const sectionHint = (el: Element): string => {
      const section = el.closest('form, [role="form"], [role="dialog"], .modal, .accordion, .tab-pane, [role="tabpanel"], .wizard, .stepper');
      if (!section) return '';
      const heading =
        section.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]')?.textContent?.trim() ||
        section.getAttribute('aria-label') ||
        section.getAttribute('id') ||
        section.className ||
        '';
      return heading.trim();
    };

    const roleFallback = (el: Element): string => el.getAttribute('role') || '';

    const targets = Array.from(
      document.querySelectorAll(
        'input,select,textarea,button,a,label,[role="button"],[role="menuitem"],[role="tab"],[role="dialog"],[contenteditable="true"],[data-testid]',
      ),
    );
    const result: UiElementMetadata[] = targets.map((el) => {
      const html = el as HTMLElement & HTMLInputElement;
      const text = (html.innerText || html.textContent || '').trim().replace(/\s+/g, ' ');
      const inputType = html.getAttribute('type') || html.tagName.toLowerCase();
      return {
        tag: html.tagName.toLowerCase(),
        role: roleFallback(html),
        id: html.id || '',
        name: html.getAttribute('name') || '',
        className: html.className || '',
        text,
        fieldLabel: getLabel(html),
        inputType,
        value: 'value' in html ? String((html as HTMLInputElement).value ?? '') : '',
        defaultValue: 'defaultValue' in html ? String((html as HTMLInputElement).defaultValue ?? '') : '',
        placeholder: html.getAttribute('placeholder') || '',
        required: html.hasAttribute('required'),
        ariaRequired: html.getAttribute('aria-required') || '',
        min: html.getAttribute('min') || '',
        max: html.getAttribute('max') || '',
        minLength: html.getAttribute('minlength') || '',
        maxLength: html.getAttribute('maxlength') || '',
        pattern: html.getAttribute('pattern') || '',
        disabled: html.hasAttribute('disabled') || html.getAttribute('aria-disabled') === 'true',
        readOnly: html.hasAttribute('readonly') || html.getAttribute('aria-readonly') === 'true',
        checked: 'checked' in html ? Boolean((html as HTMLInputElement).checked) : false,
        helpText: getHelpText(html),
        errorText: getErrorText(html),
        cssSelector: buildCss(html),
        xpath: buildXpath(html),
        sectionHint: sectionHint(html),
        menuHint: menuPathInput.join(' > '),
        visible: visible(html),
      };
    });
    return result;
  }, { menuPathInput: menuPath });

const findFirstInteractive = async (page: import('@playwright/test').Page, selectors: string[]) => {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = locator.nth(i);
      const isVisible = await candidate.isVisible().catch(() => false);
      if (!isVisible) continue;
      const isEnabled = await candidate.isEnabled().catch(() => false);
      if (!isEnabled) continue;
      return candidate;
    }
  }
  return null;
};

const clickVisibleSelectors = async (
  page: import('@playwright/test').Page,
  selectors: string[],
  maxClicks: number,
) => {
  let clicks = 0;
  for (const selector of selectors) {
    if (clicks >= maxClicks || page.isClosed()) break;
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 4); i += 1) {
      if (clicks >= maxClicks || page.isClosed()) break;
      const item = locator.nth(i);
      const visible = await item.isVisible().catch(() => false);
      const enabled = await item.isEnabled().catch(() => false);
      if (!visible || !enabled) continue;
      await item.click({ timeout: 3000 }).catch(() => null);
      clicks += 1;
    }
  }
  return clicks;
};

const authenticate = async (
  page: import('@playwright/test').Page,
  config: CrawlerConfig,
  report: CrawlReport,
  screenshotDir: string,
) => {
  const loginUrl = toAbsoluteUrl(config.auth.baseUrl, config.auth.loginPath);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigationMs });
  await waitForDynamicContent(page, config);
  await clickVisibleSelectors(
    page,
    ['a.poplight', '[id*="login" i]', '[class*="login" i]', 'button:has-text("Login")', 'a:has-text("Login")'],
    2,
  );
  await waitForDynamicContent(page, config);
  const usernameInput = await findFirstInteractive(page, config.selectors.usernameInputs);
  if (!usernameInput) {
    throw new Error('Username input not found during authentication');
  }
  await usernameInput.fill(config.auth.username, { timeout: config.timeouts.actionMs });
  const tenantInput = await findFirstInteractive(page, config.selectors.tenantInputs);
  if (tenantInput) {
    const currentValue = await tenantInput.inputValue().catch(() => '');
    if (!safeText(currentValue)) {
      await tenantInput.fill(config.auth.tenantContext, { timeout: config.timeouts.actionMs });
    }
  }
  const nextBtn = await findFirstInteractive(page, config.selectors.usernameNextButtons);
  if (nextBtn) {
    await nextBtn.click({ timeout: config.timeouts.actionMs }).catch(() => null);
    await waitForDynamicContent(page, config);
  }
  const passwordInput = await findFirstInteractive(page, config.selectors.passwordInputs);
  if (!passwordInput) {
    throw new Error('Password input not found during authentication');
  }
  await passwordInput.fill(config.auth.password, { timeout: config.timeouts.actionMs });
  let submit = await findFirstInteractive(page, config.selectors.submitButtons);
  if (!submit) {
    submit = page
      .locator('a[href*="btnLogin"], [id*="btnLogin" i], [name*="btnLogin" i], a:has-text("")')
      .first();
    const visible = await submit.isVisible().catch(() => false);
    const enabled = await submit.isEnabled().catch(() => false);
    if (!visible || !enabled) {
      submit = null;
    }
  }
  if (!submit) {
    throw new Error('Submit button not found during authentication');
  }
  await submit.click({ timeout: config.timeouts.actionMs });
  await waitForDynamicContent(page, config);
  const isLoginStillVisible = await findFirstInteractive(page, [...config.selectors.usernameInputs, ...config.selectors.passwordInputs]);
  if (isLoginStillVisible) {
    const screenshotPath = path.join(screenshotDir, `auth-still-visible-${timestampKey()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    report.failuresLog.push({
      timestamp: nowIso(),
      stage: 'authentication',
      message: 'Password input remained visible after submit. Login may require additional verification.',
      menuPath: [],
      url: page.url(),
      attempt: 1,
      screenshot: screenshotPath,
    });
    throw new Error('Authentication appears unsuccessful because login controls remain visible');
  }
};

const closeTransientUi = async (page: import('@playwright/test').Page, closeSelectors: string[]) => {
  if (page.isClosed()) return;
  await page.keyboard.press('Escape').catch(() => null);
  for (const selector of closeSelectors) {
    if (page.isClosed()) return;
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let i = 0; i < Math.min(count, 5); i += 1) {
      const item = locator.nth(i);
      const visible = await item.isVisible().catch(() => false);
      if (!visible) continue;
      const enabled = await item.isEnabled().catch(() => false);
      if (!enabled) continue;
      await item.click().catch(() => null);
    }
  }
};

const recoverFromUiError = async (
  page: import('@playwright/test').Page,
  config: CrawlerConfig,
): Promise<string[]> => {
  if (page.isClosed()) return [];
  const recoverySelectors = [...(config.selectors.recoveryCandidates || []), ...config.selectors.modalCloseCandidates, ...recoverySelectorsFallback];
  const performed: string[] = [];
  await page.keyboard.press('Escape').catch(() => null);
  await clickVisibleSelectors(page, recoverySelectors, 10);
  for (const selector of recoverySelectors) {
    if (page.isClosed()) break;
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 3); i += 1) {
      const item = locator.nth(i);
      const visible = await item.isVisible().catch(() => false);
      const enabled = await item.isEnabled().catch(() => false);
      if (!visible || !enabled) continue;
      await item.click({ timeout: 2000 }).catch(() => null);
      performed.push(selector);
    }
  }
  await waitForDynamicContent(page, config);
  return performed;
};

const expandNavigationSurfaces = async (page: import('@playwright/test').Page, config: CrawlerConfig) => {
  const expandSelectors = [...(config.selectors.expandCandidates || []), ...expandSelectorsFallback];
  await clickVisibleSelectors(page, expandSelectors, 14);
  await waitForDynamicContent(page, config);
};

test.describe('MRO autonomous UI crawler', () => {
  test('explores and captures full reachable interface metadata', async ({ page, context }) => {
    test.setTimeout(35 * 60 * 1000);
    const config = loadConfig();
    const runId = `${sanitizeKey(config.runLabel)}-${timestampKey()}`;
    const outputDir = path.resolve(process.cwd(), config.output.directory);
    const screenshotDir = path.join(outputDir, `${runId}-screenshots`);
    ensureDir(outputDir);
    ensureDir(screenshotDir);

    const report: CrawlReport = {
      runId,
      runLabel: config.runLabel,
      startedAt: nowIso(),
      authContext: {
        baseUrl: config.auth.baseUrl,
        username: config.auth.username,
        tenantContext: config.auth.tenantContext,
      },
      configSnapshot: {
        maxDepth: config.limits.maxDepth,
        maxNodes: config.limits.maxNodes,
        maxActionsPerNode: config.limits.maxActionsPerNode,
        timeouts: config.timeouts,
        retries: config.retries,
      },
      metrics: {
        visitedNodes: 0,
        visitedActions: 0,
        failures: 0,
        elapsedMs: 0,
      },
      nodes: [],
      failuresLog: [],
      navigationGraph: [],
      inaccessibleElements: [],
      hierarchy: {
        modules: [],
        relationships: [],
      },
    };

    const startedPerf = performance.now();
    const visitedNodeSignatures = new Set<string>();
    const visitedActions = new Set<string>();
    const discoveredRouteUrls = new Set<string>();
    let reauthAttempts = 0;

    const enqueueRouteCandidate = (raw: string) => {
      const normalized = normalizeInternalRouteCandidate(raw, config.auth.baseUrl);
      if (!normalized) return;
      discoveredRouteUrls.add(normalized);
    };

    for (const seedPath of config.discovery.seedPaths) {
      enqueueRouteCandidate(seedPath);
    }

    if (config.discovery.collectFromNetwork) {
      page.on('response', (response) => {
        enqueueRouteCandidate(response.url());
      });
      page.on('requestfinished', (request) => {
        enqueueRouteCandidate(request.url());
      });
    }

    await authenticate(page, config, report, screenshotDir);
    await expandNavigationSurfaces(page, config);

    const ensureActiveSession = async (menuPath: string[]) => {
      if (page.isClosed()) return;
      const inLoginPage = /\/FlyPalDeccan\/(?:index|login)\.aspx/i.test(page.url());
      const loginInputVisible = await findFirstInteractive(page, [...config.selectors.usernameInputs, ...config.selectors.passwordInputs]);
      if (!inLoginPage && !loginInputVisible) return;
      if (!config.session?.reauthenticateOnLoginRedirect) {
        throw new Error('Detected login redirect while session auto-recovery is disabled');
      }
      if (reauthAttempts >= (config.session?.maxReauthAttempts || 2)) {
        throw new Error('Session recovery attempts exhausted');
      }
      reauthAttempts += 1;
      report.failuresLog.push({
        timestamp: nowIso(),
        stage: 'session',
        message: `Session expired, re-authenticating attempt ${reauthAttempts}`,
        menuPath,
        url: page.url(),
        attempt: reauthAttempts,
      });
      await authenticate(page, config, report, screenshotDir);
      await expandNavigationSurfaces(page, config);
    };

    const attemptAction = async (
      candidate: NavCandidate,
      menuPath: string[],
      depth: number,
      sourceNodeId: string,
    ) => {
      const actionLabel = safeText(candidate.text || candidate.css || candidate.xpath || 'action');
      const beforeUrl = page.url();
      const actionKey = `${depth}|${beforeUrl}|${candidate.key}`;
      if (visitedActions.has(actionKey)) return;
      visitedActions.add(actionKey);
      report.metrics.visitedActions = visitedActions.size;
      const popupPromise = page.waitForEvent('popup', { timeout: config.timeouts.popupWaitMs }).catch(() => null);
      const actionStart = performance.now();
      try {
        if (page.isClosed()) return;
        await ensureActiveSession(menuPath);
        const delayBase = Math.max(0, config.rateLimit?.actionDelayMs || 0);
        const jitter = Math.max(0, config.rateLimit?.jitterMs || 0);
        if (delayBase > 0 || jitter > 0) {
          const delay = delayBase + Math.floor(Math.random() * (jitter + 1));
          if (delay > 0) await sleep(delay);
        }
        await retryWithBackoff(`click:${actionLabel}`, config.retries, async () => {
          if (
            (candidate.type === 'link-href' || candidate.type === 'route-href' || candidate.type === 'seed-href' || candidate.type === 'network-href')
            && safeText(candidate.href)
          ) {
            await page.goto(candidate.href, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigationMs });
            return;
          }
          const byCss = page.locator(candidate.css).first();
          const cssVisible = await byCss.isVisible().catch(() => false);
          if (cssVisible) {
            await byCss.click({ timeout: config.timeouts.actionMs });
            return;
          }
          const byXpath = page.locator(`xpath=${candidate.xpath}`).first();
          const xVisible = await byXpath.isVisible().catch(() => false);
          if (!xVisible) {
            throw new Error(`Candidate not visible: ${actionLabel}`);
          }
          await byXpath.click({ timeout: config.timeouts.actionMs });
        });
        const popup = await popupPromise;
        if (popup) {
          await popup.waitForLoadState('domcontentloaded', { timeout: config.timeouts.navigationMs }).catch(() => null);
          await popup.close().catch(() => null);
        }
        await waitForDynamicContent(page, config);
        const afterUrl = page.url();
        await crawl(depth + 1, [...menuPath, actionLabel], {
          actionDurationMs: Math.round(performance.now() - actionStart),
          beforeUrl,
          afterUrl,
        });
        report.navigationGraph.push({
          fromNodeId: sourceNodeId,
          toNodeId: report.nodes[report.nodes.length - 1]?.id || sourceNodeId,
          actionKey,
          label: actionLabel,
          type: candidate.type,
        });
      } catch (error) {
        if (!page.isClosed()) {
          const screenshotPath = path.join(screenshotDir, `failure-${sanitizeKey(actionKey)}.png`);
          if (config.output.captureScreenshotsOnFailure) {
            await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
          }
          const recoveryActions = await recoverFromUiError(page, config);
          report.failuresLog.push({
            timestamp: nowIso(),
            stage: `action:${candidate.type}`,
            message: safeText((error as Error)?.message),
            menuPath,
            url: page.url(),
            attempt: 1,
            screenshot: config.output.captureScreenshotsOnFailure ? screenshotPath : undefined,
          });
          report.inaccessibleElements.push({
            timestamp: nowIso(),
            actionKey,
            type: candidate.type,
            label: actionLabel,
            url: page.url(),
            menuPath,
            reason: safeText((error as Error)?.message),
            recovered: recoveryActions.length > 0,
            recoveryActions,
          });
        }
      } finally {
        if (!page.isClosed()) {
          await closeTransientUi(page, config.selectors.modalCloseCandidates);
          if (page.url() !== beforeUrl) {
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: config.timeouts.navigationMs }).catch(async () => {
              await page.goto(beforeUrl, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigationMs }).catch(() => null);
            });
            await waitForDynamicContent(page, config);
          }
        }
      }
    };

    const crawl = async (
      depth: number,
      menuPath: string[],
      perfContext: { actionDurationMs: number; beforeUrl: string; afterUrl: string },
    ) => {
      if (depth > config.limits.maxDepth) return;
      if (report.nodes.length >= config.limits.maxNodes) return;
      if (report.failuresLog.length >= config.limits.maxFailures) return;
      await ensureActiveSession(menuPath);
      await waitForDynamicContent(page, config);
      await expandNavigationSurfaces(page, config);
      await page.evaluate(async () => {
        const total = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
        const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
        for (let y = 0; y <= total; y += step) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        window.scrollTo(0, 0);
      });
      const signature = await page.evaluate(() => {
        const title = document.title || '';
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]'))
          .map((h) => (h.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 6)
          .join('|');
        const forms = document.querySelectorAll('form,input,select,textarea,button').length;
        const links = document.querySelectorAll('a,[role="menuitem"],[role="tab"]').length;
        return `${location.href}|${title}|${headings}|f:${forms}|l:${links}`;
      });
      if (visitedNodeSignatures.has(signature)) return;
      visitedNodeSignatures.add(signature);

      const frameworkHints = await getFrameworkHints(page);
      const allElements = await collectElements(page, menuPath);
      const navigationCandidates = await collectCandidates(page, config.selectors.navCandidates, 'menu');
      const tabCandidates = await collectCandidates(page, config.selectors.tabCandidates, 'tab');
      const accordionCandidates = await collectCandidates(page, config.selectors.accordionCandidates, 'accordion');
      const modalCandidates = await collectCandidates(page, config.selectors.modalTriggers, 'modal');
      const hrefCandidates = await collectHrefCandidates(page, config.auth.baseUrl);
      const routeCandidates = await collectRouteCandidatesFromHtml(page, config.auth.baseUrl);
      const seededRouteCandidates = collectRouteCandidatesFromSeeds(config.discovery.seedPaths, config.auth.baseUrl);
      const networkRouteCandidates = collectRouteCandidatesFromNetwork(discoveredRouteUrls, page.url());
      const fallbackClickableCandidates = await collectCandidates(
        page,
        ['a[href]', 'button', '[role="button"]', '[onclick]', 'input[type="button"]', 'input[type="submit"]'],
        'clickable',
      );

      const nodeId = `${runId}-node-${report.nodes.length + 1}`;
      const node: PageNode = {
        id: nodeId,
        depth,
        timestamp: nowIso(),
        url: page.url(),
        title: await page.title(),
        menuPath,
        signature,
        frameworkHints,
        performance: perfContext,
        discovered: {
          navigationCandidates,
          tabs: tabCandidates,
          accordions: accordionCandidates,
          modalTriggers: modalCandidates,
        },
        elements: {
          all: allElements,
          forms: allElements.filter((item) =>
            ['input', 'select', 'textarea', 'button'].includes(item.tag) ||
            ['textbox', 'combobox', 'checkbox', 'radio', 'dialog', 'tab'].includes(item.role),
          ),
          navigation: allElements.filter((item) =>
            ['a', 'button'].includes(item.tag) ||
            ['menuitem', 'tab', 'treeitem', 'navigation'].includes(item.role),
          ),
        },
      };
      report.nodes.push(node);
      report.metrics.visitedNodes = report.nodes.length;

      const interactions = [
        ...navigationCandidates,
        ...tabCandidates,
        ...accordionCandidates,
        ...modalCandidates,
        ...hrefCandidates,
        ...routeCandidates,
        ...seededRouteCandidates,
        ...networkRouteCandidates,
        ...fallbackClickableCandidates,
      ]
        .filter((item) => item.visible && !item.disabled)
        .filter((item) => !/window\.close|logout|signout/i.test(`${item.href} ${item.onClick} ${item.text}`))
        .filter((item, index, array) => array.findIndex((entry) => entry.key === item.key) === index)
        .slice(0, config.limits.maxActionsPerNode);

      logger(config.verbosity, 'info', `Depth ${depth} | ${node.url} | actions=${interactions.length}`);

      for (const candidate of interactions) {
        await attemptAction(candidate, menuPath, depth, nodeId);
        if (report.nodes.length >= config.limits.maxNodes || report.failuresLog.length >= config.limits.maxFailures) break;
      }
    };

    await crawl(0, ['root'], {
      actionDurationMs: 0,
      beforeUrl: page.url(),
      afterUrl: page.url(),
    });

    report.endedAt = nowIso();
    report.metrics.failures = report.failuresLog.length;
    report.metrics.elapsedMs = Math.round(performance.now() - startedPerf);
    report.hierarchy.modules = report.nodes.map((node) => ({
      nodeId: node.id,
      depth: node.depth,
      module: node.menuPath[node.menuPath.length - 1] || 'root',
      parentModule: node.menuPath.length > 1 ? node.menuPath[node.menuPath.length - 2] : 'root',
      menuPath: node.menuPath,
      url: node.url,
      title: node.title,
    }));
    report.hierarchy.relationships = report.navigationGraph.map((edge) => ({
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      label: edge.label,
      type: edge.type,
    }));

    const reportFile = path.join(outputDir, `${runId}.json`);
    const summaryFile = path.join(outputDir, `${runId}.summary.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(
      summaryFile,
      JSON.stringify(
        {
          runId: report.runId,
          startedAt: report.startedAt,
          endedAt: report.endedAt,
          metrics: report.metrics,
          authContext: report.authContext,
          hierarchy: report.hierarchy,
          inaccessibleElements: report.inaccessibleElements,
          nodes: report.nodes.map((node) => ({
            id: node.id,
            depth: node.depth,
            url: node.url,
            title: node.title,
            menuPath: node.menuPath,
            discoveredCounts: {
              navigation: node.discovered.navigationCandidates.length,
              tabs: node.discovered.tabs.length,
              accordions: node.discovered.accordions.length,
              modals: node.discovered.modalTriggers.length,
              formElements: node.elements.forms.length,
            },
          })),
          failuresLog: report.failuresLog,
        },
        null,
        2,
      ),
      'utf8',
    );

    await context.storageState({ path: path.join(outputDir, `${runId}.storageState.json`) }).catch((error) => {
      report.failuresLog.push({
        timestamp: nowIso(),
        stage: 'session-storage',
        message: safeText((error as Error)?.message),
        menuPath: ['root'],
        url: page.url(),
        attempt: 1,
      });
    });

    if (report.nodes.length === 0) {
      throw new Error('Crawler completed without collecting any nodes');
    }
  });
});
