import {
  SESSION_STORAGE_KEY,
  NIGHT_MODE_STORAGE_KEY,
  applyWeather,
  buildWeatherSummary,
  computeMoonPhase,
  describeAzimuth,
  describeAerosolLoad,
  describeDewRisk,
  describeSeeingQuality,
  describeTransparencyQuality,
  enrichCatalogueData,
  evaluateTargets,
  formatAltitude,
  formatCoordinate,
  formatArcseconds,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime
} from './astro-core.js';
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
} from './catalogue-utils.js';

const catalogueGrid = document.getElementById('catalogueGrid');
const catalogueHint = document.getElementById('catalogueHint');
const sessionSummary = document.getElementById('sessionSummary');
const sessionWeather = document.getElementById('sessionWeather');
const sessionMoon = document.getElementById('sessionMoon');
const sessionEvents = document.getElementById('sessionEvents');
const sessionDecision = document.getElementById('sessionDecision');
const sessionPanel = document.getElementById('sessionPanel');
const sortSelect = document.getElementById('catalogueSort');
const catalogueFilterSummary = document.getElementById('catalogueFilterSummary');
const catalogueTypeOptions = document.getElementById('catalogueTypeOptions');
const catalogueDifficultyOptions = document.getElementById('catalogueDifficultyOptions');
const catalogueSeasonOptions = document.getElementById('catalogueSeasonOptions');
const catalogueSelectionOptions = document.getElementById('catalogueSelectionOptions');
const selectAllCataloguesButton = document.getElementById('selectAllCatalogues');
const clearCatalogueSelectionButton = document.getElementById('clearCatalogueSelection');
const catalogueSelectionSummary = document.getElementById('catalogueSelectionSummary');
const nightModeToggle = document.getElementById('nightModeToggle');
const catalogueHeading = document.getElementById('catalogueTitle');
const catalogueSubheading = document.getElementById('catalogueSubtitle');

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
  if (normalized === 'research') return 'Recherche scientifique';
  return mode;
}

function applyNightMode(enabled, { persist = true } = {}) {
  document.body.classList.toggle('night-mode', enabled);
  if (nightModeToggle) {
    nightModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    nightModeToggle.classList.toggle('is-active', enabled);
    nightModeToggle.textContent = enabled ? '🌅 Mode jour' : '🔦 Mode nuit';
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
  appendCatalogueObjects(objects);
}

function appendCatalogueObjects(objects = []) {
  if (!Array.isArray(objects) || objects.length === 0) {
    return [];
  }
  const added = [];
  objects.forEach((object) => {
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
}

async function ensureCatalogueObjects(ids = [], { refreshUI = true } = {}) {
  const requested = normaliseCatalogueIdList(ids);
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
    .filter((id) => id && !loadedCatalogueIds.has(id));
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

function updateCatalogueSelectionSummary() {
  if (!catalogueSelectionSummary) return;
  const totalCatalogues = Array.isArray(catalogueDefinitions) ? catalogueDefinitions.length : 0;
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
  updateCatalogue();
  updateCatalogueSelectionControls();
}

function updateCatalogueSelectionControls() {
  if (!catalogueSelectionOptions) return;
  catalogueSelectionOptions.innerHTML = '';
  if (!Array.isArray(catalogueDefinitions) || catalogueDefinitions.length === 0) {
    const info = document.createElement('p');
    info.className = 'help-text';
    info.textContent = 'Aucun catalogue disponible pour le moment.';
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
      updateCatalogue();
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
    updateCatalogue();
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
      updateCatalogue();
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
    updateCatalogue();
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
      updateCatalogue();
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
    updateCatalogue();
  });
  catalogueSeasonOptions.appendChild(resetBtn);
}

function populateCatalogueFilters(objects) {
  populateCatalogueTypeFilter(objects);
  populateCatalogueDifficultyFilter(objects);
  populateCatalogueSeasonFilter(objects);
}

function renderCatalogue(entries) {
  catalogueGrid.innerHTML = '';
  entries.forEach(({ object, metrics }) => {
    catalogueGrid.appendChild(buildCard(object, metrics));
  });
}

function updateCatalogue() {
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
    updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
    updateCatalogueFilterSummary(0, 0);
    return;
  }
  const filtered = applyFilters(catalogueEntries);
  const sorted = sortEntries(filtered, currentSort);
  if (!catalogueGrid) {
    updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
    updateCatalogueFilterSummary(filtered.length, catalogueEntries.length);
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
    renderCatalogue(sorted);
  }
  updateCatalogueSummary(selectionObjects, lastSessionSnapshot);
  updateCatalogueFilterSummary(filtered.length, catalogueEntries.length);
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
  if (score >= 0.66) return SCORE_CLASSES.high;
  if (score >= 0.4) return SCORE_CLASSES.medium;
  return SCORE_CLASSES.low;
}

function formatFactor(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function buildCard(object, metrics) {
  const score = metrics?.score ?? 0;
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
  const destination = `messier.html?${detailParams.toString()}`;
  const card = document.createElement('a');
  card.className = `catalogue-card ${classifyScore(score)}`;
  card.href = destination;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `Voir la fiche détaillée de ${object.name}`);
  card.title = 'Ouvrir la fiche détaillée';
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
  const scoreValue = Math.round(score * 100);
  const scoreDisplay = Math.max(0, Math.min(100, scoreValue));
  const barWidth = scoreDisplay;
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
  const endAltitudeText = formatAltitude(metrics?.endAltitude);
  const coveragePercent = Number.isFinite(metrics?.visibilityRatio) ? Math.round(metrics.visibilityRatio * 100) : null;
  const visibleSamples = Number.isFinite(metrics?.visibleSamples) ? metrics.visibleSamples : null;
  const sampleLabel = visibleSamples === 1 ? 'point' : 'points';
  const coverageText =
    coveragePercent === null ? '—' : `${coveragePercent}%${visibleSamples !== null ? ` (${visibleSamples} ${sampleLabel})` : ''}`;
  const drift = Number.isFinite(metrics?.altitudeDrift) ? metrics.altitudeDrift : null;
  const driftText = drift === null ? '—' : `${drift >= 0 ? '+' : ''}${drift.toFixed(0)}°`;
  const seeingQuality = metrics?.seeingText ?? describeSeeingQuality(metrics?.seeingFactor ?? metrics?.seeingIndex);
  const seeingPercent = formatFactor(metrics?.seeingFactor ?? metrics?.seeingIndex ?? 1);
  const seeingArcsec = formatArcseconds(metrics?.seeingArcsec);
  const transparencyQuality =
    metrics?.transparencyText ?? describeTransparencyQuality(metrics?.transparencyFactor ?? metrics?.transparencyIndex);
  const transparencyPercent = formatFactor(metrics?.transparencyFactor ?? metrics?.transparencyIndex ?? 1);
  const aerosolQuality = metrics?.aerosolText ?? describeAerosolLoad();
  const aerosolPercent = formatFactor(metrics?.aerosolFactor ?? metrics?.transparencyFactor ?? 1);
  const dewQuality = metrics?.dewRiskText ?? describeDewRisk();
  const dewPercent = formatFactor(metrics?.dewFactor ?? metrics?.dewIndex ?? 1);
  text.innerHTML = `
    <header class="catalogue-card__header">
      <div>
        <h3>${object.name}</h3>
        <div class="meta">${typeLabel} • ${object.constellation} • Mag ${magnitudeText}</div>
        <div class="meta meta--catalogue">Catalogue : ${catalogueLabel}</div>
      </div>
      <span class="score-chip">${scoreDisplay}/100</span>
    </header>
    <p>${object.description}</p>
    <div class="catalogue-visibility">
      <div>
        <span class="catalogue-visibility__label">Moment idéal</span>
        <span class="catalogue-visibility__value">${bestTime}</span>
      </div>
      <div>
        <span class="catalogue-visibility__label">Direction</span>
        <span class="catalogue-visibility__value">${altitudeText} • ${direction}</span>
      </div>
    </div>
    <dl class="target-metrics">
      <div><dt>Hauteur max</dt><dd>${altitudeText}</dd></div>
      <div><dt>Altitude moyenne</dt><dd>${averageAltitudeText}</dd></div>
      <div><dt>Moment idéal</dt><dd>${bestTime}</dd></div>
    </dl>
    <div class="visibility-chart" role="img" aria-label="Évolution de l'altitude de ${object.name} durant la session"></div>
    <div class="score-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></div>
  `;

  const chartContainer = text.querySelector('.visibility-chart');
  if (chartContainer) {
    renderAltitudeSparkline(chartContainer, metrics?.track, {
      objectName: object.name,
      width: 320,
      height: 160
    });
  }

  const factors = document.createElement('ul');
  factors.className = 'factor-list';
  factors.innerHTML = `
    <li>Type : <strong>${typeLabel}</strong></li>
    <li>Catalogue(s) : <strong>${catalogueLabel || '—'}</strong></li>
    <li>Magnitude : <strong>Mag ${magnitudeText}</strong></li>
    <li>Direction optimale : <strong>${direction}</strong></li>
    <li>Début de session : <strong>${formatAltitude(metrics?.startAltitude)} • ${startDirection}</strong></li>
    <li>Fin de session : <strong>${endAltitudeText} • ${endDirection}</strong></li>
    <li>Altitude moyenne : <strong>${averageAltitudeText} (min ${minAltitudeText})</strong></li>
    <li>Variation sur la fenêtre : <strong>${driftText}</strong></li>
    <li>Temps au-dessus de 15° : <strong>${coverageText}</strong></li>
    <li>Saison : <strong>${formatFactor(metrics?.monthFactor)}</strong></li>
    <li>Pollution lumineuse : <strong>${formatFactor(metrics?.bortleFactor)}</strong></li>
    <li>Influence lunaire : <strong>${formatFactor(metrics?.moonFactor)}</strong></li>
    <li>Météo : <strong>${formatFactor(metrics?.weatherFactor)}</strong></li>
    <li>Seeing : <strong>${seeingQuality} (${seeingPercent} • ${seeingArcsec})</strong></li>
    <li>Transparence : <strong>${transparencyQuality} (${transparencyPercent})</strong></li>
    <li>Aérosols : <strong>${aerosolQuality} (${aerosolPercent})</strong></li>
    <li>Sécurité anti-buée : <strong>${dewQuality} (${dewPercent})</strong></li>
  `;
  text.appendChild(factors);

  card.appendChild(previewWrapper);
  card.appendChild(text);
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
      const scored = weather ? applyWeather(evaluated, weather) : evaluated;
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
  if (catalogues.length > 0) {
    const first = normaliseCatalogueId(catalogues[0].id);
    return first ? [first] : [];
  }
  return [];
}

async function bootstrap() {
  try {
    const [{ catalogues, objects, sources }, snapshot] = await Promise.all([
      loadCatalog(),
      Promise.resolve(readSessionSnapshot())
    ]);
    catalogueDefinitions = Array.isArray(catalogues) ? catalogues : [];
    catalogueIdIndex = new Map();
    catalogueDefinitions.forEach((catalogue) => {
      const normalizedId = normaliseCatalogueId(catalogue.id);
      if (normalizedId) {
        catalogueIdIndex.set(normalizedId, catalogue);
      }
    });
    const sourceEntries = sources instanceof Map ? sources : new Map();
    catalogueSources = new Map();
    sourceEntries.forEach((value, key) => {
      const normalizedKey = normaliseCatalogueId(key || value?.catalogueId);
      if (!normalizedKey) {
        return;
      }
      catalogueSources.set(normalizedKey, { ...value, catalogueId: normalizedKey });
    });
    registerInitialObjects(objects);
    activeCatalogueIds = resolveCatalogueSelection(snapshot, catalogues);
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
    updateCatalogue();
    updateCatalogueSelectionControls();
    prefetchRemainingCatalogues();
    if (!snapshot && sessionPanel) {
      sessionPanel.classList.add('warning');
    }
  } catch (error) {
    console.error(error);
    catalogueHint.textContent = "Impossible de charger le catalogue pour le moment.";
  }
}

if (catalogueGrid) {
  catalogueGrid.addEventListener('click', (event) => {
    const card = event.target.closest('a.catalogue-card');
    if (!card) return;
    const href = card.getAttribute('href');
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

bootstrap();
