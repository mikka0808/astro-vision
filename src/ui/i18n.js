import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  STORAGE_KEYS
} from '../../config/app-config.js';

const translations = new Map();
let activeLanguage = DEFAULT_LANGUAGE;
const listeners = new Set();
let isApplying = false;

const LANGUAGE_STORAGE_KEY = STORAGE_KEYS.language;

function getFallbackLanguage() {
  if (SUPPORTED_LANGUAGES.includes(DEFAULT_LANGUAGE)) {
    return DEFAULT_LANGUAGE;
  }
  return SUPPORTED_LANGUAGES[0] || 'fr';
}

function normalizeLanguage(lang) {
  if (!lang) return getFallbackLanguage();
  const lower = lang.toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(lower)) {
    return lower;
  }
  const base = lower.split('-')[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : getFallbackLanguage();
}

async function loadDictionary(lang) {
  const normalized = normalizeLanguage(lang);
  if (translations.has(normalized)) {
    return translations.get(normalized);
  }
  try {
    const response = await fetch(`./i18n/${normalized}.json`, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Unable to fetch dictionary for ${normalized}`);
    }
    const data = await response.json();
    translations.set(normalized, data || {});
    return data || {};
  } catch (error) {
    console.warn('Chargement du dictionnaire impossible :', error);
    translations.set(normalized, {});
    return {};
  }
}

function formatTemplate(template, values = {}) {
  if (typeof template !== 'string') {
    return template;
  }
  return template.replace(/\{([^}]+)\}/g, (_, token) => {
    const key = token.trim();
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const replacement = values[key];
      return replacement == null ? '' : String(replacement);
    }
    return `{${key}}`;
  });
}

export function translate(key, values) {
  if (!key) {
    return '';
  }
  const dict = translations.get(activeLanguage) || {};
  const fallbackDict = translations.get(getFallbackLanguage()) || {};
  const template = dict[key] ?? fallbackDict[key] ?? key;
  return formatTemplate(template, values);
}

export function onLanguageChange(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  listeners.add(callback);
  callback(activeLanguage);
  return () => {
    listeners.delete(callback);
  };
}

function notifyLanguageChange() {
  listeners.forEach((listener) => {
    try {
      listener(activeLanguage);
    } catch (error) {
      console.error('Erreur dans un écouteur de langue :', error);
    }
  });
}

function setActiveLanguage(lang) {
  activeLanguage = normalizeLanguage(lang);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = activeLanguage;
  }
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, activeLanguage);
  } catch (error) {
    console.warn('Impossible de mémoriser la langue :', error);
  }
  notifyLanguageChange();
}

function applyToElement(element) {
  const key = element.dataset.i18nKey;
  if (!key) {
    return;
  }
  const value = translate(key);
  const attrTargets = element.dataset.i18nAttr;
  if (attrTargets) {
    attrTargets.split(',').forEach((attr) => {
      const name = attr.trim();
      if (!name) return;
      if (name === 'text') {
        element.textContent = value;
      } else {
        element.setAttribute(name, value);
      }
    });
    return;
  }
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    if (element.hasAttribute('placeholder')) {
      element.setAttribute('placeholder', value);
    } else {
      element.value = value;
    }
    return;
  }
  element.textContent = value;
}

export function applyTranslations(root = document) {
  if (isApplying || !root) {
    return;
  }
  isApplying = true;
  const elements = root.querySelectorAll('[data-i18n-key]');
  elements.forEach((element) => applyToElement(element));
  isApplying = false;
}

async function bootstrapLanguage() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  const preferred = normalizeLanguage(stored || navigator.language || navigator.userLanguage);
  await loadDictionary(getFallbackLanguage());
  await loadDictionary(preferred);
  setActiveLanguage(preferred);
  applyTranslations();
  setupSwitchers();
}

function setupSwitchers() {
  const buttons = document.querySelectorAll('[data-language-switch]');
  const refresh = () => {
    buttons.forEach((button) => {
      const lang = button.dataset.languageSwitch;
      if (!lang) return;
      const normalized = normalizeLanguage(lang);
      const pressed = normalized === activeLanguage;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      const label = LANGUAGE_LABELS[normalized] || normalized.toUpperCase();
      if (!button.dataset.keepContent) {
        button.textContent = label;
      }
    });
  };
  refresh();
  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      const lang = normalizeLanguage(button.dataset.languageSwitch);
      if (lang === activeLanguage) {
        return;
      }
      await loadDictionary(lang);
      setActiveLanguage(lang);
      applyTranslations();
      refresh();
    });
  });
  onLanguageChange(refresh);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrapLanguage().catch((error) => console.error('Initialisation i18n impossible :', error));
  }, { once: true });
} else {
  bootstrapLanguage().catch((error) => console.error('Initialisation i18n impossible :', error));
}

export function formatDate(date, options = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    const formatter = new Intl.DateTimeFormat(activeLanguage, options);
    return formatter.format(date);
  } catch (error) {
    return date.toLocaleDateString();
  }
}

export function formatTime(date, options = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const mergedOptions = { hour: '2-digit', minute: '2-digit', ...options };
  try {
    const formatter = new Intl.DateTimeFormat(activeLanguage, mergedOptions);
    return formatter.format(date);
  } catch (error) {
    return date.toLocaleTimeString([], mergedOptions);
  }
}
