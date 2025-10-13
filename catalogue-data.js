const DEFAULT_CATALOGUE_SOURCES = {
  caldwell: {
    catalogueId: 'caldwell',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/caldwell.json',
    format: 'openngc-subset',
    description: 'OpenNGC — Caldwell subset (Mattia Verga)',
    license: 'CC BY-SA 4.0'
  },
  ngc: {
    catalogueId: 'ngc',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/openngc.json',
    format: 'openngc',
    cacheKey: 'openngc-master',
    description: 'OpenNGC — Master catalogue (Mattia Verga)',
    license: 'CC BY-SA 4.0'
  },
  ic: {
    catalogueId: 'ic',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/openngc.json',
    format: 'openngc',
    cacheKey: 'openngc-master',
    description: 'OpenNGC — Master catalogue (Mattia Verga)',
    license: 'CC BY-SA 4.0'
  },
  sharpless: {
    catalogueId: 'sharpless',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/sharpless.json',
    format: 'openngc-subset',
    description: 'OpenNGC — Sharpless HII regions',
    license: 'CC BY-SA 4.0'
  },
  ldn: {
    catalogueId: 'ldn',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/ldn.json',
    format: 'openngc-subset',
    description: 'OpenNGC — Lynds Dark Nebulae',
    license: 'CC BY-SA 4.0'
  },
  vdb: {
    catalogueId: 'vdb',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/vdb.json',
    format: 'openngc-subset',
    description: 'OpenNGC — van den Bergh reflection nebulae',
    license: 'CC BY-SA 4.0'
  },
  gaia: {
    catalogueId: 'gaia',
    url: 'https://cdn.jsdelivr.net/gh/astronexus/stellarium-catalogs@master/catalog-gaia-bright.json',
    format: 'gaia-bright',
    description: 'Gaia DR3 bright stars (Astronexus curated subset)',
    license: 'ESA Gaia DR3, CC BY-SA 4.0'
  },
  ugc: {
    catalogueId: 'ugc',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/openngc.json',
    format: 'openngc',
    cacheKey: 'openngc-master',
    description: 'OpenNGC — Master catalogue (Mattia Verga)',
    license: 'CC BY-SA 4.0'
  },
  arp: {
    catalogueId: 'arp',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/openngc.json',
    format: 'openngc',
    cacheKey: 'openngc-master',
    description: 'OpenNGC — Master catalogue (Mattia Verga)',
    license: 'CC BY-SA 4.0'
  },
  pgc: {
    catalogueId: 'pgc',
    url: 'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/data/openngc.json',
    format: 'openngc',
    cacheKey: 'openngc-master',
    description: 'OpenNGC — Master catalogue (Mattia Verga)',
    license: 'CC BY-SA 4.0'
  }
};

const payloadCache = new Map();
const objectsCache = new Map();

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

export function normalizeCatalogueEntry(entry = {}) {
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

export function normalizeObjectEntry(entry = {}, fallbackCatalogueId = null) {
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

function parseCatalogueSourceOverrides(overrides = []) {
  const map = new Map();
  overrides
    .filter((entry) => entry && entry.catalogueId)
    .forEach((entry) => {
      const id = entry.catalogueId;
      const base = DEFAULT_CATALOGUE_SOURCES[id] || { catalogueId: id };
      map.set(id, {
        ...base,
        ...entry,
        catalogueId: id,
        format: entry.format || base?.format || 'astro'
      });
    });
  return map;
}

export function parseCataloguePayload(payload) {
  let catalogues = [];
  let objects = [];
  if (Array.isArray(payload)) {
    objects = payload.map((entry) => normalizeObjectEntry(entry));
  } else {
    const rawCatalogues = Array.isArray(payload?.catalogues) ? payload.catalogues : [];
    catalogues = rawCatalogues.map((entry) => normalizeCatalogueEntry(entry));
    const fallbackCatalogueId = catalogues.find((item) => item.defaultSelected)?.id || catalogues[0]?.id || null;
    const rawObjects = Array.isArray(payload?.objects) ? payload.objects : [];
    objects = rawObjects.map((entry) => normalizeObjectEntry(entry, fallbackCatalogueId));
  }
  if (catalogues.length === 0) {
    const fallback = normalizeCatalogueEntry({
      id: 'primary',
      name: 'Catalogue principal',
      abbreviation: 'CAT',
      observationWeights: { visual: 1, astrophoto: 1, research: 1 },
      defaultSelected: true
    });
    catalogues = [fallback];
    objects = objects.map((entry) => normalizeObjectEntry(entry, fallback.id));
  }
  const overrides = Array.isArray(payload?.sources) ? payload.sources : [];
  const overrideMap = parseCatalogueSourceOverrides(overrides);
  const mergedSources = new Map();
  Object.keys(DEFAULT_CATALOGUE_SOURCES).forEach((id) => {
    mergedSources.set(id, { ...DEFAULT_CATALOGUE_SOURCES[id] });
  });
  overrideMap.forEach((value, key) => {
    mergedSources.set(key, value);
  });
  return { catalogues, objects, sources: mergedSources };
}

function resolveSourceConfig(catalogueId, sources = new Map()) {
  if (sources && sources.has(catalogueId)) {
    return sources.get(catalogueId);
  }
  return DEFAULT_CATALOGUE_SOURCES[catalogueId] || null;
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRightAscension(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    if (value > 24) {
      return value / 15;
    }
    if (value < 0) {
      const wrapped = ((value % 24) + 24) % 24;
      return wrapped;
    }
    return value;
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/°/.test(text)) {
    const degrees = parseNumber(text);
    return Number.isFinite(degrees) ? degrees / 15 : null;
  }
  const parts = text
    .replace(/[hms]/gi, ' ')
    .replace(/[^0-9.\-\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => Number(part.replace(',', '.')))
    .filter((part) => Number.isFinite(part));
  if (parts.length === 0) {
    const numeric = parseNumber(text);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 24 ? numeric / 15 : numeric;
  }
  const [hours = 0, minutes = 0, seconds = 0] = parts;
  const total = Math.abs(hours) + minutes / 60 + seconds / 3600;
  return total;
}

function parseDeclination(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const sign = text.startsWith('-') ? -1 : 1;
  const normalized = text.replace(/[°′'"dms]/gi, ' ');
  const parts = normalized
    .replace(/[^0-9.\-\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => Number(part.replace(',', '.')))
    .filter((part) => Number.isFinite(part));
  if (parts.length === 0) {
    const numeric = parseNumber(text);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const [deg = 0, minutes = 0, seconds = 0] = parts;
  const total = Math.abs(deg) + minutes / 60 + seconds / 3600;
  return sign * total;
}

const CONSTELLATION_MAP = {
  And: 'Andromède',
  Ant: 'Machine pneumatique',
  Aps: 'Oiseau de paradis',
  Aql: 'Aigle',
  Aqr: 'Verseau',
  Ara: 'Autel',
  Ari: 'Bélier',
  Aur: 'Cocher',
  Boo: 'Bouvier',
  Cae: 'Burins',
  Cam: 'Girafe',
  Cnc: 'Cancer',
  CVn: 'Chiens de chasse',
  CMa: 'Grand Chien',
  CMi: 'Petit Chien',
  Cap: 'Capricorne',
  Car: 'Carène',
  Cas: 'Cassiopée',
  Cen: 'Centaure',
  Cep: 'Céphée',
  Cet: 'Baleine',
  Cha: 'Caméléon',
  Cir: 'Compas',
  Col: 'Colombe',
  Com: 'Chevelure de Bérénice',
  CrA: 'Couronne australe',
  CrB: 'Couronne boréale',
  Crv: 'Corbeau',
  Crt: 'Coupe',
  Cru: 'Croix du Sud',
  Cyg: 'Cygne',
  Del: 'Dauphin',
  Dor: 'Dorade',
  Dra: 'Dragon',
  Equ: 'Petit Cheval',
  Eri: 'Éridan',
  For: 'Fourneau',
  Gem: 'Gémeaux',
  Gru: 'Grue',
  Her: 'Hercule',
  Hor: 'Horloge',
  Hya: 'Hydre femelle',
  Hyi: 'Hydre mâle',
  Ind: 'Indien',
  Lac: 'Lézard',
  Leo: 'Lion',
  LMi: 'Petit Lion',
  Lep: 'Lièvre',
  Lib: 'Balance',
  Lup: 'Loup',
  Lyn: 'Lynx',
  Lyr: 'Lyre',
  Men: 'Table',
  Mic: 'Microscope',
  Mon: 'Licorne',
  Mus: 'Mouche',
  Nor: 'Règle',
  Oct: 'Octant',
  Oph: 'Ophiuchus',
  Ori: 'Orion',
  Pav: 'Paon',
  Peg: 'Pégase',
  Per: 'Persée',
  Phe: 'Phénix',
  Pic: 'Peintre',
  Psc: 'Poissons',
  PsA: 'Poisson austral',
  Pup: 'Poupe',
  Pyx: 'Boussole',
  Ret: 'Réticule',
  Sge: 'Flèche',
  Sgr: 'Sagittaire',
  Sco: 'Scorpion',
  Scl: 'Sculpteur',
  Sct: 'Écu de Sobieski',
  Ser: 'Serpent',
  Sex: 'Sextant',
  Tau: 'Taureau',
  Tel: 'Télescope',
  TrA: 'Triangle austral',
  Tri: 'Triangle',
  Tuc: 'Toucan',
  UMa: 'Grande Ourse',
  UMi: 'Petite Ourse',
  Vel: 'Voiles',
  Vir: 'Vierge',
  Vol: 'Poisson volant',
  Vul: 'Petit Renard'
};

function translateConstellation(code) {
  if (!code) return 'Constellation inconnue';
  const key = String(code).trim();
  if (CONSTELLATION_MAP[key]) {
    return CONSTELLATION_MAP[key];
  }
  const upper = key.toUpperCase();
  const match = Object.entries(CONSTELLATION_MAP).find(([abbr]) => abbr.toUpperCase() === upper);
  if (match) return match[1];
  return key;
}

const OPENNGC_TYPE_MAP = {
  Gx: 'Galaxie',
  'Gx+Gx': 'Galaxies en interaction',
  OC: 'Amas ouvert',
  GC: 'Amas globulaire',
  PN: 'Nébuleuse planétaire',
  DN: 'Nébuleuse obscure',
  BN: 'Nébuleuse diffuse',
  EN: 'Nébuleuse en émission',
  RN: 'Nébuleuse par réflexion',
  SNR: 'Reste de supernova',
  HII: 'Région H II',
  Neb: 'Nébuleuse',
  'Cl+N': 'Amas avec nébuleuse',
  As: 'Astérisme',
  Ast: 'Astérisme',
  Dup: 'Étoiles doubles',
  Mul: 'Étoiles multiples',
  Mlt: 'Étoiles multiples',
  QSO: 'Quasar',
  GCl: 'Amas de galaxies',
  'PN+B': 'Nébuleuse planétaire',
  'HII+RN': 'Nébuleuse en émission',
  'HII+BN': 'Nébuleuse en émission',
  'RN+BN': 'Nébuleuse',
  Pl: 'Planète',
  SS: 'Système stellaire'
};

function translateOpenNgcType(code) {
  if (!code) return 'Objet céleste';
  const clean = String(code).trim();
  if (OPENNGC_TYPE_MAP[clean]) {
    return OPENNGC_TYPE_MAP[clean];
  }
  const upper = clean.toUpperCase();
  const match = Object.entries(OPENNGC_TYPE_MAP).find(([abbr]) => abbr.toUpperCase() === upper);
  if (match) return match[1];
  if (/gal/i.test(clean)) return 'Galaxie';
  if (/neb/i.test(clean)) return 'Nébuleuse';
  if (/cluster/i.test(clean) || /amas/i.test(clean)) return 'Amas stellaire';
  if (/star/i.test(clean)) return 'Étoile';
  return clean;
}

function estimateBestMonths(raHours) {
  if (!Number.isFinite(raHours)) return [];
  const rawMonth = ((raHours - 12) / 2) + 3;
  let month = Math.round(rawMonth);
  while (month < 1) month += 12;
  while (month > 12) month -= 12;
  const window = [];
  for (let offset = -1; offset <= 2; offset += 1) {
    let value = month + offset;
    while (value < 1) value += 12;
    while (value > 12) value -= 12;
    if (!window.includes(value)) {
      window.push(value);
    }
  }
  return window;
}

function estimateMinimumBortle(magnitude, typeLabel = '') {
  if (!Number.isFinite(magnitude)) return 5;
  let min = magnitude <= 5 ? 8 : magnitude <= 7 ? 6 : magnitude <= 9 ? 5 : magnitude <= 11 ? 4 : 3;
  const type = typeLabel.toLowerCase();
  if (type.includes('galaxie') && min > 4) {
    min -= 1;
  }
  if (type.includes('nébuleuse') && min > 4) {
    min -= 1;
  }
  return Math.max(2, Math.min(9, min));
}

function buildDescription({ typeLabel, constellationName, magnitude }) {
  const parts = [];
  if (typeLabel && constellationName) {
    parts.push(`${typeLabel} située dans la constellation de ${constellationName}.`);
  } else if (constellationName) {
    parts.push(`Objet localisé dans la constellation de ${constellationName}.`);
  } else if (typeLabel) {
    parts.push(`${typeLabel} répertorié dans ce catalogue.`);
  }
  if (Number.isFinite(magnitude)) {
    parts.push(`Magnitude ${magnitude.toFixed(1)} (donnée catalogue).`);
  }
  parts.push('Données consolidées depuis le catalogue OpenNGC.');
  return parts.join(' ');
}

function parseAngularSize(entry) {
  const major = parseNumber(entry.major ?? entry.majorAxis ?? entry.majAxis ?? entry.diamMajor ?? entry.diameter);
  const minor = parseNumber(entry.minor ?? entry.minorAxis ?? entry.minAxis ?? entry.diamMinor ?? entry.diameterMinor);
  if (Number.isFinite(major) && Number.isFinite(minor)) {
    return (major + minor) / 2;
  }
  if (Number.isFinite(major)) {
    return major;
  }
  const sizeString = entry.size || entry.diameter || entry.dim || '';
  if (typeof sizeString === 'string') {
    const matches = sizeString.split(/[x×]/i).map((part) => parseNumber(part)).filter((value) => Number.isFinite(value));
    if (matches.length === 1) return matches[0];
    if (matches.length >= 2) {
      return (matches[0] + matches[1]) / 2;
    }
  }
  return null;
}

function extractCatalogueTokens(entry) {
  const tokens = [];
  const fields = [
    'name',
    'id',
    'ids',
    'identifiers',
    'other',
    'catalog',
    'catalogs',
    'designations',
    'altNames',
    'alt_names',
    'aliases',
    'm',
    'messier',
    'ngc',
    'ic',
    'c',
    'caldwell',
    'ugc',
    'pgc',
    'arp',
    'vdb',
    'ldn',
    'sh2',
    'sh'
  ];
  fields.forEach((field) => {
    const value = entry[field] ?? entry[field?.toUpperCase?.()] ?? entry[field?.toLowerCase?.()];
    if (!value) return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => tokens.push(String(item)));
    } else if (typeof value === 'string') {
      value
        .split(/[;,|]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => tokens.push(item));
    } else if (Number.isFinite(value)) {
      tokens.push(String(value));
    }
  });
  return tokens;
}

function extractPrimaryDesignation(entry, catalogueId) {
  const tokens = extractCatalogueTokens(entry);
  switch (catalogueId) {
    case 'ngc':
      return tokens.find((token) => /^NGC\s*\d+/i.test(token)) || entry.name || entry.NGC || entry.ngc || null;
    case 'ic':
      return tokens.find((token) => /^IC\s*\d+/i.test(token)) || entry.name || entry.IC || entry.ic || null;
    case 'caldwell':
      return tokens.find((token) => /^C\s*\d+/i.test(token)) || entry.C || entry.caldwell || null;
    case 'ugc':
      return tokens.find((token) => /^UGC\s*\d+/i.test(token)) || entry.UGC || entry.ugc || null;
    case 'arp':
      return tokens.find((token) => /^ARP\s*\d+/i.test(token)) || entry.ARP || entry.arp || null;
    case 'pgc':
      return tokens.find((token) => /^PGC\s*\d+/i.test(token)) || entry.PGC || entry.pgc || null;
    case 'sharpless':
      return tokens.find((token) => /^SH2?[-\s]*\d+/i.test(token)) || entry.SH || entry.sh || null;
    case 'ldn':
      return tokens.find((token) => /^LDN\s*\d+/i.test(token)) || entry.LDN || entry.ldn || null;
    case 'vdb':
      return tokens.find((token) => /^VDB\s*\d+/i.test(token)) || entry.VDB || entry.vdb || null;
    default:
      return entry.name || null;
  }
}

function extractCatalogueRefs(entry, primaryCatalogueId) {
  const tokens = extractCatalogueTokens(entry);
  const ids = new Set([primaryCatalogueId]);
  tokens.forEach((token) => {
    if (/^M\s*\d+/i.test(token)) ids.add('messier');
    if (/^NGC\s*\d+/i.test(token)) ids.add('ngc');
    if (/^IC\s*\d+/i.test(token)) ids.add('ic');
    if (/^C\s*\d+/i.test(token)) ids.add('caldwell');
    if (/^UGC\s*\d+/i.test(token)) ids.add('ugc');
    if (/^PGC\s*\d+/i.test(token)) ids.add('pgc');
    if (/^ARP\s*\d+/i.test(token)) ids.add('arp');
    if (/^SH2?[-\s]*\d+/i.test(token)) ids.add('sharpless');
    if (/^LDN\s*\d+/i.test(token)) ids.add('ldn');
    if (/^VDB\s*\d+/i.test(token)) ids.add('vdb');
  });
  return Array.from(ids);
}

function normaliseName(designation, entry) {
  const baseName = entry.commonName || entry.common_name || entry.traditionalName || entry.traditional_name;
  if (baseName) {
    const clean = String(baseName).trim();
    if (designation) {
      return `${designation} — ${clean}`;
    }
    return clean;
  }
  const listedName = entry.name || entry.object || entry.title;
  if (listedName) {
    const clean = String(listedName).trim();
    if (designation && !/^NGC|^IC|^PGC|^UGC|^C\s/i.test(clean)) {
      return `${designation} — ${clean}`;
    }
    return clean;
  }
  return designation || 'Objet catalogue';
}

function transformOpenNgcEntry(entry, catalogueId) {
  const raHours = parseRightAscension(entry.ra ?? entry.RA ?? entry.raJ2000 ?? entry.RAJ2000);
  const decDeg = parseDeclination(entry.dec ?? entry.DEC ?? entry.decJ2000 ?? entry.DEJ2000);
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) {
    return null;
  }
  const designation = extractPrimaryDesignation(entry, catalogueId);
  const typeLabel = translateOpenNgcType(entry.type || entry.objtype || entry.objectType);
  const magnitude = parseNumber(entry.mag ?? entry.vmag ?? entry.vmagnitude ?? entry.bmag ?? entry.phot_g_mean_mag);
  const constellationName = translateConstellation(entry.const ?? entry.constellation ?? entry.constellation_code);
  const angularSize = parseAngularSize(entry);
  const surfaceBrightness = parseNumber(entry.surfaceBrightness ?? entry.surfbr ?? entry.surfBr);
  const refs = extractCatalogueRefs(entry, catalogueId);
  const bestMonths = estimateBestMonths(raHours);
  const minBortle = estimateMinimumBortle(magnitude, typeLabel);
  const name = normaliseName(designation, entry);
  const description = buildDescription({ typeLabel, constellationName, magnitude });
  const numberMatch = designation ? designation.match(/(\d+)/) : null;
  const number = numberMatch ? Number(numberMatch[1]) : null;
  return {
    designation: designation || name,
    name,
    type: typeLabel,
    constellation: constellationName,
    raHours,
    decDeg,
    magnitude: Number.isFinite(magnitude) ? magnitude : null,
    bestMonths,
    minBortle,
    description,
    primaryCatalogueId: catalogueId,
    catalogueRefs: refs,
    angularSizeArcmin: angularSize,
    surfaceBrightness,
    number: Number.isFinite(number) ? number : null
  };
}

function filterOpenNgcEntry(entry, catalogueId) {
  const tokens = extractCatalogueTokens(entry).map((token) => token.toUpperCase());
  switch (catalogueId) {
    case 'ngc':
      return tokens.some((token) => token.startsWith('NGC'));
    case 'ic':
      return tokens.some((token) => token.startsWith('IC'));
    case 'caldwell':
      return tokens.some((token) => token.startsWith('C'));
    case 'ugc':
      return tokens.some((token) => token.startsWith('UGC'));
    case 'pgc':
      return tokens.some((token) => token.startsWith('PGC'));
    case 'arp':
      return tokens.some((token) => token.startsWith('ARP'));
    case 'sharpless':
      return tokens.some((token) => token.startsWith('SH'));
    case 'ldn':
      return tokens.some((token) => token.startsWith('LDN'));
    case 'vdb':
      return tokens.some((token) => token.startsWith('VDB'));
    default:
      return true;
  }
}

function transformGaiaEntry(entry) {
  const raHours = parseRightAscension(entry.ra ?? entry.RA ?? entry.ra_deg ?? entry.raJ2000);
  const decDeg = parseDeclination(entry.dec ?? entry.DEC ?? entry.dec_deg ?? entry.decJ2000);
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) {
    return null;
  }
  const magnitude = parseNumber(entry.phot_g_mean_mag ?? entry.g_mag ?? entry.mag);
  if (Number.isFinite(magnitude) && magnitude > 7.5) {
    return null;
  }
  const designation = entry.designation || entry.name || (entry.source_id ? `Gaia DR3 ${entry.source_id}` : null);
  const constellationName = translateConstellation(entry.constellation || entry.constellation_code || entry.const);
  const bestMonths = estimateBestMonths(raHours);
  const minBortle = Number.isFinite(magnitude) ? (magnitude <= 3 ? 9 : magnitude <= 5 ? 8 : 7) : 7;
  const spectral = entry.spectral_type || entry.sptype || entry.spectralType;
  const typeLabel = spectral ? `Étoile ${spectral}` : 'Étoile';
  const descriptionParts = [`Étoile référencée par Gaia DR3.`];
  if (spectral) descriptionParts.push(`Type spectral ${spectral}.`);
  if (Number.isFinite(magnitude)) descriptionParts.push(`Magnitude ${magnitude.toFixed(1)}.`);
  const description = descriptionParts.join(' ');
  return {
    designation: designation || 'Gaia DR3',
    name: designation || 'Étoile Gaia DR3',
    type: typeLabel,
    constellation: constellationName,
    raHours,
    decDeg,
    magnitude: Number.isFinite(magnitude) ? magnitude : null,
    bestMonths,
    minBortle,
    description,
    primaryCatalogueId: 'gaia',
    catalogueRefs: ['gaia']
  };
}

async function fetchSourcePayload(config) {
  const key = config.cacheKey || config.url;
  if (payloadCache.has(key)) {
    const cached = payloadCache.get(key);
    if (cached instanceof Promise) {
      return cached;
    }
    return cached;
  }
  const request = (async () => {
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`Impossible de télécharger le catalogue ${config.catalogueId || ''} (${config.url}).`);
    }
    if (config.responseType === 'text' || config.format === 'csv') {
      const text = await response.text();
      return text;
    }
    return response.json();
  })();
  payloadCache.set(key, request);
  try {
    const data = await request;
    payloadCache.set(key, data);
    return data;
  } catch (error) {
    payloadCache.delete(key);
    throw error;
  }
}

function ensureArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.objects)) return payload.objects;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normaliseEntries(list, catalogueId) {
  return list
    .map((entry) => transformOpenNgcEntry(entry, catalogueId))
    .filter((value) => value !== null)
    .map((entry) => normalizeObjectEntry(entry, catalogueId));
}

export async function fetchCatalogueObjectsFromSource(catalogueId, sources = new Map()) {
  const config = resolveSourceConfig(catalogueId, sources);
  if (!config || !config.url) {
    return [];
  }
  const cacheKey = `objects:${catalogueId}`;
  if (objectsCache.has(cacheKey)) {
    const cached = objectsCache.get(cacheKey);
    if (cached instanceof Promise) {
      const resolved = await cached;
      return resolved.map((item) => ({ ...item }));
    }
    return cached.map((item) => ({ ...item }));
  }
  const promise = (async () => {
    const raw = await fetchSourcePayload(config);
    let entries = [];
    if (config.format === 'gaia-bright') {
      entries = ensureArray(raw)
        .map((entry) => transformGaiaEntry(entry))
        .filter((value) => value !== null)
        .map((entry) => normalizeObjectEntry(entry, 'gaia'));
      if (config.limit && entries.length > config.limit) {
        entries = entries
          .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99))
          .slice(0, config.limit);
      }
      return entries;
    }
    const list = ensureArray(raw);
    const mapped = list
      .filter((entry) => filterOpenNgcEntry(entry, catalogueId))
      .map((entry) => transformOpenNgcEntry(entry, catalogueId))
      .filter((value) => value !== null)
      .map((entry) => normalizeObjectEntry(entry, catalogueId));
    return mapped;
  })();
  objectsCache.set(cacheKey, promise);
  try {
    const resolved = await promise;
    objectsCache.set(cacheKey, resolved);
    return resolved.map((item) => ({ ...item }));
  } catch (error) {
    objectsCache.delete(cacheKey);
    throw error;
  }
}

export function getCatalogueSourceSummary(catalogueId, sources = new Map()) {
  const config = resolveSourceConfig(catalogueId, sources);
  if (!config) return null;
  return {
    catalogueId,
    url: config.url,
    description: config.description || '',
    license: config.license || ''
  };
}

export function listDefaultCatalogueSources() {
  return Object.values(DEFAULT_CATALOGUE_SOURCES).map((entry) => ({ ...entry }));
}

