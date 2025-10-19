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

function normalizeCatalogueId(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function sanitizeSelectionList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Set();
  value.forEach((entry) => {
    const id = normalizeCatalogueId(entry);
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

function normaliseCataloguePreferences(preferences) {
  const defaults = getDefaultCatalogueSelections();
  const source = preferences && typeof preferences === 'object' ? preferences : {};
  const normalised = {};
  MODE_IDS.forEach((mode) => {
    if (source[mode] === undefined) {
      normalised[mode] = [...(defaults[mode] || [])];
    } else {
      normalised[mode] = sanitizeSelectionList(source[mode]);
    }
  });
  return normalised;
}

export function getDefaultCatalogueSelections() {
  return cloneSelections(DEFAULT_SELECTIONS);
}

export function loadCataloguePreferences() {
  const stored = parseCookieValue();
  return normaliseCataloguePreferences(stored);
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

export function flattenCataloguePreferences(preferences = null) {
  const resolved = normaliseCataloguePreferences(preferences);
  const merged = new Set();
  MODE_IDS.forEach((mode) => {
    resolved[mode].forEach((id) => merged.add(id));
  });
  return Array.from(merged);
}

export function filterCataloguesForPreferences(catalogues = [], preferences = null) {
  const allowed = new Set(flattenCataloguePreferences(preferences));
  if (!Array.isArray(catalogues)) {
    return [];
  }
  if (allowed.size === 0) {
    return [];
  }
  return catalogues.filter((catalogue) => allowed.has(normalizeCatalogueId(catalogue?.id)));
}

export function filterObjectsForPreferences(objects = [], preferences = null) {
  const allowed = new Set(flattenCataloguePreferences(preferences));
  if (!Array.isArray(objects) || allowed.size === 0) {
    return [];
  }
  return objects.filter((object) => {
    const refs = Array.isArray(object?.catalogueRefs) ? object.catalogueRefs : [];
    return refs.some((ref) => allowed.has(normalizeCatalogueId(ref)));
  });
}

export function filterSnapshotForPreferences(snapshot, preferences = null) {
  if (!snapshot || typeof snapshot !== 'object') {
    return snapshot ?? null;
  }
  const allowedIds = new Set(flattenCataloguePreferences(preferences));
  const clone = { ...snapshot };
  if (allowedIds.size === 0) {
    clone.entries = [];
    if (clone.context && typeof clone.context === 'object') {
      clone.context = { ...clone.context, catalogueIds: [] };
    }
    clone.decisionSupport = null;
    return clone;
  }
  const filterId = (id) => allowedIds.has(normalizeCatalogueId(id));
  const entries = Array.isArray(snapshot.entries)
    ? snapshot.entries.filter((entry) => {
        const refs = Array.isArray(entry?.object?.catalogueRefs)
          ? entry.object.catalogueRefs
          : [];
        const primary = entry?.object?.primaryCatalogueId;
        if (primary && filterId(primary)) {
          return true;
        }
        return refs.some((ref) => filterId(ref));
      })
    : [];
  clone.entries = entries;
  if (snapshot.context && typeof snapshot.context === 'object') {
    const context = { ...snapshot.context };
    if (Array.isArray(context.catalogueIds)) {
      context.catalogueIds = context.catalogueIds.filter((id) => filterId(id));
    }
    clone.context = context;
  }
  clone.decisionSupport = null;
  return clone;
}
