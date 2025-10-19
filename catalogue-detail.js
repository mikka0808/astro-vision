import {
  SESSION_STORAGE_KEY,
  applyWeather,
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
} from './astro-core.js';
import { createObservationPreview, resolveImageSources } from './catalogue-media.js';
import { getObjectDossier } from './object-dossiers.js';
import { loadScorePreferencesFromCookie } from './score-preferences.js';

loadScorePreferencesFromCookie();

const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre'
];

const MONTH_SHORT_NAMES = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.'
];

const article = document.getElementById('objectArticle');
const message = document.getElementById('objectMessage');
const heading = document.getElementById('objectHeading');
const baseline = document.getElementById('objectBaseline');
const mediaContainer = document.getElementById('objectMedia');
const label = document.getElementById('objectLabel');
const title = document.getElementById('objectTitle');
const subtitle = document.getElementById('objectSubtitle');
const facts = document.getElementById('objectFacts');
const storyParagraph = document.getElementById('objectStory');
const observationParagraph = document.getElementById('objectObservation');
const sourcesList = document.getElementById('objectSources');
const sourcesSection = document.getElementById('objectSourcesSection');
const storySection = document.getElementById('objectStorySection');
const sessionSection = document.getElementById('objectSessionSection');
const sessionSummary = document.getElementById('objectSessionSummary');
const sessionFacts = document.getElementById('objectSessionFacts');
const highlightsList = document.getElementById('objectHighlights');
const usageSection = document.getElementById('objectUsageSection');
const usageList = document.getElementById('objectUsage');
const mediaMeta = document.getElementById('objectMediaMeta');
const mediaCreditLine = document.getElementById('objectMediaCredit');
const mediaLink = document.getElementById('objectMediaSource');

const catalogueMetaMap = new Map();
let catalogueDefinitions = [];
let mediaCandidateSources = null;
let currentMediaDetail = null;
let mediaSourceItem = null;

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function buildObjectSlug(entry = {}, primaryCatalogueId) {
  const catalogue = primaryCatalogueId || entry.primaryCatalogueId || null;
  const cataloguePart = catalogue ? slugify(catalogue) : 'catalogue';
  const number = Number(entry.number);
  if (Number.isFinite(number) && number > 0) {
    const padded =
      number < 1000
        ? String(Math.round(number)).padStart(catalogue === 'messier' ? 3 : 2, '0')
        : String(Math.round(number));
    return `${cataloguePart}-${padded}`;
  }
  const designation =
    entry.designation || entry.catalogueNumber || (Array.isArray(entry.catalogueRefs) ? entry.catalogueRefs[0] : null);
  const designationSlug = slugify(designation);
  if (designationSlug) {
    return `${cataloguePart}-${designationSlug}`;
  }
  const nameSlug = slugify(entry.name);
  if (nameSlug) {
    return `${cataloguePart}-${nameSlug}`;
  }
  const refsSlug = Array.isArray(entry.catalogueRefs)
    ? slugify(entry.catalogueRefs.filter(Boolean).join('-'))
    : '';
  if (refsSlug) {
    return `${cataloguePart}-${refsSlug}`;
  }
  const ra = Number(entry.raHours);
  const dec = Number(entry.decDeg);
  if (Number.isFinite(ra) && Number.isFinite(dec)) {
    return `${cataloguePart}-${Math.round(ra * 1000)}-${Math.round(dec * 1000)}`;
  }
  return `${cataloguePart}-${Date.now()}`;
}

function clampWeight(value, fallback = 1) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1.5, value));
}

function normalizeCatalogueEntry(entry = {}) {
  const weights = entry.observationWeights || {};
  return {
    ...entry,
    observationWeights: {
      visual: clampWeight(weights.visual, 1),
      astrophoto: clampWeight(weights.astrophoto, 1),
      research: clampWeight(weights.research, 1)
    }
  };
}

function normalizeObjectEntry(entry = {}, fallbackCatalogueId = null) {
  const refs = Array.isArray(entry.catalogueRefs) ? entry.catalogueRefs.filter(Boolean) : [];
  const primary = entry.primaryCatalogueId || refs[0] || fallbackCatalogueId;
  const uniqueRefs = Array.from(new Set(refs.length > 0 ? refs : primary ? [primary] : []));
  const slug = entry.slug || buildObjectSlug({ ...entry, catalogueRefs: uniqueRefs }, primary);
  return {
    ...entry,
    primaryCatalogueId: primary,
    catalogueRefs: uniqueRefs,
    slug,
    angularSizeArcmin: Number.isFinite(entry.angularSizeArcmin) ? entry.angularSizeArcmin : null,
    surfaceBrightness: Number.isFinite(entry.surfaceBrightness) ? entry.surfaceBrightness : null
  };
}

function parseCataloguePayload(payload) {
  if (Array.isArray(payload)) {
    const objects = payload.map((entry) => normalizeObjectEntry(entry));
    return { catalogues: [], objects };
  }
  const rawCatalogues = Array.isArray(payload?.catalogues) ? payload.catalogues : [];
  const catalogues = rawCatalogues.map((entry) => normalizeCatalogueEntry(entry));
  const fallbackCatalogueId = catalogues.find((item) => item.defaultSelected)?.id || catalogues[0]?.id || null;
  const rawObjects = Array.isArray(payload?.objects) ? payload.objects : [];
  const objects = rawObjects.map((entry) => normalizeObjectEntry(entry, fallbackCatalogueId));
  return { catalogues, objects };
}

function formatCatalogueList(ids = []) {
  if (!ids || ids.length === 0) {
    return '—';
  }
  return ids
    .map((id) => {
      const catalogue = catalogueMetaMap.get(id);
      if (!catalogue) return id.toUpperCase();
      return catalogue.abbreviation || catalogue.name || id.toUpperCase();
    })
    .join(' • ');
}

function buildObjectLabel(object) {
  if (!object) return 'Objet';
  if (object.primaryCatalogueId === 'messier' && Number.isFinite(object.number)) {
    return `M${object.number}`;
  }
  if (object.designation) {
    return object.designation;
  }
  const refs = Array.isArray(object.catalogueRefs) ? object.catalogueRefs.filter(Boolean) : [];
  if (refs.length > 0) {
    return formatCatalogueList(refs);
  }
  return object.name || 'Objet';
}

function parseObjectRequest() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('id') || params.get('slug') || null;
  const catalogueId = params.get('catalogue') || params.get('cat') || null;
  const rawNumber = params.get('m') || params.get('number');
  let number = null;
  if (rawNumber) {
    const parsed = Number.parseInt(rawNumber.replace(/[^0-9-]/g, ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      number = parsed;
    }
  }
  return { slug, catalogueId, number };
}

function formatRightAscension(hours) {
  if (!Number.isFinite(hours)) return '—';
  const h = Math.floor(hours);
  const minutesFloat = (hours - h) * 60;
  const m = Math.floor(minutesFloat);
  const s = Math.round((minutesFloat - m) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function formatDeclination(degrees) {
  if (!Number.isFinite(degrees)) return '—';
  const sign = degrees >= 0 ? '+' : '−';
  const abs = Math.abs(degrees);
  const d = Math.floor(abs);
  const minutesFloat = (abs - d) * 60;
  const m = Math.floor(minutesFloat);
  const s = Math.round((minutesFloat - m) * 60);
  return `${sign}${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}

function formatDistance(distanceLy) {
  if (!Number.isFinite(distanceLy)) return '—';
  if (distanceLy >= 1000000) {
    return `${(distanceLy / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M a.l.`;
  }
  return `${distanceLy.toLocaleString('fr-FR')} a.l.`;
}

function formatAngularSize(size, fallbackValue = null) {
  if (Number.isFinite(size)) {
    return `${size.toFixed(size >= 10 ? 0 : 1)}′`;
  }
  if (typeof size === 'string' && size.trim().length > 0) {
    return size;
  }
  if (Number.isFinite(fallbackValue)) {
    return `${fallbackValue.toFixed(fallbackValue >= 10 ? 0 : 1)}′`;
  }
  return '—';
}

function formatMonths(months) {
  if (!Array.isArray(months) || months.length === 0) {
    return '—';
  }
  const names = months
    .map((month) => MONTH_NAMES[month - 1])
    .filter(Boolean);
  if (names.length === 0) return '—';
  return names.join(' • ');
}

function formatHighlightMonths(months) {
  if (!Array.isArray(months) || months.length === 0) {
    return null;
  }
  const seen = new Set();
  const ordered = [];
  months.forEach((value) => {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12 && !seen.has(numeric)) {
      seen.add(numeric);
      ordered.push(numeric);
    }
  });
  if (ordered.length === 0) {
    return null;
  }
  if (ordered.length === 12) {
    return 'Toute l’année';
  }
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const start = MONTH_SHORT_NAMES[first - 1] || null;
  const end = MONTH_SHORT_NAMES[last - 1] || null;
  if (!start || !end) {
    return null;
  }
  if (first === last || ordered.length === 1) {
    return start;
  }
  return `${start} – ${end}`;
}

function renderHighlights(object, dossier) {
  if (!highlightsList) return;
  highlightsList.innerHTML = '';
  const items = [];
  const typeLabel = object.category || object.type;
  if (typeLabel) {
    items.push({ icon: '🔭', text: typeLabel });
  }
  if (object.constellation) {
    items.push({ icon: '✴️', text: object.constellation });
  }
  if (Number.isFinite(object.magnitude)) {
    items.push({ icon: '💡', text: `Mag ${object.magnitude.toFixed(1)}` });
  }
  const angularSizeText = formatAngularSize(dossier?.angularSize, object.angularSizeArcmin ?? object.angularSize);
  if (angularSizeText && angularSizeText !== '—') {
    items.push({ icon: '📏', text: angularSizeText });
  }
  const monthsHighlight = formatHighlightMonths(object.bestMonths);
  if (monthsHighlight) {
    items.push({ icon: '🗓️', text: `Saison ${monthsHighlight}` });
  }
  const distanceText = formatDistance(dossier?.distanceLy ?? object.distanceLy);
  if (distanceText && distanceText !== '—') {
    items.push({ icon: '🌌', text: distanceText });
  }
  const limited = items.slice(0, 6);
  limited.forEach((item) => {
    const li = document.createElement('li');
    if (item.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.textContent = item.icon;
      li.appendChild(iconSpan);
    }
    const textSpan = document.createElement('span');
    textSpan.textContent = item.text;
    li.appendChild(textSpan);
    highlightsList.appendChild(li);
  });
  highlightsList.hidden = limited.length === 0;
}

function renderUsage(object) {
  if (!usageSection || !usageList) return;
  usageList.innerHTML = '';
  const weights = object?.observationWeights || {};
  const entries = [
    { key: 'visual', label: 'Observation visuelle', icon: '👁️' },
    { key: 'astrophoto', label: 'Astrophotographie', icon: '📷' },
    { key: 'research', label: 'Recherche & CROA', icon: '🔬' }
  ]
    .map((entry) => {
      const value = Number(weights[entry.key]);
      if (!Number.isFinite(value)) return null;
      return { ...entry, value: Math.max(0, Math.min(1.5, value)) };
    })
    .filter(Boolean);

  if (entries.length === 0) {
    usageSection.hidden = true;
    return;
  }

  const maxWeight = entries.reduce((acc, entry) => Math.max(acc, entry.value), 0);

  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'object-usage-item';
    if (maxWeight > 0 && Math.abs(entry.value - maxWeight) < 0.05) {
      li.classList.add('object-usage-item--best');
    }

    const label = document.createElement('div');
    label.className = 'object-usage-label';
    if (entry.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.textContent = entry.icon;
      label.appendChild(iconSpan);
    }
    const textSpan = document.createElement('span');
    textSpan.textContent = entry.label;
    label.appendChild(textSpan);
    li.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'object-usage-bar';
    const meter = document.createElement('div');
    meter.className = 'object-usage-meter';
    const fill = document.createElement('span');
    const fillValue = Math.max(0, Math.min(1, entry.value / 1.5));
    fill.style.setProperty('--fill', fillValue.toFixed(3));
    meter.appendChild(fill);
    bar.appendChild(meter);

    const score = document.createElement('div');
    score.className = 'object-usage-score';
    const percent = Math.round(fillValue * 100);
    score.textContent = `Score ${percent}% • indice ${entry.value.toFixed(2)}`;
    bar.appendChild(score);

    li.appendChild(bar);
    usageList.appendChild(li);
  });

  usageSection.hidden = false;
}

function updateMediaMeta(detail) {
  if (!mediaMeta || !mediaCreditLine) return;
  if (!detail) {
    mediaMeta.hidden = true;
    mediaCreditLine.textContent = '';
    if (mediaLink) {
      mediaLink.hidden = true;
      mediaLink.removeAttribute('href');
      mediaLink.textContent = '';
    }
    return;
  }
  mediaMeta.hidden = false;
  mediaCreditLine.textContent = detail.credit || 'Visuel généré par Astro Soir';
  if (mediaLink) {
    if (detail.url) {
      mediaLink.hidden = false;
      mediaLink.href = detail.url;
      mediaLink.textContent = detail.provider ? `Source : ${detail.provider}` : 'Voir la source';
    } else {
      mediaLink.hidden = true;
      mediaLink.removeAttribute('href');
      mediaLink.textContent = '';
    }
  }
}

function updateMediaSourceList(detail) {
  if (!mediaSourceItem) return;
  mediaSourceItem.innerHTML = '';
  if (!detail) {
    const pending = document.createElement('span');
    pending.textContent =
      mediaCandidateSources && Array.isArray(mediaCandidateSources.sources) && mediaCandidateSources.sources.length > 0
        ? 'Crédit visuel : vérification en cours…'
        : 'Visuel : chargement en cours…';
    mediaSourceItem.appendChild(pending);
    return;
  }
  if (detail.isFallback) {
    const strong = document.createElement('strong');
    strong.textContent = 'Visuel :';
    mediaSourceItem.appendChild(strong);
    mediaSourceItem.append(
      ' Visualisation générée par Astro Soir — aucune source photographique confirmée.'
    );
    return;
  }
  const strong = document.createElement('strong');
  strong.textContent = 'Crédit visuel :';
  mediaSourceItem.appendChild(strong);
  mediaSourceItem.append(' ');
  mediaSourceItem.append(detail.credit || 'Source télescopique');
  if (detail.url) {
    mediaSourceItem.append(' — ');
    const link = document.createElement('a');
    link.href = detail.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = detail.provider || 'Voir la source';
    mediaSourceItem.appendChild(link);
  }
}

function applyMediaDetail(detail) {
  currentMediaDetail = detail || null;
  updateMediaMeta(currentMediaDetail);
  updateMediaSourceList(currentMediaDetail);
}

function createFact(term, detail) {
  const container = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = detail;
  container.appendChild(dt);
  container.appendChild(dd);
  return container;
}

function formatSessionContext(snapshot) {
  if (!snapshot) {
    return "Aucune analyse récente trouvée. Retourne sur la page principale pour lancer un calcul.";
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

async function loadCatalogueObject(request) {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger les catalogues.');
  }
  const payload = await response.json();
  const { catalogues, objects } = parseCataloguePayload(payload);
  catalogueDefinitions = catalogues;
  catalogueMetaMap.clear();
  catalogues.forEach((catalogue) => {
    if (catalogue?.id) {
      catalogueMetaMap.set(catalogue.id, catalogue);
    }
  });
  const enriched = enrichCatalogueData(objects);
  let target = null;
  if (request?.slug) {
    target = enriched.find((entry) => entry.slug === request.slug);
  }
  if (!target && request?.catalogueId && Number.isFinite(request.number)) {
    target = enriched.find(
      (entry) => entry.primaryCatalogueId === request.catalogueId && Number(entry.number) === Number(request.number)
    );
  }
  if (!target && Number.isFinite(request?.number)) {
    target = enriched.find((entry) => entry.primaryCatalogueId === 'messier' && Number(entry.number) === Number(request.number));
  }
  if (!target && request?.slug) {
    const normalizedSlug = request.slug.toLowerCase();
    target = enriched.find((entry) => entry.slug === normalizedSlug);
  }
  return { object: target || null, catalogues, objects: enriched };
}

function normaliseEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  if (entry.metrics && typeof entry.metrics === 'object') {
    return entry.metrics;
  }
  return entry;
}

function findMetrics(snapshot, object) {
  if (!snapshot || !object) {
    return null;
  }
  const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
  const slugKey = object.slug;
  const bySlug = slugKey ? entries.find((entry) => entry.object?.slug === slugKey || entry.objectSlug === slugKey) : null;
  const byCatalogueNumber = entries.find(
    (entry) =>
      entry.object?.primaryCatalogueId === object.primaryCatalogueId &&
      Number(entry.object?.number ?? entry.objectNumber) === Number(object.number)
  );
  const byNumber = entries.find((entry) => Number(entry.object?.number ?? entry.objectNumber) === Number(object.number));
  const byName = entries.find((entry) => entry.object?.name === object.name);
  const candidate =
    normaliseEntry(bySlug) || normaliseEntry(byCatalogueNumber) || normaliseEntry(byNumber) || normaliseEntry(byName);
  if (candidate && Number.isFinite(candidate.score)) {
    return candidate;
  }
  const context = snapshot.context;
  const weather = snapshot.weather;
  const observationDate = context?.dateISO ? new Date(context.dateISO) : null;
  if (
    context &&
    weather &&
    observationDate instanceof Date &&
    !Number.isNaN(observationDate.getTime())
  ) {
    const moonIllumination = snapshot?.moon?.illumination ?? computeMoonPhase(observationDate).illumination ?? 0;
    const evaluated = evaluateTargets([object], {
      lat: context.latitude,
      lon: context.longitude,
      bortle: context.bortle,
      date: observationDate,
      durationHours: context.durationHours,
      moonIllumination
    });
    const scored = applyWeather(evaluated, weather, {
      context: {
        latitude: context.latitude,
        longitude: context.longitude,
        durationHours: context.durationHours,
        date: observationDate
      }
    });
    return scored && scored[0] ? scored[0] : null;
  }
  return null;
}

function renderMedia(object) {
  mediaContainer.innerHTML = '';
  mediaCandidateSources = resolveImageSources(object);
  applyMediaDetail(null);
  const preview = createObservationPreview(object, { sourcesOverride: mediaCandidateSources });
  preview.classList.add('object-preview');
  preview.addEventListener('preview:resolved', (event) => {
    applyMediaDetail(event.detail);
  });
  mediaContainer.appendChild(preview);
}

function renderFacts(object, dossier) {
  facts.innerHTML = '';
  const typeLabel = object.category || object.type || 'Objet du catalogue';
  const magnitudeText = Number.isFinite(object.magnitude) ? `Mag ${object.magnitude.toFixed(1)}` : '—';
  const distanceText = formatDistance(dossier?.distanceLy ?? object.distanceLy);
  const angularSizeText = formatAngularSize(dossier?.angularSize, object.angularSizeArcmin ?? object.angularSize);
  const raText = formatRightAscension(object.raHours);
  const decText = formatDeclination(object.decDeg);
  const recommendedBortle = Number.isFinite(object.recommendedBortle)
    ? object.recommendedBortle
    : object.minBortle;
  const bortleText = Number.isFinite(recommendedBortle) ? `Bortle ${recommendedBortle}` : '—';
  const monthsText = formatMonths(object.bestMonths);
  const surfaceBrightnessText = Number.isFinite(object.surfaceBrightness)
    ? `${object.surfaceBrightness.toFixed(1)} mag/arcsec²`
    : '—';
  const cataloguesText = formatCatalogueList(
    Array.isArray(object.catalogueRefs) && object.catalogueRefs.length > 0
      ? object.catalogueRefs
      : object.primaryCatalogueId
      ? [object.primaryCatalogueId]
      : []
  );

  [
    ['Classification', typeLabel],
    ['Catalogue(s)', cataloguesText],
    ['Magnitude', magnitudeText],
    ['Brillance surfacique', surfaceBrightnessText],
    ['Constellation', object.constellation || '—'],
    ['Ascension droite', raText],
    ['Déclinaison', decText],
    ['Distance', distanceText],
    ['Taille apparente', angularSizeText],
    ['Fenêtre idéale', monthsText],
    ['Indice Bortle recommandé', bortleText]
  ].forEach(([term, detail]) => {
    facts.appendChild(createFact(term, detail));
  });
}

function renderNarrative(object, dossier) {
  const story = dossier?.story || object.description ||
    "Cette entrée attend encore son récit détaillé.";
  const observation = dossier?.observation ||
    "Ajoute cette cible à ta liste pour documenter tes propres impressions d'observation.";
  storyParagraph.textContent = story;
  observationParagraph.textContent = observation;
  storySection.hidden = !story && !observation;
}

function renderSources(object, dossier) {
  sourcesList.innerHTML = '';
  mediaSourceItem = document.createElement('li');
  mediaSourceItem.className = 'object-source-list__media';

  const documentation = [];
  if (Array.isArray(dossier?.sources)) {
    dossier.sources.forEach((source) => {
      if (source && source.label) {
        const li = document.createElement('li');
        if (source.url) {
          const link = document.createElement('a');
          link.href = source.url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          link.textContent = source.label;
          li.appendChild(link);
        } else {
          li.textContent = source.label;
        }
        documentation.push(li);
      }
    });
  }

  if (documentation.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Aucune source documentaire ajoutée pour le moment.';
    documentation.push(empty);
  }

  sourcesList.appendChild(mediaSourceItem);
  documentation.forEach((item) => sourcesList.appendChild(item));
  updateMediaSourceList(currentMediaDetail);
  if (sourcesSection) {
    sourcesSection.hidden = false;
  }
}

function renderSessionMetrics(metrics) {
  if (!metrics) {
    sessionFacts.appendChild(createFact('Disponibilité', 'Aucun score calculé pour cette cible.'));
    return;
  }
  const rawScore = Number.isFinite(metrics.score) ? Math.round(metrics.score * 100) : null;
  const scoreValue = rawScore !== null ? Math.max(0, Math.min(100, rawScore)) : null;
  const scoreTone = scoreValue !== null ? resolveScoreTone(scoreValue, { scale: 100 }) : 'neutral';
  const scoreLabel = scoreValue !== null ? `${scoreValue}/100` : '—';
  const bestTime = formatLocalTime(metrics.bestTime) || '—';
  const altitude = formatAltitude(metrics.altitude);
  const averageAltitude = formatAltitude(metrics.averageAltitude);
  const startAltitude = formatAltitude(metrics.startAltitude);
  const endAltitude = formatAltitude(metrics.endAltitude);
  const azimuth = describeAzimuth(metrics.azimuth);
  const coveragePercent = Number.isFinite(metrics.visibilityRatio)
    ? Math.round(metrics.visibilityRatio * 100)
    : null;
  const visibleSamples = Number.isFinite(metrics.visibleSamples) ? metrics.visibleSamples : null;
  const coverageText =
    coveragePercent === null
      ? '—'
      : `${coveragePercent}%${visibleSamples !== null ? ` (${visibleSamples} point${visibleSamples > 1 ? 's' : ''})` : ''}`;
  const scoreFact = createFact('Score de visibilité', scoreLabel);
  if (scoreTone !== 'neutral') {
    scoreFact.dataset.tone = scoreTone;
    const dd = scoreFact.querySelector('dd');
    if (dd) {
      dd.dataset.tone = scoreTone;
    }
  }
  sessionFacts.appendChild(scoreFact);
  [
    ['Moment idéal', bestTime],
    ['Altitude maximale', altitude],
    ['Azimut optimal', azimuth],
    ['Altitude moyenne', averageAltitude],
    ['Couverture de la session', coverageText],
    ['Début de session', `${startAltitude} • ${describeAzimuth(metrics.startAzimuth)}`],
    ['Fin de session', `${endAltitude} • ${describeAzimuth(metrics.endAzimuth)}`]
  ].forEach(([term, detail]) => {
    sessionFacts.appendChild(createFact(term, detail));
  });
}

function renderSession(snapshot, metrics) {
  if (sessionSection) {
    sessionSection.hidden = false;
  }
  sessionFacts.innerHTML = '';
  sessionSummary.textContent = formatSessionContext(snapshot);
  const moon = snapshot?.moon || (snapshot?.context?.dateISO ? computeMoonPhase(new Date(snapshot.context.dateISO)) : null);
  if (moon && Number.isFinite(moon.illumination)) {
    sessionFacts.appendChild(
      createFact('Phase lunaire', `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)}`)
    );
    if (moon.rise || moon.set) {
      const riseText = moon.rise ? formatLocalDateTime(moon.rise) : '—';
      const setText = moon.set ? formatLocalDateTime(moon.set) : '—';
      sessionFacts.appendChild(createFact('Lever / coucher de Lune', `${riseText} • ${setText}`));
    }
  }
  renderSessionMetrics(metrics);
}

async function bootstrap() {
  const request = parseObjectRequest();
  if (!request.slug && !Number.isFinite(request.number)) {
    message.textContent =
      'Aucun identifiant de catalogue valide fourni. Retourne au catalogue pour sélectionner une cible.';
    article.hidden = true;
    return;
  }

  try {
    const [{ object }, snapshot] = await Promise.all([
      loadCatalogueObject(request),
      Promise.resolve(readSessionSnapshot())
    ]);

    if (!object) {
      message.textContent =
        "Impossible de trouver cette cible dans les catalogues chargés. Vérifie ta sélection depuis la page principale.";
      article.hidden = true;
      return;
    }

    const dossier = object.primaryCatalogueId === 'messier' ? getObjectDossier(object.number) : null;
    const metrics = findMetrics(snapshot, object);
    const displayLabel = buildObjectLabel(object);
    const catalogueLabel = formatCatalogueList(
      Array.isArray(object.catalogueRefs) && object.catalogueRefs.length > 0
        ? object.catalogueRefs
        : object.primaryCatalogueId
        ? [object.primaryCatalogueId]
        : []
    );

    heading.textContent = `Fiche catalogue — ${displayLabel}`;
    baseline.textContent = `Analyse détaillée de ${object.name}.`;
    label.textContent = displayLabel;
    title.textContent = object.name;
    const typeLabel = object.category || object.type || 'Objet du catalogue';
    const subtitleParts = [typeLabel, object.constellation];
    if (catalogueLabel && catalogueLabel !== '—') {
      subtitleParts.push(catalogueLabel);
    }
    subtitle.textContent = subtitleParts.filter(Boolean).join(' • ');
    document.title = `Astro Soir — ${object.name}`;

    renderHighlights(object, dossier);
    renderMedia(object);
    renderFacts(object, dossier);
    renderUsage(object);
    renderNarrative(object, dossier);
    renderSources(object, dossier);
    renderSession(snapshot, metrics);

    article.hidden = false;
    message.textContent = '';
  } catch (error) {
    console.error(error);
    message.textContent = "Impossible de charger cette fiche pour le moment. Vérifie ta connexion ou réessaie plus tard.";
    article.hidden = true;
  }
}

bootstrap();
