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

function parseMessierNumber() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('m') || params.get('number') || params.get('id');
  if (!raw) {
    return null;
  }
  const value = Number.parseInt(raw.replace(/[^0-9-]/g, ''), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
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

function formatAngularSize(size) {
  if (!size) return '—';
  return size;
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

async function loadCatalogueObject(number) {
  const response = await fetch('objects.json');
  if (!response.ok) {
    throw new Error('Impossible de charger les objets Messier.');
  }
  const data = await response.json();
  const enriched = enrichCatalogueData(data);
  return enriched.find((entry) => Number(entry.number) === number) || null;
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
  const byNumber = entries.find((entry) => Number(entry.object?.number ?? entry.objectNumber) === Number(object.number));
  const byName = entries.find((entry) => entry.object?.name === object.name);
  const candidate = normaliseEntry(byNumber) || normaliseEntry(byName);
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
  const typeLabel = object.category || object.type || 'Objet Messier';
  const magnitudeText = Number.isFinite(object.magnitude) ? `Mag ${object.magnitude.toFixed(1)}` : '—';
  const distanceText = formatDistance(dossier?.distanceLy ?? object.distanceLy);
  const angularSizeText = formatAngularSize(dossier?.angularSize || object.angularSize);
  const raText = formatRightAscension(object.raHours);
  const decText = formatDeclination(object.decDeg);
  const bortleText = Number.isFinite(object.minBortle) ? `Bortle ${object.minBortle}` : '—';
  const monthsText = formatMonths(object.bestMonths);

  [
    ['Classification', typeLabel],
    ['Magnitude', magnitudeText],
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
    "Cette entrée Messier attend encore son récit détaillé.";
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
  const messierNumber = parseMessierNumber();
  if (!messierNumber) {
    message.textContent = 'Aucun numéro Messier valide fourni. Retourne au catalogue pour sélectionner un objet.';
    article.hidden = true;
    return;
  }

  try {
    const [object, snapshot] = await Promise.all([
      loadCatalogueObject(messierNumber),
      Promise.resolve(readSessionSnapshot())
    ]);

    if (!object) {
      message.textContent = `Impossible de trouver M${messierNumber} dans le catalogue.`;
      article.hidden = true;
      return;
    }

    const dossier = getObjectDossier(messierNumber);
    const metrics = findMetrics(snapshot, object);

    heading.textContent = `Fiche Messier — M${messierNumber}`;
    baseline.textContent = `Analyse détaillée de ${object.name}.`;
    label.textContent = `M${messierNumber}`;
    title.textContent = object.name;
    const typeLabel = object.category || object.type || 'Objet Messier';
    subtitle.textContent = [typeLabel, object.constellation].filter(Boolean).join(' • ');

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
