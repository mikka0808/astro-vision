import {
  SESSION_STORAGE_KEY,
  NIGHT_MODE_STORAGE_KEY,
  applyWeather,
  buildWeatherSummary,
  computeMoonPhase,
  describeAzimuth,
  enrichCatalogueData,
  evaluateTargets,
  formatAltitude,
  formatCoordinate,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime,
  resolveScoreTone
} from './src/core/astro.js';
import { createObservationPreview } from './catalogue-media.js';
import { renderAltitudeSparkline } from './charts.js';
import {
  parseCataloguePayload,
  fetchCatalogueObjectsFromSource,
  getCatalogueSourceSummary
} from './catalogue-data.js';
import {
  normaliseCatalogueId,
  normaliseCatalogueIdList,
  filterObjectsByCatalogue,
  countObjectsByCatalogue
} from './src/core/catalogue.js';
import { loadScorePreferencesFromCookie } from './score-preferences.js';
import {
  filterCataloguesForPreferences,
  filterObjectsForPreferences,
  filterSnapshotForPreferences,
  flattenCataloguePreferences,
  loadCataloguePreferences
} from './catalogue-preferences.js';
import { Favoris } from './src/state/favoris.js';
import { translate, onLanguageChange } from './src/ui/i18n.js';

loadScorePreferencesFromCookie();

const storedCataloguePreferences = loadCataloguePreferences();
const allowedCatalogueIds = new Set(flattenCataloguePreferences(storedCataloguePreferences));
const catalogueAvailability = new Map();
Object.entries(storedCataloguePreferences).forEach(([mode, list]) => {
  catalogueAvailability.set(mode, Array.isArray(list) ? [...list] : []);
});

const catalogueGrid = document.getElementById('catalogueGrid');
const cataloguePagination = document.getElementById('cataloguePagination');
const catalogueHint = document.getElementById('catalogueHint');
const sessionSummary = document.getElementById('sessionSummary');
const sessionWeather = document.getElementById('sessionWeather');
const sessionMoon = document.getElementById('sessionMoon');
const sessionEvents = document.getElementById('sessionEvents');
const sessionDecision = document.getElementById('sessionDecision');
const sessionPanel = document.getElementById('sessionPanel');
const sessionContextToggle = document.getElementById('sessionContextToggle');
const sessionContextBody = document.getElementById('sessionContextBody');
const sortSelect = document.getElementById('catalogueSort');
const catalogueFilterSummary = document.getElementById('catalogueFilterSummary');
const catalogueTypeOptions = document.getElementById('catalogueTypeOptions');
const catalogueDifficultyOptions = document.getElementById('catalogueDifficultyOptions');
const catalogueSeasonOptions = document.getElementById('catalogueSeasonOptions');
const catalogueSelectionOptions = document.getElementById('catalogueSelectionOptions');
const selectAllCataloguesButton = document.getElementById('selectAllCatalogues');
const clearCatalogueSelectionButton = document.getElementById('clearCatalogueSelection');
const catalogueSelectionSummary = document.getElementById('catalogueSelectionSummary');
const catalogueSelectionBadge = document.getElementById('catalogueSelectionBadge');
const catalogueList = document.getElementById('catalogueList');
const nightModeToggle = document.getElementById('nightModeToggle');
const catalogueHeading = document.getElementById('catalogueTitle');
const catalogueSubheading = document.getElementById('catalogueSubtitle');
const catalogueSearchInput = document.getElementById('catalogueSearch');
const resetAllFiltersButton = document.getElementById('resetAllFilters');
const catalogueActiveFilters = document.getElementById('catalogueActiveFilters');
const typeFilterDetails = catalogueTypeOptions ? catalogueTypeOptions.closest('details') : null;
const difficultyFilterDetails = catalogueDifficultyOptions ? catalogueDifficultyOptions.closest('details') : null;
const seasonFilterDetails = catalogueSeasonOptions ? catalogueSeasonOptions.closest('details') : null;
const catalogueSelectionDetails = catalogueSelectionOptions ? catalogueSelectionOptions.closest('details') : null;

const FAVORI_CARD_CLASS = 'catalogue-card--favori';

function resolveObjectId(object) {
  if (!object) return null;
  if (typeof object.slug === 'string' && object.slug.trim().length > 0) {
    return object.slug;
  }
  if (object.primaryCatalogueId && Number.isFinite(object.number)) {
    return `${object.primaryCatalogueId}:${object.number}`;
  }
  if (typeof object.name === 'string' && object.name.trim().length > 0) {
    return object.name.trim();
  }
  return null;
}

function updateFavoriButtonState(button, isActive, objectName) {
  if (!button) return;
  const labelName = objectName || 'cet objet';
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  button.classList.toggle('favori-toggle--active', Boolean(isActive));
  button.textContent = isActive ? '★ Favori' : '☆ Favori';
  button.setAttribute(
    'aria-label',
    isActive ? `Retirer ${labelName} des favoris` : `Ajouter ${labelName} aux favoris`
  );
  button.title = isActive ? 'Retirer des favoris' : 'Ajouter aux favoris';
}

function sanitizeForId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function renderListPickerOptions(container, objectId) {
  if (!container) return;
  container.dataset.objectId = objectId || '';
  container.innerHTML = '';
  const listes = Favoris.getListes();
  if (!Array.isArray(listes) || listes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'list-picker__empty';
    empty.textContent = 'Aucune liste enregistrée pour l’instant.';
    container.appendChild(empty);
    return;
  }
  listes.forEach((liste) => {
    const label = document.createElement('label');
    label.className = 'list-picker__option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = liste.id;
    checkbox.dataset.action = 'list-membership';
    checkbox.dataset.listId = liste.id;
    checkbox.dataset.objectId = objectId || '';
    checkbox.checked = Array.isArray(liste.cibleIds) && liste.cibleIds.includes(objectId);
    const span = document.createElement('span');
    span.textContent = liste.nom;
    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function refreshCardActions(card) {
  if (!card) return;
  const objectId = card.dataset.objectId || null;
  const objectName = card.dataset.objectName || card.querySelector('h3')?.textContent || 'cet objet';
  const isFavori = objectId ? Favoris.isFavori(objectId) : false;
  card.classList.toggle(FAVORI_CARD_CLASS, Boolean(isFavori));
  const toggle = card.querySelector('[data-action="toggle-favori"]');
  updateFavoriButtonState(toggle, isFavori, objectName);
  const optionsContainer = card.querySelector('.list-picker__options');
  if (optionsContainer && objectId) {
    const picker = optionsContainer.closest('details');
    if (!optionsContainer.childElementCount || (picker && picker.open)) {
      renderListPickerOptions(optionsContainer, objectId);
    }
  }
}

function refreshAllCardActions() {
  if (!catalogueGrid) return;
  const cards = catalogueGrid.querySelectorAll('.catalogue-card');
  cards.forEach((card) => {
    refreshCardActions(card);
  });
}

function buildCardActions(object, objectId) {
  if (!objectId) {
    return null;
  }
  const container = document.createElement('div');
  container.className = 'catalogue-card__actions';
  container.dataset.objectId = objectId;
  if (object?.name) {
    container.dataset.objectName = object.name;
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'favori-toggle';
  toggle.dataset.action = 'toggle-favori';
  toggle.textContent = '☆ Favori';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-label', `Ajouter ${object?.name || 'cet objet'} aux favoris`);
  container.appendChild(toggle);

  const listPicker = document.createElement('details');
  listPicker.className = 'list-picker';
  const summary = document.createElement('summary');
  summary.textContent = 'Ajouter à une liste…';
  listPicker.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'list-picker__content';

  const form = document.createElement('form');
  form.className = 'list-picker__form';
  form.dataset.role = 'create-list-form';
  form.dataset.objectId = objectId;
  const field = document.createElement('div');
  field.className = 'list-picker__field';
  const label = document.createElement('label');
  const inputId = `list-name-${sanitizeForId(objectId)}`;
  label.setAttribute('for', inputId);
  label.className = 'list-picker__label';
  label.textContent = 'Créer une nouvelle liste';
  const input = document.createElement('input');
  input.type = 'text';
  input.id = inputId;
  input.name = 'nom';
  input.placeholder = 'Nom de la liste';
  input.required = true;
  input.autocomplete = 'off';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'list-picker__submit';
  submit.textContent = 'Créer';
  field.appendChild(label);
  field.appendChild(input);
  field.appendChild(submit);
  form.appendChild(field);

  const options = document.createElement('div');
  options.className = 'list-picker__options';
  options.dataset.role = 'list-options';
  options.dataset.objectId = objectId;

  content.appendChild(form);
  content.appendChild(options);
  listPicker.appendChild(content);
  container.appendChild(listPicker);

  listPicker.addEventListener('toggle', () => {
    if (listPicker.open) {
      renderListPickerOptions(options, objectId);
    }
  });

  return container;
}

let sessionContextPanelState = null;

Favoris.subscribe(() => {
  refreshAllCardActions();
});

function isCatalogueAllowed(id) {
  const normalized = normaliseCatalogueId(id);
  if (!normalized) {
    return false;
  }
  if (allowedCatalogueIds.size === 0) {
    return false;
  }
  return allowedCatalogueIds.has(normalized);
}

function initSessionContextPanel() {
  if (!sessionContextToggle || !sessionContextBody) {
    return;
  }
  const section = sessionContextToggle.closest('.panel');
  const showLabel = sessionContextToggle.dataset.labelShow || 'Afficher les détails du contexte';
  const hideLabel = sessionContextToggle.dataset.labelHide || 'Masquer les détails du contexte';
  sessionContextPanelState = {
    button: sessionContextToggle,
    body: sessionContextBody,
    section,
    showLabel,
    hideLabel,
    expanded: false,
    ready: false
  };
  sessionContextToggle.textContent = showLabel;
  sessionContextToggle.setAttribute('aria-expanded', 'false');
  sessionContextToggle.disabled = true;
  sessionContextBody.hidden = true;
  if (section) {
    section.classList.add('panel--collapsed');
    section.classList.remove('panel--expanded');
    section.classList.remove('panel--ready');
  }
  sessionContextToggle.addEventListener('click', () => {
    if (!sessionContextPanelState || !sessionContextPanelState.ready) {
      return;
    }
    setSessionContextPanelExpanded(!sessionContextPanelState.expanded);
  });
}

function setSessionContextPanelExpanded(expanded) {
  if (!sessionContextPanelState) {
    return;
  }
  sessionContextPanelState.expanded = expanded;
  const { button, body, section, showLabel, hideLabel } = sessionContextPanelState;
  if (button) {
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.textContent = expanded ? hideLabel : showLabel;
  }
  if (body) {
    if (typeof body.toggleAttribute === 'function') {
      body.toggleAttribute('hidden', !expanded);
    } else {
      body.hidden = !expanded;
    }
  }
  if (section) {
    section.classList.toggle('panel--expanded', expanded);
    section.classList.toggle('panel--collapsed', !expanded);
  }
}

function setSessionContextPanelReady(ready) {
  if (!sessionContextPanelState) {
    return;
  }
  sessionContextPanelState.ready = ready;
  if (sessionContextPanelState.button) {
    sessionContextPanelState.button.disabled = !ready;
  }
  if (!ready) {
    setSessionContextPanelExpanded(false);
  }
  if (sessionContextPanelState.section) {
    sessionContextPanelState.section.classList.toggle('panel--ready', ready);
  }
}

let activeSearchTerm = '';
let activeSearchLabel = '';

const PAGE_SIZE = 100;

const SORT_BY = {
  score: 'score',
  name: 'name',
  magnitude: 'magnitude'
};

const DIFFICULTY_BANDS = [
  { id: 'urban', label: 'Observation urbaine (Bortle 8 à 9)', min: 8, max: 9 },
  { id: 'suburban', label: 'Ciel suburbain (Bortle 6 à 7)', min: 6, max: 7 },
  { id: 'rural', label: 'Ciel rural (Bortle 4 à 5)', min: 4, max: 5 },
  { id: 'dark', label: 'Site très sombre (Bortle ≤ 3)', min: 0, max: 3 },
  { id: 'unknown', label: 'Niveau non précisé' }
];

const DIFFICULTY_LABELS = new Map(DIFFICULTY_BANDS.map((band) => [band.id, band.label]));

const SEASON_GROUPS = [
  { id: 'winter', label: 'Hiver (décembre à février)', months: [12, 1, 2] },
  { id: 'spring', label: 'Printemps (mars à mai)', months: [3, 4, 5] },
  { id: 'summer', label: 'Été (juin à août)', months: [6, 7, 8] },
  { id: 'autumn', label: 'Automne (septembre à novembre)', months: [9, 10, 11] },
  { id: 'all-year', label: 'Toute l’année' }
];

const SEASON_LABELS = new Map(SEASON_GROUPS.map((season) => [season.id, season.label]));

function formatCatalogueList(ids = [], catalogues = []) {
  if (!ids || ids.length === 0) {
    return '—';
  }
  const meta = new Map();
  if (Array.isArray(catalogues) && catalogues.length > 0) {
    catalogues.forEach((catalogue) => {
      const normalizedId = normaliseCatalogueId(catalogue.id);
      if (normalizedId) {
        meta.set(normalizedId, catalogue);
      }
    });
  } else if (catalogueIdIndex.size > 0) {
    catalogueIdIndex.forEach((catalogue, key) => {
      meta.set(key, catalogue);
    });
  }
  return ids
    .map((id) => {
      const catalogue = meta.get(normaliseCatalogueId(id));
      if (!catalogue) return id.toUpperCase();
      if (catalogue.abbreviation) {
        return `${catalogue.abbreviation}`;
      }
      return catalogue.name;
    })
    .join(' • ');
}

function formatObservationModeLabel(mode) {
  if (!mode) return null;
  const normalized = mode.toLowerCase();
  if (normalized === 'visual') return 'Observation visuelle';
  if (normalized === 'astrophoto') return 'Astrophotographie';
  if (normalized === 'research') return 'Visuel assisté (EAA)';
  return mode;
}

function normaliseSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildSearchCorpus(object) {
  if (!object) return '';
  const numericId = Number(object.number);
  const parts = [
    object.name,
    object.designation,
    Number.isFinite(numericId) ? ` ${numericId}` : '',
    object.type,
    object.category,
    object.constellation,
    Array.isArray(object.catalogueRefs) ? object.catalogueRefs.join(' ') : ''
  ];
  return normaliseSearchText(parts.filter(Boolean).join(' '));
}

function setActiveSearchValue(value) {
  const label = String(value || '').trim();
  const term = normaliseSearchText(value);
  const changed = label !== activeSearchLabel || term !== activeSearchTerm;
  activeSearchLabel = label;
  activeSearchTerm = term;
  return changed;
}

function escapeForQuery(value) {
  if (typeof value !== 'string') return value;
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function queryFilterInput(container, value) {
  if (!container) return null;
  const escaped = escapeForQuery(String(value));
  try {
    return container.querySelector(`input[value="${escaped}"]`);
  } catch (error) {
    return Array.from(container.querySelectorAll('input')).find((input) => input.value === value) || null;
  }
}

function updateNightModeLabel(enabled = document.body.classList.contains('night-mode')) {
  if (!nightModeToggle) {
    return;
  }
  const key = enabled ? 'actions.nightDisable' : 'actions.nightToggle';
  const text = translate(key);
  if (text && text !== key) {
    nightModeToggle.textContent = text;
  } else {
    nightModeToggle.textContent = enabled ? '🌅 Mode jour' : '🔦 Mode nuit';
  }
}

function applyNightMode(enabled, { persist = true } = {}) {
  document.body.classList.toggle('night-mode', enabled);
  if (nightModeToggle) {
    nightModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    nightModeToggle.classList.toggle('is-active', enabled);
    updateNightModeLabel(enabled);
  }
  if (persist) {
    try {
      localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
    } catch (error) {
      console.warn('Impossible de sauvegarder le mode nuit :', error);
    }
  }
}

function initNightMode() {
  let stored = null;
  try {
    stored = localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  const enabled = stored === '1' || stored === 'true';
  applyNightMode(enabled, { persist: false });
}

initNightMode();
if (nightModeToggle) {
  nightModeToggle.addEventListener('click', () => {
    const next = !document.body.classList.contains('night-mode');
    applyNightMode(next);
  });
  updateNightModeLabel();
}

onLanguageChange(() => {
  updateNightModeLabel();
});

if (catalogueSearchInput) {
  setActiveSearchValue(catalogueSearchInput.value || '');
  catalogueSearchInput.addEventListener('input', (event) => {
    const changed = setActiveSearchValue(event.target.value || '');
    updateCatalogue({ resetPage: changed });
  });
}

if (resetAllFiltersButton) {
  resetAllFiltersButton.addEventListener('click', () => {
    if (resetAllFiltersButton.disabled) return;
    clearAllFilters();
  });
}

const SCORE_CLASSES = {
  high: 'score-good',
  medium: 'score-medium',
  low: 'score-low',
  none: 'score-none'
};

let catalogueDefinitions = [];
let catalogueIdIndex = new Map();
let activeCatalogueIds = null;
let catalogueEntries = [];
let currentSort = SORT_BY.score;
let activeTypeFilters = [];
let activeDifficultyFilters = [];
let activeSeasonFilters = [];
let catalogueSources = new Map();
let currentPage = 1;
const catalogueLoadPromises = new Map();
const loadedCatalogueIds = new Set();
const objectSlugIndex = new Map();
const catalogueObjectCounts = new Map();
let rawCatalogueObjects = [];
let enrichedCatalogueObjects = [];
let lastSessionSnapshot = null;

function registerInitialObjects(objects = []) {
  objectSlugIndex.clear();
  rawCatalogueObjects = [];
  enrichedCatalogueObjects = [];
  catalogueObjectCounts.clear();
  if (!Array.isArray(objects)) return;
  const filtered = filterObjectsForPreferences(objects, storedCataloguePreferences);
  appendCatalogueObjects(filtered);
}

function appendCatalogueObjects(objects = []) {
  if (!Array.isArray(objects) || objects.length === 0) {
    return [];
  }
  const scoped = filterObjectsForPreferences(objects, storedCataloguePreferences);
  const added = [];
  scoped.forEach((object) => {
    if (!object || !object.slug) return;
    if (objectSlugIndex.has(object.slug)) {
      return;
    }
    objectSlugIndex.set(object.slug, object);
    rawCatalogueObjects.push(object);
    added.push(object);
  });
  if (added.length > 0) {
    enrichedCatalogueObjects = enrichCatalogueData(rawCatalogueObjects);
    recalculateCatalogueCounts();
  }
  return added;
}

function recalculateCatalogueCounts() {
  catalogueObjectCounts.clear();
  const counts = countObjectsByCatalogue(enrichedCatalogueObjects);
  counts.forEach((value, key) => {
    catalogueObjectCounts.set(key, value);
  });
  renderCatalogueList(catalogueDefinitions);
}

async function ensureCatalogueObjects(ids = [], { refreshUI = true } = {}) {
  const requested = normaliseCatalogueIdList(ids).filter((id) => isCatalogueAllowed(id));
  const toLoad = requested.filter((id) => {
    if (loadedCatalogueIds.has(id)) return false;
    if (catalogueLoadPromises.has(id)) return true;
    const source = catalogueSources.get(id);
    return source && source.url;
  });
  if (toLoad.length === 0) {
    return [];
  }
  const promises = toLoad.map((id) => {
    if (catalogueLoadPromises.has(id)) {
      return catalogueLoadPromises.get(id);
    }
    const loadPromise = (async () => {
      try {
        const objects = await fetchCatalogueObjectsFromSource(id, catalogueSources);
        if (Array.isArray(objects) && objects.length > 0) {
          const added = appendCatalogueObjects(objects);
          loadedCatalogueIds.add(id);
          return added;
        }
        loadedCatalogueIds.add(id);
        return [];
      } catch (error) {
        console.error(`Impossible de charger le catalogue ${id} :`, error);
        throw error;
      } finally {
        catalogueLoadPromises.delete(id);
      }
    })();
    catalogueLoadPromises.set(id, loadPromise);
    return loadPromise;
  });
  const settled = await Promise.allSettled(promises);
  const collected = [];
  let encounteredError = false;
  settled.forEach((result) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      collected.push(...result.value);
    } else if (result.status === 'rejected') {
      encounteredError = true;
    }
  });
  if (encounteredError && catalogueHint) {
    catalogueHint.textContent =
      'Certains catalogues distants n’ont pas pu être chargés. Réessaie plus tard ou vérifie ta connexion.';
  }
  if (collected.length > 0 && refreshUI) {
    const selectionObjects = filterObjectsByCatalogue(enrichedCatalogueObjects, activeCatalogueIds);
    populateCatalogueFilters(selectionObjects);
    updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
  }
  return collected;
}

function prefetchRemainingCatalogues() {
  if (!Array.isArray(catalogueDefinitions) || catalogueDefinitions.length === 0) {
    return;
  }
  const remainingIds = catalogueDefinitions
    .map((catalogue) => normaliseCatalogueId(catalogue.id))
    .filter((id) => id && !loadedCatalogueIds.has(id) && isCatalogueAllowed(id));
  if (remainingIds.length === 0) {
    return;
  }
  ensureCatalogueObjects(remainingIds, { refreshUI: false })
    .then(() => {
      updateCatalogueSelectionControls();
      const selectionObjects = filterObjectsByCatalogue(enrichedCatalogueObjects, activeCatalogueIds);
      populateCatalogueFilters(selectionObjects);
      catalogueEntries = mergeMetrics(selectionObjects, lastSessionSnapshot);
      updateCatalogue();
    })
    .catch((error) => {
      console.error('Préchargement des catalogues incomplet :', error);
    });
}

function buildSourceSummary(ids = []) {
  const details = ids
    .map((id) => getCatalogueSourceSummary(normaliseCatalogueId(id), catalogueSources))
    .filter((info) => info && info.description)
    .map((info) => {
      const license = info.license ? ` (${info.license})` : '';
      return `${info.description}${license}`;
    });
  if (details.length === 0) {
    return '';
  }
  return `Sources : ${details.join(' • ')}.`;
}

function getSelectionIds(selection = activeCatalogueIds) {
  if (selection === null) {
    return Array.isArray(catalogueDefinitions)
      ? catalogueDefinitions
          .map((catalogue) => normaliseCatalogueId(catalogue.id))
          .filter(Boolean)
      : [];
  }
  if (Array.isArray(selection)) {
    return normaliseCatalogueIdList(selection);
  }
  return [];
}

function hasActiveCatalogueSelection(selection = activeCatalogueIds) {
  if (selection === null) {
    return Array.isArray(catalogueDefinitions) && catalogueDefinitions.length > 0;
  }
  if (!Array.isArray(selection)) {
    return false;
  }
  return normaliseCatalogueIdList(selection).length > 0;
}

function formatCatalogueOptionLabel(catalogue) {
  if (!catalogue) return '';
  const abbr = (catalogue.abbreviation || '').trim();
  const name = (catalogue.name || '').trim();
  if (abbr && name && abbr !== name) {
    return `${abbr} — ${name}`;
  }
  return name || abbr || (catalogue.id ? catalogue.id.toUpperCase() : '');
}

function shouldCatalogueBeChecked(id) {
  const normalized = normaliseCatalogueId(id);
  if (!normalized) return false;
  if (activeCatalogueIds === null) return true;
  if (!Array.isArray(activeCatalogueIds)) return false;
  return activeCatalogueIds.includes(normalized);
}

function readCatalogueSelectionFromUI() {
  if (!catalogueSelectionOptions) {
    return activeCatalogueIds;
  }
  const inputs = Array.from(catalogueSelectionOptions.querySelectorAll('input[type="checkbox"]'));
  if (inputs.length === 0) {
    return activeCatalogueIds;
  }
  const selected = inputs
    .filter((input) => input.checked)
    .map((input) => normaliseCatalogueId(input.value))
    .filter(Boolean);
  if (selected.length === 0) {
    return [];
  }
  if (selected.length === inputs.length) {
    return null;
  }
  return selected;
}

function updateCatalogueSelectionBadge(totalCatalogues = 0) {
  if (!catalogueSelectionBadge) return;
  if (!Number.isFinite(totalCatalogues) || totalCatalogues <= 0) {
    catalogueSelectionBadge.textContent = '';
    catalogueSelectionBadge.hidden = true;
    catalogueSelectionBadge.removeAttribute('aria-label');
    catalogueSelectionBadge.removeAttribute('title');
    return;
  }
  let label = '';
  let description = '';
  if (activeCatalogueIds === null) {
    label = 'Tous';
    description = 'Tous les catalogues sont affichés';
  } else if (Array.isArray(activeCatalogueIds) && activeCatalogueIds.length === 0) {
    label = 'Aucun';
    description = 'Aucun catalogue sélectionné';
  } else {
    const count = getSelectionIds().length;
    if (count <= 0) {
      label = 'Aucun';
      description = 'Aucun catalogue sélectionné';
    } else {
      label = `${count}/${totalCatalogues}`;
      description = `${count} catalogue${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''} sur ${totalCatalogues}`;
    }
  }
  if (!label) {
    catalogueSelectionBadge.textContent = '';
    catalogueSelectionBadge.hidden = true;
    catalogueSelectionBadge.removeAttribute('aria-label');
    catalogueSelectionBadge.removeAttribute('title');
    return;
  }
  catalogueSelectionBadge.textContent = label;
  catalogueSelectionBadge.hidden = false;
  if (description) {
    catalogueSelectionBadge.setAttribute('aria-label', description);
    catalogueSelectionBadge.setAttribute('title', description);
  } else {
    catalogueSelectionBadge.removeAttribute('aria-label');
    catalogueSelectionBadge.removeAttribute('title');
  }
}

function updateCatalogueSelectionSummary() {
  if (!catalogueSelectionSummary) return;
  const totalCatalogues = Array.isArray(catalogueDefinitions) ? catalogueDefinitions.length : 0;
  updateCatalogueSelectionBadge(totalCatalogues);
  if (totalCatalogues === 0) {
    catalogueSelectionSummary.textContent = 'Aucun catalogue disponible pour le moment.';
    return;
  }
  if (!hasActiveCatalogueSelection()) {
    catalogueSelectionSummary.textContent =
      'Aucun catalogue sélectionné. Utilise les cases à cocher ci-dessus pour afficher des objets.';
    return;
  }
  const selectionIds = getSelectionIds();
  const list = selectionIds.length > 0 ? formatCatalogueList(selectionIds, catalogueDefinitions) : '';
  if (activeCatalogueIds === null) {
    catalogueSelectionSummary.textContent = list
      ? `Tous les ${totalCatalogues} catalogues sont affichés (${list}).`
      : `Tous les ${totalCatalogues} catalogues sont affichés.`;
    return;
  }
  const count = selectionIds.length;
  if (count === 0) {
    catalogueSelectionSummary.textContent =
      'Aucun catalogue sélectionné. Utilise les cases à cocher ci-dessus pour afficher des objets.';
    return;
  }
  const label = list && list !== '—' ? list : selectionIds.join(', ');
  catalogueSelectionSummary.textContent =
    count === 1 ? `Catalogue affiché : ${label}.` : `${count} catalogues affichés : ${label}.`;
}

async function applyCatalogueSelection(selection) {
  const normalizedSelection = selection === null ? null : normaliseCatalogueIdList(selection);
  const selectionIds = getSelectionIds(normalizedSelection);
  activeCatalogueIds = normalizedSelection === null ? null : selectionIds;
  const pending = selectionIds.filter((id) => !loadedCatalogueIds.has(id));
  if (pending.length > 0 && catalogueHint) {
    catalogueHint.textContent = 'Chargement des catalogues sélectionnés…';
  }
  if (selectionIds.length > 0) {
    try {
      await ensureCatalogueObjects(selectionIds, { refreshUI: false });
    } catch (error) {
      console.error('Impossible de charger certains catalogues sélectionnés :', error);
      if (catalogueHint) {
        catalogueHint.textContent =
          'Impossible de télécharger certains catalogues pour le moment. Vérifie ta connexion ou réessaie plus tard.';
      }
    }
  }
  const selectionObjects = filterObjectsByCatalogue(enrichedCatalogueObjects, activeCatalogueIds);
  catalogueEntries = mergeMetrics(selectionObjects, lastSessionSnapshot);
  populateCatalogueFilters(selectionObjects);
  updateCatalogue({ resetPage: true });
  updateCatalogueSelectionControls();
}

function updateCatalogueSelectionControls() {
  if (!catalogueSelectionOptions) return;
  catalogueSelectionOptions.innerHTML = '';
  if (!Array.isArray(catalogueDefinitions) || catalogueDefinitions.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent =
      allowedCatalogueIds.size === 0
        ? 'Aucun catalogue n’est activé dans les préférences. Rendez-vous sur la page dédiée pour en ajouter.'
        : 'Aucun catalogue disponible pour le moment.';
    catalogueSelectionOptions.appendChild(info);
    if (selectAllCataloguesButton) {
      selectAllCataloguesButton.disabled = true;
    }
    if (clearCatalogueSelectionButton) {
      clearCatalogueSelectionButton.disabled = true;
    }
    updateCatalogueSelectionSummary();
    return;
  }
  catalogueDefinitions.forEach((catalogue) => {
    const normalizedId = normaliseCatalogueId(catalogue.id);
    if (!normalizedId) {
      return;
    }
    const label = document.createElement('label');
    label.className = 'filter-option';
    label.classList.add('filter-option--catalogue');
    if (catalogue.description) {
      label.title = catalogue.description;
    }
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = catalogue.id;
    checkbox.checked = shouldCatalogueBeChecked(catalogue.id);
    checkbox.addEventListener('change', () => {
      const nextSelection = readCatalogueSelectionFromUI();
      applyCatalogueSelection(nextSelection).catch((error) => {
        console.error('Impossible de mettre à jour la sélection de catalogues :', error);
      });
    });
    const count = catalogueObjectCounts.get(normalizedId);
    let countText = '…';
    if (Number.isFinite(count)) {
      countText = count.toLocaleString('fr-FR');
    } else if (loadedCatalogueIds.has(normalizedId)) {
      countText = '0';
    }
    const content = document.createElement('span');
    content.className = 'filter-option__content';
    const nameLine = document.createElement('span');
    nameLine.className = 'filter-option__label';
    nameLine.textContent = `${formatCatalogueOptionLabel(catalogue)} (${countText})`;
    content.appendChild(nameLine);
    const metaParts = [];
    if (catalogue.focus) {
      metaParts.push(catalogue.focus);
    }
    if (catalogue.coverage) {
      metaParts.push(catalogue.coverage);
    } else if (catalogue.type) {
      metaParts.push(catalogue.type);
    }
    if (metaParts.length > 0) {
      const meta = document.createElement('span');
      meta.className = 'filter-option__meta';
      meta.textContent = metaParts.join(' • ');
      content.appendChild(meta);
    }
    label.appendChild(checkbox);
    label.appendChild(content);
    catalogueSelectionOptions.appendChild(label);
  });
  if (selectAllCataloguesButton) {
    selectAllCataloguesButton.disabled = false;
  }
  if (clearCatalogueSelectionButton) {
    clearCatalogueSelectionButton.disabled = false;
  }
  updateCatalogueSelectionSummary();
  renderCatalogueList(catalogueDefinitions);
}

function renderCatalogueList(catalogues = []) {
  if (!catalogueList) return;
  catalogueList.innerHTML = '';
  if (!Array.isArray(catalogues) || catalogues.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'help-text';
    empty.textContent = 'Aucun catalogue disponible pour le moment.';
    catalogueList.appendChild(empty);
    return;
  }
  const selectionIds = new Set(getSelectionIds());
  const highlightAll = activeCatalogueIds === null;
  catalogues.forEach((catalogue) => {
    const normalizedId = normaliseCatalogueId(catalogue.id);
    if (!normalizedId) {
      return;
    }
    const item = document.createElement('article');
    item.className = 'catalogue-list__item';
    item.dataset.catalogue = normalizedId;
    item.setAttribute('role', 'listitem');
    if (highlightAll || selectionIds.has(normalizedId)) {
      item.classList.add('catalogue-list__item--active');
    }

    const header = document.createElement('header');
    header.className = 'catalogue-list__header';
    if (catalogue.abbreviation) {
      const badge = document.createElement('span');
      badge.className = 'catalogue-list__abbr';
      badge.textContent = catalogue.abbreviation;
      header.appendChild(badge);
    }
    const title = document.createElement('h3');
    title.className = 'catalogue-list__title';
    title.textContent = catalogue.name || catalogue.abbreviation || normalizedId.toUpperCase();
    header.appendChild(title);
    item.appendChild(header);

    const metaParts = [];
    if (catalogue.focus) {
      metaParts.push(catalogue.focus);
    }
    if (catalogue.coverage) {
      metaParts.push(catalogue.coverage);
    } else if (catalogue.type) {
      metaParts.push(catalogue.type);
    }
    if (metaParts.length > 0) {
      const meta = document.createElement('p');
      meta.className = 'catalogue-list__tagline';
      meta.textContent = metaParts.join(' • ');
      item.appendChild(meta);
    }

    if (catalogue.description) {
      const description = document.createElement('p');
      description.className = 'catalogue-list__description';
      description.textContent = catalogue.description;
      item.appendChild(description);
    }

    const count = catalogueObjectCounts.get(normalizedId);
    const countLine = document.createElement('div');
    countLine.className = 'catalogue-list__count';
    if (Number.isFinite(count)) {
      const plural = count > 1 ? 's' : '';
      const value = document.createElement('strong');
      value.className = 'catalogue-list__count-value';
      value.textContent = count.toLocaleString('fr-FR');
      const suffix = document.createElement('span');
      suffix.className = 'catalogue-list__count-label';
      suffix.textContent = ` objet${plural} disponibles`;
      countLine.appendChild(value);
      countLine.appendChild(suffix);
    } else if (loadedCatalogueIds.has(normalizedId)) {
      const empty = document.createElement('span');
      empty.className = 'catalogue-list__count-label';
      empty.textContent = 'Aucun objet disponible';
      countLine.appendChild(empty);
    } else {
      const pending = document.createElement('span');
      pending.className = 'catalogue-list__count-label';
      pending.textContent = 'Chargement…';
      countLine.appendChild(pending);
    }
    item.appendChild(countLine);

    catalogueList.appendChild(item);
  });
}

function updateCatalogueSummary(filteredObjects = [], snapshot = null) {
  const selectionIds = getSelectionIds();
  const hasSelection = hasActiveCatalogueSelection();
  const selectionList = selectionIds.length > 0 ? formatCatalogueList(selectionIds, catalogueDefinitions) : '';
  let displayedSelection;
  if (!hasSelection) {
    displayedSelection = 'aucun catalogue';
  } else if (activeCatalogueIds === null) {
    displayedSelection = selectionList ? `tous les catalogues (${selectionList})` : 'tous les catalogues';
  } else {
    displayedSelection = selectionList && selectionList !== '—' ? selectionList : 'catalogue sélectionné';
  }
  const total = filteredObjects.length;
  let baseMessage;
  if (!hasSelection) {
    baseMessage = 'Sélectionne au moins un catalogue pour afficher des objets.';
  } else if (total === 0) {
    baseMessage = 'Aucun objet n’est encore disponible pour cette sélection.';
  } else {
    baseMessage = `${total} objets disponibles`;
  }
  const suffix = snapshot
    ? 'Triés automatiquement par score décroissant. Clique sur une vignette pour ouvrir la fiche détaillée.'
    :
        'Les scores de visibilité seront ajoutés après ta prochaine analyse. Clique sur une vignette pour consulter la fiche détaillée.';
  const sourceText = buildSourceSummary(selectionIds);
  if (catalogueHint) {
    const hint = `${baseMessage} — sélection : ${displayedSelection}. ${suffix}`;
    catalogueHint.textContent = sourceText ? `${hint} ${sourceText}` : hint;
  }
  if (catalogueHeading) {
    if (!hasSelection) {
      catalogueHeading.textContent = 'Catalogue d’observation';
    } else if (activeCatalogueIds === null) {
      catalogueHeading.textContent = 'Catalogue : tous les catalogues';
    } else if (selectionList && selectionList !== '—') {
      catalogueHeading.textContent = `Catalogue : ${selectionList}`;
    } else {
      catalogueHeading.textContent = 'Catalogue d’observation';
    }
  }
  if (catalogueSubheading) {
    const modeLabel = formatObservationModeLabel(snapshot?.context?.observationMode);
    if (!hasSelection) {
      catalogueSubheading.textContent = modeLabel
        ? `Mode ${modeLabel} — aucun catalogue sélectionné`
        : 'Aucun catalogue sélectionné pour le moment.';
    } else {
      const modeText = modeLabel
        ? `Mode ${modeLabel} — catalogues ${displayedSelection}`
        : `Catalogues sélectionnés : ${displayedSelection}`;
      catalogueSubheading.textContent = modeText;
    }
  }
  updateCatalogueSelectionSummary();
}

function normaliseScore(value) {
  return Number.isFinite(value) ? value : -1;
}

function sortEntries(entries, sortMode) {
  const sorted = [...entries];
  if (sortMode === SORT_BY.score) {
    sorted.sort((a, b) => {
      const scoreDiff = normaliseScore(b.metrics?.score) - normaliseScore(a.metrics?.score);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return (a.object.name || '').localeCompare(b.object.name || '', 'fr', { sensitivity: 'base' });
    });
    return sorted;
  }
  if (sortMode === SORT_BY.magnitude) {
    sorted.sort((a, b) => {
      const magDiff = (a.object.magnitude ?? Infinity) - (b.object.magnitude ?? Infinity);
      if (magDiff !== 0) {
        return magDiff;
      }
      return (a.object.name || '').localeCompare(b.object.name || '', 'fr', { sensitivity: 'base' });
    });
    return sorted;
  }
  sorted.sort((a, b) => (a.object.name || '').localeCompare(b.object.name || '', 'fr', { sensitivity: 'base' }));
  return sorted;
}

function readTypeSelection() {
  if (!catalogueTypeOptions) return [];
  return Array.from(catalogueTypeOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function readDifficultySelection() {
  if (!catalogueDifficultyOptions) return [];
  return Array.from(catalogueDifficultyOptions.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value
  );
}

function readSeasonSelection() {
  if (!catalogueSeasonOptions) return [];
  return Array.from(catalogueSeasonOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function updateCatalogueFilterSummary(count = 0, total = 0) {
  if (!catalogueFilterSummary) return;
  if (!hasActiveCatalogueSelection()) {
    catalogueFilterSummary.textContent =
      'Aucun catalogue sélectionné. Active une case dans le filtre ci-dessus pour afficher des objets.';
    return;
  }
  if (total === 0) {
    catalogueFilterSummary.textContent = 'Catalogue en cours de préparation.';
    return;
  }
  const activeFilters = [];
  if (activeSearchLabel) {
    activeFilters.push(`recherche (« ${activeSearchLabel} »)`);
  }
  if (activeTypeFilters.length > 0) {
    activeFilters.push(`types (${activeTypeFilters.join(', ')})`);
  }
  if (activeDifficultyFilters.length > 0) {
    const labels = activeDifficultyFilters.map((id) => DIFFICULTY_LABELS.get(id) || id);
    activeFilters.push(`difficulté (${labels.join(', ')})`);
  }
  if (activeSeasonFilters.length > 0) {
    const labels = activeSeasonFilters.map((id) => SEASON_LABELS.get(id) || id);
    activeFilters.push(`période (${labels.join(', ')})`);
  }

  if (activeFilters.length === 0 && count === total) {
    catalogueFilterSummary.textContent = 'Aucun filtre actif : tous les objets sélectionnés sont affichés.';
    return;
  }

  if (count === 0) {
    const details = activeFilters.length > 0 ? ` (${activeFilters.join(' · ')})` : '';
    catalogueFilterSummary.textContent =
      `Aucun objet ne correspond aux filtres appliqués${details}. Réinitialise les filtres pour revoir toute la sélection.`;
    return;
  }

  const details = activeFilters.length > 0 ? ` selon ${activeFilters.join(' · ')}` : '';
  catalogueFilterSummary.textContent = `${count} objet${count > 1 ? 's' : ''} sur ${total} correspondent aux filtres${details}.`;
}

function hasCustomCatalogueSelection() {
  if (!Array.isArray(catalogueDefinitions) || catalogueDefinitions.length === 0) {
    return false;
  }
  if (activeCatalogueIds === null) {
    return false;
  }
  const selected = getSelectionIds(activeCatalogueIds);
  return selected.length > 0 && selected.length < catalogueDefinitions.length;
}

function syncFilterDetailState(detailsElement, hasActive, { autoOpen = true } = {}) {
  if (!detailsElement) return;
  if (hasActive) {
    detailsElement.dataset.active = 'true';
    if (autoOpen) {
      detailsElement.open = true;
    }
  } else {
    delete detailsElement.dataset.active;
  }
}

function collectActiveFilterDescriptors() {
  const descriptors = [];
  if (activeSearchLabel) {
    descriptors.push({
      group: 'search',
      id: 'search',
      label: `Recherche : « ${activeSearchLabel} »`
    });
  }
  activeTypeFilters.forEach((value) => {
    descriptors.push({ group: 'type', id: value, label: value });
  });
  activeDifficultyFilters.forEach((value) => {
    descriptors.push({
      group: 'difficulty',
      id: value,
      label: DIFFICULTY_LABELS.get(value) || value
    });
  });
  activeSeasonFilters.forEach((value) => {
    descriptors.push({
      group: 'season',
      id: value,
      label: SEASON_LABELS.get(value) || value
    });
  });
  return descriptors;
}

function renderActiveFilterChips() {
  if (!catalogueActiveFilters) return;
  catalogueActiveFilters.innerHTML = '';
  const descriptors = collectActiveFilterDescriptors();
  if (descriptors.length === 0) {
    const span = document.createElement('span');
    span.className = 'help-text--inline';
    span.textContent = 'Aucun filtre supplémentaire n’est appliqué.';
    catalogueActiveFilters.appendChild(span);
    if (resetAllFiltersButton) {
      resetAllFiltersButton.disabled = true;
    }
  } else {
    descriptors.forEach((descriptor) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      const label = document.createElement('span');
      label.className = 'filter-chip__label';
      label.textContent = descriptor.label;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'filter-chip__remove';
      removeBtn.setAttribute('aria-label', `Supprimer le filtre ${descriptor.label}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        if (descriptor.group === 'search') {
          setActiveSearchValue('');
          if (catalogueSearchInput) {
            catalogueSearchInput.value = '';
            catalogueSearchInput.focus();
          }
        } else if (descriptor.group === 'type') {
          const input = queryFilterInput(catalogueTypeOptions, descriptor.id);
          if (input) input.checked = false;
          activeTypeFilters = activeTypeFilters.filter((value) => value !== descriptor.id);
        } else if (descriptor.group === 'difficulty') {
          const input = queryFilterInput(catalogueDifficultyOptions, descriptor.id);
          if (input) input.checked = false;
          activeDifficultyFilters = activeDifficultyFilters.filter((value) => value !== descriptor.id);
        } else if (descriptor.group === 'season') {
          const input = queryFilterInput(catalogueSeasonOptions, descriptor.id);
          if (input) input.checked = false;
          activeSeasonFilters = activeSeasonFilters.filter((value) => value !== descriptor.id);
        }
        updateCatalogue({ resetPage: true });
      });
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      catalogueActiveFilters.appendChild(chip);
    });
    if (resetAllFiltersButton) {
      resetAllFiltersButton.disabled = false;
    }
  }
  syncFilterDetailState(typeFilterDetails, activeTypeFilters.length > 0);
  syncFilterDetailState(difficultyFilterDetails, activeDifficultyFilters.length > 0);
  syncFilterDetailState(seasonFilterDetails, activeSeasonFilters.length > 0);
  syncFilterDetailState(catalogueSelectionDetails, hasCustomCatalogueSelection(), { autoOpen: false });
}

function clearAllFilters() {
  if (catalogueTypeOptions) {
    catalogueTypeOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  }
  if (catalogueDifficultyOptions) {
    catalogueDifficultyOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  }
  if (catalogueSeasonOptions) {
    catalogueSeasonOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  }
  activeTypeFilters = [];
  activeDifficultyFilters = [];
  activeSeasonFilters = [];
  setActiveSearchValue('');
  if (catalogueSearchInput) {
    catalogueSearchInput.value = '';
    catalogueSearchInput.focus();
  }
  updateCatalogue({ resetPage: true });
}

const DEFAULT_CATEGORY_LABEL = 'Objet céleste';

function resolveObjectCategory(object) {
  if (!object) return DEFAULT_CATEGORY_LABEL;
  const label = (object.category || object.type || '').trim();
  return label || DEFAULT_CATEGORY_LABEL;
}

function resolveDifficultyBandId(object) {
  const value = Number(object?.minBortle);
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  if (value >= 8) return 'urban';
  if (value >= 6) return 'suburban';
  if (value >= 4) return 'rural';
  return 'dark';
}

function resolveSeasonTags(object) {
  const months = Array.isArray(object?.bestMonths)
    ? object.bestMonths
        .map((month) => Number(month))
        .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    : [];
  if (months.length === 0) {
    return ['all-year'];
  }
  const uniqueMonths = Array.from(new Set(months));
  if (uniqueMonths.length >= 10) {
    return ['all-year'];
  }
  const tags = SEASON_GROUPS.filter((season) => Array.isArray(season.months)).reduce((acc, season) => {
    const matches = season.months.some((month) => uniqueMonths.includes(month));
    if (matches) {
      acc.push(season.id);
    }
    return acc;
  }, []);
  if (tags.length === 0) {
    return ['all-year'];
  }
  const definedSeasons = SEASON_GROUPS.filter((season) => Array.isArray(season.months)).length;
  if (tags.length === definedSeasons) {
    return ['all-year'];
  }
  return tags;
}

function applyFilters(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(({ object }) => {
    if (activeSearchTerm) {
      const corpus = buildSearchCorpus(object);
      if (!corpus.includes(activeSearchTerm)) {
        return false;
      }
    }
    const category = resolveObjectCategory(object);
    if (activeTypeFilters.length > 0 && !activeTypeFilters.includes(category)) {
      return false;
    }
    const difficultyId = resolveDifficultyBandId(object);
    if (activeDifficultyFilters.length > 0 && !activeDifficultyFilters.includes(difficultyId)) {
      return false;
    }
    const seasons = resolveSeasonTags(object);
    if (activeSeasonFilters.length > 0 && !seasons.some((season) => activeSeasonFilters.includes(season))) {
      return false;
    }
    return true;
  });
}

function populateCatalogueTypeFilter(objects) {
  if (!catalogueTypeOptions) return;
  catalogueTypeOptions.innerHTML = '';
  const counts = new Map();
  objects.forEach((object) => {
    const category = resolveObjectCategory(object);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  const categories = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  activeTypeFilters = activeTypeFilters.filter((category) => categories.includes(category));
  if (categories.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Aucun type détecté dans le catalogue.';
    catalogueTypeOptions.appendChild(info);
    return;
  }
  categories.forEach((category) => {
    const label = document.createElement('label');
    label.className = 'filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = category;
    checkbox.checked = activeTypeFilters.includes(category);
    checkbox.addEventListener('change', () => {
      activeTypeFilters = readTypeSelection();
      updateCatalogue({ resetPage: true });
    });
    const span = document.createElement('span');
    const count = counts.get(category) || 0;
    span.textContent = count > 0 ? `${category} (${count})` : category;
    label.appendChild(checkbox);
    label.appendChild(span);
    catalogueTypeOptions.appendChild(label);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'link-button';
  resetBtn.textContent = 'Réinitialiser';
  resetBtn.addEventListener('click', () => {
    catalogueTypeOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    activeTypeFilters = [];
    updateCatalogue({ resetPage: true });
  });
  catalogueTypeOptions.appendChild(resetBtn);
}

function populateCatalogueDifficultyFilter(objects) {
  if (!catalogueDifficultyOptions) return;
  catalogueDifficultyOptions.innerHTML = '';
  const counts = new Map();
  objects.forEach((object) => {
    const id = resolveDifficultyBandId(object);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  const availableBands = DIFFICULTY_BANDS.filter((band) => (counts.get(band.id) || 0) > 0);
  activeDifficultyFilters = activeDifficultyFilters.filter((id) => availableBands.some((band) => band.id === id));
  if (availableBands.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Aucun niveau de difficulté n’est disponible pour cette sélection.';
    catalogueDifficultyOptions.appendChild(info);
    return;
  }
  availableBands.forEach((band) => {
    const label = document.createElement('label');
    label.className = 'filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = band.id;
    checkbox.checked = activeDifficultyFilters.includes(band.id);
    checkbox.addEventListener('change', () => {
      activeDifficultyFilters = readDifficultySelection();
      updateCatalogue({ resetPage: true });
    });
    const span = document.createElement('span');
    const count = counts.get(band.id) || 0;
    span.textContent = count > 0 ? `${band.label} (${count})` : band.label;
    label.appendChild(checkbox);
    label.appendChild(span);
    catalogueDifficultyOptions.appendChild(label);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'link-button';
  resetBtn.textContent = 'Réinitialiser';
  resetBtn.addEventListener('click', () => {
    catalogueDifficultyOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    activeDifficultyFilters = [];
    updateCatalogue({ resetPage: true });
  });
  catalogueDifficultyOptions.appendChild(resetBtn);
}

function populateCatalogueSeasonFilter(objects) {
  if (!catalogueSeasonOptions) return;
  catalogueSeasonOptions.innerHTML = '';
  const counts = new Map();
  objects.forEach((object) => {
    resolveSeasonTags(object).forEach((seasonId) => {
      counts.set(seasonId, (counts.get(seasonId) || 0) + 1);
    });
  });
  const availableSeasons = SEASON_GROUPS.filter((season) => (counts.get(season.id) || 0) > 0);
  activeSeasonFilters = activeSeasonFilters.filter((id) => availableSeasons.some((season) => season.id === id));
  if (availableSeasons.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Aucune période optimale n’est indiquée pour cette sélection.';
    catalogueSeasonOptions.appendChild(info);
    return;
  }
  availableSeasons.forEach((season) => {
    const label = document.createElement('label');
    label.className = 'filter-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = season.id;
    checkbox.checked = activeSeasonFilters.includes(season.id);
    checkbox.addEventListener('change', () => {
      activeSeasonFilters = readSeasonSelection();
      updateCatalogue({ resetPage: true });
    });
    const span = document.createElement('span');
    const count = counts.get(season.id) || 0;
    span.textContent = count > 0 ? `${season.label} (${count})` : season.label;
    label.appendChild(checkbox);
    label.appendChild(span);
    catalogueSeasonOptions.appendChild(label);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'link-button';
  resetBtn.textContent = 'Réinitialiser';
  resetBtn.addEventListener('click', () => {
    catalogueSeasonOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    activeSeasonFilters = [];
    updateCatalogue({ resetPage: true });
  });
  catalogueSeasonOptions.appendChild(resetBtn);
}

function populateCatalogueFilters(objects) {
  populateCatalogueTypeFilter(objects);
  populateCatalogueDifficultyFilter(objects);
  populateCatalogueSeasonFilter(objects);
}

function clampPage(page, totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) {
    return 1;
  }
  if (!Number.isFinite(page)) {
    return 1;
  }
  const normalized = Math.trunc(page);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > totalPages) {
    return totalPages;
  }
  return normalized;
}

function renderPaginationControls(totalItems, totalPages) {
  if (!cataloguePagination) {
    return;
  }
  if (!Number.isFinite(totalItems) || totalItems <= 0 || !Number.isFinite(totalPages) || totalPages <= 1) {
    cataloguePagination.innerHTML = '';
    cataloguePagination.hidden = true;
    return;
  }
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(totalItems, currentPage * PAGE_SIZE);
  cataloguePagination.innerHTML = '';
  cataloguePagination.hidden = false;
  const summary = document.createElement('span');
  summary.className = 'pagination__summary';
  summary.textContent = `Objets ${startIndex} à ${endIndex} sur ${totalItems}`;
  const controls = document.createElement('div');
  controls.className = 'pagination__controls';
  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'pagination__button';
  prevButton.textContent = 'Précédent';
  prevButton.disabled = currentPage <= 1;
  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      updateCatalogue({ page: currentPage - 1 });
    }
  });
  const status = document.createElement('span');
  status.className = 'pagination__status';
  status.textContent = `Page ${currentPage} / ${totalPages}`;
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'pagination__button';
  nextButton.textContent = 'Suivant';
  nextButton.disabled = currentPage >= totalPages;
  nextButton.addEventListener('click', () => {
    if (currentPage < totalPages) {
      updateCatalogue({ page: currentPage + 1 });
    }
  });
  controls.appendChild(prevButton);
  controls.appendChild(status);
  controls.appendChild(nextButton);
  cataloguePagination.appendChild(summary);
  cataloguePagination.appendChild(controls);
}

function renderCatalogue(entries) {
  catalogueGrid.innerHTML = '';
  entries.forEach(({ object, metrics }) => {
    catalogueGrid.appendChild(buildCard(object, metrics));
  });
}

function updateCatalogue({ resetPage = false, page = null } = {}) {
  if (resetPage) {
    currentPage = 1;
  } else if (Number.isFinite(page)) {
    currentPage = page;
  }
  const selectionObjects = filterObjectsByCatalogue(enrichedCatalogueObjects, activeCatalogueIds);
  if (!Array.isArray(catalogueEntries) || catalogueEntries.length === 0) {
    if (catalogueGrid) {
      catalogueGrid.innerHTML = '';
      const empty = document.createElement('p');
      empty.className = 'help-text';
      if (!hasActiveCatalogueSelection()) {
        empty.textContent =
          'Aucun catalogue sélectionné. Utilise les filtres ci-dessus pour choisir les catalogues à afficher.';
      } else if (selectionObjects.length === 0) {
        empty.textContent = 'Chargement des catalogues sélectionnés…';
      } else {
        const selectionText = formatCatalogueList(getSelectionIds(), catalogueDefinitions);
        empty.textContent =
          selectionText && selectionText !== '—'
            ? `Aucun objet trouvé pour la sélection ${selectionText}. Ajuste les filtres ou choisis un autre catalogue.`
            : 'Aucun objet disponible. Vérifie les catalogues sélectionnés.';
      }
      catalogueGrid.appendChild(empty);
    }
    renderPaginationControls(0, 0);
    updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
    updateCatalogueFilterSummary(0, 0);
    renderActiveFilterChips();
    return;
  }
  const filtered = applyFilters(catalogueEntries);
  const sorted = sortEntries(filtered, currentSort);
  const totalItems = sorted.length;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / PAGE_SIZE) : 0;
  currentPage = clampPage(currentPage, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageEntries = sorted.slice(startIndex, startIndex + PAGE_SIZE);
  if (!catalogueGrid) {
    updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
    updateCatalogueFilterSummary(filtered.length, catalogueEntries.length);
    renderActiveFilterChips();
    renderPaginationControls(totalItems, totalPages);
    return;
  }
  if (sorted.length === 0) {
    catalogueGrid.innerHTML = '';
    const empty = document.createElement('p');
    empty.className = 'help-text';
    empty.textContent =
      'Aucun objet ne correspond aux filtres sélectionnés. Réinitialise les filtres pour afficher de nouveau la sélection complète.';
    catalogueGrid.appendChild(empty);
  } else {
    renderCatalogue(pageEntries);
  }
  updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
  updateCatalogueFilterSummary(filtered.length, catalogueEntries.length);
  renderActiveFilterChips();
  renderPaginationControls(totalItems, totalPages);
}

function readSessionSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Impossible de lire la dernière session :', error);
    return null;
  }
}

async function loadCatalog() {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger les catalogues.');
  }
  const payload = await response.json();
  return parseCataloguePayload(payload);
}

function formatSessionContext(snapshot) {
  if (!snapshot) {
    return "Aucune session enregistrée. Consulte librement le catalogue et reviens sur la page principale pour ajouter tes futures analyses.";
  }
  const { context } = snapshot;
  if (!context) {
    return "Contexte incomplet. Relance une analyse depuis la page principale.";
  }
  const latitude = Number.isFinite(context.latitude) ? formatCoordinate(context.latitude) : '—';
  const longitude = Number.isFinite(context.longitude) ? formatCoordinate(context.longitude) : '—';
  const latitudeText = latitude === '—' ? '—' : `${latitude}°`;
  const longitudeText = longitude === '—' ? '—' : `${longitude}°`;
  const bortle = Number.isFinite(context.bortle) ? context.bortle : '—';
  const when = context.localDate && context.localTime ? `${context.localDate} à ${context.localTime}` : 'date/heure inconnues';
  const duration = Number.isFinite(context.durationHours) ? context.durationHours : '—';
  const bortleSummary = context.bortleSummary ? ` ${context.bortleSummary}` : '';
  return `Session du ${when}, durée ${duration} h — latitude ${latitudeText}, longitude ${longitudeText}, Bortle ${bortle}.${bortleSummary}`;
}

function renderSessionWeather(weather) {
  if (!sessionWeather) return;
  if (!weather) {
    sessionWeather.textContent =
      'Aucune donnée météo enregistrée pour le moment. Elles apparaîtront après ta prochaine analyse.';
    return;
  }
  sessionWeather.textContent = buildWeatherSummary(weather);
}

function renderSessionDecision(decision) {
  if (!sessionDecision) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    sessionDecision.textContent =
      'Scores personnalisés disponibles après avoir enregistré une session sur la page principale.';
    return;
  }
  const score = Math.max(0, Math.min(100, Math.round((decision.globalScore ?? 0) * 100)));
  const label = decision.globalLabel ?? '';
  let astroSuffix = '';
  if (decision.astrophoto?.active && Array.isArray(decision.astrophoto.recommendations)) {
    const names = decision.astrophoto.recommendations
      .slice(0, 2)
      .map((entry) => entry.object?.name)
      .filter(Boolean);
    if (names.length > 0) {
      astroSuffix = ` — Photo : ${names.join(', ')}`;
    }
  }
  sessionDecision.textContent = `Score global ${score}/100 — ${label}.${astroSuffix}`;
}

function resolveMoon(snapshot) {
  if (snapshot?.moon && Number.isFinite(snapshot.moon.illumination)) {
    return snapshot.moon;
  }
  const iso = snapshot?.context?.dateISO;
  if (iso) {
    try {
      return computeMoonPhase(new Date(iso));
    } catch (error) {
      console.warn('Impossible de recalculer la phase lunaire :', error);
    }
  }
  return null;
}

function renderSessionMoon(moon) {
  if (!sessionMoon) return;
  if (!moon) {
    sessionMoon.textContent =
      'Phase lunaire non calculée. Elle sera ajoutée automatiquement dès qu’une session sera enregistrée.';
    return;
  }
  sessionMoon.textContent = `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)} éclairée. ${moon.description}`;
}

function renderSessionEvents(events) {
  if (!sessionEvents) return;
  sessionEvents.innerHTML = '';
  if (!events || events.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'event-item';
    empty.innerHTML =
      '<p>Aucun événement enregistré pour l’instant. Ils apparaîtront après ta prochaine analyse.</p>';
    sessionEvents.appendChild(empty);
    return;
  }
  events.forEach((event) => {
    const item = document.createElement('li');
    item.className = 'event-item';
    const when = event.occursAt ? formatLocalDateTime(event.occursAt) : 'À vérifier manuellement';
    item.innerHTML = `
      <h3>${event.icon ?? '✨'} ${event.name}</h3>
      <p class="meta">${event.type}${event.occursAt ? ` — ${when}` : ''}</p>
      <p>${event.description}</p>
    `;
    sessionEvents.appendChild(item);
  });
}

function renderSessionDetails(snapshot) {
  renderSessionDecision(snapshot?.decisionSupport);
  renderSessionWeather(snapshot?.weather);
  renderSessionMoon(resolveMoon(snapshot));
  renderSessionEvents(snapshot?.events);
}

function classifyScore(score) {
  if (!Number.isFinite(score) || score <= 0) return SCORE_CLASSES.none;
  const tone = resolveScoreTone(score, { scale: 1 });
  if (tone === 'good') return SCORE_CLASSES.high;
  if (tone === 'warn') return SCORE_CLASSES.medium;
  if (tone === 'bad') return SCORE_CLASSES.low;
  return SCORE_CLASSES.none;
}

function buildCard(object, metrics) {
  const objectId = resolveObjectId(object);
  const scoreRatio = Number.isFinite(metrics?.score) ? metrics.score : null;
  const score = scoreRatio ?? 0;
  const detailParams = new URLSearchParams();
  if (object.slug) {
    detailParams.set('id', object.slug);
  }
  if (object.primaryCatalogueId) {
    detailParams.set('catalogue', object.primaryCatalogueId);
  }
  if (object.primaryCatalogueId === 'messier' && Number.isFinite(object.number)) {
    detailParams.set('m', object.number);
  } else if (Number.isFinite(object.number)) {
    detailParams.set('number', object.number);
  }
  const destination = `fiche-catalogue.html?${detailParams.toString()}`;
  const card = document.createElement('article');
  card.className = `catalogue-card tone-frame ${classifyScore(score)}`;
  card.setAttribute('role', 'listitem');
  card.dataset.href = destination;
  if (objectId) {
    card.dataset.objectId = objectId;
  }
  if (object?.name) {
    card.dataset.objectName = object.name;
  }
  if (Number.isFinite(object.number) && object.primaryCatalogueId === 'messier') {
    card.dataset.messier = `M${object.number}`;
  }
  if (object.primaryCatalogueId) {
    card.dataset.catalogue = object.primaryCatalogueId;
  }
  if (object.slug) {
    card.dataset.slug = object.slug;
  }

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'preview-wrapper';
  previewWrapper.appendChild(createObservationPreview(object));

  const text = document.createElement('div');
  text.className = 'catalogue-text';
  const scoreValue = scoreRatio !== null ? Math.round(scoreRatio * 100) : null;
  const scoreDisplay = scoreValue !== null ? Math.max(0, Math.min(100, scoreValue)) : null;
  const scoreTone = scoreDisplay !== null ? resolveScoreTone(scoreDisplay, { scale: 100 }) : 'neutral';
  if (scoreTone !== 'neutral') {
    card.dataset.tone = scoreTone;
  } else {
    delete card.dataset.tone;
  }
  const toneAttr = scoreTone === 'neutral' ? '' : ` data-tone="${scoreTone}"`;
  const barWidth = scoreDisplay !== null ? scoreDisplay : 0;
  const scoreLabel = scoreDisplay !== null ? `${scoreDisplay}/100` : '—';
  const bestTime = formatLocalTime(metrics?.bestTime);
  const direction = describeAzimuth(metrics?.azimuth);
  const startDirection = describeAzimuth(metrics?.startAzimuth);
  const endDirection = describeAzimuth(metrics?.endAzimuth);
  const typeLabel = resolveObjectCategory(object);
  const magnitudeText = Number.isFinite(object.magnitude) ? object.magnitude.toFixed(1) : '—';
  const catalogueLabel = formatCatalogueList(
    Array.isArray(object.catalogueRefs) && object.catalogueRefs.length > 0
      ? object.catalogueRefs
      : object.primaryCatalogueId
      ? [object.primaryCatalogueId]
      : [],
    catalogueDefinitions
  );
  const altitudeText = formatAltitude(metrics?.altitude);
  const averageAltitudeText = formatAltitude(metrics?.averageAltitude);
  const minAltitudeText = formatAltitude(metrics?.minAltitude);
  const startAltitudeText = formatAltitude(metrics?.startAltitude);
  const endAltitudeText = formatAltitude(metrics?.endAltitude);
  const coveragePercent = Number.isFinite(metrics?.visibilityRatio) ? Math.round(metrics.visibilityRatio * 100) : null;
  const visibleSamples = Number.isFinite(metrics?.visibleSamples) ? metrics.visibleSamples : null;
  const sampleLabel = visibleSamples === 1 ? 'point' : 'points';
  const coverageText =
    coveragePercent === null ? '—' : `${coveragePercent}%${visibleSamples !== null ? ` (${visibleSamples} ${sampleLabel})` : ''}`;
  text.innerHTML = `
    <header class="catalogue-card__header">
      <div>
        <h3><a class="catalogue-card__link" href="${destination}" aria-label="Voir la fiche détaillée de ${object.name}" title="Ouvrir la fiche détaillée">${object.name}</a></h3>
        <div class="meta">${typeLabel} • ${object.constellation} • Mag ${magnitudeText}</div>
        <div class="meta meta--catalogue">Catalogue : ${catalogueLabel}</div>
      </div>
      <span class="score-chip"${toneAttr}>${scoreLabel}</span>
    </header>
    <p class="catalogue-summary">${object.description}</p>
    <div class="catalogue-visibility">
      <div>
        <span class="catalogue-visibility__label">Moment idéal</span>
        <strong class="catalogue-visibility__value">${bestTime}</strong>
      </div>
      <div>
        <span class="catalogue-visibility__label">Direction</span>
        <strong class="catalogue-visibility__value">${altitudeText} • ${direction}</strong>
      </div>
    </div>
    <details class="card-fold">
      <summary>Fiche complète</summary>
      <div class="card-fold__content">
        <div class="score-bar" aria-hidden="true"${toneAttr}><span style="width:${barWidth}%"></span></div>
        <dl class="target-metrics">
          <div><dt>Altitude moyenne</dt><dd>${averageAltitudeText}</dd></div>
          <div><dt>Altitude minimale</dt><dd>${minAltitudeText}</dd></div>
          <div><dt>Fin de fenêtre</dt><dd>${endAltitudeText} • ${endDirection}</dd></div>
        </dl>
        <div class="visibility-chart" role="img" aria-label="Évolution de l'altitude de ${object.name} durant la session"></div>
        <ul class="target-insights">
          <li>Type : ${typeLabel}</li>
          <li>Magnitude apparente : Mag ${magnitudeText}</li>
          <li>Temps visible &gt; 30° : ${coverageText}</li>
          <li>Début de session : ${startAltitudeText} • ${startDirection}</li>
          <li>Fin de session : ${endAltitudeText} • ${endDirection}</li>
          <li>Catalogues : ${catalogueLabel}</li>
          <li>Points mesurés : ${visibleSamples !== null ? `${visibleSamples} ${sampleLabel}` : '—'}</li>
        </ul>
      </div>
    </details>
  `;

  const actions = buildCardActions(object, objectId);
  if (actions) {
    const header = text.querySelector('.catalogue-card__header');
    if (header) {
      header.insertAdjacentElement('afterend', actions);
    } else {
      text.insertBefore(actions, text.firstChild);
    }
  }

  const chartContainer = text.querySelector('.visibility-chart');
  if (chartContainer) {
    renderAltitudeSparkline(chartContainer, metrics?.track, {
      objectName: object.name,
      width: 320,
      height: 160
    });
  }

  card.appendChild(previewWrapper);
  card.appendChild(text);
  refreshCardActions(card);
  return card;
}

function mergeMetrics(objects, snapshot) {
  const results = [];
  const map = new Map();
  if (snapshot?.entries) {
    snapshot.entries.forEach((entry) => {
      const slugKey = entry.object?.slug || entry.objectSlug;
      const numberKey =
        entry.object?.primaryCatalogueId && Number.isFinite(entry.object?.number)
          ? `${entry.object.primaryCatalogueId}:${entry.object.number}`
          : null;
      const nameKey = entry.object?.name;
      if (slugKey) {
        map.set(slugKey, entry);
      }
      if (numberKey) {
        map.set(numberKey, entry);
      }
      if (nameKey) {
        map.set(nameKey, entry);
      }
    });
  }
  const context = snapshot?.context;
  const weather = snapshot?.weather;
  const lat = Number(context?.latitude ?? context?.lat);
  const lon = Number(context?.longitude ?? context?.lon);
  const bortle = Number(context?.bortle);
  const durationHours = Number(context?.durationHours ?? context?.duration ?? 2);
  const observationDate = context?.dateISO ? new Date(context.dateISO) : null;
  const moonIllumination = snapshot?.moon?.illumination ?? (observationDate ? computeMoonPhase(observationDate).illumination : 0);
  objects.forEach((object) => {
    const slugKey = object.slug || null;
    const numberKey =
      object.primaryCatalogueId && Number.isFinite(object.number)
        ? `${object.primaryCatalogueId}:${object.number}`
        : null;
    let metrics = null;
    if (slugKey && map.has(slugKey)) {
      metrics = map.get(slugKey);
    } else if (numberKey && map.has(numberKey)) {
      metrics = map.get(numberKey);
    } else if (map.has(object.name)) {
      metrics = map.get(object.name);
    }
    const needsRebuild =
      !metrics ||
      !Array.isArray(metrics.track) ||
      metrics.track.length === 0 ||
      !metrics.bestTime ||
      !Number.isFinite(metrics.altitude);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      observationDate instanceof Date &&
      !Number.isNaN(observationDate.getTime()) &&
      needsRebuild
    ) {
      const evaluated = evaluateTargets([object], {
        lat,
        lon,
        bortle,
        date: observationDate,
        durationHours,
        moonIllumination
      });
      const scored = weather
        ? applyWeather(evaluated, weather, {
            context: { latitude: lat, longitude: lon, durationHours, date: observationDate }
          })
        : evaluated;
      const rebuilt = scored[0];
      if (rebuilt) {
        metrics = metrics ? { ...metrics, ...rebuilt } : rebuilt;
      }
    }

    results.push({ object, metrics });
  });
  return results;
}

function resolveCatalogueSelection(snapshot, catalogues = []) {
  const knownIds = new Set(catalogues.map((catalogue) => normaliseCatalogueId(catalogue.id)).filter(Boolean));
  const stored = Array.isArray(snapshot?.context?.catalogueIds)
    ? normaliseCatalogueIdList(snapshot.context.catalogueIds).filter((id) => knownIds.has(id))
    : [];
  if (stored.length > 0) {
    return stored;
  }
  const defaults = catalogues
    .filter((catalogue) => catalogue.defaultSelected)
    .map((catalogue) => normaliseCatalogueId(catalogue.id))
    .filter(Boolean);
  if (defaults.length > 0) {
    return defaults;
  }
  const allowedDefaults = Array.from(allowedCatalogueIds).filter((id) => knownIds.has(id));
  if (allowedDefaults.length > 0) {
    return allowedDefaults;
  }
  if (catalogues.length > 0) {
    const first = normaliseCatalogueId(catalogues[0].id);
    return first ? [first] : [];
  }
  return [];
}

async function bootstrap() {
  try {
    setSessionContextPanelReady(false);
    const [payload, rawSnapshot] = await Promise.all([
      loadCatalog(),
      Promise.resolve(readSessionSnapshot())
    ]);
    const snapshot = filterSnapshotForPreferences(rawSnapshot, storedCataloguePreferences);
    const filteredCatalogues = filterCataloguesForPreferences(payload.catalogues, storedCataloguePreferences);
    catalogueDefinitions = Array.isArray(filteredCatalogues) ? filteredCatalogues : [];
    catalogueIdIndex = new Map();
    const knownCatalogues = new Set();
    catalogueDefinitions.forEach((catalogue) => {
      const normalizedId = normaliseCatalogueId(catalogue.id);
      if (!normalizedId || !isCatalogueAllowed(normalizedId)) {
        return;
      }
      knownCatalogues.add(normalizedId);
      catalogueIdIndex.set(normalizedId, catalogue);
    });
    catalogueSources = new Map();
    if (payload.sources instanceof Map) {
      payload.sources.forEach((value, key) => {
        const normalizedKey = normaliseCatalogueId(key || value?.catalogueId);
        if (!normalizedKey || !knownCatalogues.has(normalizedKey)) {
          return;
        }
        catalogueSources.set(normalizedKey, { ...value, catalogueId: normalizedKey });
      });
    }
    catalogueAvailability.forEach((list, mode) => {
      const filtered = (Array.isArray(list) ? list : [])
        .map((id) => normaliseCatalogueId(id))
        .filter((id) => id && knownCatalogues.has(id));
      catalogueAvailability.set(mode, filtered);
    });
    allowedCatalogueIds.clear();
    catalogueAvailability.forEach((list) => {
      list.forEach((id) => allowedCatalogueIds.add(id));
    });
    registerInitialObjects(filterObjectsForPreferences(payload.objects, storedCataloguePreferences));
    activeCatalogueIds = resolveCatalogueSelection(snapshot, catalogueDefinitions);
    if (!Array.isArray(activeCatalogueIds) || activeCatalogueIds.length === 0) {
      activeCatalogueIds = null;
    }
    updateCatalogueSelectionControls();
    if (catalogueHint) {
      catalogueHint.textContent = 'Chargement des catalogues sélectionnés…';
    }
    sessionSummary.textContent = formatSessionContext(snapshot);
    renderSessionDetails(snapshot);
    lastSessionSnapshot = snapshot;
    const selectionIds = getSelectionIds();
    if (selectionIds.length > 0) {
      await ensureCatalogueObjects(selectionIds, { refreshUI: false });
    }
    const filteredObjects = filterObjectsByCatalogue(enrichedCatalogueObjects, activeCatalogueIds);
    catalogueEntries = mergeMetrics(filteredObjects, snapshot);
    populateCatalogueFilters(filteredObjects);
    updateCatalogue({ resetPage: true });
    updateCatalogueSelectionControls();
    prefetchRemainingCatalogues();
    if (!snapshot && sessionPanel) {
      sessionPanel.classList.add('warning');
    }
    setSessionContextPanelReady(true);
    setSessionContextPanelExpanded(false);
  } catch (error) {
    console.error(error);
    catalogueHint.textContent = "Impossible de charger le catalogue pour le moment.";
    setSessionContextPanelReady(true);
    setSessionContextPanelExpanded(false);
  }
}

if (catalogueGrid) {
  catalogueGrid.addEventListener('click', (event) => {
    const toggleButton = event.target.closest('[data-action="toggle-favori"]');
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      const card = toggleButton.closest('.catalogue-card');
      if (!card) {
        return;
      }
      const objectId = card.dataset.objectId || null;
      const objectName = card.dataset.objectName || card.querySelector('h3')?.textContent || 'cet objet';
      if (!objectId) {
        return;
      }
      const isActive = Favoris.toggle(objectId);
      updateFavoriButtonState(toggleButton, isActive, objectName);
      card.classList.toggle(FAVORI_CARD_CLASS, Boolean(isActive));
      return;
    }
  });

  catalogueGrid.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-action="list-membership"]');
    if (!checkbox) {
      return;
    }
    event.stopPropagation();
    const listId = checkbox.dataset.listId || '';
    const objectId = checkbox.dataset.objectId || '';
    if (!listId || !objectId) {
      return;
    }
    const checked = checkbox.checked;
    const updated = checked
      ? Favoris.addToListe(listId, objectId)
      : Favoris.removeFromListe(listId, objectId);
    if (!updated) {
      checkbox.checked = !checked;
      return;
    }
    if (checked) {
      Favoris.add(objectId);
    }
    const options = checkbox.closest('.list-picker__options');
    if (options) {
      renderListPickerOptions(options, objectId);
    }
  });

  catalogueGrid.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-role="create-list-form"]');
    if (!form) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    const objectId = form.dataset.objectId || '';
    const input = form.querySelector('input[name="nom"]');
    if (!input) {
      return;
    }
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    const created = Favoris.creerListe(name);
    if (objectId && created?.id) {
      Favoris.addToListe(created.id, objectId);
      Favoris.add(objectId);
    }
    input.value = '';
    const options = form.parentElement?.querySelector('.list-picker__options');
    if (options && objectId) {
      renderListPickerOptions(options, objectId);
    }
  });

  catalogueGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.catalogue-card');
    if (!card) return;
    if (event.target.closest('.card-fold')) {
      return;
    }
    if (event.target.closest('.catalogue-card__actions')) {
      return;
    }
    const directLink = event.target.closest('a');
    if (directLink) {
      return;
    }
    const href = card.dataset.href;
    if (!href) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    window.location.assign(href);
  });
}

if (sortSelect) {
  sortSelect.value = SORT_BY.score;
  sortSelect.addEventListener('change', (event) => {
    const selected = event.target.value;
    if (selected === currentSort) {
      return;
    }
    currentSort = Object.values(SORT_BY).includes(selected) ? selected : SORT_BY.score;
    updateCatalogue();
  });
}

if (selectAllCataloguesButton) {
  selectAllCataloguesButton.addEventListener('click', () => {
    applyCatalogueSelection(null).catch((error) => {
      console.error('Impossible d’afficher tous les catalogues :', error);
    });
  });
}

if (clearCatalogueSelectionButton) {
  clearCatalogueSelectionButton.addEventListener('click', () => {
    applyCatalogueSelection([]).catch((error) => {
      console.error('Impossible de vider la sélection de catalogues :', error);
    });
  });
}

initSessionContextPanel();

renderActiveFilterChips();

bootstrap();
