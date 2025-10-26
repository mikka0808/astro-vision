import { NIGHT_MODE_STORAGE_KEY } from './src/core/astro.js';
import { STAR_CATALOG } from './src/core/star-catalog.js';

const nightModeToggle = document.getElementById('nightModeToggle');
const canvas = document.getElementById('starMapCanvas');
const canvasContainer = document.getElementById('starMapCanvasContainer');
const tooltip = document.getElementById('starMapTooltip');
const rotationInput = document.getElementById('starMapRotation');
const rotationValue = document.getElementById('starMapRotationValue');
const resetButton = document.getElementById('starMapReset');
const constellationsToggle = document.getElementById('starMapConstellations');
const milkyWayToggle = document.getElementById('starMapMilkyWay');
const gridToggle = document.getElementById('starMapGrid');
const horizonToggle = document.getElementById('starMapHorizon');
const magnitudeInput = document.getElementById('starMapMagnitude');
const magnitudeValue = document.getElementById('starMapMagnitudeValue');
const fovInput = document.getElementById('starMapFov');
const fovValue = document.getElementById('starMapFovValue');
const toggleStarsButton = document.getElementById('starMapToggleStars');
const toggleConstellationsButton = document.getElementById('starMapToggleConstellations');
const toggleLabelsButton = document.getElementById('starMapToggleLabels');
const sessionTimeButton = document.getElementById('starMapSessionTime');
const legendList = document.getElementById('constellationLegend');
const detailsPanel = document.getElementById('starMapDetails');
const autoRotateButton = document.getElementById('starMapAutoRotate');
const centerButton = document.getElementById('starMapCenterSelection');
const fullscreenButton = document.getElementById('starMapFullscreen');

let pseudoFullscreen = false;

const requestFrame =
  typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : (callback) =>
        window.setTimeout(
          () =>
            callback(
              typeof performance !== 'undefined' && typeof performance.now === 'function'
                ? performance.now()
                : Date.now()
            ),
          16
        );

const cancelFrame =
  typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window)
    : (handle) => window.clearTimeout(handle);

if (!canvas || !canvasContainer || !rotationInput || !rotationValue || !legendList || !detailsPanel) {
  console.warn('Carte du ciel : éléments requis introuvables.');
}

const CONSTELLATIONS = [
  {
    id: 'uma',
    name: 'Grande Ourse',
    abbreviation: 'UMa',
    description: 'Asterisme du « grand chariot », point de départ de nombreuses recherches nocturnes.',
    bestSeason: 'Printemps et nuits circumpolaires',
    observation: 'Prolonge la queue vers Arcturus puis Spica pour balayer le ciel de printemps.',
    notableStars: ['Dubhe', 'Merak', 'Alioth', 'Mizar', 'Alkaid'],
    segments: [
      ['Dubhe', 'Merak'],
      ['Merak', 'Phecda'],
      ['Phecda', 'Megrez'],
      ['Megrez', 'Alioth'],
      ['Alioth', 'Mizar'],
      ['Mizar', 'Alkaid'],
      ['Dubhe', 'Megrez'],
      ['Merak', 'Dubhe']
    ],
    anchor: { rightAscension: 11.3, declination: 57.5 }
  },
  {
    id: 'umi',
    name: 'Petite Ourse',
    abbreviation: 'UMi',
    description: 'Petit chariot tournant autour du pôle nord céleste.',
    bestSeason: 'Toute l’année dans l’hémisphère nord',
    observation: 'Serre la base Polaris–Kochab pour vérifier la dérive polaire.',
    notableStars: ['Polaris', 'Kochab', 'Pherkad'],
    segments: [
      ['Polaris', 'Pherkad'],
      ['Pherkad', 'Kochab'],
      ['Kochab', 'Polaris']
    ],
    anchor: { rightAscension: 15.0, declination: 80.0 }
  },
  {
    id: 'lyr',
    name: 'Lyre',
    abbreviation: 'Lyr',
    description: 'Petite constellation estivale abritant la nébuleuse annulaire M57.',
    bestSeason: 'Été',
    observation: 'Balaye la zone entre Sulafat et Sheliak pour faire ressortir la nébuleuse M57.',
    notableStars: ['Vega', 'Sheliak', 'Sulafat'],
    segments: [
      ['Vega', 'Sheliak'],
      ['Sheliak', 'Sulafat'],
      ['Sulafat', 'Vega']
    ],
    anchor: { rightAscension: 18.8, declination: 36.0 }
  },
  {
    id: 'cyg',
    name: 'Cygne',
    abbreviation: 'Cyg',
    description: 'Grande croix traversant la Voie lactée et reliant Deneb à Albireo.',
    bestSeason: 'Été et début d’automne',
    observation: 'Suis l’axe Deneb → Albireo pour explorer les nébuloses du Cygne.',
    notableStars: ['Deneb', 'Sadr', 'Gienah', 'Albireo'],
    segments: [
      ['Deneb', 'Sadr'],
      ['Sadr', 'Gienah'],
      ['Sadr', 'Albireo'],
      ['Albireo', 'Deneb']
    ],
    anchor: { rightAscension: 20.3, declination: 39.0 }
  },
  {
    id: 'aql',
    name: 'Aigle',
    abbreviation: 'Aql',
    description: 'Constellation marquant l’axe sud du Triangle d’été.',
    bestSeason: 'Été',
    observation: 'Triangle Altair–Tarazed–Alshain pour repérer rapidement l’Aigle.',
    notableStars: ['Altair', 'Tarazed', 'Alshain'],
    segments: [
      ['Altair', 'Tarazed'],
      ['Tarazed', 'Alshain'],
      ['Alshain', 'Altair']
    ],
    anchor: { rightAscension: 19.9, declination: 9.0 }
  },
  {
    id: 'ori',
    name: 'Orion',
    abbreviation: 'Ori',
    description: 'Constellation hivernale emblématique, riche en nébuleuses.',
    bestSeason: 'Hiver',
    observation: 'Aligne la ceinture vers le sud-est pour atteindre Sirius et M42.',
    notableStars: ['Betelgeuse', 'Rigel', 'Alnitak', 'Alnilam', 'Mintaka'],
    segments: [
      ['Betelgeuse', 'Bellatrix'],
      ['Bellatrix', 'Mintaka'],
      ['Mintaka', 'Alnilam'],
      ['Alnilam', 'Alnitak'],
      ['Alnitak', 'Rigel'],
      ['Rigel', 'Saiph'],
      ['Saiph', 'Betelgeuse']
    ],
    anchor: { rightAscension: 5.7, declination: -1.0 }
  },
  {
    id: 'cma',
    name: 'Grand Chien',
    abbreviation: 'CMa',
    description: 'Berceau de Sirius, l’étoile la plus brillante de la nuit.',
    bestSeason: 'Hiver',
    observation: 'Sirius culmine bas sur l’horizon sud : privilégie les nuits sans turbulence.',
    notableStars: ['Sirius', 'Adhara', 'Wezen'],
    segments: [
      ['Sirius', 'Adhara'],
      ['Adhara', 'Wezen'],
      ['Wezen', 'Sirius']
    ],
    anchor: { rightAscension: 6.9, declination: -22.0 }
  },
  {
    id: 'tau',
    name: 'Taureau',
    abbreviation: 'Tau',
    description: 'Constellation zodiacale abritant les Hyades et le célèbre amas des Pléiades.',
    bestSeason: 'Fin d’automne et hiver',
    observation: 'Trace Aldebaran → Elnath pour suivre les cornes et viser M1.',
    notableStars: ['Aldebaran', 'Elnath'],
    segments: [
      ['Aldebaran', 'Elnath'],
      ['Aldebaran', 'Capella']
    ],
    anchor: { rightAscension: 4.8, declination: 18.0 }
  },
  {
    id: 'leo',
    name: 'Lion',
    abbreviation: 'Leo',
    description: 'Signe de printemps, idéal pour la chasse aux galaxies.',
    bestSeason: 'Mars à mai',
    observation: 'Utilise le Sphinx (faucille) pour te repérer dans le ciel printanier.',
    notableStars: ['Regulus', 'Algieba', 'Denebola'],
    segments: [
      ['Regulus', 'Algieba'],
      ['Algieba', 'Denebola']
    ],
    anchor: { rightAscension: 10.8, declination: 18.0 }
  },
  {
    id: 'sco',
    name: 'Scorpion',
    abbreviation: 'Sco',
    description: 'Constellation spectaculaire des nuits estivales méridionales.',
    bestSeason: 'Été',
    observation: 'Repère Antares et déroule le dard vers Shaula pour atteindre M6 et M7.',
    notableStars: ['Antares', 'Shaula', 'Sargas'],
    segments: [
      ['Antares', 'Shaula'],
      ['Shaula', 'Sargas']
    ],
    anchor: { rightAscension: 17.2, declination: -32.0 }
  }
];

const MILKY_WAY_NODES = [
  { rightAscension: 17.6, declination: -33, width: 0.24 },
  { rightAscension: 18.9, declination: -12, width: 0.2 },
  { rightAscension: 20.2, declination: 12, width: 0.18 },
  { rightAscension: 21.3, declination: 40, width: 0.16 },
  { rightAscension: 0.5, declination: 25, width: 0.15 },
  { rightAscension: 2.5, declination: 5, width: 0.16 },
  { rightAscension: 5.2, declination: -5, width: 0.18 },
  { rightAscension: 6.8, declination: -20, width: 0.22 },
  { rightAscension: 8.5, declination: -30, width: 0.2 },
  { rightAscension: 10.7, declination: -18, width: 0.18 },
  { rightAscension: 13.0, declination: -5, width: 0.16 },
  { rightAscension: 15.2, declination: -15, width: 0.2 }
];

const SPECTRAL_COLOR_MAP = new Map([
  ['O', '#87b7ff'],
  ['B', '#9cc5ff'],
  ['A', '#d6e8ff'],
  ['F', '#f8f1d9'],
  ['G', '#ffe9b3'],
  ['K', '#ffd1a3'],
  ['M', '#ffb48a']
]);

const LABELLED_STARS = new Set([
  'Polaris',
  'Vega',
  'Deneb',
  'Altair',
  'Betelgeuse',
  'Rigel',
  'Sirius',
  'Procyon',
  'Aldebaran',
  'Capella',
  'Arcturus',
  'Spica',
  'Antares',
  'Fomalhaut'
]);

const TWO_PI = Math.PI * 2;
const OBSERVER_LONGITUDE = 2.3522; // Paris
const DEFAULT_MAGNITUDE_LIMIT = 6;
const MIN_MAGNITUDE_LIMIT = -1;
const MAX_MAGNITUDE_LIMIT = 8;
const MIN_FIELD_OF_VIEW = 60;
const MAX_FIELD_OF_VIEW = 180;
const DEFAULT_FIELD_OF_VIEW = 160;
const PAN_INERTIA_DECAY = 0.92;
const PAN_VELOCITY_THRESHOLD = 0.02;

const mapState = {
  devicePixelRatio: window.devicePixelRatio || 1,
  canvasSize: 0,
  baseRadius: 0,
  radius: 0,
  centerX: 0,
  centerY: 0,
  viewCenterX: 0,
  viewCenterY: 0,
  rotationHours: 0,
  panX: 0,
  panY: 0,
  velocityX: 0,
  velocityY: 0,
  inertiaFrame: null,
  lastInertiaTime: null,
  zoom: 1,
  targetZoom: 1,
  zoomFrame: null,
  lastZoomTime: null,
  fieldOfView: DEFAULT_FIELD_OF_VIEW,
  magnitudeLimit: DEFAULT_MAGNITUDE_LIMIT,
  showStars: true,
  showConstellations: true,
  showLabels: true,
  showGrid: true,
  showHorizon: true,
  showMilkyWay: true,
  hoveredStar: null,
  selectedStar: null,
  activeConstellation: null,
  previewConstellation: null,
  projectedStars: [],
  projectedPositions: new Map(),
  autoRotate: false,
  autoRotateFrame: null,
  lastAutoRotateTime: null
};

mapState.targetZoom = fieldOfViewToZoom(mapState.fieldOfView);
mapState.zoom = mapState.targetZoom;

const pointerState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  lastTime: 0,
  velocityX: 0,
  velocityY: 0,
  moved: false
};

let ctx = null;

function normaliseHours(value) {
  if (Number.isNaN(value)) {
    return 0;
  }
  let hours = value % 24;
  if (hours < 0) {
    hours += 24;
  }
  return hours;
}

function formatHours(value) {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function formatRightAscension(hours) {
  const normalised = normaliseHours(hours);
  const h = Math.floor(normalised);
  const minutesFloat = (normalised - h) * 60;
  const m = Math.floor(minutesFloat);
  const s = Math.round((minutesFloat - m) * 60);
  return `${h} h ${m.toString().padStart(2, '0')} min ${s.toString().padStart(2, '0')} s`;
}

function formatDeclination(degrees) {
  const sign = degrees >= 0 ? '+' : '−';
  const abs = Math.abs(degrees);
  const d = Math.floor(abs);
  const minutesFloat = (abs - d) * 60;
  const m = Math.floor(minutesFloat);
  const s = Math.round((minutesFloat - m) * 60);
  return `${sign}${d}° ${m.toString().padStart(2, '0')}' ${s.toString().padStart(2, '0')}"`;
}

function formatMagnitude(magnitude) {
  if (typeof magnitude !== 'number' || Number.isNaN(magnitude)) {
    return '—';
  }
  return magnitude.toFixed(2);
}

function formatDistance(distance) {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return '—';
  }
  if (distance < 50) {
    return `${distance.toFixed(1)} al`;
  }
  return `${Math.round(distance)} al`;
}

function getSpectralColor(type) {
  if (!type || typeof type !== 'string') {
    return '#f5f8ff';
  }
  const family = type.trim()[0]?.toUpperCase();
  return SPECTRAL_COLOR_MAP.get(family) || '#f5f8ff';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function computeLocalSiderealTime(date, longitudeDegrees) {
  const JD = toJulianDate(date);
  const T = (JD - 2451545.0) / 36525;
  const GMST =
    280.46061837 +
    360.98564736629 * (JD - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  const GMSTDegrees = ((GMST % 360) + 360) % 360;
  const GMSTHours = GMSTDegrees / 15;
  const longitudeHours = longitudeDegrees / 15;
  return normaliseHours(GMSTHours + longitudeHours);
}

const MAP_PADDING = 24;
const MAX_CANVAS_SIZE = 1080;
const AUTO_ROTATE_SPEED = 0.25;
const DEFAULT_FOCUS_STAR = 'Polaris';

function fieldOfViewToZoom(fieldOfView) {
  return 180 / clamp(fieldOfView, MIN_FIELD_OF_VIEW, MAX_FIELD_OF_VIEW);
}

function clampPan() {
  const limit = mapState.baseRadius * mapState.zoom * 2.2;
  mapState.panX = clamp(mapState.panX, -limit, limit);
  mapState.panY = clamp(mapState.panY, -limit, limit);
}

function updateViewTransform() {
  clampPan();
  mapState.viewCenterX = mapState.centerX + mapState.panX;
  mapState.viewCenterY = mapState.centerY + mapState.panY;
  mapState.radius = mapState.baseRadius * mapState.zoom;
}

function toScreenCoordinates(px, py) {
  return {
    x: mapState.viewCenterX + px * mapState.zoom,
    y: mapState.viewCenterY + py * mapState.zoom
  };
}

function stopZoomAnimation() {
  if (mapState.zoomFrame) {
    cancelFrame(mapState.zoomFrame);
  }
  mapState.zoomFrame = null;
  mapState.lastZoomTime = null;
}

function animateZoomStep(timestamp) {
  if (!mapState.zoomFrame) {
    mapState.lastZoomTime = null;
    return;
  }
  if (typeof mapState.lastZoomTime !== 'number') {
    mapState.lastZoomTime = timestamp;
  }
  const delta = mapState.targetZoom - mapState.zoom;
  if (Math.abs(delta) < 0.0005) {
    mapState.zoom = mapState.targetZoom;
    stopZoomAnimation();
    renderStarMap();
    return;
  }
  const elapsed = Math.max(16, timestamp - mapState.lastZoomTime);
  const factor = clamp(elapsed / 160, 0.08, 0.28);
  mapState.zoom += delta * factor;
  mapState.lastZoomTime = timestamp;
  renderStarMap();
  mapState.zoomFrame = requestFrame(animateZoomStep);
}

function startZoomAnimation() {
  if (!mapState.zoomFrame) {
    mapState.zoomFrame = requestFrame(animateZoomStep);
  }
}

function stopPanInertia() {
  if (mapState.inertiaFrame) {
    cancelFrame(mapState.inertiaFrame);
  }
  mapState.inertiaFrame = null;
  mapState.lastInertiaTime = null;
  mapState.velocityX = 0;
  mapState.velocityY = 0;
}

function panInertiaStep(timestamp) {
  if (!mapState.inertiaFrame) {
    mapState.lastInertiaTime = null;
    return;
  }
  if (typeof mapState.lastInertiaTime !== 'number') {
    mapState.lastInertiaTime = timestamp;
  }
  const deltaTime = Math.max(16, timestamp - mapState.lastInertiaTime);
  mapState.lastInertiaTime = timestamp;
  mapState.panX += mapState.velocityX * deltaTime;
  mapState.panY += mapState.velocityY * deltaTime;
  mapState.velocityX *= PAN_INERTIA_DECAY;
  mapState.velocityY *= PAN_INERTIA_DECAY;
  if (Math.abs(mapState.velocityX) < PAN_VELOCITY_THRESHOLD && Math.abs(mapState.velocityY) < PAN_VELOCITY_THRESHOLD) {
    stopPanInertia();
    renderStarMap();
    return;
  }
  renderStarMap();
  mapState.inertiaFrame = requestFrame(panInertiaStep);
}

function startPanInertia() {
  if (!mapState.inertiaFrame) {
    mapState.inertiaFrame = requestFrame(panInertiaStep);
  }
}

function projectCoordinates(rightAscension, declination) {
  if (!mapState.baseRadius) {
    return { px: 0, py: 0, radial: 0 };
  }
  const effectiveRA = normaliseHours(rightAscension - mapState.rotationHours);
  const angle = (effectiveRA / 24) * TWO_PI;
  const clampedDec = clamp(declination, -90, 90);
  const radial = ((90 - clampedDec) / 180) * mapState.baseRadius;
  const px = Math.sin(angle) * radial;
  const py = -Math.cos(angle) * radial;
  return { px, py, radial };
}

function computeProjections() {
  mapState.projectedStars = [];
  mapState.projectedPositions.clear();
  STAR_CATALOG.forEach((star) => {
    const coords = projectCoordinates(star.rightAscension, star.declination);
    const screen = toScreenCoordinates(coords.px, coords.py);
    const screenRadius = coords.radial * mapState.zoom;
    mapState.projectedPositions.set(star.name, { ...coords, ...screen, screenRadius });
    mapState.projectedStars.push({ star, ...coords, ...screen, screenRadius });
  });
}
function drawBackground() {
  if (!ctx || !mapState.radius) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.viewCenterX, mapState.viewCenterY, mapState.radius, 0, TWO_PI);
  ctx.closePath();
  const gradient = ctx.createRadialGradient(
    mapState.viewCenterX,
    mapState.viewCenterY,
    mapState.radius * 0.1,
    mapState.viewCenterX,
    mapState.viewCenterY,
    mapState.radius
  );
  gradient.addColorStop(0, '#071a36');
  gradient.addColorStop(1, '#02050f');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(140, 185, 255, 0.25)';
  ctx.stroke();
  ctx.restore();
}

function drawGraticule() {
  if (!ctx || !mapState.radius || !mapState.showGrid) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.viewCenterX, mapState.viewCenterY, mapState.radius, 0, TWO_PI);
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  for (let dec = -60; dec <= 60; dec += 30) {
    const radius = ((90 - dec) / 180) * mapState.baseRadius * mapState.zoom;
    ctx.beginPath();
    ctx.arc(mapState.viewCenterX, mapState.viewCenterY, radius, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  const innerStart = mapState.radius * 0.18;
  for (let hour = 0; hour < 24; hour += 1) {
    const angle = (hour / 24) * TWO_PI;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    ctx.beginPath();
    ctx.moveTo(
      mapState.viewCenterX + sin * innerStart,
      mapState.viewCenterY - cos * innerStart
    );
    ctx.lineTo(
      mapState.viewCenterX + sin * mapState.radius,
      mapState.viewCenterY - cos * mapState.radius
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(204, 224, 255, 0.65)';
  ctx.font = `${Math.max(11, mapState.radius * 0.06)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let hour = 0; hour < 24; hour += 3) {
    const angle = (hour / 24) * TWO_PI;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const labelRadius = mapState.radius + 14;
    const x = mapState.viewCenterX + sin * labelRadius;
    const y = mapState.viewCenterY - cos * labelRadius;
    ctx.fillText(`${hour} h`, x, y);
  }
  ctx.restore();
}

function drawHorizon() {
  if (!ctx || !mapState.radius || !mapState.showHorizon) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.viewCenterX, mapState.viewCenterY, mapState.radius, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255, 200, 160, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([10, 6]);
  ctx.stroke();
  ctx.restore();
}

function drawMilkyWay() {
  if (!ctx || !mapState.radius || !mapState.showMilkyWay) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.viewCenterX, mapState.viewCenterY, mapState.radius, 0, TWO_PI);
  ctx.clip();
  MILKY_WAY_NODES.forEach((node) => {
    const coords = projectCoordinates(node.rightAscension, node.declination);
    const center = toScreenCoordinates(coords.px, coords.py);
    const width = mapState.baseRadius * node.width * mapState.zoom;
    const gradient = ctx.createRadialGradient(
      center.x,
      center.y,
      width * 0.2,
      center.x,
      center.y,
      width
    );
    gradient.addColorStop(0, 'rgba(96, 150, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(20, 40, 90, 0)');
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(center.x, center.y, width, 0, TWO_PI);
    ctx.fill();
  });
  ctx.restore();
}

function drawConstellations() {
  if (!ctx || !mapState.radius || !mapState.showConstellations) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.viewCenterX, mapState.viewCenterY, mapState.radius, 0, TWO_PI);
  ctx.clip();
  const activeId = mapState.activeConstellation?.id;
  const previewId = mapState.previewConstellation?.id;
  CONSTELLATIONS.forEach((constellation) => {
    const highlight = activeId === constellation.id;
    const preview = !highlight && previewId === constellation.id;
    ctx.strokeStyle = highlight
      ? 'rgba(255, 206, 128, 0.95)'
      : preview
        ? 'rgba(255, 214, 170, 0.7)'
        : 'rgba(132, 188, 255, 0.35)';
    ctx.lineWidth = highlight ? 2.4 : preview ? 1.6 : 1.1;
    constellation.segments.forEach(([fromName, toName]) => {
      const from = mapState.projectedPositions.get(fromName);
      const to = mapState.projectedPositions.get(toName);
      if (!from || !to) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawConstellationLabel(constellation, { preview = false } = {}) {
  if (!ctx || !constellation || !constellation.anchor) {
    return;
  }
  const coords = projectCoordinates(constellation.anchor.rightAscension, constellation.anchor.declination);
  if (coords.radial > mapState.baseRadius) {
    return;
  }
  const screen = toScreenCoordinates(coords.px, coords.py);
  ctx.save();
  const isActive = mapState.activeConstellation?.id === constellation.id;
  const color = isActive
    ? 'rgba(255, 222, 160, 0.95)'
    : preview
      ? 'rgba(240, 234, 210, 0.92)'
      : 'rgba(180, 210, 255, 0.85)';
  ctx.fillStyle = color;
  ctx.font = `${Math.max(13, mapState.radius * 0.07)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = constellation.abbreviation || constellation.name;
  ctx.fillText(label, screen.x, screen.y);
  ctx.restore();
}

function drawStars() {
  if (!ctx || !mapState.radius || !mapState.showStars) {
    return;
  }
  const activeConstellation = mapState.activeConstellation;
  const previewConstellation = mapState.previewConstellation
    && (!activeConstellation || mapState.previewConstellation.id !== activeConstellation.id)
    ? mapState.previewConstellation
    : null;
  const activeStarNames = new Set();
  const previewStarNames = new Set();
  if (activeConstellation) {
    activeConstellation.segments.forEach(([fromName, toName]) => {
      activeStarNames.add(fromName);
      activeStarNames.add(toName);
    });
    if (Array.isArray(activeConstellation.notableStars)) {
      activeConstellation.notableStars.forEach((name) => activeStarNames.add(name));
    }
  }
  if (previewConstellation) {
    previewConstellation.segments.forEach(([fromName, toName]) => {
      previewStarNames.add(fromName);
      previewStarNames.add(toName);
    });
    if (Array.isArray(previewConstellation.notableStars)) {
      previewConstellation.notableStars.forEach((name) => previewStarNames.add(name));
    }
  }

  mapState.projectedStars.forEach(({ star, x, y, screenRadius }) => {
    if (screenRadius > mapState.radius + 8) {
      return;
    }
    if (typeof star.magnitude === 'number' && star.magnitude > mapState.magnitudeLimit) {
      return;
    }
    const baseSize = Math.max(1.3, 4.6 - (star.magnitude ?? 5) * 0.6);
    let size = baseSize;
    const isHovered = mapState.hoveredStar?.name === star.name;
    const isSelected = mapState.selectedStar?.name === star.name;
    const inActiveConstellation = activeStarNames.has(star.name);
    const inPreviewConstellation = !inActiveConstellation && previewStarNames.has(star.name);
    if (isSelected) {
      size += 1.6;
    } else if (isHovered) {
      size += 1.1;
    } else {
      if (inActiveConstellation) {
        size += 0.75;
      } else if (inPreviewConstellation) {
        size += 0.45;
      }
    }
    ctx.beginPath();
    ctx.fillStyle = getSpectralColor(star.spectralType);
    const alpha = isSelected || isHovered
      ? 1
      : inActiveConstellation
        ? 0.98
        : inPreviewConstellation
          ? 0.86
          : 0.75;
    ctx.globalAlpha = alpha;
    ctx.arc(x, y, size, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (isSelected || isHovered) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = isSelected ? 'rgba(255, 210, 130, 0.9)' : 'rgba(160, 210, 255, 0.85)';
      ctx.lineWidth = isSelected ? 2.4 : 1.8;
      ctx.arc(x, y, size + 2.8, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawStarLabels() {
  if (!ctx || !mapState.radius || !mapState.showLabels || !mapState.showStars) {
    return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(235, 244, 255, 0.85)';
  ctx.font = `${Math.max(11, mapState.radius * 0.045)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const limit = (mapState.radius - 16) ** 2;
  mapState.projectedStars.forEach(({ star, x, y }) => {
    const shouldLabel = LABELLED_STARS.has(star.name)
      || mapState.selectedStar?.name === star.name
      || mapState.hoveredStar?.name === star.name;
    if (!shouldLabel) {
      return;
    }
    if (typeof star.magnitude === 'number' && star.magnitude > mapState.magnitudeLimit) {
      return;
    }
    const dx = x - mapState.viewCenterX;
    const dy = y - mapState.viewCenterY;
    if (dx * dx + dy * dy > limit) {
      return;
    }
    ctx.fillText(star.name, x + 6, y - 6);
  });
  ctx.restore();
}
function renderStarMap() {
  if (!ctx || !canvas) {
    return;
  }
  ctx.setTransform(mapState.devicePixelRatio, 0, 0, mapState.devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateViewTransform();
  computeProjections();
  drawBackground();
  drawGraticule();
  drawHorizon();
  if (mapState.showMilkyWay) {
    drawMilkyWay();
  }
  if (mapState.showConstellations) {
    drawConstellations();
  }
  drawStars();
  drawStarLabels();
  if (mapState.activeConstellation) {
    drawConstellationLabel(mapState.activeConstellation);
  }
  if (mapState.previewConstellation
    && (!mapState.activeConstellation || mapState.previewConstellation.id !== mapState.activeConstellation.id)) {
    drawConstellationLabel(mapState.previewConstellation, { preview: true });
  }
}
function ensureContext() {
  if (ctx || !canvas) {
    return;
  }
  ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
}

function resizeCanvas() {
  if (!canvas || !canvasContainer) {
    return;
  }
  ensureContext();
  const rect = canvasContainer.getBoundingClientRect();
  const containerWidth = rect.width || 600;
  const viewportWidth = window.innerWidth || containerWidth;
  const viewportHeight = window.innerHeight || containerWidth;
  const fullscreenActive = document.fullscreenElement === canvasContainer || pseudoFullscreen;
  const fullscreenWidth = fullscreenActive ? viewportWidth : containerWidth;
  const fullscreenHeight = fullscreenActive ? viewportHeight : viewportHeight * 0.85;
  const maxSize = fullscreenActive ? Math.min(fullscreenWidth, fullscreenHeight) : Math.min(fullscreenWidth, fullscreenHeight, MAX_CANVAS_SIZE);
  const size = Math.max(420, maxSize);
  const devicePixelRatio = window.devicePixelRatio || 1;
  mapState.devicePixelRatio = devicePixelRatio;
  mapState.canvasSize = size;
  mapState.baseRadius = size / 2 - MAP_PADDING;
  mapState.centerX = size / 2;
  mapState.centerY = size / 2;
  updateViewTransform();
  canvas.width = Math.round(size * devicePixelRatio);
  canvas.height = Math.round(size * devicePixelRatio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  if (ctx) {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
}
function handleResize() {
  resizeCanvas();
  renderStarMap();
  updateTooltip(null);
}
const CONSTELLATION_LABELS = new Map();
CONSTELLATIONS.forEach((constellation) => {
  if (constellation.abbreviation) {
    CONSTELLATION_LABELS.set(constellation.abbreviation, constellation.name);
  }
  CONSTELLATION_LABELS.set(constellation.id, constellation.name);
});
function buildConstellationLegend() {
  if (!legendList) {
    return;
  }
  legendList.innerHTML = '';
  CONSTELLATIONS.forEach((constellation) => {
    const item = document.createElement('li');
    item.className = 'star-map__legend-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'star-map__legend-button';
    button.dataset.constellationId = constellation.id;
    button.innerHTML = `
      <span class="star-map__legend-badge">${constellation.abbreviation || constellation.id.toUpperCase()}</span>
      <span class="star-map__legend-label">${constellation.name}</span>
    `;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      toggleConstellation(constellation);
    });
    button.addEventListener('mouseenter', () => {
      previewConstellation(constellation);
    });
    button.addEventListener('mouseleave', () => {
      clearConstellationPreview(constellation);
    });
    button.addEventListener('focus', () => {
      previewConstellation(constellation);
    });
    button.addEventListener('blur', () => {
      clearConstellationPreview(constellation);
    });
    item.appendChild(button);
    legendList.appendChild(item);
  });
}

function updateLegendActive() {
  if (!legendList) {
    return;
  }
  const buttons = legendList.querySelectorAll('.star-map__legend-button');
  buttons.forEach((button) => {
    const id = button.dataset.constellationId;
    const isActive = mapState.activeConstellation?.id === id;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
function setRotation(hours) {
  mapState.rotationHours = normaliseHours(hours);
  if (rotationInput) {
    rotationInput.value = mapState.rotationHours.toFixed(2);
  }
  if (rotationValue) {
    const formatted = formatHours(mapState.rotationHours).replace('.', ',');
    rotationValue.textContent = formatted;
  }
  renderStarMap();
  updateDetails();
}

function updateMagnitudeControl() {
  if (magnitudeInput) {
    magnitudeInput.value = mapState.magnitudeLimit.toFixed(1);
  }
  if (magnitudeValue) {
    magnitudeValue.textContent = mapState.magnitudeLimit.toFixed(1);
  }
}

function setMagnitudeLimit(value) {
  const clamped = clamp(value, MIN_MAGNITUDE_LIMIT, MAX_MAGNITUDE_LIMIT);
  if (clamped === mapState.magnitudeLimit) {
    return;
  }
  mapState.magnitudeLimit = clamped;
  updateMagnitudeControl();
  mapState.hoveredStar = null;
  updateDetails();
  updateTooltip(null);
  renderStarMap();
}

function updateFieldOfViewControl() {
  if (fovInput) {
    fovInput.value = Math.round(mapState.fieldOfView).toString();
  }
  if (fovValue) {
    fovValue.textContent = `${Math.round(mapState.fieldOfView)}°`;
  }
}

function setFieldOfView(value, { animate = true } = {}) {
  const clamped = clamp(value, MIN_FIELD_OF_VIEW, MAX_FIELD_OF_VIEW);
  if (clamped === mapState.fieldOfView) {
    updateFieldOfViewControl();
    return;
  }
  mapState.fieldOfView = clamped;
  mapState.targetZoom = fieldOfViewToZoom(mapState.fieldOfView);
  updateFieldOfViewControl();
  if (!animate) {
    stopZoomAnimation();
    mapState.zoom = mapState.targetZoom;
    renderStarMap();
    return;
  }
  startZoomAnimation();
}

function updateVisibilityButton(button, active, hideLabel, showLabel) {
  if (!button) {
    return;
  }
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.classList.toggle('is-active', active);
  const label = active ? hideLabel : showLabel;
  button.textContent = label;
  button.setAttribute('title', label);
}

function updateVisibilityControls() {
  updateVisibilityButton(toggleStarsButton, mapState.showStars, '✨ Masquer les étoiles', '✨ Afficher les étoiles');
  updateVisibilityButton(toggleConstellationsButton, mapState.showConstellations, '🌌 Masquer les constellations', '🌌 Afficher les constellations');
  updateVisibilityButton(toggleLabelsButton, mapState.showLabels, '🔖 Masquer les noms', '🔖 Afficher les noms');
  if (constellationsToggle) {
    constellationsToggle.checked = mapState.showConstellations;
  }
}

function toggleStarsVisibility() {
  mapState.showStars = !mapState.showStars;
  if (!mapState.showStars) {
    mapState.hoveredStar = null;
    mapState.selectedStar = null;
    updateLegendActive();
    updateDetails();
    updateTooltip(null);
  }
  updateVisibilityControls();
  renderStarMap();
  updateCenterButtonLabel();
}

function toggleConstellationsVisibility() {
  mapState.showConstellations = !mapState.showConstellations;
  updateVisibilityControls();
  renderStarMap();
}

function toggleLabelsVisibility() {
  mapState.showLabels = !mapState.showLabels;
  updateVisibilityControls();
  renderStarMap();
}

function toggleConstellation(constellation) {
  if (!constellation) {
    return;
  }
  if (mapState.activeConstellation?.id === constellation.id) {
    mapState.activeConstellation = null;
  } else {
    mapState.activeConstellation = constellation;
  }
  mapState.previewConstellation = null;
  mapState.selectedStar = null;
  updateLegendActive();
  updateDetails();
  renderStarMap();
}

function selectStar(star) {
  if (!star) {
    return;
  }
  if (mapState.selectedStar?.name === star.name) {
    mapState.selectedStar = null;
  } else {
    mapState.selectedStar = star;
  }
  if (mapState.selectedStar) {
    mapState.activeConstellation = CONSTELLATIONS.find(
      (constellation) => constellation.abbreviation === star.constellation || constellation.name === star.constellation
    ) || mapState.activeConstellation;
  }
  mapState.previewConstellation = null;
  updateLegendActive();
  updateDetails();
  renderStarMap();
  updateCenterButtonLabel();
}

function clearSelection() {
  mapState.selectedStar = null;
  mapState.activeConstellation = null;
  mapState.previewConstellation = null;
  updateLegendActive();
  updateDetails();
  renderStarMap();
  updateCenterButtonLabel();
}

function previewConstellation(constellation) {
  if (!constellation || mapState.activeConstellation?.id === constellation.id) {
    return;
  }
  mapState.previewConstellation = constellation;
  updateDetails();
  renderStarMap();
}

function clearConstellationPreview(constellation, { skipRender = false, skipDetails = false } = {}) {
  if (!mapState.previewConstellation) {
    return;
  }
  if (constellation && mapState.previewConstellation.id !== constellation.id) {
    return;
  }
  mapState.previewConstellation = null;
  if (!skipDetails) {
    updateDetails();
  }
  if (!skipRender) {
    renderStarMap();
  }
}
function updateDetails() {
  if (!detailsPanel) {
    updateCenterButtonLabel();
    return;
  }
  if (mapState.selectedStar) {
    renderStarDetails(mapState.selectedStar, { locked: true });
  } else if (mapState.hoveredStar) {
    renderStarDetails(mapState.hoveredStar, { locked: false });
  } else if (mapState.activeConstellation) {
    renderConstellationDetails(mapState.activeConstellation);
  } else if (mapState.previewConstellation) {
    renderConstellationDetails(mapState.previewConstellation);
  } else {
    setDefaultDetails();
  }
  updateCenterButtonLabel();
}

function setDefaultDetails() {
  if (!detailsPanel) {
    return;
  }
  detailsPanel.innerHTML = `
    <h3 class="star-map__details-title">Fiche rapide</h3>
    <p>Survole une étoile brillante ou sélectionne une constellation pour obtenir des conseils d’observation.</p>
  `;
}

function renderStarDetails(star, { locked = false } = {}) {
  if (!detailsPanel || !star) {
    return;
  }
  const constellationName = CONSTELLATION_LABELS.get(star.constellation) || star.constellation;
  const heading = locked ? 'Étoile sélectionnée' : 'Étoile survolée';
  detailsPanel.innerHTML = `
    <h3 class="star-map__details-title">${heading}</h3>
    <p class="star-map__details-subtitle">${star.name} · ${star.designation} (${constellationName})</p>
    <dl class="star-map__facts">
      <div class="star-map__fact"><dt>Ascension droite</dt><dd>${formatRightAscension(star.rightAscension)}</dd></div>
      <div class="star-map__fact"><dt>Déclinaison</dt><dd>${formatDeclination(star.declination)}</dd></div>
      <div class="star-map__fact"><dt>Magnitude</dt><dd>${formatMagnitude(star.magnitude)}</dd></div>
      <div class="star-map__fact"><dt>Distance</dt><dd>${formatDistance(star.distance)}</dd></div>
      <div class="star-map__fact"><dt>Type spectral</dt><dd>${star.spectralType || '—'}</dd></div>
    </dl>
    <p class="star-map__details-text">${star.description}</p>
    <p class="star-map__details-tip">${star.observation}</p>
  `;
}

function updateCenterButtonLabel() {
  if (!centerButton) {
    return;
  }
  const target = mapState.selectedStar || mapState.hoveredStar;
  if (target) {
    centerButton.textContent = `🎯 Centrer ${target.name}`;
    centerButton.setAttribute('aria-label', `Centrer la carte sur ${target.name}`);
    centerButton.disabled = false;
  } else {
    centerButton.textContent = `🎯 Centrer ${DEFAULT_FOCUS_STAR}`;
    centerButton.setAttribute('aria-label', `Centrer la carte sur ${DEFAULT_FOCUS_STAR}`);
    centerButton.disabled = false;
  }
}

function renderConstellationDetails(constellation) {
  if (!detailsPanel || !constellation) {
    return;
  }
  const notable = Array.isArray(constellation.notableStars) && constellation.notableStars.length > 0
    ? constellation.notableStars.join(', ')
    : '—';
  const isActive = mapState.activeConstellation?.id === constellation.id;
  const heading = isActive ? 'Constellation sélectionnée' : 'Constellation à explorer';
  const abbreviation = (constellation.abbreviation || constellation.id || '').toUpperCase();
  detailsPanel.innerHTML = `
    <h3 class="star-map__details-title">${heading}</h3>
    <p class="star-map__details-subtitle">${constellation.name}${abbreviation ? ` (${abbreviation})` : ''}</p>
    <dl class="star-map__facts">
      <div class="star-map__fact"><dt>Saison idéale</dt><dd>${constellation.bestSeason}</dd></div>
      <div class="star-map__fact"><dt>Étoiles repères</dt><dd>${notable}</dd></div>
    </dl>
    <p class="star-map__details-text">${constellation.description}</p>
    <p class="star-map__details-tip">${constellation.observation}</p>
  `;
}
function updateTooltip(star, event) {
  if (!tooltip) {
    return;
  }
  if (!star) {
    tooltip.hidden = true;
    return;
  }
  tooltip.innerHTML = `
    <strong>${star.name}</strong>
    <span>${star.designation} · ${star.constellation}</span>
    <span>${formatRightAscension(star.rightAscension)} · ${formatDeclination(star.declination)} · mag ${formatMagnitude(star.magnitude)}</span>
  `;
  const rect = canvasContainer.getBoundingClientRect();
  const offsetX = event ? event.clientX - rect.left : mapState.centerX;
  const offsetY = event ? event.clientY - rect.top : mapState.centerY;
  const maxLeft = rect.width - 190;
  const maxTop = rect.height - 80;
  const clampedLeft = Math.min(maxLeft, Math.max(12, offsetX + 14));
  const clampedTop = Math.min(maxTop, Math.max(12, offsetY + 14));
  tooltip.style.left = `${clampedLeft}px`;
  tooltip.style.top = `${clampedTop}px`;
  tooltip.hidden = false;
}
function getRelativePosition(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (mapState.canvasSize / rect.width);
  const y = (event.clientY - rect.top) * (mapState.canvasSize / rect.height);
  return { x, y };
}

function findStarAtPosition(x, y) {
  if (!mapState.showStars) {
    return null;
  }
  let closest = null;
  let minDistance = Infinity;
  mapState.projectedStars.forEach(({ star, x: sx, y: sy }) => {
    if (typeof star.magnitude === 'number' && star.magnitude > mapState.magnitudeLimit) {
      return;
    }
    const dx = x - sx;
    const dy = y - sy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const threshold = Math.max(12, 6 + Math.max(1.2, 4.6 - (star.magnitude ?? 5) * 0.6));
    if (distance <= threshold && distance < minDistance) {
      closest = star;
      minDistance = distance;
    }
  });
  return closest;
}

function updateAutoRotateButton() {
  if (!autoRotateButton) {
    return;
  }
  autoRotateButton.setAttribute('aria-pressed', mapState.autoRotate ? 'true' : 'false');
  autoRotateButton.textContent = mapState.autoRotate ? '⏸️ Pause rotation' : '⟳ Rotation auto';
  autoRotateButton.setAttribute(
    'title',
    mapState.autoRotate ? 'Suspendre la rotation automatique' : 'Lancer la rotation automatique'
  );
  autoRotateButton.classList.toggle('is-active', mapState.autoRotate);
}

function autoRotateStep(timestamp) {
  if (!mapState.autoRotate) {
    mapState.autoRotateFrame = null;
    mapState.lastAutoRotateTime = null;
    return;
  }
  if (typeof mapState.lastAutoRotateTime === 'number') {
    const deltaSeconds = (timestamp - mapState.lastAutoRotateTime) / 1000;
    const deltaHours = deltaSeconds * AUTO_ROTATE_SPEED;
    if (deltaHours) {
      setRotation(mapState.rotationHours + deltaHours);
    }
  }
  mapState.lastAutoRotateTime = timestamp;
  mapState.autoRotateFrame = requestFrame(autoRotateStep);
}

function startAutoRotate() {
  if (mapState.autoRotate) {
    return;
  }
  mapState.autoRotate = true;
  mapState.lastAutoRotateTime = null;
  updateAutoRotateButton();
  mapState.autoRotateFrame = requestFrame(autoRotateStep);
}

function stopAutoRotate({ updateButton = true } = {}) {
  if (mapState.autoRotateFrame) {
    cancelFrame(mapState.autoRotateFrame);
  }
  mapState.autoRotateFrame = null;
  mapState.lastAutoRotateTime = null;
  const wasActive = mapState.autoRotate;
  mapState.autoRotate = false;
  if (updateButton || wasActive) {
    updateAutoRotateButton();
  }
}

function toggleAutoRotate() {
  if (mapState.autoRotate) {
    stopAutoRotate();
  } else {
    startAutoRotate();
  }
}

function focusOnStar(star) {
  if (!star) {
    return;
  }
  stopAutoRotate();
  stopPanInertia();
  mapState.hoveredStar = null;
  mapState.previewConstellation = null;
  mapState.selectedStar = star;
  const constellation = CONSTELLATIONS.find(
    (item) => item.abbreviation === star.constellation || item.name === star.constellation
  );
  if (constellation) {
    mapState.activeConstellation = constellation;
  }
  updateLegendActive();
  setRotation(star.rightAscension);
  const coords = projectCoordinates(star.rightAscension, star.declination);
  mapState.panX = -coords.px * mapState.zoom;
  mapState.panY = -coords.py * mapState.zoom;
  updateViewTransform();
  renderStarMap();
  updateCenterButtonLabel();
}

function handleCenterSelection() {
  const target = mapState.selectedStar
    || mapState.hoveredStar
    || STAR_CATALOG.find((star) => star.name === DEFAULT_FOCUS_STAR)
    || mapState.projectedStars[0]?.star;
  if (target) {
    focusOnStar(target);
  }
}

function handleDoubleClick(event) {
  if (!canvas) {
    return;
  }
  event.preventDefault();
  const { x, y } = getRelativePosition(event);
  const star = findStarAtPosition(x, y);
  if (star) {
    focusOnStar(star);
  }
}

function isFullscreenActive() {
  return document.fullscreenElement === canvasContainer || pseudoFullscreen;
}

function updateFullscreenButton() {
  if (!fullscreenButton) {
    return;
  }
  const fullscreen = isFullscreenActive();
  fullscreenButton.setAttribute('aria-pressed', fullscreen ? 'true' : 'false');
  fullscreenButton.textContent = fullscreen ? '⤺ Fermer le plein écran' : '⤢ Plein écran';
  fullscreenButton.setAttribute(
    'title',
    fullscreen ? 'Revenir à la taille normale' : 'Afficher la carte du ciel en plein écran'
  );
  fullscreenButton.classList.toggle('is-active', fullscreen);
}

function handleFullscreenToggle() {
  if (!canvasContainer) {
    return;
  }
  if (isFullscreenActive()) {
    exitFullscreen();
  } else {
    requestFullscreen();
  }
}

function handleFullscreenChange() {
  if (document.fullscreenElement === canvasContainer && pseudoFullscreen) {
    leavePseudoFullscreen();
  }
  updateFullscreenButton();
  resizeCanvas();
  renderStarMap();
}

function requestFullscreen() {
  if (!canvasContainer) {
    return;
  }
  const method =
    canvasContainer.requestFullscreen ||
    canvasContainer.webkitRequestFullscreen ||
    canvasContainer.msRequestFullscreen ||
    canvasContainer.mozRequestFullScreen;
  if (method) {
    try {
      const result = method.call(canvasContainer);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          enterPseudoFullscreen();
        });
      }
    } catch (error) {
      enterPseudoFullscreen();
    }
  } else {
    enterPseudoFullscreen();
  }
}

function exitFullscreen() {
  const exitMethod =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen ||
    document.mozCancelFullScreen;
  if (document.fullscreenElement === canvasContainer && exitMethod) {
    try {
      const result = exitMethod.call(document);
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          leavePseudoFullscreen();
        });
      }
    } catch (error) {
      leavePseudoFullscreen();
    }
  }
  if (pseudoFullscreen) {
    leavePseudoFullscreen();
  }
}

function enterPseudoFullscreen() {
  if (!canvasContainer || pseudoFullscreen) {
    return;
  }
  pseudoFullscreen = true;
  canvasContainer.classList.add('is-pseudo-fullscreen');
  document.body.classList.add('star-map--pseudo-fullscreen');
  updateFullscreenButton();
  resizeCanvas();
  renderStarMap();
}

function leavePseudoFullscreen() {
  if (!pseudoFullscreen) {
    return;
  }
  pseudoFullscreen = false;
  canvasContainer.classList.remove('is-pseudo-fullscreen');
  document.body.classList.remove('star-map--pseudo-fullscreen');
  updateFullscreenButton();
  resizeCanvas();
  renderStarMap();
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAutoRotate();
  }
}
function handlePointerDown(event) {
  if (!canvas) {
    return;
  }
  stopAutoRotate();
  stopPanInertia();
  clearConstellationPreview();
  pointerState.active = true;
  pointerState.pointerId = event.pointerId;
  pointerState.moved = false;
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  pointerState.velocityX = 0;
  pointerState.velocityY = 0;
  pointerState.lastTime = event.timeStamp || performance.now();
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!canvas) {
    return;
  }
  if (pointerState.active && event.pointerId === pointerState.pointerId) {
    const dx = event.clientX - pointerState.lastX;
    const dy = event.clientY - pointerState.lastY;
    mapState.panX += dx;
    mapState.panY += dy;
    const deltaXFromStart = event.clientX - pointerState.startX;
    const deltaYFromStart = event.clientY - pointerState.startY;
    if (!pointerState.moved && Math.hypot(deltaXFromStart, deltaYFromStart) > 4) {
      pointerState.moved = true;
      clearConstellationPreview(undefined, { skipRender: true, skipDetails: true });
      mapState.hoveredStar = null;
      updateTooltip(null);
    }
    const now = event.timeStamp || performance.now();
    const deltaTime = Math.max(16, now - pointerState.lastTime);
    pointerState.velocityX = dx / deltaTime;
    pointerState.velocityY = dy / deltaTime;
    pointerState.lastX = event.clientX;
    pointerState.lastY = event.clientY;
    pointerState.lastTime = now;
    renderStarMap();
  } else {
    const { x, y } = getRelativePosition(event);
    const hovered = findStarAtPosition(x, y);
    let previewCleared = false;
    if (hovered && mapState.previewConstellation) {
      clearConstellationPreview(undefined, { skipRender: true });
      previewCleared = true;
    }
    if (hovered?.name !== mapState.hoveredStar?.name) {
      mapState.hoveredStar = hovered || null;
      if (!mapState.selectedStar) {
        updateDetails();
      }
      renderStarMap();
      previewCleared = false;
      updateCenterButtonLabel();
    } else if (previewCleared) {
      renderStarMap();
    }
    updateTooltip(hovered, event);
  }
}

function handlePointerUp(event) {
  if (!canvas) {
    return;
  }
  if (pointerState.active && event.pointerId === pointerState.pointerId) {
    canvas.releasePointerCapture(event.pointerId);
    if (!pointerState.moved && mapState.hoveredStar) {
      selectStar(mapState.hoveredStar);
    } else {
      mapState.velocityX = pointerState.velocityX;
      mapState.velocityY = pointerState.velocityY;
      if (Math.abs(mapState.velocityX) > PAN_VELOCITY_THRESHOLD || Math.abs(mapState.velocityY) > PAN_VELOCITY_THRESHOLD) {
        startPanInertia();
      }
    }
    pointerState.active = false;
    pointerState.pointerId = null;
    pointerState.moved = false;
    pointerState.velocityX = 0;
    pointerState.velocityY = 0;
    updateCenterButtonLabel();
  }
}

function handlePointerLeave() {
  if (pointerState.active) {
    return;
  }
  mapState.hoveredStar = null;
  updateDetails();
  updateTooltip(null);
  renderStarMap();
}
function handleRotationInput(event) {
  const value = parseFloat(event.target.value);
  stopAutoRotate();
  setRotation(Number.isNaN(value) ? 0 : value);
}

function handleResetOrientation() {
  stopAutoRotate();
  stopPanInertia();
  mapState.panX = 0;
  mapState.panY = 0;
  updateViewTransform();
  setRotation(0);
  clearSelection();
}

function handleConstellationToggle(event) {
  mapState.showConstellations = Boolean(event.target.checked);
  updateVisibilityControls();
  renderStarMap();
}

function handleMilkyWayToggle(event) {
  mapState.showMilkyWay = Boolean(event.target.checked);
  renderStarMap();
}

function handleMagnitudeInput(event) {
  const value = parseFloat(event.target.value);
  setMagnitudeLimit(Number.isNaN(value) ? mapState.magnitudeLimit : value);
}

function handleFovInput(event) {
  const value = parseFloat(event.target.value);
  const clamped = Number.isNaN(value) ? mapState.fieldOfView : value;
  const animate = event.type !== 'input';
  setFieldOfView(clamped, { animate });
  if (animate) {
    renderStarMap();
  }
}

function handleGridToggle(event) {
  mapState.showGrid = Boolean(event.target.checked);
  renderStarMap();
}

function handleHorizonToggle(event) {
  mapState.showHorizon = Boolean(event.target.checked);
  renderStarMap();
}

function handleSessionTimeRecenter() {
  stopAutoRotate();
  stopPanInertia();
  mapState.panX = 0;
  mapState.panY = 0;
  updateViewTransform();
  const sidereal = computeLocalSiderealTime(new Date(), OBSERVER_LONGITUDE);
  setRotation(sidereal);
}

function handleWheel(event) {
  if (!canvas) {
    return;
  }
  event.preventDefault();
  stopAutoRotate();
  const delta = -event.deltaY || 0;
  if (!delta) {
    return;
  }
  const sensitivity = mapState.fieldOfView * 0.0025;
  setFieldOfView(mapState.fieldOfView - delta * sensitivity);
  renderStarMap();
}
function applyNightMode(enabled) {
  document.documentElement.classList.toggle('night-mode', enabled);
  if (nightModeToggle) {
    nightModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    nightModeToggle.classList.toggle('is-active', enabled);
    nightModeToggle.textContent = enabled ? '🌅 Mode jour' : '🔦 Mode nuit';
  }
}

function readNightModePreference() {
  let stored = null;
  try {
    stored = localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  if (stored === '1') {
    applyNightMode(true);
  } else if (stored === '0') {
    applyNightMode(false);
  } else {
    applyNightMode(false);
  }
}
function initialiseStarMap() {
  if (!canvas) {
    readNightModePreference();
    if (nightModeToggle) {
      nightModeToggle.addEventListener('click', () => {
        const enabled = !document.documentElement.classList.contains('night-mode');
        applyNightMode(enabled);
        try {
          localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
        } catch (error) {
          /* ignore */
        }
      });
    }
    return;
  }

  ensureContext();
  buildConstellationLegend();
  updateLegendActive();

  mapState.showConstellations = constellationsToggle ? Boolean(constellationsToggle.checked) : true;
  mapState.showMilkyWay = milkyWayToggle ? Boolean(milkyWayToggle.checked) : true;
  mapState.showGrid = gridToggle ? Boolean(gridToggle.checked) : true;
  mapState.showHorizon = horizonToggle ? Boolean(horizonToggle.checked) : true;

  if (magnitudeInput) {
    const initialMagnitude = parseFloat(magnitudeInput.value);
    if (!Number.isNaN(initialMagnitude)) {
      mapState.magnitudeLimit = clamp(initialMagnitude, MIN_MAGNITUDE_LIMIT, MAX_MAGNITUDE_LIMIT);
    }
  }
  updateMagnitudeControl();

  if (fovInput) {
    const initialFov = parseFloat(fovInput.value);
    if (!Number.isNaN(initialFov)) {
      mapState.fieldOfView = clamp(initialFov, MIN_FIELD_OF_VIEW, MAX_FIELD_OF_VIEW);
    }
  }
  mapState.targetZoom = fieldOfViewToZoom(mapState.fieldOfView);
  mapState.zoom = mapState.targetZoom;
  updateFieldOfViewControl();
  updateVisibilityControls();

  setDefaultDetails();
  resizeCanvas();
  const initialSidereal = computeLocalSiderealTime(new Date(), OBSERVER_LONGITUDE);
  setRotation(initialSidereal);

  readNightModePreference();
  if (nightModeToggle) {
    nightModeToggle.addEventListener('click', () => {
      const enabled = !document.documentElement.classList.contains('night-mode');
      applyNightMode(enabled);
      try {
        localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
      } catch (error) {
        /* ignore */
      }
    });
  }

  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (pseudoFullscreen || document.fullscreenElement === canvasContainer) {
        exitFullscreen();
      } else {
        clearSelection();
      }
    }
  });

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('dblclick', handleDoubleClick);
  canvas.addEventListener('wheel', handleWheel, { passive: false });

  if (rotationInput) {
    rotationInput.addEventListener('input', handleRotationInput);
    rotationInput.addEventListener('change', handleRotationInput);
  }
  if (resetButton) {
    resetButton.addEventListener('click', handleResetOrientation);
  }
  if (constellationsToggle) {
    constellationsToggle.addEventListener('change', handleConstellationToggle);
  }
  if (milkyWayToggle) {
    milkyWayToggle.addEventListener('change', handleMilkyWayToggle);
  }
  if (gridToggle) {
    gridToggle.addEventListener('change', handleGridToggle);
  }
  if (horizonToggle) {
    horizonToggle.addEventListener('change', handleHorizonToggle);
  }
  if (magnitudeInput) {
    magnitudeInput.addEventListener('input', handleMagnitudeInput);
    magnitudeInput.addEventListener('change', handleMagnitudeInput);
  }
  if (fovInput) {
    fovInput.addEventListener('input', handleFovInput);
    fovInput.addEventListener('change', handleFovInput);
  }
  if (toggleStarsButton) {
    toggleStarsButton.addEventListener('click', toggleStarsVisibility);
  }
  if (toggleConstellationsButton) {
    toggleConstellationsButton.addEventListener('click', toggleConstellationsVisibility);
  }
  if (toggleLabelsButton) {
    toggleLabelsButton.addEventListener('click', toggleLabelsVisibility);
  }
  if (autoRotateButton) {
    autoRotateButton.addEventListener('click', toggleAutoRotate);
    updateAutoRotateButton();
  }
  if (centerButton) {
    centerButton.addEventListener('click', handleCenterSelection);
    centerButton.setAttribute('title', 'Aligner la carte sur l’étoile suivie');
    updateCenterButtonLabel();
  }
  if (sessionTimeButton) {
    sessionTimeButton.addEventListener('click', handleSessionTimeRecenter);
    sessionTimeButton.setAttribute('title', 'Recentrer sur l’heure sidérale locale');
  }
  if (fullscreenButton) {
    fullscreenButton.addEventListener('click', handleFullscreenToggle);
    updateFullscreenButton();
  }
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((eventName) => {
    document.addEventListener(eventName, handleFullscreenChange);
  });
  ['fullscreenerror', 'webkitfullscreenerror', 'mozfullscreenerror', 'MSFullscreenError'].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      if (!pseudoFullscreen) {
        enterPseudoFullscreen();
      }
    });
  });
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

initialiseStarMap();
