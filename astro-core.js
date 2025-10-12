import { getObjectDistanceLy } from './object-distances.js';

export const bortleDescriptions = {
  1: 'ciel exceptionnel',
  2: 'ciel de campagne',
  3: 'ciel rural',
  4: 'transition rural/suburbain',
  5: 'banlieue modérée',
  6: 'ciel périurbain',
  7: 'banlieue lumineuse',
  8: 'ville',
  9: 'centre-ville'
};

export const weatherCodes = {
  0: 'Ciel dégagé',
  1: 'Principalement clair',
  2: 'Partiellement nuageux',
  3: 'Couvert',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine',
  55: 'Bruine dense',
  56: 'Bruine verglaçante',
  57: 'Bruine verglaçante dense',
  61: 'Pluie faible',
  63: 'Pluie',
  65: 'Pluie forte',
  66: 'Pluie verglaçante faible',
  67: 'Pluie verglaçante',
  71: 'Neige légère',
  73: 'Neige',
  75: 'Fortes chutes de neige',
  80: 'Averses légères',
  81: 'Averses modérées',
  82: 'Fortes averses',
  95: 'Orage',
  96: 'Orage + grêle légère',
  99: 'Orage + grêle'
};

export const SESSION_STORAGE_KEY = 'astroSoir:lastSession';

const SYNODIC_MONTH = 29.53058867;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const MOON_PHASE_BUCKETS = [
  { maxAge: 1.84566, name: 'Nouvelle Lune', emoji: '🌑', description: 'Ciel le plus sombre, idéal pour les objets diffus.' },
  {
    maxAge: 5.53699,
    name: 'Croissant croissant',
    emoji: '🌒',
    description: 'Faible luminosité, la lueur lunaire reste limitée en début de nuit.'
  },
  { maxAge: 9.22831, name: 'Premier quartier', emoji: '🌓', description: 'La moitié du disque éclaire le ciel en première partie de nuit.' },
  {
    maxAge: 12.91963,
    name: 'Gibbeuse croissante',
    emoji: '🌔',
    description: 'Lumière lunaire marquée, privilégie les objets brillants ou l’observation en fin de nuit.'
  },
  { maxAge: 16.61096, name: 'Pleine Lune', emoji: '🌕', description: 'Éclairement maximal, observation difficile des objets faibles.' },
  {
    maxAge: 20.30228,
    name: 'Gibbeuse décroissante',
    emoji: '🌖',
    description: 'La Lune se lève tard, fenêtre plus sombre en début de nuit.'
  },
  { maxAge: 23.99361, name: 'Dernier quartier', emoji: '🌗', description: 'Moitié du disque visible en seconde partie de nuit.' },
  {
    maxAge: 27.68493,
    name: 'Croissant décroissant',
    emoji: '🌘',
    description: 'Lumière discrète juste avant l’aube.'
  },
  { maxAge: SYNODIC_MONTH + 0.1, name: 'Nouvelle Lune imminente', emoji: '🌑', description: 'Retour rapide à un ciel très sombre.' }
];

const METEOR_SHOWERS = [
  {
    name: 'Quadrantides',
    month: 1,
    day: 4,
    radiant: 'Bouvier/Dragon',
    peakRate: '120/h',
    description: 'Pluie intense mais courte, active début janvier.'
  },
  {
    name: 'Lyrides',
    month: 4,
    day: 22,
    radiant: 'Lyre',
    peakRate: '18/h',
    description: 'Pluie de printemps aux traînées persistantes.'
  },
  {
    name: 'Perséides',
    month: 8,
    day: 12,
    radiant: 'Persée',
    peakRate: '100/h',
    description: 'La pluie estivale incontournable, météores rapides et brillants.'
  },
  {
    name: 'Draconides',
    month: 10,
    day: 8,
    radiant: 'Dragon',
    peakRate: '10/h',
    description: 'Activité imprévisible, souvent visible tôt dans la soirée.'
  },
  {
    name: 'Orionides',
    month: 10,
    day: 21,
    radiant: 'Orion',
    peakRate: '20/h',
    description: 'Pluie issue de la comète de Halley, météores rapides.'
  },
  {
    name: 'Léonides',
    month: 11,
    day: 17,
    radiant: 'Lion',
    peakRate: '15/h',
    description: 'Peut offrir des sursauts spectaculaires certains cycles.'
  },
  {
    name: 'Géminides',
    month: 12,
    day: 14,
    radiant: 'Gémeaux',
    peakRate: '120/h',
    description: 'Pluie la plus régulière de l’année, météores colorés.'
  }
];

const RARE_EVENT_SERIES = [
  {
    label: 'Phénomène planétaire',
    name: 'Opposition de Saturne',
    icon: '🪐',
    start: Date.UTC(2024, 8, 8, 0, 0, 0),
    periodDays: 378,
    description:
      "Saturne culmine autour de l'opposition : visible toute la nuit avec ses anneaux bien inclinés. Date indicative, à vérifier selon ta longitude."
  },
  {
    label: 'Phénomène planétaire',
    name: 'Opposition de Jupiter',
    icon: '♃',
    start: Date.UTC(2023, 10, 3, 0, 0, 0),
    periodDays: 399,
    description:
      "Jupiter est en opposition : disque énorme, bandes nuageuses contrastées et transits de satellites visibles toute la nuit. Date approximative — confirme l'heure précise."
  },
  {
    label: 'Phénomène planétaire',
    name: 'Opposition de Mars',
    icon: '♂️',
    start: Date.UTC(2025, 0, 16, 0, 0, 0),
    periodDays: 780,
    description:
      'Mars revient en opposition (cycle de ~26 mois) : fenêtre rare pour ses détails de surface. Profite du diamètre apparent maximal.'
  },
  {
    label: 'Éclipse lunaire',
    name: 'Saison d’éclipse lunaire',
    icon: '🌕',
    start: Date.UTC(2024, 2, 25, 0, 0, 0),
    periodDays: 177,
    description:
      "Une éclipse lunaire est attendue autour de cette date. La visibilité dépend de ta localisation : consulte un almanach pour l'horaire exact."
  },
  {
    label: 'Éclipse solaire',
    name: 'Saison d’éclipse solaire',
    icon: '🌞',
    start: Date.UTC(2024, 3, 8, 0, 0, 0),
    periodDays: 177,
    description:
      "Fenêtre pour une éclipse solaire (totale ou annulaire selon la zone). Prépare un filtre adapté et vérifie les horaires officiels."
  }
];

const COMPASS_SECTORS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSO',
  'SO',
  'OSO',
  'O',
  'ONO',
  'NO',
  'NNO'
];

const ASTROPHOTO_PROFILES = [
  {
    id: 'visual',
    label: 'Observation visuelle (équilibré)',
    description: "Classement polyvalent pour la découverte et l'imagerie légère.",
    minAltitude: 15,
    maxMagnitude: 12,
    weights: { base: 0.45, altitude: 0.2, window: 0.15, brightness: 0.1, seeing: 0.05, transparency: 0.05 },
    categoryBoost: {}
  },
  {
    id: 'dslr-wide',
    label: 'Photo grand champ — APN + objectif',
    description: 'Privilégie les nébuleuses étendues et les amas ouverts lumineux.',
    minAltitude: 20,
    maxMagnitude: 9.5,
    weights: { base: 0.35, altitude: 0.2, window: 0.15, brightness: 0.15, seeing: 0.05, transparency: 0.1 },
    categoryBoost: { Nébuleuses: 1.15, 'Amas ouverts': 1.1, 'Autres objets': 0.9 }
  },
  {
    id: 'newton-150',
    label: 'Photo ciel profond — Télescope 150/750',
    description: 'Met en avant les galaxies et nébuleuses contrastées accessibles aux instruments de 150 mm.',
    minAltitude: 25,
    maxMagnitude: 11,
    weights: { base: 0.4, altitude: 0.2, window: 0.1, brightness: 0.15, seeing: 0.1, transparency: 0.05 },
    categoryBoost: { Galaxies: 1.15, Nébuleuses: 1.1, 'Amas globulaires': 1.05 }
  },
  {
    id: 'planetary',
    label: 'Planétaire — Caméra haute cadence',
    description: 'Se concentre sur les planètes et étoiles doubles, exige un seeing solide.',
    minAltitude: 30,
    maxMagnitude: 7.5,
    weights: { base: 0.25, altitude: 0.25, window: 0.15, brightness: 0.1, seeing: 0.2, transparency: 0.05 },
    categoryBoost: { Planètes: 1.3, Étoiles: 1.15, 'Amas globulaires': 1.05 },
    requireSeeing: 0.55
  }
];

function clamp01(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

function describeIndexQuality(value, tiers) {
  const ratio = clamp01(value, 0);
  if (ratio >= 0.8) return tiers.excellent;
  if (ratio >= 0.6) return tiers.good;
  if (ratio >= 0.4) return tiers.ok;
  if (ratio >= 0.2) return tiers.poor;
  return tiers.bad;
}

function average(values = []) {
  const filtered = values.map(Number).filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((total, value) => total + value, 0);
  return sum / filtered.length;
}

function brightnessIndex(magnitude) {
  if (!Number.isFinite(magnitude)) return 0.5;
  const minMag = -1;
  const maxMag = 13;
  const clamped = Math.min(maxMag, Math.max(minMag, magnitude));
  return (maxMag - clamped) / (maxMag - minMag);
}

function describeGeneralQuality(value) {
  return describeIndexQuality(value, {
    excellent: 'exceptionnelle',
    good: 'très bonne',
    ok: 'correcte',
    poor: 'délicate',
    bad: 'critique'
  });
}

function findAstrophotoProfile(id) {
  return ASTROPHOTO_PROFILES.find((profile) => profile.id === id) || ASTROPHOTO_PROFILES[0];
}

export function describeSeeingQuality(value) {
  return describeIndexQuality(value, {
    excellent: 'très stable',
    good: 'stable',
    ok: 'agité',
    poor: 'turbulent',
    bad: 'instable'
  });
}

export function describeTransparencyQuality(value) {
  return describeIndexQuality(value, {
    excellent: 'limpide',
    good: 'claire',
    ok: 'voilée',
    poor: 'laitueuse',
    bad: 'opaque'
  });
}

export function describeAerosolLoad(pm10, pm25) {
  const pm10Value = Number(pm10);
  const pm25Value = Number(pm25);
  if (!Number.isFinite(pm10Value) && !Number.isFinite(pm25Value)) {
    return 'charge particulaire inconnue';
  }
  const fine = Number.isFinite(pm25Value) ? pm25Value : pm10Value * 0.6;
  const coarse = Number.isFinite(pm10Value) ? pm10Value : pm25Value * 1.4;
  if (fine <= 8 && coarse <= 20) return 'air très limpide';
  if (fine <= 12 && coarse <= 30) return 'faible voile';
  if (fine <= 18 && coarse <= 45) return 'voile notable';
  if (fine <= 25 && coarse <= 60) return 'voile prononcé';
  return 'aérosols importants';
}

export function describeDewRisk(spread) {
  if (!Number.isFinite(spread)) return "Risque de buée indéterminé";
  if (spread >= 8) return 'Optique au sec';
  if (spread >= 5) return 'Risque faible de buée';
  if (spread >= 3) return 'Risque modéré de buée';
  if (spread >= 1) return 'Risque élevé de buée';
  return 'Condensation quasi certaine';
}

export function describeAzimuth(deg) {
  if (!Number.isFinite(deg)) return '—';
  const normalised = ((deg % 360) + 360) % 360;
  const index = Math.round(normalised / 22.5) % COMPASS_SECTORS.length;
  const sector = COMPASS_SECTORS[index];
  return `${sector} (${normalised.toFixed(0)}°)`;
}

export function formatAzimuth(deg) {
  if (!Number.isFinite(deg)) return '—';
  const normalised = ((deg % 360) + 360) % 360;
  return `${normalised.toFixed(0)}°`;
}

export function formatIllumination(fraction) {
  if (!Number.isFinite(fraction)) return '—';
  return `${Math.round(fraction * 100)}%`;
}

export function formatArcseconds(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}″`;
}

export function formatLocalTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatLocalDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export function computeMoonPhase(date) {
  const dayMs = 86400000;
  const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diffDays = (time - KNOWN_NEW_MOON) / dayMs;
  const age = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phaseAngle = (age / SYNODIC_MONTH) * Math.PI * 2;
  const illumination = (1 - Math.cos(phaseAngle)) / 2;
  const bucket = MOON_PHASE_BUCKETS.find((entry) => age <= entry.maxAge) || MOON_PHASE_BUCKETS[0];
  return {
    ageDays: age,
    illumination,
    phaseAngle,
    name: bucket.name,
    emoji: bucket.emoji,
    description: bucket.description
  };
}

function daysUntil(targetAge, currentAge) {
  if (targetAge >= currentAge) {
    return targetAge - currentAge;
  }
  return SYNODIC_MONTH - (currentAge - targetAge);
}

function buildMoonEvent(baseDate, currentAge, targetAge, label, icon) {
  const days = daysUntil(targetAge, currentAge);
  const occursAt = new Date(baseDate.getTime() + days * 86400000);
  return {
    type: 'Phase lunaire',
    name: label,
    icon,
    occursAt: occursAt.toISOString(),
    description: `Prépare-toi à une ${label.toLowerCase()} pour ajuster tes observations.`
  };
}

function normaliseDay(month, day, reference) {
  const year = reference.getUTCFullYear();
  const occurrence = Date.UTC(year, month - 1, day, 0, 0, 0);
  if (occurrence >= reference.getTime()) {
    return new Date(occurrence);
  }
  return new Date(Date.UTC(year + 1, month - 1, day, 0, 0, 0));
}

function formatMeteorDescription(shower) {
  return `${shower.description} Maximum attendu vers le ${shower.day}/${String(shower.month).padStart(2, '0')} (${shower.peakRate}).`;
}

export function getUpcomingEvents(observationDate, moonPhase) {
  const baseDate = observationDate instanceof Date ? observationDate : new Date(observationDate);
  const referencePhase = moonPhase || computeMoonPhase(baseDate);
  const events = [];

  const moonEvents = [
    buildMoonEvent(baseDate, referencePhase.ageDays, 0, 'Nouvelle Lune', '🌑'),
    buildMoonEvent(baseDate, referencePhase.ageDays, SYNODIC_MONTH / 2, 'Pleine Lune', '🌕'),
    buildMoonEvent(baseDate, referencePhase.ageDays, SYNODIC_MONTH / 4, 'Premier quartier', '🌓'),
    buildMoonEvent(baseDate, referencePhase.ageDays, (3 * SYNODIC_MONTH) / 4, 'Dernier quartier', '🌗')
  ];

  const withinDays = (event, maxDays) => {
    if (!event?.occursAt) return true;
    const diff = new Date(event.occursAt).getTime() - baseDate.getTime();
    return diff >= 0 && diff <= maxDays * 86400000;
  };

  moonEvents.filter((event) => withinDays(event, 40)).forEach((event) => events.push(event));

  const meteorEvents = METEOR_SHOWERS.map((shower) => {
    const occurrence = normaliseDay(shower.month, shower.day, baseDate);
    return {
      type: 'Pluie de météores',
      name: `${shower.name}`,
      icon: '🌠',
      occursAt: occurrence.toISOString(),
      description: `${formatMeteorDescription(shower)} Radiant : ${shower.radiant}.`
    };
  }).sort((a, b) => new Date(a.occursAt).getTime() - new Date(b.occursAt).getTime());

  const meteorWindow = meteorEvents.filter((event) => withinDays(event, 60));
  const selectedMeteors = meteorWindow.length > 0 ? meteorWindow.slice(0, 2) : meteorEvents.slice(0, 1);
  selectedMeteors.forEach((event) => events.push(event));

  const seriesEvents = RARE_EVENT_SERIES.map((series) => {
    const periodMs = series.periodDays * 86400000;
    if (!Number.isFinite(periodMs) || periodMs <= 0) return null;
    let occurrence = series.start;
    if (!Number.isFinite(occurrence)) return null;
    if (occurrence < baseDate.getTime()) {
      const steps = Math.ceil((baseDate.getTime() - occurrence) / periodMs);
      occurrence += steps * periodMs;
    }
    const diffDays = (occurrence - baseDate.getTime()) / 86400000;
    if (diffDays > 400) {
      return null;
    }
    return {
      type: series.label,
      name: series.name,
      icon: series.icon,
      occursAt: new Date(occurrence).toISOString(),
      description: `${series.description} (${Math.round(diffDays)} jours).`
    };
  }).filter(Boolean);

  seriesEvents.forEach((event) => events.push(event));

  events.push({
    type: 'Passage ISS',
    name: 'Prévision ISS',
    icon: '🚀',
    occursAt: null,
    description:
      "Consulte Heavens-Above ou Spot The Station 24 h avant la session pour connaître l'heure exacte des passages visibles."
  });

  return events.sort((a, b) => {
    if (!a.occursAt && !b.occursAt) return 0;
    if (!a.occursAt) return 1;
    if (!b.occursAt) return -1;
    return new Date(a.occursAt).getTime() - new Date(b.occursAt).getTime();
  });
}

export function parseCoordinate(value) {
  if (typeof value !== 'string') return Number.NaN;
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  return Number(normalized);
}

export function formatCoordinate(value) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(3).replace('.', ',');
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeHourAngle(angleHours) {
  let h = angleHours % 24;
  if (h < 0) h += 24;
  if (h > 12) h -= 24;
  return h;
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function localSiderealTime(date, longitudeDegrees) {
  const jd = julianDate(date);
  const jd0 = Math.floor(jd - 0.5) + 0.5;
  const H = (jd - jd0) * 24; // hours since midnight UTC
  const D = jd - 2451545.0;
  const D0 = jd0 - 2451545.0;
  const T = D / 36525.0;
  let gmst = 6.697374558 + 0.06570982441908 * D0 + 1.00273790935 * H + 0.000026 * T * T;
  gmst = ((gmst % 24) + 24) % 24;
  const lst = (gmst + longitudeDegrees / 15) % 24;
  return (lst + 24) % 24;
}

export function horizontalCoordinates(object, location, observationDate) {
  const lst = localSiderealTime(observationDate, location.longitude);
  const hourAngleHours = normalizeHourAngle(lst - object.raHours);
  const hourAngleRad = toRadians(hourAngleHours * 15);
  const latRad = toRadians(location.latitude);
  const decRad = toRadians(object.decDeg);
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngleRad);
  const altRad = Math.asin(Math.min(Math.max(sinAlt, -1), 1));
  const altitude = (altRad * 180) / Math.PI;
  const cosAzDenominator = Math.cos(latRad) * Math.cos(altRad);
  let azimuth;
  if (Math.abs(cosAzDenominator) < 1e-6) {
    azimuth = hourAngleRad < 0 ? 0 : 180;
  } else {
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / cosAzDenominator;
    const sinAz = (-Math.cos(decRad) * Math.sin(hourAngleRad)) / Math.cos(altRad);
    azimuth = ((Math.atan2(sinAz, cosAz) * 180) / Math.PI + 360) % 360;
  }
  return { altitude, azimuth };
}

export function altitudeForObject(object, location, observationDate) {
  return horizontalCoordinates(object, location, observationDate).altitude;
}

export function monthScore(bestMonths, targetMonth) {
  if (!Array.isArray(bestMonths) || bestMonths.length === 0) return 0.3;
  if (bestMonths.includes(targetMonth)) return 1;
  const distance = Math.min(
    ...bestMonths.map((m) => Math.min(Math.abs(m - targetMonth), 12 - Math.abs(m - targetMonth)))
  );
  return Math.max(0, 1 - distance / 6);
}

export function brightnessScore(magnitude) {
  return Math.max(0, Math.min(1, (10 - magnitude) / 8));
}

export function bortleScore(observerBortle, targetBortle) {
  const diff = observerBortle - targetBortle;
  if (diff <= 0) return 1;
  return Math.max(0, 1 - diff * 0.15);
}

function moonSensitivityForObject(object) {
  const magnitude = Number.isFinite(object.magnitude) ? object.magnitude : 8;
  const type = (object.type || '').toLowerCase();
  let sensitivity = 0.55;
  if (type.includes('galaxie')) {
    sensitivity = 0.85;
  } else if (type.includes('nébuleuse')) {
    sensitivity = 0.75;
  } else if (type.includes('amas globulaire')) {
    sensitivity = 0.6;
  } else if (type.includes('amas ouvert')) {
    sensitivity = 0.55;
  } else if (type.includes('planète') || type.includes('étoile')) {
    sensitivity = 0.35;
  }
  if (magnitude >= 9) {
    sensitivity += 0.1;
  } else if (magnitude <= 6) {
    sensitivity -= 0.1;
  }
  return Math.min(0.9, Math.max(0.25, sensitivity));
}

function moonFactorForObject(object, illumination, altitude) {
  if (!Number.isFinite(illumination)) return 1;
  const sensitivity = moonSensitivityForObject(object);
  const altitudeBonus = altitude >= 45 ? 0.1 : altitude >= 30 ? 0.05 : 0;
  const factor = 1 - illumination * (sensitivity - altitudeBonus);
  return Math.min(1, Math.max(0.25, factor));
}

export function buildScore(object, context) {
  const {
    altitude,
    averageAltitude = altitude,
    startAltitude = altitude,
    visibilityRatio = 1,
    monthFactor = 0,
    bortleFactor = 0,
    weatherFactor = 1,
    moonFactor = 1
  } = context;
  if (!Number.isFinite(altitude) || altitude <= 5) return 0; // trop bas
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const altitudeFactor = clamp((altitude - 10) / 70);
  const averageFactor = clamp((averageAltitude - 15) / 60);
  const startFactor = clamp((startAltitude - 10) / 60);
  const windowFactor = clamp(visibilityRatio);
  const brightnessFactor = brightnessScore(object.magnitude);
  const baseScore =
    altitudeFactor * 0.3 +
    averageFactor * 0.2 +
    startFactor * 0.1 +
    windowFactor * 0.1 +
    clamp(monthFactor) * 0.1 +
    brightnessFactor * 0.1 +
    clamp(bortleFactor) * 0.1;
  return baseScore * weatherFactor * moonFactor;
}

export function evaluateTargets(objects, { lat, lon, bortle, date, durationHours, moonIllumination = 0 }) {
  const month = date.getMonth() + 1;
  const weatherFactor = 1;
  return objects.map((object) => {
    const samples = Math.max(1, Math.round(durationHours));
    const location = { latitude: lat, longitude: lon };
    const positions = Array.from({ length: samples }, (_, i) => {
      const sampleDate = new Date(date.getTime() + i * 60 * 60 * 1000);
      const coords = horizontalCoordinates(object, location, sampleDate);
      return { ...coords, sampleDate };
    });
    const startPosition = horizontalCoordinates(object, location, date);
    const track = positions.length > 0 ? positions : [{ ...startPosition, sampleDate: date }];
    let bestPosition = track[0] || { ...startPosition, sampleDate: date };
    track.forEach((pos) => {
      if (!bestPosition || pos.altitude > bestPosition.altitude) {
        bestPosition = pos;
      }
    });
    const altitude = bestPosition.altitude;
    const endPosition = track[track.length - 1] || { ...startPosition, sampleDate: date };
    const altitudes = track
      .map((pos) => pos.altitude)
      .filter((value) => Number.isFinite(value));
    const averageAltitude =
      altitudes.length > 0 ? altitudes.reduce((sum, value) => sum + value, 0) / altitudes.length : startPosition.altitude;
    const minAltitude = altitudes.length > 0 ? Math.min(...altitudes) : startPosition.altitude;
    const visibleThreshold = 15;
    const visibleSamples = altitudes.filter((value) => value >= visibleThreshold).length;
    const visibilityRatio = altitudes.length > 0 ? visibleSamples / altitudes.length : 0;
    const altitudeDrift = endPosition.altitude - startPosition.altitude;
    const monthFactor = monthScore(object.bestMonths, month);
    const bortleFactor = bortleScore(bortle, object.minBortle);
    const moonFactor = moonFactorForObject(object, moonIllumination, altitude);
    const baseScore = buildScore(object, {
      altitude,
      averageAltitude,
      startAltitude: startPosition.altitude,
      visibilityRatio,
      monthFactor,
      bortleFactor,
      weatherFactor,
      moonFactor
    });
    return {
      object,
      altitude,
      azimuth: bestPosition.azimuth,
      startAltitude: startPosition.altitude,
      startAzimuth: startPosition.azimuth,
      endAltitude: endPosition.altitude,
      endAzimuth: endPosition.azimuth,
      bestTime: bestPosition.sampleDate.toISOString(),
      averageAltitude,
      minAltitude,
      visibilityRatio,
      visibleSamples,
      altitudeDrift,
      monthFactor,
      bortleFactor,
      moonFactor,
      baseScore
    };
  });
}

export function computeWeatherImpact(weather = {}) {
  const cloudFactor = Math.max(0, 1 - (weather.cover ?? 100) / 100);
  const precipFactor = Math.max(0, 1 - (weather.precipProb ?? 0) / 100);
  const baseVisibility = weather.visibilityFactor;
  const visibilityFallback = cloudFactor || 0;
  const visibilityFactor = clamp01(baseVisibility ?? visibilityFallback, visibilityFallback);
  const seeingFactor = clamp01(weather.seeingIndex ?? weather.seeingFactor ?? 1, 1);
  const transparencyFactor = clamp01(weather.transparencyIndex ?? weather.transparencyFactor ?? 1, 1);
  const dewFactor = clamp01(weather.dewFactor ?? weather.dewIndex ?? 1, 1);
  const aerosolFactor = clamp01(weather.aerosolFactor ?? weather.transparencyIndex ?? 1, 1);
  const code = weather.weatherCode ?? 0;
  const conditionFactor = code >= 80 ? 0.25 : code >= 60 ? 0.4 : code >= 45 ? 0.6 : 1;
  const skyWindow = clamp01(cloudFactor * 0.55 + precipFactor * 0.25 + visibilityFactor * 0.2, 0);
  const atmosphere = clamp01(transparencyFactor * 0.45 + seeingFactor * 0.3 + dewFactor * 0.15 + aerosolFactor * 0.1, 0);
  const weatherFactor = clamp01(skyWindow * atmosphere * conditionFactor, 0);
  return {
    weatherFactor,
    cloudFactor,
    precipFactor,
    visibilityFactor,
    seeingFactor,
    transparencyFactor,
    dewFactor,
    aerosolFactor,
    skyWindow,
    atmosphere,
    conditionFactor
  };
}

export function applyWeather(results, weather = {}) {
  const impact = computeWeatherImpact(weather);
  return results.map((entry) => {
    const weatherFactor = impact.weatherFactor;
    const score = entry.baseScore * weatherFactor;
    return {
      ...entry,
      weatherFactor,
      seeingFactor: impact.seeingFactor,
      transparencyFactor: impact.transparencyFactor,
      dewFactor: impact.dewFactor,
      aerosolFactor: impact.aerosolFactor,
      weatherWindow: impact.skyWindow,
      atmosphereFactor: impact.atmosphere,
      weatherConditionFactor: impact.conditionFactor,
      cloudFactor: impact.cloudFactor,
      precipFactor: impact.precipFactor,
      visibilityFactor: impact.visibilityFactor,
      seeingArcsec: weather.seeingArcsec,
      seeingText: weather.seeingText,
      transparencyText: weather.transparencyText,
      dewRiskText: weather.dewRiskText,
      aerosolText: weather.aerosolText,
      score
    };
  });
}

function resolveContextDate(context) {
  if (!context) return null;
  if (context.date instanceof Date) return context.date;
  if (context.dateISO) {
    const parsed = new Date(context.dateISO);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (context.dateValue && context.timeValue) {
    try {
      const local = new Date(`${context.dateValue}T${context.timeValue}`);
      if (!Number.isNaN(local.getTime())) return new Date(local.getTime() - local.getTimezoneOffset() * 60000);
    } catch (error) {
      console.warn('Impossible de reconstruire la date de contexte :', error);
    }
  }
  return null;
}

export function buildVisibilityCalendar(baseResults = [], objects = [], context = {}, nights = 4) {
  const lat = Number(context.latitude ?? context.lat);
  const lon = Number(context.longitude ?? context.lon);
  const bortle = Number(context.bortle);
  const durationHours = Number(context.durationHours ?? context.duration ?? 2);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const startDate = resolveContextDate(context);
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return [];
  const catalogue = Array.isArray(objects) && objects.length > 0 ? objects : baseResults.map((entry) => entry.object);
  const nightsCount = Math.max(1, Math.min(6, Number.isFinite(nights) ? Math.round(nights) : 4));
  const schedules = [];
  for (let offset = 0; offset < nightsCount; offset += 1) {
    const date = new Date(startDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const moon = computeMoonPhase(date);
    const evaluated = evaluateTargets(catalogue, {
      lat,
      lon,
      bortle,
      date,
      durationHours,
      moonIllumination: moon.illumination
    });
    schedules.push({ date, entries: evaluated, moon });
  }
  return baseResults
    .map((entry) => {
      const timeline = schedules
        .map(({ date, entries, moon }, index) => {
          let match = entry;
          if (index !== 0) {
            match = entries.find((candidate) => candidate.object.name === entry.object.name);
          }
          if (!match) return null;
          return {
            dateISO: date.toISOString(),
            bestTime: match.bestTime,
            altitude: match.altitude,
            visibilityRatio: match.visibilityRatio,
            baseScore: match.baseScore,
            score: index === 0 ? entry.score : match.baseScore,
            moonIllumination: moon?.illumination ?? null,
            moonPhase: moon ? { name: moon.name, emoji: moon.emoji } : null
          };
        })
        .filter(Boolean);
      if (timeline.length === 0) return null;
      return { object: entry.object, windows: timeline };
    })
    .filter(Boolean);
}

function computeAstrophotoRecommendations(results = [], profileId = 'visual', weatherImpact = {}, options = {}) {
  const profile = findAstrophotoProfile(profileId);
  const { limit = 5 } = options;
  const minAltitude = profile.minAltitude ?? 10;
  const maxMagnitude = profile.maxMagnitude ?? 12;
  const recommendations = results
    .filter((entry) => Number.isFinite(entry.altitude) && entry.altitude >= minAltitude)
    .filter((entry) => {
      const magnitude = Number(entry.object?.magnitude);
      return !Number.isFinite(magnitude) || magnitude <= maxMagnitude;
    })
    .map((entry) => {
      const weights = profile.weights ?? {};
      const baseScore = clamp01(entry.score ?? entry.baseScore ?? 0, 0);
      const altitude = clamp01((entry.altitude ?? 0) / 90, 0);
      const window = clamp01(entry.visibilityRatio ?? 0.5, 0.5);
      const brightness = brightnessIndex(entry.object?.magnitude);
      const seeing = clamp01(entry.seeingFactor ?? weatherImpact.seeingFactor ?? 1, 1);
      const transparency = clamp01(entry.transparencyFactor ?? weatherImpact.transparencyFactor ?? 1, 1);
      let astroScore =
        baseScore * (weights.base ?? 0) +
        altitude * (weights.altitude ?? 0) +
        window * (weights.window ?? 0) +
        brightness * (weights.brightness ?? 0) +
        seeing * (weights.seeing ?? 0) +
        transparency * (weights.transparency ?? 0);
      const category = entry.object?.category || entry.object?.type;
      const boost = profile.categoryBoost?.[category] ?? 1;
      astroScore *= boost;
      if (profile.requireSeeing && seeing < profile.requireSeeing) {
        astroScore *= 0.6;
      }
      return { ...entry, astroScore };
    })
    .filter((entry) => entry.astroScore > 0.1)
    .sort((a, b) => b.astroScore - a.astroScore)
    .slice(0, Math.max(1, limit));
  return { profile, recommendations };
}

function describeGlobalVisibility(score) {
  return describeIndexQuality(score, {
    excellent: 'Fenêtre exceptionnelle',
    good: 'Fenêtre très favorable',
    ok: 'Conditions correctes',
    poor: 'Fenêtre délicate',
    bad: 'Fenêtre critique'
  });
}

function clampDate(date, minDate, maxDate) {
  if (!(date instanceof Date)) return null;
  const time = date.getTime();
  const min = minDate instanceof Date ? minDate.getTime() : Number.NEGATIVE_INFINITY;
  const max = maxDate instanceof Date ? maxDate.getTime() : Number.POSITIVE_INFINITY;
  const clamped = Math.min(Math.max(time, min), max);
  return new Date(clamped);
}

export function computeDecisionInsights(results = [], options = {}) {
  const { weather = {}, moon = null, context = {}, objects = [], equipment = {}, nights = 4 } = options;
  if (!Array.isArray(results) || results.length === 0) {
    return {
      globalScore: 0,
      globalLabel: 'Analyse indisponible',
      globalSummary: "Aucune cible disponible pour calculer une aide à la décision.",
      aggregates: { weather: computeWeatherImpact(weather), avgScore: 0, avgAltitude: 0, avgVisibility: 0, moonIllumination: 0 },
      alerts: [],
      calendar: [],
      astrophoto: {
        active: Boolean(equipment?.enabled),
        profileId: equipment?.profileId ?? 'visual',
        profileLabel: findAstrophotoProfile(equipment?.profileId)?.label,
        profileDescription: findAstrophotoProfile(equipment?.profileId)?.description,
        recommendations: []
      }
    };
  }

  const top = selectTopTargets(results, { limit: Math.min(results.length, 10) });
  const weatherImpact = computeWeatherImpact(weather);
  const avgScore = average(top.map((entry) => entry.score ?? entry.baseScore ?? 0));
  const avgAltitude = average(top.map((entry) => (Number.isFinite(entry.altitude) ? entry.altitude : null)));
  const avgVisibility = average(top.map((entry) => entry.visibilityRatio ?? null));
  const moonIllumination = Number.isFinite(moon?.illumination) ? moon.illumination : 0;
  const altitudeComponent = clamp01(avgAltitude / 90, 0);
  const visibilityComponent = clamp01(avgVisibility, 0.5);
  const globalScore = clamp01(
    (avgScore || 0) * 0.55 +
      (weatherImpact.weatherFactor || 0) * 0.2 +
      altitudeComponent * 0.15 +
      visibilityComponent * 0.05 +
      (1 - moonIllumination * 0.7) * 0.05,
    0
  );
  const globalLabel = describeGlobalVisibility(globalScore);
  const skyQuality = describeGeneralQuality(weatherImpact.skyWindow ?? 0);
  const atmosphereQuality = describeGeneralQuality(weatherImpact.atmosphere ?? 0);
  const moonPercent = Math.round((moonIllumination ?? 0) * 100);
  const globalSummary =
    `Score global ${Math.round(globalScore * 100)}/100 — ${globalLabel}. ` +
    `Fenêtre ciel ${skyQuality}, atmosphère ${atmosphereQuality}, Lune ${moonPercent}% éclairée.`;

  const sessionStart = resolveContextDate(context);
  const sessionEnd =
    sessionStart && Number.isFinite(context.durationHours)
      ? new Date(sessionStart.getTime() + Number(context.durationHours) * 60 * 60 * 1000)
      : null;

  const alerts = top
    .filter((entry) => (entry.score ?? 0) >= 0.35)
    .slice(0, 4)
    .map((entry) => {
      const peak = new Date(entry.bestTime);
      if (Number.isNaN(peak.getTime())) return null;
      const windowWidthMinutes = Math.max(30, Math.min(90, Math.round((entry.visibilityRatio ?? 0.6) * 90)));
      const start = clampDate(new Date(peak.getTime() - (windowWidthMinutes / 2) * 60000), sessionStart, sessionEnd);
      const end = clampDate(new Date(peak.getTime() + (windowWidthMinutes / 2) * 60000), sessionStart, sessionEnd);
      return {
        object: entry.object,
        score: entry.score,
        altitude: entry.altitude,
        direction: describeAzimuth(entry.azimuth),
        peak: entry.bestTime,
        windowStart: start ? start.toISOString() : null,
        windowEnd: end ? end.toISOString() : null
      };
    })
    .filter(Boolean);

  const calendar = buildVisibilityCalendar(top.slice(0, 4), objects, { ...context, date: sessionStart }, nights);

  const astroSettings = {
    enabled: Boolean(equipment?.enabled),
    profileId: equipment?.profileId ?? 'visual'
  };
  const astrophoto = computeAstrophotoRecommendations(top, astroSettings.profileId, weatherImpact, { limit: 5 });

  return {
    globalScore,
    globalLabel,
    globalSummary,
    aggregates: {
      weather: weatherImpact,
      avgScore,
      avgAltitude,
      avgVisibility,
      moonIllumination
    },
    alerts,
    calendar,
    astrophoto: {
      active: astroSettings.enabled,
      profileId: astrophoto.profile.id,
      profileLabel: astrophoto.profile.label,
      profileDescription: astrophoto.profile.description,
      recommendations: astroSettings.enabled ? astrophoto.recommendations : []
    }
  };
}

export function selectTopTargets(results, options = {}) {
  const { limit = 8, typeFilter = [] } = options;
  const normalizedFilter = Array.isArray(typeFilter) ? typeFilter.filter(Boolean) : [];
  return results
    .filter((entry) => {
      const ratio = Number.isFinite(entry.visibilityRatio) ? entry.visibilityRatio : 1;
      return entry.altitude > 15 && entry.score > 0.05 && ratio > 0.2;
    })
    .filter((entry) =>
      normalizedFilter.length === 0 ? true : normalizedFilter.includes(entry.object.category || entry.object.type)
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildObservationDate(dateValue, timeValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute);
  const utc = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);
  return utc;
}

export function formatAltitude(deg) {
  if (!Number.isFinite(deg)) return '—';
  return `${deg.toFixed(0)}°`;
}

function normaliseTypeLabel(type = '') {
  const value = type.toLowerCase();
  if (value.includes('galaxie')) return 'Galaxies';
  if (value.includes('nébuleuse') || value.includes('supernova')) return 'Nébuleuses';
  if (value.includes('amas globulaire')) return 'Amas globulaires';
  if (value.includes('amas ouvert') || value.includes("amas d'étoiles")) return 'Amas ouverts';
  if (value.includes('amas')) return 'Amas';
  if (value.includes('planète')) return 'Planètes';
  if (value.includes('étoile') || value.includes('double')) return 'Étoiles';
  return 'Autres objets';
}

export function enrichCatalogueData(objects = []) {
  return objects.map((object) => {
    const number = Number(object.number);
    const distanceLy = getObjectDistanceLy(number);
    return {
      ...object,
      category: normaliseTypeLabel(object.type || ''),
      distanceLy
    };
  });
}

export function buildWeatherSummary(data) {
  if (!data) {
    return "Aucune donnée météo stockée. Relance l'analyse depuis la page principale.";
  }
  const { cover = 100, precipProb = 0, weatherCode = 0, wind = 0, periodLabel = '–' } = data;
  const sky = cover <= 20 ? 'excellent' : cover <= 45 ? 'bon' : cover <= 70 ? 'mitigé' : 'difficile';
  const codeText = weatherCodes[weatherCode] || 'Condition inconnue';
  const seeingText = data.seeingText || describeSeeingQuality(data.seeingIndex);
  const transparencyText = data.transparencyText || describeTransparencyQuality(data.transparencyIndex);
  const seeingArcsec = Number.isFinite(data.seeingArcsec) ? `${data.seeingArcsec.toFixed(1)}″` : '';
  const aerosolText = data.aerosolText || describeAerosolLoad(data.pm10, data.pm25);
  const spreadValue = Number.isFinite(data.dewPointSpread) ? `${data.dewPointSpread.toFixed(1)}°C` : null;
  const dewText = data.dewRiskText || describeDewRisk(data.dewPointSpread);

  const parts = [
    `Fenêtre ${periodLabel}`,
    `ciel ${sky}`,
    codeText.toLowerCase()
  ];

  if (Number.isFinite(cover)) {
    parts.push(`${Math.round(cover)}% nuages`);
  }
  if (Number.isFinite(precipProb)) {
    parts.push(`${Math.round(precipProb)}% pluie`);
  }
  if (Number.isFinite(wind)) {
    parts.push(`vent ${Math.round(wind)} km/h`);
  }
  if (seeingText) {
    parts.push(`seeing ${seeingText}${seeingArcsec ? ` (~${seeingArcsec})` : ''}`);
  }
  if (transparencyText) {
    parts.push(`transparence ${transparencyText}`);
  }
  if (aerosolText) {
    parts.push(`aérosols ${aerosolText}`);
  }
  if (spreadValue && dewText) {
    parts.push(`rosée Δ ${spreadValue} (${dewText})`);
  } else if (spreadValue) {
    parts.push(`rosée Δ ${spreadValue}`);
  } else if (dewText) {
    parts.push(`rosée ${dewText}`);
  }

  return parts
    .filter((part) => typeof part === 'string' && part.trim().length > 0 && !part.includes('undefined'))
    .join(' • ');
}
