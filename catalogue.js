import {
  SESSION_STORAGE_KEY,
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

const SORT_BY = {
  number: 'number',
  score: 'score'
};

const SCORE_CLASSES = {
  high: 'score-good',
  medium: 'score-medium',
  low: 'score-low',
  none: 'score-none'
};

let catalogueEntries = [];
let currentSort = SORT_BY.number;
let activeTypeFilters = [];

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
      return (a.object.number ?? 0) - (b.object.number ?? 0);
    });
    return sorted;
  }
  sorted.sort((a, b) => (a.object.number ?? 0) - (b.object.number ?? 0));
  return sorted;
}

function readTypeSelection() {
  if (!catalogueTypeOptions) return [];
  return Array.from(catalogueTypeOptions.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
}

function updateCatalogueFilterSummary(count = 0, total = 0) {
  if (!catalogueFilterSummary) return;
  if (total === 0) {
    catalogueFilterSummary.textContent = 'Catalogue en cours de préparation.';
    return;
  }
  if (count === total && activeTypeFilters.length === 0) {
    catalogueFilterSummary.textContent = 'Tous les types sont affichés.';
  } else {
    catalogueFilterSummary.textContent = `${count} objets sur ${total} correspondent au filtre.`;
  }
}

function applyTypeFilter(entries) {
  if (!Array.isArray(entries)) return [];
  if (!activeTypeFilters || activeTypeFilters.length === 0) return entries;
  return entries.filter(({ object }) => activeTypeFilters.includes(object.category || object.type));
}

function populateCatalogueTypeFilter(objects) {
  if (!catalogueTypeOptions) return;
  catalogueTypeOptions.innerHTML = '';
  const categories = Array.from(new Set(objects.map((object) => object.category))).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );
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
    span.textContent = category;
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
  updateCatalogueFilterSummary(objects.length, objects.length);
}

function renderCatalogue(entries) {
  catalogueGrid.innerHTML = '';
  entries.forEach(({ object, metrics }) => {
    catalogueGrid.appendChild(buildCard(object, metrics));
  });
}

function updateCatalogue() {
  if (!Array.isArray(catalogueEntries) || catalogueEntries.length === 0) {
    catalogueGrid.innerHTML = '';
    updateCatalogueFilterSummary(0, 0);
    return;
  }
  const filtered = applyTypeFilter(catalogueEntries);
  const sorted = sortEntries(filtered, currentSort);
  renderCatalogue(sorted);
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
    throw new Error('Impossible de charger les objets Messier.');
  }
  const data = await response.json();
  return enrichCatalogueData(data);
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

function renderSessionWeather(weather) {
  if (!sessionWeather) return;
  sessionWeather.textContent = buildWeatherSummary(weather);
}

function renderSessionDecision(decision) {
  if (!sessionDecision) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    sessionDecision.textContent =
      'Score global indisponible. Lance une nouvelle analyse pour obtenir l’aide à la décision.';
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
    sessionMoon.textContent = 'Phase lunaire indisponible. Relance une analyse pour l\'actualiser.';
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
    empty.innerHTML = '<p>Aucun événement enregistré. Lance une nouvelle analyse pour obtenir les prochains phénomènes.</p>';
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

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed + 0x6d2b79f5;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawGalaxy(ctx, random) {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  const angle = random() * Math.PI;
  const major = 40 + random() * 40;
  const minor = major * (0.35 + random() * 0.15);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const steps = 40;
  for (let i = steps; i >= 1; i -= 1) {
    const t = i / steps;
    ctx.globalAlpha = 0.06 + 0.6 * Math.pow(1 - t, 1.5);
    ctx.fillStyle = `rgb(${Math.round(20 + t * 220)}, ${Math.round(20 + t * 220)}, ${Math.round(20 + t * 220)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, major * t, minor * t, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 4 + random() * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNebula(ctx, random) {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  const blobs = 6 + Math.floor(random() * 6);
  for (let i = 0; i < blobs; i += 1) {
    const size = 25 + random() * 40;
    const x = cx + (random() - 0.5) * 60;
    const y = cy + (random() - 0.5) * 60;
    ctx.globalAlpha = 0.08 + random() * 0.15;
    const grey = Math.round(100 + random() * 120);
    ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * (0.6 + random() * 0.6), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCluster(ctx, random) {
  const count = 90;
  for (let i = 0; i < count; i += 1) {
    const x = random() * ctx.canvas.width;
    const y = random() * ctx.canvas.height;
    const size = random() * 2.4;
    const light = Math.round(180 + random() * 75);
    ctx.globalAlpha = 0.4 + random() * 0.6;
    ctx.fillStyle = `rgb(${light}, ${light}, ${light})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOther(ctx, random) {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = 'rgba(220,220,220,0.6)';
  ctx.lineWidth = 2;
  const radius = 30 + random() * 40;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 25; i += 1) {
    const angle = random() * Math.PI * 2;
    const r = radius * random();
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.globalAlpha = 0.5 + random() * 0.4;
    const shade = Math.round(160 + random() * 80);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createPreview(object) {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  canvas.className = 'preview-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const random = createRandom(hashString(object.name));
  const type = object.type.toLowerCase();
  if (type.includes('galaxie')) {
    drawGalaxy(ctx, random);
  } else if (type.includes('nébuleuse')) {
    drawNebula(ctx, random);
  } else if (type.includes('amas')) {
    drawCluster(ctx, random);
  } else {
    drawOther(ctx, random);
  }
  return canvas;
}

function formatFactor(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function buildCard(object, metrics) {
  const score = metrics?.score ?? 0;
  const card = document.createElement('article');
  card.className = `catalogue-card ${classifyScore(score)}`;
  card.setAttribute('role', 'listitem');
  if (Number.isFinite(object.number)) {
    card.dataset.messier = `M${object.number}`;
  }

  const previewWrapper = document.createElement('div');
  previewWrapper.className = 'preview-wrapper';
  previewWrapper.appendChild(createPreview(object));

  const text = document.createElement('div');
  text.className = 'catalogue-text';
  const scoreValue = Math.round(score * 100);
  const scoreDisplay = Math.max(0, Math.min(100, scoreValue));
  const barWidth = scoreDisplay;
  const bestTime = formatLocalTime(metrics?.bestTime);
  const direction = describeAzimuth(metrics?.azimuth);
  const startDirection = describeAzimuth(metrics?.startAzimuth);
  const endDirection = describeAzimuth(metrics?.endAzimuth);
  const typeLabel = object.category || object.type || 'Objet céleste';
  const magnitudeText = Number.isFinite(object.magnitude) ? object.magnitude.toFixed(1) : '—';
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
      </div>
      <span class="score-chip">${scoreDisplay}/100</span>
    </header>
    <p>${object.description}</p>
    <dl class="target-metrics">
      <div><dt>Hauteur max</dt><dd>${formatAltitude(metrics?.altitude)}</dd></div>
      <div><dt>Altitude moyenne</dt><dd>${averageAltitudeText}</dd></div>
      <div><dt>Moment idéal</dt><dd>${bestTime}</dd></div>
    </dl>
    <div class="score-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></div>
  `;

  const factors = document.createElement('ul');
  factors.className = 'factor-list';
  factors.innerHTML = `
    <li>Type : <strong>${typeLabel}</strong></li>
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
      map.set(entry.object.name, entry);
    });
  }
  const context = snapshot?.context;
  const weather = snapshot?.weather;
  const observationDate = context?.dateISO ? new Date(context.dateISO) : null;
  const moonIllumination = snapshot?.moon?.illumination ?? (observationDate ? computeMoonPhase(observationDate).illumination : 0);
  objects.forEach((object) => {
    let metrics = map.get(object.name);
    if (
      !metrics &&
      context &&
      weather &&
      observationDate instanceof Date &&
      !Number.isNaN(observationDate.getTime())
    ) {
      const evaluated = evaluateTargets([object], {
        lat: context.latitude,
        lon: context.longitude,
        bortle: context.bortle,
        date: observationDate,
        durationHours: context.durationHours,
        moonIllumination
      });
      const scored = applyWeather(evaluated, weather);
      metrics = scored[0];
    }
    results.push({ object, metrics });
  });
  return results;
}

async function bootstrap() {
  try {
    const [objects, snapshot] = await Promise.all([loadCatalog(), Promise.resolve(readSessionSnapshot())]);
    sessionSummary.textContent = formatSessionContext(snapshot);
    renderSessionDetails(snapshot);
    const merged = mergeMetrics(objects, snapshot);
    catalogueEntries = merged;
    populateCatalogueTypeFilter(merged.map(({ object }) => object));
    updateCatalogue();
    if (snapshot) {
      catalogueHint.textContent = `${objects.length} objets listés — utilise le tri pour afficher les meilleures cibles en premier.`;
    } else {
      catalogueHint.textContent = `${objects.length} objets listés. `
        + 'Lance une analyse depuis la page principale pour obtenir les scores de visibilité.';
    }
    if (!snapshot && sessionPanel) {
      sessionPanel.classList.add('warning');
    }
  } catch (error) {
    console.error(error);
    catalogueHint.textContent = "Impossible de charger le catalogue pour le moment.";
  }
}

if (sortSelect) {
  sortSelect.value = SORT_BY.number;
  sortSelect.addEventListener('change', (event) => {
    const selected = event.target.value;
    if (selected === currentSort) {
      return;
    }
    currentSort = Object.values(SORT_BY).includes(selected) ? selected : SORT_BY.number;
    updateCatalogue();
  });
}

bootstrap();
