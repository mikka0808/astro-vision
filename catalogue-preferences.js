const COOKIE_NAME = 'astroSoir:catalogueSelection';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an

const DEFAULT_SELECTIONS = Object.freeze({
  visual: Object.freeze(['messier', 'caldwell', 'ngc']),
  research: Object.freeze(['messier', 'caldwell', 'ngc', 'sharpless', 'ldn', 'vdb', 'arp']),
  astrophoto: Object.freeze(['messier', 'caldwell', 'ngc', 'ic', 'sharpless', 'ldn', 'vdb', 'arp', 'pgc'])
});

const MODE_IDS = Object.freeze(Object.keys(DEFAULT_SELECTIONS));

function cloneSelections(source) {
  return MODE_IDS.reduce((acc, key) => {
    const values = Array.isArray(source[key]) ? source[key] : [];
    acc[key] = [...values];
    return acc;
  }, {});
}

function parseCookieValue() {
  if (typeof document === 'undefined') {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split(';') : [];
  const entry = cookies
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE_NAME}=`));
  if (!entry) {
    return null;
  }
  const raw = entry.substring(COOKIE_NAME.length + 1);
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (error) {
    console.warn('Impossible de décoder les préférences de catalogue', error);
    return null;
  }
}

function sanitizeSelectionList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set();
  value.forEach((entry) => {
    const id = typeof entry === 'string' ? entry.trim() : '';
    if (id) {
      unique.add(id);
    }
  });
  return Array.from(unique);
}

function serializePreferences(preferences) {
  const payload = {};
  MODE_IDS.forEach((mode) => {
    const list = sanitizeSelectionList(preferences?.[mode]);
    payload[mode] = list;
  });
  return payload;
}

export function getDefaultCatalogueSelections() {
  return cloneSelections(DEFAULT_SELECTIONS);
}

export function loadCataloguePreferences() {
  const defaults = getDefaultCatalogueSelections();
  const stored = parseCookieValue();
  if (!stored) {
    return defaults;
  }
  const merged = {};
  MODE_IDS.forEach((mode) => {
    if (stored[mode] === undefined) {
      merged[mode] = defaults[mode];
    } else {
      merged[mode] = sanitizeSelectionList(stored[mode]);
    }
  });
  return merged;
}

export function persistCataloguePreferences(preferences) {
  if (typeof document === 'undefined') {
    return;
  }
  try {
    const payload = serializePreferences(preferences);
    const encoded = encodeURIComponent(JSON.stringify(payload));
    document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch (error) {
    console.warn("Impossible d'enregistrer les préférences de catalogue", error);
  }
}

export function resetCataloguePreferences() {
  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
  return getDefaultCatalogueSelections();
}

export function getCatalogueModes() {
  return [...MODE_IDS];
}
