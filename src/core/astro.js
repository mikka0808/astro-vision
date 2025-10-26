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
export const NIGHT_MODE_STORAGE_KEY = 'astroSoir:nightMode';

const SYNODIC_MONTH = 29.53058867;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const J2000_EPOCH = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAY_IN_MS = 86400000;

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
    categoryBoost: {},
    setup: null,
    guidance: {
      summary: 'Pour des sessions découverte et imagerie légère sans autoguidage.',
      exposure: '30 à 60 s à ISO 1600–3200 (f/4–f/5.6)',
      integration: "Vise 30 à 45 min d'intégration totale",
      filters: 'Filtre CLS/UHC utile en ciel urbain, UV/IR cut ailleurs',
      checklist: [
        'Effectue la mise au point avec un masque de Bahtinov ou l’assistant de ton boîtier.',
        'Prévois darks et flats dédiés avant de remballer pour faciliter le traitement.'
      ]
    }
  },
  {
    id: 'dslr-wide',
    label: 'Photo grand champ — APN + objectif',
    description: 'Privilégie les nébuleuses étendues et les amas ouverts lumineux.',
    minAltitude: 20,
    maxMagnitude: 9.5,
    weights: { base: 0.35, altitude: 0.2, window: 0.15, brightness: 0.15, seeing: 0.05, transparency: 0.1 },
    categoryBoost: { Nébuleuses: 1.15, 'Amas ouverts': 1.1, 'Autres objets': 0.9 },
    setup: {
      presetId: 'preset-dslr-135',
      presetName: 'APN 135 mm plein format',
      focaleMm: 135,
      apertureMm: 48,
      reducteur: 1,
      sensor: { widthMm: 36, heightMm: 24, pixelUm: 5.3 },
      bin: 1,
      allowUnguidedEstimates: true,
      capture: {
        iso: 'ISO 800–1600',
        gain: null,
        cadence: 'Empile 30 × 90 s — dithering toutes les 3 poses'
      }
    },
    guidance: {
      summary: 'Optimise le grand champ : nébuleuses diffuses et régions étoilées.',
      exposure: '60 à 180 s à ISO 800–1600 (f/2.8–f/4)',
      integration: 'Empile au moins 2 h pour révéler les faibles nébulosités',
      filters: 'Filtre duo-band conseillé en Bortle ≥ 5, UV/IR cut suffisant sous ciel noir',
      checklist: [
        'Active le dithering toutes les 2–3 poses pour lisser le bruit résiduel.',
        'Prépare ton cadrage dans Telescopius, Stellarium ou N.I.N.A. avant la session.'
      ]
    }
  },
  {
    id: 'newton-150',
    label: 'Photo ciel profond — Télescope 150/750',
    description: 'Met en avant les galaxies et nébuleuses contrastées accessibles aux instruments de 150 mm.',
    minAltitude: 25,
    maxMagnitude: 11,
    weights: { base: 0.4, altitude: 0.2, window: 0.1, brightness: 0.15, seeing: 0.1, transparency: 0.05 },
    categoryBoost: { Galaxies: 1.15, Nébuleuses: 1.1, 'Amas globulaires': 1.05 },
    setup: {
      presetId: 'preset-newton-150-750',
      presetName: 'Newton 150/750 + caméra APS-C',
      focaleMm: 750,
      apertureMm: 150,
      reducteur: 1,
      sensor: { widthMm: 23.5, heightMm: 15.7, pixelUm: 3.76 },
      bin: 1,
      allowUnguidedEstimates: true,
      capture: {
        iso: null,
        gain: 'Gain 100–120',
        cadence: 'Empile 45 × 180 s — dithering toutes les 2 poses'
      }
    },
    guidance: {
      summary: "Tire parti d'un 150/750 sur les galaxies et nébuleuses contrastées.",
      exposure: '180 à 240 s avec gain 100–120 ou ISO 800–1600 sous autoguidage',
      integration: 'Cible 3 h pour détailler les structures faibles',
      filters: 'Filtre L-eNhance/L-eXtreme pour les nébuleuses, luminance libre pour les galaxies',
      checklist: [
        'Vérifie la collimation et une mise en station < 1′ d’arc avant de lancer les poses.',
        'Collecte darks, flats et dark-flats à la même température que les lights.'
      ]
    }
  },
  {
    id: 'planetary',
    label: 'Planétaire — Caméra haute cadence',
    description: 'Se concentre sur les planètes et étoiles doubles, exige un seeing solide.',
    minAltitude: 30,
    maxMagnitude: 7.5,
    weights: { base: 0.25, altitude: 0.25, window: 0.15, brightness: 0.1, seeing: 0.2, transparency: 0.05 },
    categoryBoost: { Planètes: 1.3, Étoiles: 1.15, 'Amas globulaires': 1.05 },
    requireSeeing: 0.55,
    setup: {
      presetId: 'preset-planetary-150',
      presetName: 'Setup planétaire 150 mm',
      focaleMm: 3000,
      apertureMm: 150,
      reducteur: 1,
      sensor: { widthMm: 4.8, heightMm: 3.6, pixelUm: 2.9 },
      bin: 1,
      allowUnguidedEstimates: false,
      capture: {
        iso: null,
        gain: 'Gain 280–320',
        cadence: 'Séquences SER de 90 s à ≥ 150 i/s'
      }
    },
    guidance: {
      summary: 'Optimise la haute résolution sur planètes et étoiles doubles.',
      exposure: 'Séquences vidéo de 90 à 180 s à ≥ 150 i/s (ROI serré)',
      integration: 'Empile 10 à 15 % des meilleures images pour préserver les détails',
      filters: 'Filtre IR-cut obligatoire, ajoute un ADC ou IR-pass selon la cible',
      checklist: [
        'Laisse le tube atteindre la température extérieure pour stabiliser la turbulence interne.',
        'Surveille le seeing en direct et ajuste barlow/focale pour rester sous l’échantillonnage critique.'
      ]
    }
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

function cloneAstrophotoSetup(setup) {
  if (!setup) return null;
  const sensor = setup.sensor ? { ...setup.sensor } : null;
  const capture = setup.capture ? { ...setup.capture } : null;
  return {
    ...setup,
    sensor,
    capture
  };
}

export function getAstrophotoProfile(id) {
  const profile = findAstrophotoProfile(id);
  if (!profile) return null;
  const guidance = profile.guidance
    ? {
        ...profile.guidance,
        checklist: Array.isArray(profile.guidance.checklist) ? [...profile.guidance.checklist] : []
      }
    : null;
  const setup = cloneAstrophotoSetup(profile.setup);
  return { ...profile, guidance, setup };
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
  const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diffDays = (time - KNOWN_NEW_MOON) / DAY_IN_MS;
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

export function localSiderealTime(date, longitudeDegrees) {
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

function normalizeDegrees(value) {
  let deg = value % 360;
  if (deg < 0) deg += 360;
  return deg;
}

function daysSinceJ2000(date) {
  return (date.getTime() - J2000_EPOCH) / DAY_IN_MS;
}

function approximateSunEquatorial(date) {
  const d = daysSinceJ2000(date);
  const L = normalizeDegrees(280.460 + 0.9856474 * d);
  const g = normalizeDegrees(357.528 + 0.9856003 * d);
  const gRad = toRadians(g);
  const lambda = normalizeDegrees(L + 1.915 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad));
  const epsilon = toRadians(23.439 - 0.0000004 * d);
  const lambdaRad = toRadians(lambda);
  let ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambdaRad), Math.cos(lambdaRad));
  if (ra < 0) {
    ra += Math.PI * 2;
  }
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambdaRad));
  return { raHours: (ra * 12) / Math.PI, decDeg: (dec * 180) / Math.PI };
}

function approximateMoonEquatorial(date) {
  const d = daysSinceJ2000(date);
  const N = toRadians(normalizeDegrees(125.1228 - 0.0529538083 * d));
  const i = toRadians(5.1454);
  const w = toRadians(normalizeDegrees(318.0634 + 0.1643573223 * d));
  const e = 0.0549;
  const M = toRadians(normalizeDegrees(115.3654 + 13.0649929509 * d));
  const E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  const xv = Math.cos(E) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const sinVW = Math.sin(v + w);
  const cosVW = Math.cos(v + w);
  const xh = r * (Math.cos(N) * cosVW - Math.sin(N) * sinVW * Math.cos(i));
  const yh = r * (Math.sin(N) * cosVW + Math.cos(N) * sinVW * Math.cos(i));
  const zh = r * sinVW * Math.sin(i);
  const oblecl = toRadians(23.4393 - 3.563e-7 * d);
  const xequat = xh;
  const yequat = yh * Math.cos(oblecl) - zh * Math.sin(oblecl);
  const zequat = yh * Math.sin(oblecl) + zh * Math.cos(oblecl);
  let ra = Math.atan2(yequat, xequat);
  if (ra < 0) {
    ra += Math.PI * 2;
  }
  const dec = Math.atan2(zequat, Math.sqrt(xequat * xequat + yequat * yequat));
  return { raHours: (ra * 12) / Math.PI, decDeg: (dec * 180) / Math.PI };
}

function angularSeparation(ra1Deg, dec1Deg, ra2Deg, dec2Deg) {
  const rad = Math.PI / 180;
  const ra1 = ra1Deg * rad;
  const ra2 = ra2Deg * rad;
  const dec1 = dec1Deg * rad;
  const dec2 = dec2Deg * rad;
  const cosSep =
    Math.sin(dec1) * Math.sin(dec2) +
    Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);
  const clamped = Math.min(1, Math.max(-1, cosSep));
  return Math.acos(clamped) / rad;
}

function computeTwilightFactorForDate(date, location) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 0.85;
  }
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return 0.85;
  }
  const sunCoords = approximateSunEquatorial(date);
  const sunHorizontal = horizontalCoordinates(sunCoords, location, date);
  const altitude = Number.isFinite(sunHorizontal.altitude) ? sunHorizontal.altitude : 0;
  if (altitude <= -18) return 1;
  if (altitude <= -15) return 0.92;
  if (altitude <= -12) return 0.78;
  if (altitude <= -9) return 0.6;
  if (altitude <= -6) return 0.42;
  if (altitude <= -3) return 0.25;
  if (altitude <= 0) return 0.12;
  return 0.05;
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

const DEFAULT_SCORE_WEIGHTS = {
  position: 0.15,
  airmass: 0.07,
  window: 0.1,
  usefulDuration: 0.08,
  trackStability: 0.05,
  brightness: 0.08,
  contrast: 0.09,
  seasonal: 0.05,
  lightPollution: 0.06,
  transparency: 0.07,
  seeing: 0.07,
  clouds: 0.05,
  moon: 0.05,
  planning: 0.04
};

let activeScoreWeights = { ...DEFAULT_SCORE_WEIGHTS };

const SCORE_TYPE_PROFILES = [
  {
    keywords: ['galaxie'],
    multipliers: { contrast: 1.25, transparency: 1.15, lightPollution: 1.15, moon: 1.1, seeing: 0.9 }
  },
  {
    keywords: ['nébuleuse planétaire'],
    multipliers: { seeing: 1.15, contrast: 1.1, position: 1.05 }
  },
  {
    keywords: ['nébuleuse'],
    multipliers: { contrast: 1.2, transparency: 1.1, moon: 1.15 }
  },
  {
    keywords: ['amas globulaire'],
    multipliers: { brightness: 1.1, airmass: 1.05, position: 1.05, contrast: 1.05 }
  },
  {
    keywords: ['amas ouvert'],
    multipliers: { window: 1.05, usefulDuration: 1.05, brightness: 1.05 }
  },
  {
    keywords: ['planète'],
    multipliers: { seeing: 1.35, airmass: 1.2, position: 1.1, contrast: 0.9, moon: 0.85 }
  },
  {
    keywords: ['étoile double', 'étoile variable', 'étoile'],
    multipliers: { seeing: 1.2, brightness: 1.1, contrast: 0.95 }
  },
  {
    keywords: ['comète'],
    multipliers: { brightness: 1.2, contrast: 1.1, moon: 1.15, clouds: 1.05 }
  }
];

function resolveTypeWeightProfile(object = {}) {
  const type = (object.type || '').toLowerCase();
  if (!type) {
    return {};
  }
  const multipliers = {};
  SCORE_TYPE_PROFILES.forEach(({ keywords, multipliers: profileMultipliers }) => {
    if (keywords.some((keyword) => type.includes(keyword))) {
      Object.entries(profileMultipliers).forEach(([key, factor]) => {
        if (!Number.isFinite(factor) || factor <= 0) {
          return;
        }
        multipliers[key] = (multipliers[key] ?? 1) * factor;
      });
    }
  });
  return multipliers;
}

export function getDefaultScoreWeights() {
  return { ...DEFAULT_SCORE_WEIGHTS };
}

export function getScoreWeights() {
  return { ...activeScoreWeights };
}

export function setScoreWeightOverrides(overrides = null) {
  if (!overrides || typeof overrides !== 'object') {
    activeScoreWeights = { ...DEFAULT_SCORE_WEIGHTS };
    return getScoreWeights();
  }
  const nextWeights = { ...DEFAULT_SCORE_WEIGHTS };
  let hasOverride = false;
  Object.entries(overrides).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SCORE_WEIGHTS, key)) {
      return;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return;
    }
    nextWeights[key] = numeric;
    hasOverride = true;
  });
  activeScoreWeights = hasOverride ? nextWeights : { ...DEFAULT_SCORE_WEIGHTS };
  return getScoreWeights();
}

const SCORE_TONE_THRESHOLDS = {
  good: 0.75,
  warn: 0.45
};

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function computeContextFactor(entry = {}, durationHours, context = {}) {
  const sessionStart = toDate(entry.sessionStart) || toDate(context.date) || null;
  const bestTime = toDate(entry.bestTime) || null;
  let timeAlignment = 0.6;
  if (sessionStart && Number.isFinite(durationHours)) {
    const sessionEnd = new Date(sessionStart.getTime() + durationHours * 60 * 60 * 1000);
    if (bestTime) {
      if (bestTime >= sessionStart && bestTime <= sessionEnd) {
        timeAlignment = 1;
      } else {
        const diffHours = Math.abs(bestTime.getTime() - sessionStart.getTime()) / (60 * 60 * 1000);
        const tolerance = Math.max(2, durationHours * 1.5);
        timeAlignment = clamp01(1 - diffHours / tolerance, 0.6);
      }
    } else {
      timeAlignment = 0.75;
    }
  } else if (bestTime) {
    timeAlignment = 0.75;
  }
  const latitude = Number(entry.contextLatitude ?? context.latitude ?? context.lat);
  const longitude = Number(entry.contextLongitude ?? context.longitude ?? context.lon);
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const locationConfidence = hasLocation ? 1 : 0.65;
  return clamp01(timeAlignment * 0.6 + locationConfidence * 0.4, hasLocation ? 0.7 : 0.5);
}

function computeAirmassScore(averageAltitude = 0, minAltitude = averageAltitude) {
  const avg = Number.isFinite(averageAltitude) ? averageAltitude : 0;
  const floorMin = Number.isFinite(minAltitude) ? minAltitude : avg;
  const weightedAltitude = Math.max(5, Math.min(90, avg * 0.7 + floorMin * 0.3));
  const rad = toRadians(weightedAltitude);
  const airmass = 1 / Math.max(Math.sin(rad), 0.1);
  return clamp01(1 - (airmass - 1) / 3, 0.2);
}

function computeTwilightFactor(entry = {}, context = {}) {
  const lat = Number(entry.contextLatitude ?? context.latitude ?? context.lat);
  const lon = Number(entry.contextLongitude ?? context.longitude ?? context.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return 0.85;
  }
  const location = { latitude: lat, longitude: lon };
  const referenceDate =
    toDate(entry.bestTime) ||
    toDate(entry.sessionStart) ||
    toDate(context.date) ||
    null;
  if (!referenceDate) {
    return 0.85;
  }
  return computeTwilightFactorForDate(referenceDate, location);
}

function computeScoreInputs(entry = {}, { weatherImpact = {}, context = {} } = {}) {
  const altitudeNow = Number(entry.altitude);
  const averageAltitudeValue = Number(entry.averageAltitude ?? entry.altitude);
  const startAltitudeValue = Number(entry.startAltitude ?? entry.altitude);
  const minAltitudeValue = Number(entry.minAltitude ?? startAltitudeValue ?? altitudeNow);
  const altitude = clamp01(((altitudeNow || 0) - 10) / 70, 0);
  const averageAltitude = clamp01(((averageAltitudeValue || 0) - 15) / 60, 0);
  const startAltitude = clamp01(((startAltitudeValue || 0) - 10) / 60, 0);
  const minAltitude = clamp01(((minAltitudeValue || 0) - 5) / 55, 0);
  const position = clamp01(altitude * 0.5 + averageAltitude * 0.35 + minAltitude * 0.15, 0);
  const airmass = computeAirmassScore(averageAltitudeValue || altitudeNow || 0, minAltitudeValue || altitudeNow || 0);
  const drift = Number(entry.altitudeDrift);
  const trackStability = clamp01(1 - Math.min(1, Math.abs(Number.isFinite(drift) ? drift : 0) / 45), 0.4);
  const window = clamp01(entry.visibilityRatio ?? 0, 0);
  const contextDuration = Number.isFinite(entry.sessionDurationHours)
    ? Number(entry.sessionDurationHours)
    : Number.isFinite(context.durationHours)
    ? Number(context.durationHours)
    : Number.isFinite(context.duration)
    ? Number(context.duration)
    : 2;
  const visibleHours = Math.max(0, window * Math.max(contextDuration, 0));
  const durationReference = Math.max(1.5, Math.min(6, contextDuration || 2));
  const usefulDuration = clamp01(visibleHours / durationReference, 0);
  const brightness = clamp01(brightnessScore(entry.object?.magnitude ?? entry.magnitude ?? 10), 0.3);
  const seasonal = clamp01(entry.monthFactor ?? 0.5, 0);
  const lightPollution = clamp01(entry.bortleFactor ?? entry.lightPollutionFactor ?? 0.5, 0);
  const moon = clamp01(entry.moonFactor ?? 1, 0.25);
  const weatherFactor = clamp01(weatherImpact.weatherFactor ?? entry.weatherFactor ?? 1, 0);
  const seeingFactor = clamp01(weatherImpact.seeingFactor ?? entry.seeingFactor ?? 1, 0);
  const transparencyFactor = clamp01(weatherImpact.transparencyFactor ?? entry.transparencyFactor ?? 1, 0);
  const dewFactor = clamp01(weatherImpact.dewFactor ?? entry.dewFactor ?? 1, 0);
  const aerosolFactor = clamp01(weatherImpact.aerosolFactor ?? entry.aerosolFactor ?? transparencyFactor ?? 1, 0);
  const cloudFactor = clamp01(weatherImpact.cloudFactor ?? entry.cloudFactor ?? weatherFactor, 0);
  const precipFactor = clamp01(weatherImpact.precipFactor ?? entry.precipFactor ?? weatherFactor, 0);
  const visibilityFactor = clamp01(weatherImpact.visibilityFactor ?? entry.visibilityFactor ?? weatherFactor, 0);
  const weatherWindow = clamp01(weatherImpact.skyWindow ?? entry.weatherWindow ?? visibilityFactor, 0);
  const atmosphereFactor = clamp01(
    weatherImpact.atmosphere ?? entry.atmosphereFactor ?? (transparencyFactor + seeingFactor + dewFactor + aerosolFactor) / 4,
    0
  );
  const conditionFactor = clamp01(weatherImpact.conditionFactor ?? entry.weatherConditionFactor ?? 1, 0);
  const clouds = clamp01(
    Math.min(weatherWindow, visibilityFactor) * 0.6 + cloudFactor * 0.25 + precipFactor * 0.15,
    0
  );
  const transparency = clamp01(transparencyFactor * 0.6 + aerosolFactor * 0.25 + dewFactor * 0.15, 0);
  const seeing = clamp01(seeingFactor * 0.7 + atmosphereFactor * 0.3, 0);
  const twilight = computeTwilightFactor(entry, context);
  const contrast = clamp01(
    brightness * 0.28 +
      lightPollution * 0.18 +
      transparency * 0.18 +
      moon * 0.14 +
      visibilityFactor * 0.07 +
      twilight * 0.15,
    0
  );
  const planning = computeContextFactor(entry, contextDuration, context);
  return {
    position,
    airmass,
    window,
    usefulDuration,
    trackStability,
    brightness,
    contrast,
    seasonal,
    lightPollution,
    transparency,
    seeing,
    clouds: clamp01(clouds * conditionFactor, 0),
    moon,
    planning
  };
}

export function computeUnifiedVisibilityScore(entry = {}, options = {}) {
  const inputs = computeScoreInputs(entry, options);
  const breakdown = {};
  let score = 0;
  const weights = getScoreWeights();
  const typeMultipliers = resolveTypeWeightProfile(entry.object);
  const normalizedEntries = Object.entries(weights).map(([key, weight]) => {
    const numeric = Number(weight);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return [key, 0];
    }
    const multiplier = Number.isFinite(typeMultipliers[key]) && typeMultipliers[key] > 0 ? typeMultipliers[key] : 1;
    return [key, numeric * multiplier];
  });
  const totalWeight = normalizedEntries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  normalizedEntries.forEach(([key, rawWeight]) => {
    const value = clamp01(inputs[key] ?? 0, 0);
    const weight = rawWeight / totalWeight;
    const contribution = value * weight;
    breakdown[key] = { weight, value, contribution };
    score += contribution;
  });
  return { score, breakdown };
}

export function resolveScoreTone(score, { scale = 100, goodThreshold = SCORE_TONE_THRESHOLDS.good, warnThreshold = SCORE_TONE_THRESHOLDS.warn } = {}) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) {
    return 'neutral';
  }
  const ratio = scale === 1 ? numeric : numeric / (scale || 100);
  if (!Number.isFinite(ratio)) {
    return 'neutral';
  }
  const value = clamp01(ratio, 0);
  if (value >= goodThreshold) {
    return 'good';
  }
  if (value >= warnThreshold) {
    return 'warn';
  }
  return 'bad';
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

function moonFactorForObject(object, illumination, altitude, separation, moonAltitude) {
  if (!Number.isFinite(illumination)) return 1;
  const sensitivity = moonSensitivityForObject(object);
  const altitudeBonus = altitude >= 45 ? 0.1 : altitude >= 30 ? 0.05 : 0;
  const base = 1 - illumination * (sensitivity - altitudeBonus);
  const separationFactor = Number.isFinite(separation)
    ? clamp01(Math.pow(Math.max(separation, 5) / 90, 0.85), 0.25)
    : 1;
  const moonElevationPenalty = Number.isFinite(moonAltitude) ? clamp01((moonAltitude - 20) / 50, 0) : 0;
  const altitudeMitigation = 1 - moonElevationPenalty * 0.6;
  const factor = base * (0.55 + 0.45 * separationFactor) * altitudeMitigation;
  return Math.min(1, Math.max(0.2, factor));
}

export function buildScore(object, context = {}) {
  if (!object) return 0;
  const entry = {
    object,
    altitude: context.altitude,
    averageAltitude: context.averageAltitude ?? context.altitude,
    startAltitude: context.startAltitude ?? context.altitude,
    visibilityRatio: context.visibilityRatio ?? 0,
    monthFactor: context.monthFactor ?? 0,
    bortleFactor: context.bortleFactor ?? 0,
    moonFactor: context.moonFactor ?? 1,
    altitudeDrift: context.altitudeDrift ?? 0,
    sessionDurationHours: context.sessionDurationHours ?? context.durationHours,
    sessionStart: context.sessionStart ?? context.date ?? context.dateISO ?? null,
    bestTime: context.bestTime ?? context.bestTimeISO ?? null,
    contextLatitude: context.latitude ?? context.lat,
    contextLongitude: context.longitude ?? context.lon
  };
  const { score } = computeUnifiedVisibilityScore(entry, {
    weatherImpact: {
      weatherFactor: context.weatherFactor ?? 1,
      seeingFactor: context.seeingFactor ?? 1,
      transparencyFactor: context.transparencyFactor ?? 1,
      dewFactor: context.dewFactor ?? 1
    },
    context: {
      latitude: context.latitude ?? context.lat,
      longitude: context.longitude ?? context.lon,
      durationHours: entry.sessionDurationHours,
      date: toDate(entry.sessionStart)
    }
  });
  return score;
}

export function evaluateTargets(objects, { lat, lon, bortle, date, durationHours, moonIllumination = 0 }) {
  const month = date.getMonth() + 1;
  const weatherFactor = 1;
  const location = { latitude: lat, longitude: lon };
  const normalizedDurationHours = Number.isFinite(durationHours) ? Math.max(0.5, durationHours) : 1;
  const sessionSpanMs = normalizedDurationHours * 60 * 60 * 1000;
  const sampleIntervalMinutes =
    normalizedDurationHours <= 2 ? 15 : normalizedDurationHours <= 4 ? 30 : 60;
  const sampleIntervalMs = sampleIntervalMinutes * 60 * 1000;
  const stepCount = Math.max(1, Math.floor(sessionSpanMs / sampleIntervalMs));

  return objects.map((object) => {
    const positions = Array.from({ length: stepCount + 1 }, (_, index) => {
      const offset = Math.min(sessionSpanMs, index * sampleIntervalMs);
      const sampleDate = new Date(date.getTime() + offset);
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
    const visibleThreshold = 30;
    const visibleSamples = altitudes.filter((value) => value >= visibleThreshold).length;
    const visibilityRatio = altitudes.length > 0 ? visibleSamples / altitudes.length : 0;
    const altitudeDrift = endPosition.altitude - startPosition.altitude;
    const monthFactor = monthScore(object.bestMonths, month);
    const bortleFactor = bortleScore(bortle, object.minBortle);
    const moonCoords = approximateMoonEquatorial(bestPosition.sampleDate);
    const moonAltAz = horizontalCoordinates(moonCoords, location, bestPosition.sampleDate);
    const moonSeparation = Number.isFinite(moonCoords?.raHours)
      ? angularSeparation(object.raHours * 15, object.decDeg, moonCoords.raHours * 15, moonCoords.decDeg)
      : null;
    const moonFactor = moonFactorForObject(
      object,
      moonIllumination,
      altitude,
      moonSeparation,
      moonAltAz.altitude
    );
    const baseScore = buildScore(object, {
      altitude,
      averageAltitude,
      startAltitude: startPosition.altitude,
      visibilityRatio,
      monthFactor,
      bortleFactor,
      weatherFactor,
      moonFactor,
      altitudeDrift,
      sessionDurationHours: normalizedDurationHours,
      sessionStart: date,
      bestTime: bestPosition.sampleDate,
      latitude: lat,
      longitude: lon
    });
    const visibilityTrack = track.map((pos) => ({
      timeISO: pos.sampleDate.toISOString(),
      altitude: pos.altitude,
      azimuth: pos.azimuth
    }));
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
      moonSeparation,
      moonAltitude: moonAltAz.altitude,
      baseScore,
      track: visibilityTrack,
      sessionStart: date.toISOString(),
      sessionDurationHours: normalizedDurationHours,
      contextLatitude: lat,
      contextLongitude: lon
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

export function applyWeather(results, weather = {}, options = {}) {
  const impact = computeWeatherImpact(weather);
  const context = options.context || {};
  return results.map((entry) => {
    const weatherFactor = impact.weatherFactor;
    const enrichedEntry = {
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
      aerosolText: weather.aerosolText
    };
    const scoringContext = {
      ...context,
      latitude: context.latitude ?? context.lat ?? enrichedEntry.contextLatitude,
      longitude: context.longitude ?? context.lon ?? enrichedEntry.contextLongitude,
      durationHours: context.durationHours ?? context.duration ?? enrichedEntry.sessionDurationHours,
      date:
        context.date ??
        context.dateISO ??
        (enrichedEntry.sessionStart ? new Date(enrichedEntry.sessionStart) : null)
    };
    const { score, breakdown } = computeUnifiedVisibilityScore(enrichedEntry, {
      weatherImpact: impact,
      context: scoringContext
    });
    return {
      ...enrichedEntry,
      score,
      scoreBreakdown: breakdown
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
        guidance: findAstrophotoProfile(equipment?.profileId)?.guidance ?? null,
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
      guidance: astrophoto.profile.guidance ?? null,
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
  if ((value.includes('reste') && value.includes('supernova')) || value.includes('crabe')) return 'Vestiges de supernova';
  if (value.includes('nébuleuse planétaire')) return 'Nébuleuses planétaires';
  if (value.includes('nébuleuse sombre') || value.includes('nébuleuse obscure') || value.includes('obscur')) {
    return 'Nébuleuses obscures';
  }
  if (value.includes('réflexion')) return 'Nébuleuses par réflexion';
  if (value.includes('nébuleuse diffuse') || value.includes('nébuleuse lumineuse')) return 'Nébuleuses diffuses';
  if (value.includes('hii') || value.includes('émission')) return 'Nébuleuses en émission';
  if (value.includes('nébuleuse')) return 'Nébuleuses';
  if (value.includes('amas globulaire')) return 'Amas globulaires';
  if (value.includes('amas ouvert') || value.includes("amas d'étoiles") || value.includes('amas stellaire')) {
    return 'Amas ouverts';
  }
  if (value.includes('amas')) return 'Amas';
  if (value.includes('planète')) return 'Planètes';
  if (value.includes('étoile') || value.includes('double')) return 'Étoiles';
  return 'Autres objets';
}

function clampBortle(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(9, Math.max(1, Math.round(value)));
}

function estimateBortleFromSurfaceBrightness(surfaceBrightness) {
  if (!Number.isFinite(surfaceBrightness)) {
    return null;
  }
  if (surfaceBrightness <= 12.5) return 9;
  if (surfaceBrightness <= 13.5) return 8;
  if (surfaceBrightness <= 14.5) return 7;
  if (surfaceBrightness <= 15.5) return 6;
  if (surfaceBrightness <= 16.5) return 5;
  if (surfaceBrightness <= 18) return 4;
  if (surfaceBrightness <= 19.5) return 3;
  return 2;
}

function estimateBortleFromMagnitude(magnitude) {
  if (!Number.isFinite(magnitude)) {
    return null;
  }
  if (magnitude <= 4.5) return 9;
  if (magnitude <= 5.5) return 8;
  if (magnitude <= 6.5) return 7;
  if (magnitude <= 8) return 6;
  if (magnitude <= 9.5) return 5;
  if (magnitude <= 11) return 4;
  if (magnitude <= 12.5) return 3;
  return 2;
}

export function computeBortleRecommendation(object = {}) {
  const surfaceBrightness = Number(object.surfaceBrightness ?? object.surfaceBrightnessMagArcsec2);
  const magnitude = Number(object.magnitude);
  const angularSize = Number(object.angularSizeArcmin ?? object.angularSize);
  const rawCategory = object.category || object.type || '';
  const category = typeof rawCategory === 'string' ? rawCategory.toLowerCase() : '';

  let recommendation = estimateBortleFromSurfaceBrightness(surfaceBrightness);
  if (recommendation === null) {
    recommendation = estimateBortleFromMagnitude(magnitude);
  }
  if (recommendation === null) {
    recommendation = Number.isFinite(object.minBortle) ? object.minBortle : 5;
  }

  if (category.includes('galaxie') || category.includes('nébuleuse obscure')) {
    recommendation -= 2;
  } else if (category.includes('nébuleuse')) {
    recommendation -= 1;
  } else if (category.includes('amas globulaire') || category.includes('amas ouverts')) {
    recommendation += 1;
  } else if (category.includes('étoile') || category.includes('planète')) {
    recommendation += 2;
  }

  if (Number.isFinite(angularSize)) {
    if (angularSize >= 60) {
      recommendation -= 1;
    } else if (angularSize <= 5) {
      recommendation += 1;
    }
  }

  return clampBortle(recommendation);
}

export function enrichCatalogueData(objects = []) {
  return objects.map((object) => {
    const number = Number(object.number);
    const distanceLy = getObjectDistanceLy(number);
    const category = normaliseTypeLabel(object.type || '');
    const recommendedBortle = computeBortleRecommendation({ ...object, category });
    return {
      ...object,
      category,
      distanceLy,
      minBortle: Number.isFinite(recommendedBortle) ? recommendedBortle : object.minBortle,
      recommendedBortle: Number.isFinite(recommendedBortle) ? recommendedBortle : null
    };
  });
}

export function buildWeatherSummary(data) {
  if (!data) {
    return "Aucune donnée météo enregistrée pour le moment. Elles apparaîtront après ta prochaine analyse.";
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
