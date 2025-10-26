export const APP_VERSION = '2024.11.0';

export const DEFAULT_LANGUAGE = 'fr';
export const SUPPORTED_LANGUAGES = ['fr', 'en'];
export const LANGUAGE_LABELS = {
  fr: 'FR',
  en: 'EN'
};

export const ALTITUDE_THRESHOLDS = {
  horizon: -5,
  low: 15,
  medium: 35,
  optimal: 55
};

export const COLOR_PALETTE = {
  lightBackground: '#050a18',
  lightSurface: '#121d3e',
  lightAccent: '#82b7ff',
  darkBackground: '#160606',
  darkSurface: '#35101b',
  darkAccent: '#ff9a8b'
};

export const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/catalogue.html',
  '/catalogue-detail.html',
  '/catalogue-settings.html',
  '/score-settings.html',
  '/mes-equipements.html',
  '/mes-listes.html',
  '/star-map.html',
  '/manifest.webmanifest',
  '/dist/page-loader.js',
  '/dist/styles.css',
  '/assets/icon.svg',
  '/objects.json'
];

export const STATIC_DATA_ENDPOINTS = ['objects.json', 'data/caldwell-catalogue.json'];

export const STORAGE_KEYS = {
  language: 'astroSoir:language',
  offlineLists: 'astroSoir:offlineLists'
};

export const OBSERVATION_LIMITS = {
  maxTargets: 8,
  scenarioCount: 5
};

export const FONT_STACK = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";
