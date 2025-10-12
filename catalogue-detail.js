import {
  SESSION_STORAGE_KEY,
  applyWeather,
  computeMoonPhase,
  describeAzimuth,
  describeAerosolLoad,
  describeDewRisk,
  describeSeeingQuality,
  describeTransparencyQuality,
  enrichCatalogueData,
  evaluateTargets,
  formatAltitude,
  formatArcseconds,
  formatCoordinate,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime
} from './astro-core.js';
import { createObservationPreview, resolveImageSources } from './catalogue-media.js';
import { getObjectDossier } from './object-dossiers.js';

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

const catalogueMetaMap = new Map();
let catalogueDefinitions = [];

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
    const scored = applyWeather(evaluated, weather);
    return scored && scored[0] ? scored[0] : null;
  }
  return null;
}

function formatFactor(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function renderMedia(object) {
  mediaContainer.innerHTML = '';
  const preview = createObservationPreview(object);
  preview.classList.add('object-preview');
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
  const bortleText = Number.isFinite(object.minBortle) ? `Bortle ${object.minBortle}` : '—';
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
    ['Indice Bortle conseillé', bortleText]
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
  const items = [];
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
        items.push(li);
      }
    });
  }
  const mediaSources = resolveImageSources(object);
  if (mediaSources) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Crédit visuel :</strong> ${mediaSources.credit || 'Source télescopique'}`;
    if (Array.isArray(mediaSources.sources) && mediaSources.sources.length > 0) {
      const nested = document.createElement('ul');
      mediaSources.sources.forEach((url) => {
        if (!url) return;
        const nestedItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = url;
        nestedItem.appendChild(link);
        nested.appendChild(nestedItem);
      });
      li.appendChild(nested);
    }
    items.push(li);
  }
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Aucune source documentée pour le moment.';
    items.push(empty);
  }
  items.forEach((node) => sourcesList.appendChild(node));
  sourcesSection.hidden = false;
}

function renderSessionMetrics(metrics) {
  if (!metrics) {
    sessionFacts.appendChild(createFact('Disponibilité', 'Aucun score calculé pour cette cible.'));
    return;
  }
  const scoreValue = Math.max(0, Math.min(100, Math.round((metrics.score ?? 0) * 100)));
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
  const drift = Number.isFinite(metrics.altitudeDrift) ? metrics.altitudeDrift : null;
  const driftText = drift === null ? '—' : `${drift >= 0 ? '+' : ''}${drift.toFixed(0)}°`;
  const seeingLabel = metrics.seeingText || describeSeeingQuality(metrics.seeingFactor ?? metrics.seeingIndex);
  const seeingPercent = formatFactor(metrics.seeingFactor ?? metrics.seeingIndex);
  const seeingArcsec = formatArcseconds(metrics.seeingArcsec);
  const transparencyLabel =
    metrics.transparencyText || describeTransparencyQuality(metrics.transparencyFactor ?? metrics.transparencyIndex);
  const transparencyPercent = formatFactor(metrics.transparencyFactor ?? metrics.transparencyIndex);
  const aerosolLabel = metrics.aerosolText || describeAerosolLoad();
  const aerosolPercent = formatFactor(metrics.aerosolFactor ?? metrics.transparencyFactor);
  const dewLabel = metrics.dewRiskText || describeDewRisk();
  const dewPercent = formatFactor(metrics.dewFactor ?? metrics.dewIndex);
  const moonFactor = formatFactor(metrics.moonFactor);
  const bortleFactor = formatFactor(metrics.bortleFactor);

  [
    ['Score de visibilité', `${scoreValue}/100`],
    ['Moment idéal', bestTime],
    ['Altitude maximale', altitude],
    ['Azimut optimal', azimuth],
    ['Altitude moyenne', averageAltitude],
    ['Début de session', `${startAltitude} • ${describeAzimuth(metrics.startAzimuth)}`],
    ['Fin de session', `${endAltitude} • ${describeAzimuth(metrics.endAzimuth)}`],
    ['Variation sur la fenêtre', driftText],
    ['Temps au-dessus de 15°', coverageText],
    ['Seeing', `${seeingLabel} (${seeingPercent} • ${seeingArcsec})`],
    ['Transparence', `${transparencyLabel} (${transparencyPercent})`],
    ['Aérosols', `${aerosolLabel} (${aerosolPercent})`],
    ['Risque de buée', `${dewLabel} (${dewPercent})`],
    ['Influence lunaire', moonFactor],
    ['Pollution lumineuse', bortleFactor]
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

    renderMedia(object);
    renderFacts(object, dossier);
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
