import {
  SESSION_STORAGE_KEY,
  buildWeatherSummary,
  computeDecisionInsights,
  formatAltitude,
  formatCoordinate,
  formatIllumination,
  formatLocalDateTime,
  formatLocalTime,
  describeAzimuth
} from './astro-core.js';

const summaryEl = document.getElementById('dashboardSummary');
const scoreEl = document.getElementById('dashboardScore');
const gaugeEl = document.getElementById('dashboardGauge');
const detailsEl = document.getElementById('dashboardDetails');
const contextEl = document.getElementById('dashboardContext');
const weatherEl = document.getElementById('dashboardWeather');
const moonEl = document.getElementById('dashboardMoon');
const alertsList = document.getElementById('dashboardAlerts');
const calendarList = document.getElementById('dashboardCalendar');
const astroSummaryEl = document.getElementById('dashboardAstroSummary');
const astroList = document.getElementById('dashboardAstroList');

function readSnapshot() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Impossible de relire la dernière session :', error);
    return null;
  }
}

function ensureDecision(snapshot) {
  if (!snapshot) return null;
  if (snapshot.decisionSupport && Number.isFinite(snapshot.decisionSupport.globalScore)) {
    return snapshot.decisionSupport;
  }
  if (Array.isArray(snapshot.entries) && snapshot.entries.length > 0) {
    try {
      return computeDecisionInsights(snapshot.entries, {
        weather: snapshot.weather,
        moon: snapshot.moon,
        context: snapshot.context,
        objects: snapshot.entries.map((entry) => entry.object),
        equipment: snapshot.astroSettings,
        nights: 4
      });
    } catch (error) {
      console.warn('Impossible de reconstruire la décision :', error);
    }
  }
  return null;
}

function renderContext(snapshot) {
  if (!contextEl) return;
  if (!snapshot?.context) {
    contextEl.textContent = 'Aucune session enregistrée. Retourne sur la page principale pour lancer une analyse.';
    return;
  }
  const { latitude, longitude, localDate, localTime, durationHours, bortle } = snapshot.context;
  const bortleSummary = snapshot.context?.bortleSummary;
  const latText = Number.isFinite(latitude) ? `${formatCoordinate(latitude)}°` : '—';
  const lonText = Number.isFinite(longitude) ? `${formatCoordinate(longitude)}°` : '—';
  const when = localDate && localTime ? `${localDate} à ${localTime}` : 'date inconnue';
  const duration = Number.isFinite(durationHours) ? `${durationHours} h` : 'durée inconnue';
  const bortleText = Number.isFinite(bortle) ? `Bortle ${bortle}` : 'Bortle ?';
  const summarySuffix = bortleSummary ? ` ${bortleSummary}` : '';
  contextEl.textContent = `Session du ${when} (${duration}) — lat ${latText}, lon ${lonText}, ${bortleText}.${summarySuffix}`;
}

function renderWeather(snapshot) {
  if (!weatherEl) return;
  if (!snapshot?.weather) {
    weatherEl.textContent = 'Résumé météo indisponible.';
    return;
  }
  weatherEl.textContent = buildWeatherSummary(snapshot.weather);
}

function renderMoon(snapshot) {
  if (!moonEl) return;
  const moon = snapshot?.moon;
  if (!moon) {
    moonEl.textContent = 'Phase lunaire non calculée.';
    return;
  }
  moonEl.textContent = `${moon.emoji ?? '🌙'} ${moon.name} — ${formatIllumination(moon.illumination)} éclairée.`;
}

function renderAlerts(decision) {
  if (!alertsList) return;
  alertsList.innerHTML = '';
  if (!decision || !Array.isArray(decision.alerts) || decision.alerts.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Aucune alerte détectée pour la dernière session.';
    alertsList.appendChild(item);
    return;
  }
  decision.alerts.forEach((alert) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = alert.object?.name ?? 'Cible recommandée';
    const span = document.createElement('span');
    const start = alert.windowStart ? formatLocalTime(alert.windowStart) : null;
    const end = alert.windowEnd ? formatLocalTime(alert.windowEnd) : null;
    const peak = formatLocalTime(alert.peak);
    const altitude = formatAltitude(alert.altitude);
    const direction = alert.direction || describeAzimuth(alert.object?.azimuth);
    const windowText = start && end ? `Fenêtre ${start} → ${end}` : `Moment idéal ${peak}`;
    const scoreText = Number.isFinite(alert.score) ? `${Math.round(alert.score * 100)}/100` : '—';
    span.textContent = `${windowText} • ${altitude} • ${direction} • Score ${scoreText}`;
    item.appendChild(title);
    item.appendChild(span);
    alertsList.appendChild(item);
  });
}

function renderCalendar(decision) {
  if (!calendarList) return;
  calendarList.innerHTML = '';
  if (!decision || !Array.isArray(decision.calendar) || decision.calendar.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Relance une analyse pour générer le calendrier des fenêtres.';
    calendarList.appendChild(item);
    return;
  }
  decision.calendar.forEach((entry) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.object?.name ?? 'Objet céleste';
    const span = document.createElement('span');
    const rows = entry.windows
      .slice(0, 4)
      .map((window) => {
        const date = window.dateISO ? new Date(window.dateISO) : null;
        const day = date
          ? date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' })
          : '—';
        const time = formatLocalTime(window.bestTime);
        const altitude = formatAltitude(window.altitude);
        const score = Number.isFinite(window.score ?? window.baseScore)
          ? `${Math.round((window.score ?? window.baseScore) * 100)}/100`
          : '—';
        const moonLabel = window.moonPhase?.emoji ? `${window.moonPhase.emoji} ${window.moonPhase.name}` : '';
        return `${day} • ${time} • ${altitude} • ${score}${moonLabel ? ` • ${moonLabel}` : ''}`;
      });
    span.innerHTML = rows.join('<br>');
    item.appendChild(title);
    item.appendChild(span);
    calendarList.appendChild(item);
  });
}

function renderAstrophoto(decision) {
  if (!astroSummaryEl || !astroList) return;
  astroList.innerHTML = '';
  const astro = decision?.astrophoto;
  if (!astro || !astro.active) {
    astroSummaryEl.textContent =
      'Active le mode astrophotographie sur la page principale pour obtenir des recommandations personnalisées.';
    return;
  }
  astroSummaryEl.textContent = `${astro.profileLabel ?? 'Mode photo'} — ${astro.profileDescription ?? ''}`;
  if (!Array.isArray(astro.recommendations) || astro.recommendations.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Aucune cible photo prioritaire avec les conditions actuelles.';
    astroList.appendChild(item);
    return;
  }
  astro.recommendations.forEach((entry) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.object?.name ?? 'Cible photo';
    const span = document.createElement('span');
    const astroScore = Number.isFinite(entry.astroScore) ? `${Math.round(entry.astroScore * 100)}/100` : '—';
    const globalScore = Number.isFinite(entry.score ?? entry.baseScore)
      ? `${Math.round((entry.score ?? entry.baseScore) * 100)}/100`
      : '—';
    span.textContent = `${formatLocalTime(entry.bestTime)} • ${formatAltitude(entry.altitude)} • ${describeAzimuth(
      entry.azimuth
    )} • Photo ${astroScore} • Global ${globalScore}`;
    item.appendChild(title);
    item.appendChild(span);
    astroList.appendChild(item);
  });
}

function renderScore(decision, snapshot) {
  if (!scoreEl || !gaugeEl || !detailsEl) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    scoreEl.textContent = '—';
    gaugeEl.style.width = '0%';
    detailsEl.textContent = 'Score indisponible.';
    return;
  }
  const score = Math.max(0, Math.min(100, Math.round(decision.globalScore * 100)));
  scoreEl.textContent = `${score}/100`;
  gaugeEl.style.width = `${score}%`;
  const aggregates = decision.aggregates ?? {};
  const moonPercent = Number.isFinite(aggregates.moonIllumination)
    ? `${Math.round(aggregates.moonIllumination * 100)}%`
    : '—';
  const avgAltitude = Number.isFinite(aggregates.avgAltitude) ? `${Math.round(aggregates.avgAltitude)}°` : '—';
  const avgVisibility = Number.isFinite(aggregates.avgVisibility)
    ? `${Math.round(aggregates.avgVisibility * 100)}%`
    : '—';
  const skyWindow = Number.isFinite(aggregates.weather?.skyWindow)
    ? `${Math.round(aggregates.weather.skyWindow * 100)}%`
    : '—';
  const atmosphere = Number.isFinite(aggregates.weather?.atmosphere)
    ? `${Math.round(aggregates.weather.atmosphere * 100)}%`
    : '—';
  const generated = snapshot?.generatedAt ? formatLocalDateTime(snapshot.generatedAt) : null;
  const parts = [
    `Altitude moyenne ${avgAltitude}`,
    `Couverture ${avgVisibility}`,
    `Fenêtre ciel ${skyWindow}`,
    `Atmosphère ${atmosphere}`,
    `Lune ${moonPercent}`
  ];
  if (generated) {
    parts.push(`Synthèse générée le ${generated}`);
  }
  detailsEl.textContent = parts.join(' • ');
}

function renderSummary(decision, snapshot) {
  if (!summaryEl) return;
  if (!decision || !Number.isFinite(decision.globalScore)) {
    summaryEl.textContent = 'Aucune analyse récente. Retourne sur la page principale pour lancer un calcul.';
    return;
  }
  summaryEl.textContent = decision.globalSummary;
}

function bootstrap() {
  const snapshot = readSnapshot();
  const decision = ensureDecision(snapshot);
  renderSummary(decision, snapshot);
  renderScore(decision, snapshot);
  renderContext(snapshot);
  renderWeather(snapshot);
  renderMoon(snapshot);
  renderAlerts(decision);
  renderCalendar(decision);
  renderAstrophoto(decision);
}

bootstrap();
